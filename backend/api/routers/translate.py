"""翻译API路由模块

提供视频字幕翻译、单行翻译等功能，支持动态AI提供商配置。
已修复依赖注入问题，支持前端界面配置的自定义提供商。
"""

import asyncio
import logging
import os
import re
import uuid
import json
from typing import Optional, Dict, List, Any
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    WebSocket,
)
from pydantic import BaseModel, Field, ValidationError

from backend.schemas.api import APIResponse
from backend.schemas.task import (
    TranslationConfig,
    TranslationStyle,
)
from backend.schemas.config import SystemConfig, AIProviderType
from backend.core.subtitle_translator import SubtitleTranslator
from backend.services.utils import SRTOptimizer
from backend.services.video_storage import VideoStorageService
from backend.api.websocket import manager  # 导入WebSocket管理器

# 配置日志
logger = logging.getLogger("aniversegateway.api.translate")

# 全局任务管理器：存储正在运行的翻译任务
# 格式为: { "task_id": asyncio.Task }
running_tasks: Dict[str, asyncio.Task] = {}

# 创建独立路由器
router = APIRouter()

# 创建额外的路由器用于 /api/translation 前缀（兼容旧的前端调用）
translation_router = APIRouter()


# 导入标准依赖
from backend.api.dependencies import (
    get_system_config,
    get_video_storage,
    get_subtitle_extractor,
)
from backend.core.subtitle_extractor import SubtitleExtractor


def parse_original_subtitles(source_path: str) -> List[Dict[str, Any]]:
    """解析原始字幕文件

    Args:
        source_path: 源字幕文件路径

    Returns:
        List[Dict[str, Any]]: 解析后的原始字幕列表
    """
    original_subtitles = []
    try:
        if os.path.exists(source_path):
            with open(source_path, "r", encoding="utf-8") as f:
                source_srt_content = f.read()
                # 解析原始SRT内容
                pattern = r"(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.*?)(?=\n\d+\n|\n*$)"
                matches = re.findall(pattern, source_srt_content, re.DOTALL)

                for match in matches:
                    index, start_time, end_time, text = match
                    original_subtitles.append(
                        {
                            "index": int(index),
                            "startTime": srt_time_to_seconds(start_time),
                            "endTime": srt_time_to_seconds(end_time),
                            "text": text.strip(),
                        }
                    )
                logger.info(
                    f"成功解析原始字幕，共 {len(original_subtitles)} 条"
                )
    except Exception as e:
        logger.error(f"解析原始字幕失败: {e}")

    return original_subtitles


# 辅助函数：创建一个临时的、请求专用的配置副本
def _create_request_specific_config(
    base_config: SystemConfig,
    provider_config: Dict[str, Any],
    model_id: str,
) -> SystemConfig:
    """根据请求参数创建一个临时的、一次性的配置副本，不修改原始配置。

    Args:
        base_config: 基础系统配置
        provider_config: 提供商配置信息
        model_id: 模型ID

    Returns:
        SystemConfig: 请求专用的配置副本
    """
    from copy import deepcopy
    from pydantic import SecretStr
    from backend.schemas.config import (
        OpenAIConfig,
        OllamaConfig,
        CustomAPIConfig,
        CustomProviderConfig,
    )

    # 创建基础配置的深拷贝，确保不影响全局配置
    request_config = deepcopy(base_config)

    try:
        # 根据提供商类型设置配置
        provider_id = provider_config.get("id", "")
        api_key = provider_config.get("apiKey", "")
        api_host = provider_config.get("apiHost", "")

        # 也支持标准字段名作为备选
        if not provider_id:
            provider_id = provider_config.get("provider_type", "openai")
        if not api_key:
            api_key = provider_config.get("api_key", "")
        if not api_host:
            api_host = provider_config.get("base_url", "")

        logger.info(
            f"为请求创建专用配置: 提供商={provider_id}, 模型={model_id}"
        )

        if provider_id == "openai":
            request_config.ai_service.provider = AIProviderType.OPENAI

            # 确保 openai 配置对象存在
            if request_config.ai_service.openai is None:
                request_config.ai_service.openai = OpenAIConfig(
                    api_key=SecretStr(""), model=model_id
                )

            # 更新配置
            if api_key:
                request_config.ai_service.openai.api_key = SecretStr(api_key)
            if api_host:
                request_config.ai_service.openai.base_url = api_host
            request_config.ai_service.openai.model = model_id

        elif provider_id == "siliconflow":
            request_config.ai_service.provider = AIProviderType.SILICONFLOW

            # 确保 siliconflow 配置对象存在
            if request_config.ai_service.siliconflow is None:
                from backend.schemas.config import SiliconFlowConfig

                request_config.ai_service.siliconflow = SiliconFlowConfig(
                    api_key=SecretStr(""), model=model_id
                )

            # 更新配置
            if api_key:
                request_config.ai_service.siliconflow.api_key = SecretStr(
                    api_key
                )
            if api_host:
                request_config.ai_service.siliconflow.base_url = api_host
            request_config.ai_service.siliconflow.model = model_id

        elif provider_id.startswith("custom-"):
            request_config.ai_service.provider = AIProviderType.CUSTOM

            # 创建单个自定义提供商配置，用自定义提供商翻译所需仅为所选模型id不需要列表
            custom_provider = CustomProviderConfig(
                id=provider_id,
                name=f"Custom Provider {provider_id}",
                api_key=SecretStr(api_key) if api_key else SecretStr(""),
                base_url=api_host if api_host else "",
                model=model_id,
            )

            # 创建 CustomAPIConfig 并设置激活的提供商
            request_config.ai_service.custom = CustomAPIConfig(
                providers={provider_id: custom_provider},
                active_provider=provider_id,
            )

        elif provider_id == "ollama":
            request_config.ai_service.provider = AIProviderType.OLLAMA

            # 确保 ollama 配置对象存在
            if request_config.ai_service.ollama is None:
                request_config.ai_service.ollama = OllamaConfig(model=model_id)

            # 更新配置
            if api_host:
                request_config.ai_service.ollama.base_url = api_host
            request_config.ai_service.ollama.model = model_id

        else:
            # 默认使用 OpenAI 兼容接口
            request_config.ai_service.provider = AIProviderType.OPENAI

            # 确保 openai 配置对象存在
            if request_config.ai_service.openai is None:
                request_config.ai_service.openai = OpenAIConfig(
                    api_key=SecretStr(""), model=model_id
                )

            # 更新配置
            if api_key:
                request_config.ai_service.openai.api_key = SecretStr(api_key)
            if api_host:
                request_config.ai_service.openai.base_url = api_host
            request_config.ai_service.openai.model = model_id

        logger.info(f"请求专用配置创建完成: {provider_id}, 模型: {model_id}")
        logger.info(
            f"最终配置的提供商类型: {request_config.ai_service.provider}"
        )

        return request_config

    except Exception as e:
        logger.error(f"创建请求专用配置失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=400, detail=f"创建请求专用配置失败: {str(e)}"
        )


# SRT解析和时间转换工具函数
def srt_time_to_seconds(time_str: str) -> float:
    """SRT时间格式转秒数

    Args:
        time_str: SRT时间格式字符串，如 "00:01:23,456"

    Returns:
        float: 秒数，如 83.456
    """
    try:
        # 处理逗号或点号分隔的毫秒
        if "," in time_str:
            time_part, ms_part = time_str.split(",")
        elif "." in time_str:
            time_part, ms_part = time_str.split(".")
        else:
            time_part = time_str
            ms_part = "000"

        hours, minutes, seconds = map(int, time_part.split(":"))
        milliseconds = int(ms_part)

        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
    except Exception as e:
        logger.error(f"时间格式转换失败: {time_str}, 错误: {e}")
        return 0.0


def parse_srt_content(
    srt_content: str, original_subtitles: List[Dict] = None
) -> List[Dict]:
    """解析SRT内容为前端格式

    Args:
        srt_content: SRT文件内容（翻译后的）
        original_subtitles: 原始字幕数据列表

    Returns:
        List[Dict]: 前端期望的翻译结果格式
    """
    results = []
    try:
        if not srt_content or not srt_content.strip():
            logger.warning("SRT内容为空")
            return results

        # 记录SRT内容的行数和前200个字符
        logger.info(f"SRT内容行数: {len(srt_content.splitlines())}")
        logger.info(f"SRT内容预览: {repr(srt_content[:200])}")

        # 改进的SRT格式正则表达式 - 处理多种格式变体
        # 支持逗号和点作为毫秒分隔符，支持不同的换行符
        patterns = [
            # 标准格式：数字 + 换行 + 时间 + 换行 + 文本
            r"(\d+)\s*[\r\n]+(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*[\r\n]+(.*?)(?=\s*[\r\n]+\d+\s*[\r\n]+|\s*$)",
            # 紧凑格式：可能没有空行分隔
            r"(\d+)[\r\n]+(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})[\r\n]+(.*?)(?=[\r\n]*\d+[\r\n]+|[\r\n]*$)",
        ]

        matches = []
        for pattern in patterns:
            matches = re.findall(
                pattern, srt_content, re.DOTALL | re.MULTILINE
            )
            if matches:
                logger.info(f"使用模式匹配到 {len(matches)} 条字幕")
                break

        if not matches:
            logger.warning("没有匹配到任何字幕条目")
            # 尝试按行解析
            lines = srt_content.strip().split("\n")
            logger.info(f"尝试按行解析，共 {len(lines)} 行")
            for i, line in enumerate(lines[:5]):  # 只记录前5行
                logger.info(f"第{i+1}行: {repr(line)}")
            return results

        for i, match in enumerate(matches):
            try:
                index, start_time, end_time, translated_text = match

                # 清理文本内容
                translated_text = translated_text.strip()
                if not translated_text:
                    logger.warning(f"第{i+1}条字幕文本为空")
                    continue

                # 转换时间为秒数
                start_seconds = srt_time_to_seconds(start_time)
                end_seconds = srt_time_to_seconds(end_time)

                # 获取对应的原文
                original_text = "原文未找到"  # 默认值
                if original_subtitles:
                    # 优先根据索引匹配
                    for orig_sub in original_subtitles:
                        if orig_sub.get("index") == int(index):
                            original_text = orig_sub.get("text", "原文未找到")
                            break

                    # 如果索引匹配失败，尝试时间匹配
                    if original_text == "原文未找到":
                        for orig_sub in original_subtitles:
                            orig_start = orig_sub.get("startTime", 0)
                            orig_end = orig_sub.get("endTime", 0)
                            if (
                                abs(orig_start - start_seconds) < 1.0
                                and abs(orig_end - end_seconds) < 1.0
                            ):
                                original_text = orig_sub.get(
                                    "text", "原文未找到"
                                )
                                break

                result_item = {
                    "index": int(index),
                    "startTime": start_seconds,
                    "endTime": end_seconds,
                    "startTimeStr": start_time,
                    "endTimeStr": end_time,
                    "original": original_text,  # 原始字幕内容
                    "translated": translated_text,  # 翻译后的内容
                }
                results.append(result_item)

                # 记录前几条结果用于调试
                if i < 3:
                    logger.info(f"解析结果 {i+1}: {result_item}")

            except Exception as e:
                logger.error(f"解析第{i+1}条字幕失败: {e}")
                continue

        logger.info(f"成功解析 {len(results)} 条字幕")

    except Exception as e:
        logger.error(f"解析SRT内容失败: {e}", exc_info=True)

    return results


# 视频字幕翻译请求模型 - 简化版本
class VideoSubtitleTranslateRequestV2(BaseModel):
    """视频字幕翻译请求模型 v2 - 简化版本"""

    video_id: str = Field(..., description="视频ID")
    track_index: int = Field(..., description="字幕轨道索引")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    # 提供商配置信息
    provider_config: Dict[str, Any] = Field(..., description="提供商配置信息")
    model_id: str = Field(..., description="模型ID")
    # 翻译参数
    chunk_size: int = Field(default=30, description="字幕分块大小（单位：条）")
    context_window: int = Field(
        default=3, description="上下文窗口大小（单位：条）"
    )
    context_preservation: bool = Field(
        default=True, description="保持上下文一致性"
    )
    preserve_formatting: bool = Field(default=True, description="保留原格式")

    class Config:
        # 允许额外字段，提高兼容性
        extra = "allow"


# 视频字幕翻译响应模型
class VideoSubtitleTranslateResponseV2(APIResponse):
    """视频字幕翻译响应模型 v2"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "字幕翻译任务已提交",
                "data": {
                    "task_id": "uuid-string",
                    "video_id": "video-id",
                    "track_index": 0,
                    "source_language": "en",
                    "target_language": "zh",
                    "style": "natural",
                },
            }
        }


@router.post(
    "/video-subtitle",
    response_model=VideoSubtitleTranslateResponseV2,
    tags=["视频字幕翻译"],
)
async def translate_video_subtitle(
    request: VideoSubtitleTranslateRequestV2,
    raw_request: Request,
    base_config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """翻译视频字幕轨道 v2 - 重构版本

    使用标准依赖注入和请求专用配置副本，避免全局配置污染。

    Args:
        request: 视频字幕翻译请求
        raw_request: 原始请求对象，用于调试
        base_config: 基础系统配置（通过依赖注入获取）
        video_storage: 视频存储服务（通过依赖注入获取）
        extractor: 字幕提取器（通过依赖注入获取）

    Returns:
        VideoSubtitleTranslateResponseV2: 翻译响应
    """
    try:
        # 记录请求信息用于调试
        logger.info(
            f"收到视频字幕翻译请求v2: video_id={request.video_id}, track_index={request.track_index}"
        )
        logger.info(f"请求头: {dict(raw_request.headers)}")
        logger.info(
            f"请求体大小: {len(await raw_request.body()) if hasattr(raw_request, 'body') else 'unknown'}"
        )

        # 验证视频是否存在
        video_info = video_storage.get_video(request.video_id)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")

        # 验证字幕轨道是否存在
        if (
            not video_info.subtitle_tracks
            or len(video_info.subtitle_tracks) <= request.track_index
        ):
            raise HTTPException(status_code=404, detail="字幕轨道不存在")

        # 生成任务ID
        task_id = str(uuid.uuid4())

        # 创建临时目录
        temp_dir = base_config.temp_dir
        os.makedirs(temp_dir, exist_ok=True)

        logger.info(
            f"开始翻译视频字幕v2，视频ID: {request.video_id}, 轨道索引: {request.track_index}, 任务ID: {task_id}"
        )

        # 定义增强的进度回调函数
        async def progress_callback(
            progress: float,
            status: str,
            message: str,
            extra_data: Optional[Dict[str, Any]] = None,
        ):
            """增强的进度回调函数，支持更多参数"""
            try:
                # 创建WebSocket消息
                if status == "failed":
                    websocket_message = {"type": "error", "message": message}
                else:
                    # 进行中状态
                    websocket_message = {
                        "type": "progress",
                        "percentage": progress,
                        "current": 0,  # 当前处理项
                        "total": 0,  # 总项数
                        "currentItem": message,
                        "estimatedTime": None,
                    }

                    # 添加额外数据
                    if extra_data:
                        # 预览数据
                        if "preview" in extra_data:
                            websocket_message["preview"] = extra_data[
                                "preview"
                            ]

                        # 预计剩余时间
                        if (
                            "estimated_remaining_time" in extra_data
                            and extra_data["estimated_remaining_time"]
                        ):
                            websocket_message["estimatedTime"] = extra_data[
                                "estimated_remaining_time"
                            ]

                        # 当前翻译模型
                        if "model" in extra_data:
                            websocket_message["model"] = extra_data["model"]

                        # Token使用信息
                        if "usage" in extra_data and extra_data["usage"]:
                            usage_data = extra_data["usage"].copy()
                            # 添加估算标记的友好显示
                            if usage_data.get("is_estimated", False):
                                usage_data["display_note"] = "估算值"
                            else:
                                usage_data["display_note"] = "真实值"
                            websocket_message["usage"] = usage_data

                        # 当前chunk信息
                        if "current_chunk" in extra_data:
                            websocket_message["current"] = extra_data[
                                "current_chunk"
                            ]
                        if "total_chunks" in extra_data:
                            websocket_message["total"] = extra_data[
                                "total_chunks"
                            ]

                # 通过WebSocket广播进度更新
                await manager.broadcast(task_id, websocket_message)

                logger.info(
                    f"任务 {task_id} 进度: {progress}%, 状态: {status}, 消息: {message}"
                )
            except Exception as e:
                logger.error(f"进度回调失败: {e}")

        # 后台翻译任务
        async def process_video_subtitle_translation(
            extractor_instance: SubtitleExtractor,
        ):
            """处理视频字幕翻译的后台任务

            Args:
                extractor_instance: 字幕提取器实例（通过依赖注入传入）
            """
            try:
                # 获取字幕轨道
                subtitle_track = video_info.subtitle_tracks[
                    request.track_index
                ]

                # 检查字幕轨道是否存在
                if not subtitle_track:
                    raise Exception(
                        f"字幕轨道索引 {request.track_index} 不存在"
                    )

                # 提取字幕内容到临时文件
                from pathlib import Path

                # 创建临时目录
                output_dir = Path(base_config.temp_dir) / "subtitles"
                output_dir.mkdir(parents=True, exist_ok=True)

                # 提取字幕内容
                subtitle_path = extractor_instance.extract_embedded_subtitle(
                    video_info,
                    track_index=request.track_index,
                    output_dir=output_dir,
                    target_format="srt",
                )

                if not subtitle_path or not os.path.exists(str(subtitle_path)):
                    raise Exception("提取字幕内容失败")

                # 创建一个专用于本次翻译任务的配置副本
                request_specific_config = _create_request_specific_config(
                    base_config,
                    request.provider_config,
                    request.model_id,
                )

                # 使用这个临时配置来创建一次性的翻译器
                translator = SubtitleTranslator(request_specific_config)
                logger.info(
                    f"使用请求专用配置创建了临时的 SubtitleTranslator 实例。"
                )

                # 创建翻译任务
                task = SubtitleTranslator.create_task(
                    video_id=task_id,
                    source_path=str(subtitle_path),
                    source_language=request.source_language,
                    target_language=request.target_language,
                    style=request.style,
                    preserve_formatting=request.preserve_formatting,
                    context_preservation=request.context_preservation,
                    chunk_size=request.chunk_size,
                    context_window=request.context_window,
                )

                # 解析原始字幕数据
                original_subtitles = parse_original_subtitles(task.source_path)

                # 执行翻译任务，获取翻译内容、结果路径和token使用信息
                translated_content, result_path, total_usage, chunk_usages = (
                    await translator.translate_task(task, progress_callback)
                )

                if translated_content:
                    # 解析翻译结果
                    translation_results = parse_srt_content(
                        translated_content, original_subtitles
                    )

                    # 为总计统计添加估算标记
                    if total_usage:
                        total_usage_display = total_usage.copy()
                        # 检查是否包含估算值
                        has_estimated = any(
                            chunk_usage.get("is_estimated", False)
                            for chunk_usage in chunk_usages
                        )
                        if has_estimated:
                            total_usage_display["display_note"] = "包含估算值"
                        else:
                            total_usage_display["display_note"] = (
                                "全部为真实值"
                            )
                    else:
                        total_usage_display = {}

                    # 发送完成消息
                    websocket_message = {
                        "type": "completed",
                        "message": "翻译完成",
                        "results": translation_results,
                        "totalUsage": total_usage_display,  # 添加总token使用统计
                    }
                    await manager.broadcast(task_id, websocket_message)

                    logger.info(
                        f"翻译任务 {task_id} 完成，共 {len(translation_results)} 条结果"
                    )
                    if total_usage:
                        logger.info(
                            f"翻译任务 {task_id} Token使用统计: {total_usage}"
                        )
                else:
                    # 翻译失败
                    await progress_callback(
                        task.progress,
                        "failed",
                        task.error_message or "翻译失败",
                    )

            except asyncio.CancelledError:
                # 任务被取消
                logger.info(f"任务 {task_id} 已被成功取消")
                await progress_callback(0.0, "failed", "任务已被用户取消")
            except Exception as e:
                logger.error(
                    f"视频字幕翻译任务 {task_id} 异常: {e}", exc_info=True
                )
                await progress_callback(0.0, "failed", f"任务失败: {str(e)}")
            finally:
                # 无论任务成功、失败或取消，都从管理器中移除
                if task_id in running_tasks:
                    del running_tasks[task_id]
                    logger.info(f"任务 {task_id} 已从管理器中移除")

        # 使用 asyncio.create_task 而不是 background_tasks.add_task
        task_obj = asyncio.create_task(
            process_video_subtitle_translation(extractor)
        )

        # 将任务对象存储到全局管理器中
        running_tasks[task_id] = task_obj

        logger.info(f"翻译任务 {task_id} 已创建并在后台运行")

        # 返回任务信息
        return VideoSubtitleTranslateResponseV2(
            success=True,
            message="视频字幕翻译任务已提交v2",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style.value,
                "version": "v2",
            },
        )

    except ValidationError as e:
        logger.error(f"请求验证失败v2: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"请求验证失败: {str(e)}")
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"提交视频字幕翻译任务失败v2: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"提交翻译任务失败: {str(e)}"
        )


# 单行翻译请求模型 v2
class LineTranslateRequestV2(BaseModel):
    """单行翻译请求模型 v2"""

    text: str = Field(..., description="待翻译文本")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    context: Optional[List[Dict[str, str]]] = Field(
        None, description="上下文内容"
    )
    glossary: Optional[Dict[str, str]] = Field(None, description="术语表")
    ai_provider: Optional[AIProviderType] = Field(
        None, description="AI服务提供商"
    )
    template_name: Optional[str] = Field(None, description="提示模板名称")
    service_type: Optional[str] = Field(
        default="network_provider",
        description="翻译服务类型，可选值：network_provider, local_ollama",
    )

    class Config:
        extra = "allow"


# 翻译结果保存请求模型
class TranslationSaveRequest(BaseModel):
    """翻译结果保存请求模型"""

    videoId: str = Field(..., description="视频ID")
    results: List[Dict[str, Any]] = Field(..., description="翻译结果列表")
    targetLanguage: str = Field(..., description="目标语言")
    fileName: str = Field(..., description="文件名")
    edited: bool = Field(default=False, description="是否为编辑后的结果")
    isRealTranslation: bool = Field(
        default=True, description="是否为真实翻译结果"
    )


# 翻译结果加载请求模型
class TranslationLoadRequest(BaseModel):
    """翻译结果加载请求模型"""

    videoId: str = Field(..., description="视频ID")
    targetLanguage: str = Field(..., description="目标语言")


# 翻译结果保存响应模型
class TranslationSaveResponse(APIResponse):
    """翻译结果保存响应模型"""

    pass


# 片段翻译请求模型 v2
class SectionTranslateRequestV2(BaseModel):
    """字幕片段翻译请求模型 v2"""

    lines: List[Dict[str, Any]] = Field(..., description="字幕行列表")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    config: Optional[TranslationConfig] = Field(None, description="翻译配置")

    class Config:
        extra = "allow"


# 翻译响应模型 v2
class TranslateResponseV2(APIResponse):
    """翻译响应模型 v2"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "翻译成功",
                "data": {
                    "translated_text": "这是翻译后的文本",
                    "original_text": "This is the original text",
                    "source_language": "en",
                    "target_language": "zh",
                    "style": "natural",
                    "model_used": "gpt-4",
                    "version": "v2",
                },
            }
        }


@router.post("/line", response_model=TranslateResponseV2, tags=["实时翻译"])
async def translate_line(
    request: LineTranslateRequestV2,
    base_config: SystemConfig = Depends(get_system_config),
):
    """翻译单行字幕 v2 - 重构版本

    实时翻译单行字幕文本，用于预览或单句编辑。

    Args:
        request: 翻译请求
        base_config: 基础系统配置

    Returns:
        TranslateResponseV2: 翻译响应
    """
    try:
        # 创建请求专用配置（如果需要自定义提供商）
        if hasattr(request, "provider_config") and request.provider_config:
            request_config = _create_request_specific_config(
                base_config,
                request.provider_config,
                getattr(request, "model_id", "gpt-3.5-turbo"),
            )
        else:
            request_config = base_config

        # 使用配置创建翻译器
        translator = SubtitleTranslator(request_config)

        # 准备翻译服务
        service_translator = translator.service_translator

        # 使用用户指定的AI提供商或默认配置
        ai_service_config = request_config.ai_service

        # 根据service_type选择不同的翻译服务
        if request.service_type == "local_ollama":
            # 使用Ollama服务
            ai_service_config.provider = AIProviderType.OLLAMA
            logger.info("使用本地Ollama模型进行翻译v2")
        elif request.service_type == "network_provider":
            # 使用网络翻译服务
            if request.ai_provider:
                ai_service_config.provider = request.ai_provider
            logger.info(
                f"使用网络翻译服务进行翻译v2: {ai_service_config.provider}"
            )

        # 获取模板
        template = None
        if request.template_name:
            templates = translator.get_available_templates()
            if request.template_name in templates:
                template = templates[request.template_name]
            else:
                return TranslateResponseV2(
                    success=False,
                    message=f"提示模板 '{request.template_name}' 不存在",
                    data=None,
                )

        # 准备术语表
        glossary = request.glossary or {}

        # 优化文本以减少token使用量（如果包含HTML标签或格式标记）
        clean_text, format_tokens = SRTOptimizer.extract_text_and_format(
            request.text
        )

        # 仅当文本存在格式标记时才使用优化版本
        has_formatting = any(
            token_type == "tag" for token_type, _ in format_tokens
        )
        text_to_translate = clean_text if has_formatting else request.text

        # 执行翻译
        result = await service_translator.translate_text(
            text=text_to_translate,
            source_language=request.source_language,
            target_language=request.target_language,
            style=request.style,
            context=request.context,
            glossary=glossary,
            template=template,
            with_details=True,
        )

        translated_text = result.get("translated_text", "")

        # 如果原文有格式，恢复格式
        if has_formatting:
            translated_text = SRTOptimizer.apply_translation_to_tokens(
                format_tokens, translated_text
            )

        # 返回翻译结果
        return TranslateResponseV2(
            success=True,
            message="翻译成功v2",
            data={
                "translated_text": translated_text,
                "original_text": request.text,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style,
                "model_used": result.get("model_used", ""),
                "provider": str(ai_service_config.provider),
                "details": result.get("details", {}),
                "version": "v2",
            },
        )

    except Exception as e:
        logger.error(f"翻译单行字幕失败v2: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


@router.post("/section", response_model=TranslateResponseV2, tags=["实时翻译"])
async def translate_section(
    request: SectionTranslateRequestV2,
):
    """翻译字幕片段 v2 - 独立版本

    翻译一组连续的字幕行，保持上下文一致性。

    Args:
        request: 翻译请求

    Returns:
        TranslateResponseV2: 翻译响应
    """
    try:
        # 这是一个更复杂的功能，需要处理多行字幕和上下文
        # 目前返回未实现错误，但不会有422问题
        logger.info(f"收到字幕片段翻译请求v2: {len(request.lines)} 行字幕")

        return TranslateResponseV2(
            success=False,
            message="字幕片段翻译功能v2暂未实现，但请求解析正常",
            data={
                "lines_count": len(request.lines),
                "source_language": request.source_language,
                "target_language": request.target_language,
                "version": "v2",
                "status": "not_implemented",
            },
        )

    except Exception as e:
        logger.error(f"翻译字幕片段失败v2: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


# 健康检查端点
@router.get("/health", response_model=APIResponse, tags=["健康检查"])
async def health_check():
    """健康检查端点"""
    return APIResponse(
        success=True,
        message="翻译服务健康状态正常",
        data={"status": "healthy"},
    )


@router.websocket("/ws/{task_id}")
async def websocket_translation_progress(websocket: WebSocket, task_id: str):
    """WebSocket端点，用于实时推送翻译进度

    Args:
        websocket: WebSocket连接
        task_id: 翻译任务ID
    """
    await manager.connect(websocket, task_id)
    try:
        while True:
            # 保持连接活跃，等待客户端消息
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"WebSocket连接断开: {task_id}, 原因: {e}")
    finally:
        manager.disconnect(websocket, task_id)


# 添加缺失的保存和加载接口
@router.post(
    "/save", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def save_translation_results(
    request: TranslationSaveRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """保存翻译结果

    保存视频字幕的翻译结果到文件系统。

    Args:
        request: 保存请求，包含videoId、results、targetLanguage、fileName等字段

    Returns:
        APIResponse: 保存结果响应
    """
    try:
        # 创建保存目录
        save_dir = Path(config.temp_dir) / "translations"
        save_dir.mkdir(parents=True, exist_ok=True)

        # 生成文件名
        file_suffix = "_edited" if request.edited else ""
        file_name = (
            f"{request.videoId}_{request.targetLanguage}{file_suffix}.json"
        )
        file_path = save_dir / file_name

        # 保存数据
        save_data = {
            "videoId": request.videoId,
            "targetLanguage": request.targetLanguage,
            "fileName": request.fileName,
            "edited": request.edited,
            "results": request.results,
            "isRealTranslation": request.isRealTranslation,
            "savedAt": datetime.now().isoformat(),
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)

        logger.info(f"翻译结果已保存到: {file_path}")

        return TranslationSaveResponse(
            success=True,
            message="翻译结果保存成功",
            data={"filePath": str(file_path), "fileName": file_name},
        )

    except Exception as e:
        logger.error(f"保存翻译结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.post(
    "/load", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def load_translation_results(
    request: TranslationLoadRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """加载翻译结果

    从文件系统加载之前保存的翻译结果。

    Args:
        request: 加载请求，包含videoId、targetLanguage、fileName等字段

    Returns:
        APIResponse: 加载结果响应
    """
    try:
        save_dir = Path(config.temp_dir) / "translations"

        # 优先查找编辑过的版本
        edited_file = (
            save_dir
            / f"{request.videoId}_{request.targetLanguage}_edited.json"
        )
        original_file = (
            save_dir / f"{request.videoId}_{request.targetLanguage}.json"
        )

        file_path = None
        if edited_file.exists():
            file_path = edited_file
        elif original_file.exists():
            file_path = original_file

        if not file_path:
            return TranslationSaveResponse(
                success=False, message="未找到保存的翻译结果", data=None
            )

        # 加载数据
        with open(file_path, "r", encoding="utf-8") as f:
            save_data = json.load(f)

        logger.info(f"翻译结果已从 {file_path} 加载")

        return TranslationSaveResponse(
            success=True, message="翻译结果加载成功", data=save_data
        )

    except Exception as e:
        logger.error(f"加载翻译结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"加载失败: {str(e)}")


@router.post(
    "/clear", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def clear_translation_results(
    request: TranslationLoadRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """清空指定视频的所有翻译结果

    Args:
        request: 清空请求（复用加载请求的结构）
        config: 系统配置

    Returns:
        TranslationSaveResponse: 清空响应
    """
    try:
        save_dir = Path(config.temp_dir) / "translations"

        # 查找所有相关文件
        edited_file = (
            save_dir
            / f"{request.videoId}_{request.targetLanguage}_edited.json"
        )
        original_file = (
            save_dir / f"{request.videoId}_{request.targetLanguage}.json"
        )

        cleared_files = []

        # 删除编辑版本
        if edited_file.exists():
            edited_file.unlink()
            cleared_files.append(str(edited_file))
            logger.info(f"已删除编辑版本: {edited_file}")

        # 删除原始版本
        if original_file.exists():
            original_file.unlink()
            cleared_files.append(str(original_file))
            logger.info(f"已删除原始版本: {original_file}")

        if not cleared_files:
            return TranslationSaveResponse(
                success=True,
                message="没有找到需要清空的翻译结果",
                data={"clearedFiles": []},
            )

        logger.info(
            f"已清空视频 {request.videoId} 的 {request.targetLanguage} 翻译结果"
        )

        return TranslationSaveResponse(
            success=True,
            message=f"成功清空 {len(cleared_files)} 个翻译结果文件",
            data={"clearedFiles": cleared_files},
        )

    except Exception as e:
        logger.error(f"清空翻译结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")


@router.delete(
    "/delete", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def delete_translation_results(
    request: TranslationLoadRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """删除指定视频的翻译结果（用户主动删除）

    Args:
        request: 删除请求（复用加载请求的结构）
        config: 系统配置

    Returns:
        TranslationSaveResponse: 删除响应
    """
    try:
        save_dir = Path(config.temp_dir) / "translations"

        # 查找所有相关文件
        edited_file = (
            save_dir
            / f"{request.videoId}_{request.targetLanguage}_edited.json"
        )
        original_file = (
            save_dir / f"{request.videoId}_{request.targetLanguage}.json"
        )

        deleted_files = []

        # 删除编辑版本
        if edited_file.exists():
            edited_file.unlink()
            deleted_files.append(str(edited_file))
            logger.info(f"用户删除编辑版本: {edited_file}")

        # 删除原始版本
        if original_file.exists():
            original_file.unlink()
            deleted_files.append(str(original_file))
            logger.info(f"用户删除原始版本: {original_file}")

        if not deleted_files:
            return TranslationSaveResponse(
                success=False,
                message="没有找到可删除的翻译结果",
                data={"deletedFiles": []},
            )

        logger.info(
            f"用户删除了视频 {request.videoId} 的 {request.targetLanguage} 翻译结果"
        )

        return TranslationSaveResponse(
            success=True,
            message=f"成功删除 {len(deleted_files)} 个翻译结果文件",
            data={"deletedFiles": deleted_files},
        )

    except Exception as e:
        logger.error(f"删除翻译结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.post(
    "/cancel/{task_id}", response_model=APIResponse, tags=["翻译任务管理"]
)
async def cancel_translation_task(task_id: str):
    """取消翻译任务

    Args:
        task_id: 翻译任务ID

    Returns:
        APIResponse: 操作响应
    """
    try:
        # 导入任务取消管理器
        from backend.services.task_cancellation_manager import (
            cancellation_manager,
        )

        # 标记任务为取消状态（保留原有逻辑用于兼容性）
        cancellation_manager.cancel_task(task_id)

        # 【核心修改】从全局管理器中找到并取消 asyncio.Task
        task_to_cancel = running_tasks.get(task_id)
        if task_to_cancel:
            task_to_cancel.cancel()  # 这会立即向任务注入一个 CancelledError
            logger.info(f"已向 asyncio 任务 {task_id} 发送取消请求")

            # 通过WebSocket通知前端任务已取消
            await manager.broadcast(
                task_id,
                {"type": "cancelled", "message": "翻译任务已被用户取消"},
            )

            logger.info(f"翻译任务 {task_id} 取消请求已处理")
            return APIResponse(success=True, message="翻译任务取消请求已提交")
        else:
            logger.warning(
                f"尝试取消任务 {task_id}，但在运行列表中未找到。可能已完成或失败"
            )
            return APIResponse(success=False, message="任务不存在或已完成")

    except Exception as e:
        logger.error(f"取消翻译任务失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")


# 为兼容性添加 /api/translation 前缀的接口
@translation_router.post(
    "/save", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def save_translation_result_compat(
    request: dict,
    config: SystemConfig = Depends(get_system_config),
):
    """保存翻译结果 (兼容性接口)

    这是为了兼容前端现有调用而提供的接口，功能与 /api/translate/save 相同。

    Args:
        request: 保存请求，包含videoId、results、targetLanguage、fileName等字段
        config: 系统配置（通过依赖注入获取）

    Returns:
        TranslationSaveResponse: 保存结果响应
    """
    try:
        # 将 dict 转换为 TranslationSaveRequest 模型
        save_request = TranslationSaveRequest(
            videoId=request.get("videoId"),
            results=request.get("results", []),
            targetLanguage=request.get("targetLanguage", "zh"),
            fileName=request.get("fileName", "translation"),
            edited=request.get("edited", False),
            isRealTranslation=request.get("isRealTranslation", True),
        )

        # 调用主要的保存函数
        return await save_translation_results(save_request, config)

    except Exception as e:
        logger.error(f"兼容性保存接口失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")
