"""实时翻译API路由模块

提供单行翻译和字幕片段翻译功能。
"""

import logging
import os
import uuid
from typing import Optional, Dict, List, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    BackgroundTasks,
    UploadFile,
    File,
    Form,
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
from backend.api.dependencies import get_system_config, get_subtitle_translator
from backend.api.websocket import manager  # 导入WebSocket管理器


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


# 片段翻译请求模型
class SectionTranslateRequest(BaseModel):
    """字幕片段翻译请求模型"""

    lines: List[Dict[str, Any]] = Field(..., description="字幕行列表")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    config: Optional[TranslationConfig] = Field(None, description="翻译配置")


# 文件翻译请求模型
class FileTranslateRequest(BaseModel):
    """字幕文件翻译请求模型"""

    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    context_preservation: bool = Field(
        default=True, description="保持上下文一致性"
    )
    preserve_formatting: bool = Field(default=True, description="保留原格式")
    chunk_size: int = Field(default=30, description="字幕分块大小（单位：条）")
    context_window: int = Field(
        default=3, description="上下文窗口大小（单位：条）"
    )


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


# 文件翻译响应模型
class FileTranslateResponse(APIResponse):
    """文件翻译响应模型"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "文件翻译任务已提交",
                "data": {
                    "task_id": "12345",
                    "source_language": "en",
                    "target_language": "zh",
                    "style": "natural",
                    "result_path": "/path/to/result.srt",
                },
            }
        }


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
        if request.ai_provider:
            ai_service_config.provider = request.ai_provider

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
    "/file", response_model=FileTranslateResponse, tags=["字幕文件翻译"]
)
async def translate_file(
    background_tasks: BackgroundTasks,
    subtitle_file: UploadFile = File(...),
    data: str = Form(...),  # JSON序列化的配置数据
    config: SystemConfig = Depends(get_system_config),
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """翻译整个字幕文件

    上传SRT字幕文件并进行完整翻译，返回任务ID用于跟踪进度。

    Args:
        background_tasks: FastAPI后台任务
        subtitle_file: 上传的SRT字幕文件
        data: JSON格式的翻译配置参数
        config: 系统配置
        translator: 字幕翻译器

    Returns:
        FileTranslateResponse: 文件翻译响应
    """
    try:
        # 解析请求数据
        import json
        from pydantic import ValidationError

        try:
            request_data = FileTranslateRequest.model_validate(
                json.loads(data)
            )
        except (json.JSONDecodeError, ValidationError) as e:
            raise HTTPException(
                status_code=400, detail=f"请求数据格式错误: {str(e)}"
            )

        # 检查文件类型
        filename = subtitle_file.filename
        if not filename.lower().endswith(".srt"):
            raise HTTPException(
                status_code=400, detail="仅支持SRT格式字幕文件"
            )

        # 保存上传的文件
        temp_dir = config.temp_dir
        os.makedirs(temp_dir, exist_ok=True)

        task_id = str(uuid.uuid4())
        temp_file_path = os.path.join(temp_dir, f"{task_id}_{filename}")

        # 读取并保存文件内容
        content = await subtitle_file.read()
        with open(temp_file_path, "wb") as f:
            f.write(content)

        logger.info(f"字幕文件已保存: {temp_file_path}")

        # 创建任务
        task = SubtitleTranslator.create_task(
            video_id=task_id,
            source_path=temp_file_path,
            source_language=request_data.source_language,
            target_language=request_data.target_language,
            style=request_data.style,
            preserve_formatting=request_data.preserve_formatting,
            context_preservation=request_data.context_preservation,
            chunk_size=request_data.chunk_size,
            context_window=request_data.context_window,
        )

        # 定义异步翻译函数
        async def process_translation_task():
            try:
                # 设置进度回调
                callback = (
                    lambda progress, status, message=None: progress_callback(
                        task.id, progress, status, message
                    )
                )

                # 读取字幕内容
                with open(task.source_path, "r", encoding="utf-8") as f:
                    srt_content = f.read()

                # 优化字幕内容以减少token使用量
                logger.info("优化字幕内容以减少token使用量...")
                optimized_srt, format_map = SRTOptimizer.optimize_srt_content(
                    srt_content
                )

                logger.info(f"优化前内容长度: {len(srt_content)} 字符")
                logger.info(f"优化后内容长度: {len(optimized_srt)} 字符")
                logger.info(
                    f"节省: {len(srt_content) - len(optimized_srt)} 字符"
                )

                # 执行翻译任务
                success = await translator.translate_task(task, callback)

                if success:
                    # 如果需要恢复格式
                    if request_data.preserve_formatting and format_map:
                        # 读取翻译后的内容
                        with open(
                            task.result_path, "r", encoding="utf-8"
                        ) as f:
                            translated_content = f.read()

                        # 恢复格式
                        logger.info("恢复字幕格式...")
                        restored_content = SRTOptimizer.restore_srt_format(
                            translated_content, format_map
                        )

                        # 保存恢复格式后的内容
                        with open(
                            task.result_path, "w", encoding="utf-8"
                        ) as f:
                            f.write(restored_content)

                        logger.info(f"格式已恢复并保存到: {task.result_path}")

                    # 任务完成通知
                    await callback(100.0, "completed", "翻译完成")
                else:
                    # 任务失败通知
                    await callback(
                        task.progress,
                        "failed",
                        task.error_message or "翻译失败",
                    )

            except Exception as e:
                logger.error(f"翻译任务 {task.id} 异常: {e}", exc_info=True)
                # 通知失败
                await callback(0.0, "failed", f"任务失败: {str(e)}")

        # 添加到后台任务
        background_tasks.add_task(process_translation_task)

        # 返回任务信息
        return FileTranslateResponse(
            success=True,
            message="字幕文件翻译任务已提交",
            data={
                "task_id": task.id,
                "source_language": task.source_language,
                "target_language": task.target_language,
                "style": task.config.style.value,
                "file_name": filename,
            },
        )

    except Exception as e:
        logger.error(f"提交字幕文件翻译任务失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"提交翻译任务失败: {str(e)}"
        )


@router.get(
    "/file/{task_id}", response_model=APIResponse, tags=["字幕文件翻译"]
)
async def get_file_translation_status(
    task_id: str,
    config: SystemConfig = Depends(get_system_config),
):
    """获取文件翻译任务状态

    通过任务ID获取文件翻译的当前状态和进度。

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        APIResponse: 任务状态响应
    """
    try:
        # 检查任务ID格式是否有效
        try:
            uuid.UUID(task_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的任务ID格式")

        # 构建可能的结果文件路径模式
        result_path_pattern = os.path.join(
            config.temp_dir, f"{task_id}_*.srt.translated.srt"
        )

        # 查找可能的结果文件
        import glob

        result_files = glob.glob(result_path_pattern)

        if result_files:
            # 找到结果文件，任务已完成
            return APIResponse(
                success=True,
                message="翻译任务已完成",
                data={
                    "task_id": task_id,
                    "status": "completed",
                    "progress": 100.0,
                    "result_path": result_files[0],
                },
            )

        # 检查临时文件是否存在
        temp_file_pattern = os.path.join(config.temp_dir, f"{task_id}_*.srt")
        temp_files = glob.glob(temp_file_pattern)

        if temp_files:
            # 找到临时文件，任务可能正在进行中
            return APIResponse(
                success=True,
                message="翻译任务正在进行中",
                data={
                    "task_id": task_id,
                    "status": "processing",
                    "progress": -1,  # 无法确定具体进度
                },
            )

        # 未找到相关文件
        raise HTTPException(status_code=404, detail=f"未找到任务ID: {task_id}")

    except Exception as e:
        logger.error(f"获取翻译任务状态失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"获取任务状态失败: {str(e)}"
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
