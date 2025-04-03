"""实时翻译API路由模块

提供单行翻译和字幕片段翻译功能。
"""

import logging
from typing import Optional, Dict, List, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ...schemas.api import APIResponse
from ...schemas.task import TranslationConfig, TranslationStyle, PromptTemplate
from ...schemas.config import SystemConfig, AIProviderType
from ...core.subtitle_translator import SubtitleTranslator
from ...services.translator import SubtitleTranslator as ServiceTranslator
from ..dependencies import get_system_config, get_subtitle_translator


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


# 翻译响应模型
class TranslateResponse(APIResponse):
    """翻译响应模型"""

    class Config:
        schema_extra = {
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

        # 执行翻译
        result = await service_translator.translate_text(
            text=request.text,
            source_language=request.source_language,
            target_language=request.target_language,
            style=request.style,
            context=request.context,
            glossary=glossary,
            template=template,
            with_details=True,
        )

        # 返回翻译结果
        return TranslateResponse(
            success=True,
            message="翻译成功",
            data={
                "translated_text": result.get("translated_text", ""),
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
