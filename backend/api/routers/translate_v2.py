"""独立翻译API路由模块 v2

这是一个完全独立的翻译路由模块，用于解决原有路由中的422错误问题。
逐步迁移功能，避免全局配置冲突。
"""

import logging
import os
import re
import uuid
from typing import Optional, Dict, List, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    BackgroundTasks,
    Request,
    WebSocket,
)
from pydantic import BaseModel, Field, ValidationError

from backend.schemas.api import APIResponse, ProgressUpdateEvent
from backend.schemas.task import (
    TranslationConfig,
    TranslationStyle,
    SubtitleTask,
)
from backend.schemas.config import SystemConfig, AIProviderType
from backend.core.subtitle_translator import SubtitleTranslator
from backend.services.utils import SRTOptimizer
from backend.services.video_storage import VideoStorageService
from backend.api.websocket import manager  # 导入WebSocket管理器

# 配置日志
logger = logging.getLogger("subtranslate.api.translate_v2")

# 创建独立路由器
router = APIRouter()


# 独立的依赖项函数，避免使用全局依赖
def get_independent_system_config() -> SystemConfig:
    """获取独立的系统配置实例"""
    try:
        return SystemConfig.from_env()
    except Exception as e:
        logger.error(f"加载系统配置失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"加载系统配置失败: {str(e)}"
        )


def get_independent_video_storage() -> VideoStorageService:
    """获取独立的视频存储服务实例（实际使用全局共享实例）"""
    try:
        # 导入全局依赖项函数
        from backend.api.dependencies import get_video_storage

        # 使用全局共享的视频存储实例，而不是创建新实例
        return get_video_storage()
    except Exception as e:
        logger.error(f"获取视频存储服务失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取视频存储服务失败: {str(e)}"
        )


def get_independent_subtitle_translator() -> SubtitleTranslator:
    """获取独立的字幕翻译器实例"""
    try:
        config = get_independent_system_config()
        return SubtitleTranslator(config)
    except Exception as e:
        logger.error(f"创建字幕翻译器失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"创建字幕翻译器失败: {str(e)}"
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


# 辅助函数：配置AI服务
async def _configure_ai_service_from_provider_config_v2(
    config: SystemConfig,
    provider_config: Dict[str, Any],
    model_id: str,
):
    """根据提供商配置设置AI服务 v2"""
    try:
        from pydantic import SecretStr
        from backend.schemas.config import OpenAIConfig, OllamaConfig

        # 根据提供商类型设置配置
        # 支持前端发送的字段名：id, apiKey, apiHost
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

        # 根据提供商ID确定类型
        if provider_id in ["openai", "siliconflow"] or provider_id.startswith(
            "custom-"
        ):
            config.ai_service.provider = AIProviderType.OPENAI

            # 确保 openai 配置对象存在
            if config.ai_service.openai is None:
                config.ai_service.openai = OpenAIConfig(
                    api_key=SecretStr(""), model=model_id
                )

            # 更新配置
            if api_key:
                config.ai_service.openai.api_key = SecretStr(api_key)
            if api_host:
                config.ai_service.openai.base_url = api_host
            config.ai_service.openai.model = model_id

        elif provider_id == "ollama":
            config.ai_service.provider = AIProviderType.OLLAMA

            # 确保 ollama 配置对象存在
            if config.ai_service.ollama is None:
                config.ai_service.ollama = OllamaConfig(model=model_id)

            # 更新配置
            if api_host:
                config.ai_service.ollama.base_url = api_host
            config.ai_service.ollama.model = model_id

        else:
            # 默认使用 OpenAI 兼容接口
            config.ai_service.provider = AIProviderType.OPENAI

            # 确保 openai 配置对象存在
            if config.ai_service.openai is None:
                config.ai_service.openai = OpenAIConfig(
                    api_key=SecretStr(""), model=model_id
                )

            # 更新配置
            if api_key:
                config.ai_service.openai.api_key = SecretStr(api_key)
            if api_host:
                config.ai_service.openai.base_url = api_host
            config.ai_service.openai.model = model_id

        logger.info(f"AI服务配置完成: {provider_id}, 模型: {model_id}")

    except Exception as e:
        logger.error(f"配置AI服务失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=400, detail=f"配置AI服务失败: {str(e)}"
        )


@router.post(
    "/video-subtitle-v2",
    response_model=VideoSubtitleTranslateResponseV2,
    tags=["视频字幕翻译v2"],
)
async def translate_video_subtitle_v2(
    request: VideoSubtitleTranslateRequestV2,
    background_tasks: BackgroundTasks,
    raw_request: Request,
):
    """翻译视频字幕轨道 v2 - 独立版本

    这是一个完全独立的视频字幕翻译接口，避免全局配置冲突。

    Args:
        request: 视频字幕翻译请求
        background_tasks: FastAPI后台任务
        raw_request: 原始请求对象，用于调试

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

        # 获取独立的服务实例
        config = get_independent_system_config()
        video_storage = get_independent_video_storage()
        translator = get_independent_subtitle_translator()

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
        temp_dir = config.temp_dir
        os.makedirs(temp_dir, exist_ok=True)

        logger.info(
            f"开始翻译视频字幕v2，视频ID: {request.video_id}, 轨道索引: {request.track_index}, 任务ID: {task_id}"
        )

        # 定义进度回调函数
        async def callback(progress: float, status: str, message: str):
            """进度回调函数"""
            try:
                # 根据状态创建前端期望的消息格式
                if status == "completed":
                    # 获取翻译结果
                    translation_results = []
                    try:
                        # 从翻译任务中获取结果
                        task = getattr(callback, "_current_task", None)
                        if task:
                            logger.info(
                                f"任务对象存在，result_path: {getattr(task, 'result_path', 'None')}"
                            )

                            # 尝试多种方式获取翻译结果文件
                            result_file_paths = []

                            # 方式1：从任务对象获取
                            if (
                                hasattr(task, "result_path")
                                and task.result_path
                            ):
                                result_file_paths.append(task.result_path)

                            # 方式2：从临时目录构建路径
                            if hasattr(task, "id"):
                                temp_result_file = os.path.join(
                                    temp_dir, f"{task.id}_result.srt"
                                )
                                result_file_paths.append(temp_result_file)

                            # 方式3：使用任务ID构建路径
                            task_result_file = os.path.join(
                                temp_dir, f"{task_id}_result.srt"
                            )
                            result_file_paths.append(task_result_file)

                            # 方式4：查找临时目录中的所有SRT文件
                            if os.path.exists(temp_dir):
                                for file in os.listdir(temp_dir):
                                    if (
                                        file.endswith(".srt")
                                        and task_id in file
                                    ):
                                        result_file_paths.append(
                                            os.path.join(temp_dir, file)
                                        )

                            logger.info(
                                f"尝试的结果文件路径: {result_file_paths}"
                            )

                            # 尝试读取翻译结果
                            srt_content = None
                            used_path = None
                            for path in result_file_paths:
                                if path and os.path.exists(path):
                                    try:
                                        with open(
                                            path, "r", encoding="utf-8"
                                        ) as f:
                                            srt_content = f.read()
                                            used_path = path
                                            logger.info(
                                                f"成功从 {path} 读取翻译结果"
                                            )
                                            break
                                    except Exception as e:
                                        logger.warning(
                                            f"读取文件 {path} 失败: {e}"
                                        )
                                        continue

                            if srt_content:
                                # 获取原始字幕数据
                                original_subtitles = getattr(
                                    callback, "_original_subtitles", None
                                )
                                logger.info(
                                    f"原始字幕数据条数: {len(original_subtitles) if original_subtitles else 0}"
                                )
                                if (
                                    original_subtitles
                                    and len(original_subtitles) > 0
                                ):
                                    logger.info(
                                        f"第一条原始字幕: {original_subtitles[0]}"
                                    )

                                # 解析翻译结果
                                translation_results = parse_srt_content(
                                    srt_content, original_subtitles
                                )

                                # 记录解析结果
                                logger.info(
                                    f"成功解析翻译结果，共 {len(translation_results)} 条字幕"
                                )
                                if translation_results:
                                    logger.info(
                                        f"第一条翻译结果: {translation_results[0]}"
                                    )
                            else:
                                logger.error("无法找到或读取翻译结果文件")
                        else:
                            logger.error("任务对象不存在")

                    except Exception as e:
                        logger.error(f"获取翻译结果失败: {e}", exc_info=True)
                        translation_results = []

                    websocket_message = {
                        "type": "completed",
                        "message": message,
                        "results": translation_results,  # ✅ 实际翻译结果
                    }

                    # 记录WebSocket消息
                    logger.info(
                        f"准备发送WebSocket消息: type={websocket_message['type']}, results_count={len(translation_results)}"
                    )
                elif status == "failed":
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

                # 通过WebSocket广播进度更新
                await manager.broadcast(task_id, websocket_message)

                logger.info(
                    f"任务 {task_id} 进度: {progress}%, 状态: {status}, 消息: {message}"
                )
            except Exception as e:
                logger.error(f"进度回调失败: {e}")

        # 后台翻译任务
        async def process_video_subtitle_translation():
            """处理视频字幕翻译的后台任务"""
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
                from backend.core.subtitle_extractor import SubtitleExtractor
                from backend.core.ffmpeg import FFmpegTool
                from pathlib import Path

                # 创建字幕提取器实例
                ffmpeg_tool = FFmpegTool()
                extractor = SubtitleExtractor(ffmpeg_tool)

                # 创建临时目录
                output_dir = Path(config.temp_dir) / "subtitles"
                output_dir.mkdir(parents=True, exist_ok=True)

                # 提取字幕内容
                subtitle_path = extractor.extract_embedded_subtitle(
                    video_info,
                    track_index=request.track_index,
                    output_dir=output_dir,
                    target_format="srt",
                )

                if not subtitle_path or not os.path.exists(str(subtitle_path)):
                    raise Exception("提取字幕内容失败")

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

                # 使用提供商配置创建临时AI服务配置
                original_provider = config.ai_service.provider

                try:
                    # 根据提供商配置设置AI服务
                    await _configure_ai_service_from_provider_config_v2(
                        config,
                        request.provider_config,
                        request.model_id,
                    )

                    # 设置回调函数的任务引用，以便获取翻译结果
                    callback._current_task = task

                    # 读取并解析原始字幕数据
                    original_subtitles = []
                    try:
                        if os.path.exists(task.source_path):
                            with open(
                                task.source_path, "r", encoding="utf-8"
                            ) as f:
                                source_srt_content = f.read()
                                # 解析原始SRT内容
                                pattern = r"(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.*?)(?=\n\d+\n|\n*$)"
                                matches = re.findall(
                                    pattern, source_srt_content, re.DOTALL
                                )

                                for match in matches:
                                    index, start_time, end_time, text = match
                                    original_subtitles.append(
                                        {
                                            "index": int(index),
                                            "startTime": srt_time_to_seconds(
                                                start_time
                                            ),
                                            "endTime": srt_time_to_seconds(
                                                end_time
                                            ),
                                            "text": text.strip(),
                                        }
                                    )
                                logger.info(
                                    f"成功解析原始字幕，共 {len(original_subtitles)} 条"
                                )
                    except Exception as e:
                        logger.error(f"解析原始字幕失败: {e}")
                        original_subtitles = []

                    # 保存原始字幕数据到回调函数
                    callback._original_subtitles = original_subtitles

                    # 执行翻译任务
                    success = await translator.translate_task(task, callback)

                    if success:
                        await callback(100.0, "completed", "翻译完成")
                    else:
                        await callback(
                            task.progress,
                            "failed",
                            task.error_message or "翻译失败",
                        )

                finally:
                    # 恢复原始提供商配置
                    config.ai_service.provider = original_provider

            except Exception as e:
                logger.error(
                    f"视频字幕翻译任务 {task_id} 异常: {e}", exc_info=True
                )
                await callback(0.0, "failed", f"任务失败: {str(e)}")

        # 添加到后台任务
        background_tasks.add_task(process_video_subtitle_translation)

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


@router.post(
    "/line-v2", response_model=TranslateResponseV2, tags=["实时翻译v2"]
)
async def translate_line_v2(
    request: LineTranslateRequestV2,
):
    """翻译单行字幕 v2 - 独立版本

    实时翻译单行字幕文本，用于预览或单句编辑。

    Args:
        request: 翻译请求

    Returns:
        TranslateResponseV2: 翻译响应
    """
    try:
        # 获取独立的服务实例
        config = get_independent_system_config()
        translator = get_independent_subtitle_translator()

        # 准备翻译服务
        service_translator = translator.service_translator

        # 使用用户指定的AI提供商或默认配置
        ai_service_config = config.ai_service

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


@router.post(
    "/section-v2", response_model=TranslateResponseV2, tags=["实时翻译v2"]
)
async def translate_section_v2(
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
@router.get("/health-v2", response_model=APIResponse, tags=["健康检查v2"])
async def health_check_v2():
    """健康检查端点 v2"""
    return APIResponse(
        success=True,
        message="翻译服务v2健康状态正常",
        data={"status": "healthy", "version": "v2"},
    )


# 调试端点：检查依赖项状态
@router.get("/debug/dependencies", response_model=APIResponse, tags=["调试v2"])
async def debug_dependencies():
    """调试端点：检查依赖项状态"""
    try:
        config = get_independent_system_config()
        video_storage = get_independent_video_storage()
        translator = get_independent_subtitle_translator()

        return APIResponse(
            success=True,
            message="依赖项状态检查完成",
            data={
                "config_loaded": True,
                "video_storage_initialized": True,
                "translator_initialized": True,
                "video_count": len(video_storage.videos),
                "temp_dir": config.temp_dir,
                "ai_provider": str(config.ai_service.provider),
            },
        )
    except Exception as e:
        logger.error(f"依赖项检查失败: {e}", exc_info=True)
        return APIResponse(
            success=False,
            message=f"依赖项检查失败: {str(e)}",
            data=None,
        )


# 调试端点：测试请求解析
@router.post(
    "/debug/parse-request", response_model=APIResponse, tags=["调试v2"]
)
async def debug_parse_request(
    request: VideoSubtitleTranslateRequestV2,
    raw_request: Request,
):
    """调试端点：测试请求解析"""
    try:
        # 获取原始请求体
        body = await raw_request.body()

        return APIResponse(
            success=True,
            message="请求解析成功",
            data={
                "parsed_request": request.model_dump(),
                "raw_body_size": len(body),
                "content_type": raw_request.headers.get("content-type"),
                "headers": dict(raw_request.headers),
            },
        )
    except Exception as e:
        logger.error(f"请求解析测试失败: {e}", exc_info=True)
        return APIResponse(
            success=False,
            message=f"请求解析失败: {str(e)}",
            data=None,
        )


@router.websocket("/ws/{task_id}")
async def websocket_translation_progress_v2(
    websocket: WebSocket, task_id: str
):
    """WebSocket端点，用于实时推送翻译进度 v2

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
