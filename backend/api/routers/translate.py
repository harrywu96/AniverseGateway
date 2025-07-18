"""实时翻译API路由模块

提供单行翻译和字幕片段翻译功能。
"""

import logging
import os
import uuid
import json
from typing import Optional, Dict, List, Any
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    BackgroundTasks,
    UploadFile,
    File,
    Form,
    WebSocket,
)
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse, ProgressUpdateEvent
from backend.schemas.task import (
    TranslationConfig,
    TranslationStyle,
    SubtitleTask,
)
from backend.schemas.config import SystemConfig, AIProviderType
from backend.core.subtitle_translator import SubtitleTranslator
from backend.services.utils import SRTOptimizer
from backend.api.dependencies import (
    get_system_config,
    get_subtitle_translator,
    get_video_storage,
)
from backend.api.websocket import manager  # 导入WebSocket管理器
from backend.services.video_storage import VideoStorageService


# 配置日志
logger = logging.getLogger("subtranslate.api.translate")


# 创建路由器
router = APIRouter()


# 单行翻译请求模型
class LineTranslateRequest(BaseModel):
    """单行翻译请求模型"""

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


# 片段翻译请求模型
class SectionTranslateRequest(BaseModel):
    """字幕片段翻译请求模型"""

    lines: List[Dict[str, Any]] = Field(..., description="字幕行列表")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    config: Optional[TranslationConfig] = Field(None, description="翻译配置")


# 视频字幕翻译请求模型
class VideoSubtitleTranslateRequest(BaseModel):
    """视频字幕翻译请求模型"""

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


# 视频字幕翻译响应模型
class VideoSubtitleTranslateResponse(APIResponse):
    """视频字幕翻译响应模型"""

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


# 翻译响应模型
class TranslateResponse(APIResponse):
    """翻译响应模型"""

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
                },
            }
        }


# 翻译结果保存请求模型
class TranslationSaveRequest(BaseModel):
    """翻译结果保存请求模型"""

    videoId: str = Field(..., description="视频ID")
    results: List[Dict[str, Any]] = Field(..., description="翻译结果列表")
    targetLanguage: str = Field(..., description="目标语言")
    fileName: str = Field(..., description="文件名")
    edited: bool = Field(default=False, description="是否为编辑后的结果")


# 翻译结果加载请求模型
class TranslationLoadRequest(BaseModel):
    """翻译结果加载请求模型"""

    videoId: str = Field(..., description="视频ID")
    targetLanguage: str = Field(..., description="目标语言")


# 翻译结果保存响应模型
class TranslationSaveResponse(APIResponse):
    """翻译结果保存响应模型"""

    pass


async def _configure_ai_service_from_provider_config(
    config: SystemConfig, provider_config: Dict[str, Any], model_id: str
):
    """根据提供商配置动态设置AI服务

    Args:
        config: 系统配置
        provider_config: 提供商配置信息
        model_id: 模型ID
    """
    from pydantic import SecretStr

    # 根据提供商类型设置相应的配置
    provider_id = provider_config.get("id", "")
    api_key = provider_config.get("apiKey", "")
    base_url = provider_config.get("apiHost", "")

    if provider_id == "openai" or provider_id.startswith("custom-"):
        # OpenAI或自定义提供商
        from backend.schemas.config import OpenAIConfig

        config.ai_service.openai = OpenAIConfig(
            api_key=SecretStr(api_key),
            base_url=base_url,
            model=model_id,
        )
        config.ai_service.provider = AIProviderType.OPENAI

    elif provider_id == "siliconflow":
        # SiliconFlow提供商
        from backend.schemas.config import SiliconFlowConfig

        config.ai_service.siliconflow = SiliconFlowConfig(
            api_key=SecretStr(api_key),
            base_url=base_url or "https://api.siliconflow.cn/v1",
            model=model_id,
        )
        config.ai_service.provider = AIProviderType.SILICONFLOW

    else:
        # 其他提供商可以在这里添加
        logger.warning(f"未知的提供商类型: {provider_id}")
        raise HTTPException(
            status_code=400, detail=f"不支持的提供商类型: {provider_id}"
        )


async def progress_callback(
    task_id: str, progress: float, status: str, message: Optional[str] = None
):
    """任务进度回调函数，用于向WebSocket客户端推送进度更新

    Args:
        task_id: 任务ID
        progress: 进度百分比
        status: 任务状态
        message: 状态消息
    """
    # 创建进度更新事件
    event = ProgressUpdateEvent(
        task_id=task_id, progress=progress, status=status, message=message
    )

    # 广播给所有订阅此任务的客户端
    await manager.broadcast(task_id, event.model_dump())
    logger.info(f"任务 {task_id} 进度: {progress:.2f}% - 状态: {status}")


@router.post("/line", response_model=TranslateResponse, tags=["实时翻译"])
async def translate_line(
    request: LineTranslateRequest,
    config: SystemConfig = Depends(get_system_config),
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """翻译单行字幕

    实时翻译单行字幕文本，用于预览或单句编辑。

    Args:
        request: 翻译请求
        config: 系统配置
        translator: 字幕翻译器

    Returns:
        TranslateResponse: 翻译响应
    """
    try:
        # 准备翻译服务
        service_translator = translator.service_translator

        # 使用用户指定的AI提供商或默认配置
        ai_service_config = config.ai_service

        # 根据service_type选择不同的翻译服务
        if request.service_type == "local_ollama":
            # 使用Ollama服务
            ai_service_config.provider = AIProviderType.OLLAMA
            logger.info("使用本地Ollama模型进行翻译")
        elif request.service_type == "network_provider":
            # 使用网络翻译服务
            if request.ai_provider:
                ai_service_config.provider = request.ai_provider
            logger.info(
                f"使用网络翻译服务进行翻译: {ai_service_config.provider}"
            )

        # 获取模板
        template = None
        if request.template_name:
            templates = translator.get_available_templates()
            if request.template_name in templates:
                template = templates[request.template_name]
            else:
                return TranslateResponse(
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
        return TranslateResponse(
            success=True,
            message="翻译成功",
            data={
                "translated_text": translated_text,
                "original_text": request.text,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style,
                "model_used": result.get("model_used", ""),
                "provider": str(ai_service_config.provider),
                "details": result.get("details", {}),
            },
        )

    except Exception as e:
        logger.error(f"翻译单行字幕失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


@router.post("/section", response_model=TranslateResponse, tags=["实时翻译"])
async def translate_section(
    request: SectionTranslateRequest,
    config: SystemConfig = Depends(get_system_config),
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """翻译字幕片段

    翻译一组连续的字幕行，保持上下文一致性。

    Args:
        request: 翻译请求
        config: 系统配置
        translator: 字幕翻译器

    Returns:
        TranslateResponse: 翻译响应
    """
    try:
        # 这是一个更复杂的功能，需要处理多行字幕和上下文
        # 由于实现复杂，目前返回未实现错误
        raise HTTPException(status_code=501, detail="功能未实现")

    except Exception as e:
        logger.error(f"翻译字幕片段失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


@router.post(
    "/video-subtitle-fixed",
    response_model=VideoSubtitleTranslateResponse,
    tags=["视频字幕翻译"],
)
async def translate_video_subtitle(
    request: VideoSubtitleTranslateRequest,
    background_tasks: BackgroundTasks,
    config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """翻译视频字幕轨道

    对指定视频的字幕轨道进行翻译，支持自定义提供商配置。

    Args:
        request: 视频字幕翻译请求
        background_tasks: FastAPI后台任务
        config: 系统配置
        video_storage: 视频存储服务

    Returns:
        VideoSubtitleTranslateResponse: 翻译响应
    """
    try:
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
            f"开始翻译视频字幕，视频ID: {request.video_id}, 轨道索引: {request.track_index}"
        )

        # 定义异步翻译函数
        async def process_video_subtitle_translation():
            try:
                # 在函数内部创建SubtitleTranslator实例，避免依赖注入问题
                translator = SubtitleTranslator(config)

                # 设置进度回调
                async def callback(
                    progress: float, status: str, message: Optional[str] = None
                ):
                    await progress_callback(task_id, progress, status, message)

                # 获取字幕内容
                from backend.core.subtitle_extractor import SubtitleExtractor
                from backend.core.ffmpeg import FFmpegTool
                from pathlib import Path

                # 创建字幕提取器实例
                ffmpeg_tool = FFmpegTool()
                extractor = SubtitleExtractor(ffmpeg_tool)

                # 提取字幕内容到临时文件
                output_dir = Path(temp_dir) / "subtitles"
                output_dir.mkdir(parents=True, exist_ok=True)

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
                    await _configure_ai_service_from_provider_config(
                        config,
                        request.provider_config,
                        request.model_id,
                    )

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
        return VideoSubtitleTranslateResponse(
            success=True,
            message="视频字幕翻译任务已提交",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style.value,
            },
        )

    except Exception as e:
        logger.error(f"提交视频字幕翻译任务失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"提交翻译任务失败: {str(e)}"
        )


@router.get("/providers", response_model=APIResponse, tags=["实时翻译"])
async def list_ai_providers(config: SystemConfig = Depends(get_system_config)):
    """获取可用AI服务提供商列表

    获取系统支持的AI服务提供商列表及其配置状态。

    Args:
        config: 系统配置

    Returns:
        APIResponse: 提供商列表响应
    """
    # 获取所有可用提供商
    providers = [provider.value for provider in AIProviderType]

    # 当前激活的提供商
    active_provider = config.ai_service.provider.value

    # 已配置的提供商（有API密钥的）
    configured_providers = []

    provider_config = config.ai_service.get_provider_config()
    if (
        provider_config
        and provider_config.api_key
        and provider_config.api_key.get_secret_value()
    ):
        configured_providers.append(active_provider)

    return APIResponse(
        success=True,
        message="获取AI服务提供商列表成功",
        data={
            "providers": providers,
            "active_provider": active_provider,
            "configured_providers": configured_providers,
        },
    )


@router.get("/templates", response_model=APIResponse, tags=["实时翻译"])
async def list_templates(
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """获取可用翻译提示模板列表

    获取系统内置和用户自定义的提示模板列表。

    Args:
        translator: 字幕翻译器

    Returns:
        APIResponse: 模板列表响应
    """
    try:
        # 获取所有可用模板
        templates = translator.get_available_templates()

        # 转换为可序列化的字典
        template_list = []
        for name, template in templates.items():
            template_dict = template.model_dump()
            template_dict["name"] = name
            template_list.append(template_dict)

        return APIResponse(
            success=True, message="获取提示模板列表成功", data=template_list
        )

    except Exception as e:
        logger.error(f"获取模板列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取模板列表失败: {str(e)}"
        )


@router.post(
    "/save", response_model=TranslationSaveResponse, tags=["翻译结果管理"]
)
async def save_translation_results(
    request: TranslationSaveRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """保存翻译结果

    Args:
        request: 保存请求
        config: 系统配置

    Returns:
        TranslationSaveResponse: 保存响应
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
            "savedAt": str(uuid.uuid4()),  # 简单的时间戳替代
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

    Args:
        request: 加载请求
        config: 系统配置

    Returns:
        TranslationSaveResponse: 加载响应
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
