"""提示模板管理API路由模块

提供翻译提示模板的管理功能。
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse
from backend.schemas.task import PromptTemplate
from backend.schemas.config import SystemConfig
from backend.core.subtitle_translator import SubtitleTranslator
from backend.api.dependencies import get_system_config, get_subtitle_translator


# 配置日志
logger = logging.getLogger("subtranslate.api.templates")


# 创建路由器
router = APIRouter()


# 模板创建/更新请求模型
class TemplateRequest(BaseModel):
    """模板创建或更新请求模型"""

    name: str = Field(..., description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    system_prompt: str = Field(..., description="系统提示")
    user_prompt: str = Field(..., description="用户提示")
    examples: Optional[List[Dict[str, str]]] = Field(
        None, description="少样本示例"
    )
    is_default: Optional[bool] = Field(None, description="是否为默认模板")
    version: Optional[str] = Field(None, description="模板版本")


@router.get("", response_model=APIResponse, tags=["提示模板"])
async def list_templates(
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """获取所有可用模板

    获取系统内置和用户自定义的所有提示模板列表。

    Args:
        translator: 字幕翻译器

    Returns:
        APIResponse: 模板列表响应
    """
    try:
        # 获取所有可用模板
        templates = translator.get_available_templates()

        # 转换为可序列化的字典列表
        template_list = []
        for name, template in templates.items():
            template_dict = template.model_dump()
            template_dict["name"] = name
            template_list.append(template_dict)

        return APIResponse(
            success=True, message="获取模板列表成功", data=template_list
        )

    except Exception as e:
        logger.error(f"获取模板列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取模板列表失败: {str(e)}"
        )


@router.post("", response_model=APIResponse, tags=["提示模板"])
async def create_template(
    request: TemplateRequest,
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """创建新模板

    创建自定义翻译提示模板。

    Args:
        request: 模板创建请求
        translator: 字幕翻译器

    Returns:
        APIResponse: 创建结果响应
    """
    try:
        # 检查模板是否已存在
        templates = translator.get_available_templates()
        if request.name in templates:
            return APIResponse(
                success=False,
                message=f"模板 '{request.name}' 已存在，请使用PUT方法更新",
                data=None,
            )

        # 创建新模板
        template = PromptTemplate(
            name=request.name,
            description=request.description or "",
            system_prompt=request.system_prompt,
            user_prompt=request.user_prompt,
            examples=request.examples or [],
            is_default=request.is_default or False,
            version=request.version or "1.0",
        )

        # 保存模板
        success = translator.save_custom_template(template)

        if success:
            return APIResponse(
                success=True,
                message="创建模板成功",
                data=template.model_dump(),
            )
        else:
            return APIResponse(
                success=False, message="创建模板失败", data=None
            )

    except Exception as e:
        logger.error(f"创建模板失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建模板失败: {str(e)}")


@router.put("/{name}", response_model=APIResponse, tags=["提示模板"])
async def update_template(
    name: str,
    request: TemplateRequest,
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """更新模板

    更新已存在的翻译提示模板。

    Args:
        name: 模板名称
        request: 模板更新请求
        translator: 字幕翻译器

    Returns:
        APIResponse: 更新结果响应
    """
    try:
        # 检查模板是否存在
        templates = translator.get_available_templates()
        if name not in templates:
            return APIResponse(
                success=False, message=f"模板 '{name}' 不存在", data=None
            )

        # 检查是否为内置模板
        template = templates[name]
        is_builtin = any(
            name == t.name
            for t in translator.service_translator.default_templates.values()
        )
        if is_builtin:
            return APIResponse(
                success=False, message=f"内置模板 '{name}' 不能修改", data=None
            )

        # 更新模板
        new_template = PromptTemplate(
            name=request.name,
            description=request.description or template.description,
            system_prompt=request.system_prompt,
            user_prompt=request.user_prompt,
            examples=request.examples or template.examples,
            is_default=(
                request.is_default
                if request.is_default is not None
                else template.is_default
            ),
            version=request.version or template.version,
        )

        # 如果修改了名称，需要先删除旧模板
        if name != request.name:
            translator.delete_custom_template(name)

        # 保存新模板
        success = translator.save_custom_template(new_template)

        if success:
            return APIResponse(
                success=True,
                message="更新模板成功",
                data=new_template.model_dump(),
            )
        else:
            return APIResponse(
                success=False, message="更新模板失败", data=None
            )

    except Exception as e:
        logger.error(f"更新模板失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新模板失败: {str(e)}")


@router.delete("/{name}", response_model=APIResponse, tags=["提示模板"])
async def delete_template(
    name: str,
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """删除模板

    删除自定义翻译提示模板。

    Args:
        name: 模板名称
        translator: 字幕翻译器

    Returns:
        APIResponse: 删除结果响应
    """
    try:
        # 检查模板是否存在
        templates = translator.get_available_templates()
        if name not in templates:
            return APIResponse(
                success=False, message=f"模板 '{name}' 不存在", data=None
            )

        # 检查是否为内置模板
        is_builtin = any(
            name == t.name
            for t in translator.service_translator.default_templates.values()
        )
        if is_builtin:
            return APIResponse(
                success=False, message=f"内置模板 '{name}' 不能删除", data=None
            )

        # 删除模板
        success = translator.delete_custom_template(name)

        if success:
            return APIResponse(
                success=True, message=f"删除模板 '{name}' 成功", data=None
            )
        else:
            return APIResponse(
                success=False, message=f"删除模板 '{name}' 失败", data=None
            )

    except Exception as e:
        logger.error(f"删除模板失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除模板失败: {str(e)}")
