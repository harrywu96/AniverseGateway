"""配置管理API路由模块

提供系统配置的获取和更新功能。
"""

import logging
import os
import json
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, SecretStr

from ...schemas.api import APIResponse
from ...schemas.config import SystemConfig, AIProviderType, BaseAIConfig
from ..dependencies import get_system_config


# 配置日志
logger = logging.getLogger("subtranslate.api.config")


# 创建路由器
router = APIRouter()


# 配置更新请求模型
class ConfigUpdateRequest(BaseModel):
    """配置更新请求模型，用于部分更新系统配置"""

    ai_provider: Optional[AIProviderType] = Field(
        None, description="AI服务提供商"
    )
    api_key: Optional[str] = Field(None, description="API密钥")
    model: Optional[str] = Field(None, description="模型名称")
    base_url: Optional[str] = Field(None, description="API基础URL")
    parameters: Optional[Dict[str, Any]] = Field(None, description="模型参数")
    output_dir: Optional[str] = Field(None, description="输出目录")
    allowed_formats: Optional[list] = Field(None, description="允许的视频格式")
    max_concurrent_tasks: Optional[int] = Field(
        None, description="最大并发任务数"
    )


# AI提供商验证请求
class ProviderTestRequest(BaseModel):
    """AI提供商验证请求模型"""

    provider: AIProviderType = Field(..., description="AI服务提供商")
    api_key: str = Field(..., description="API密钥")
    model: Optional[str] = Field(None, description="模型名称")
    base_url: Optional[str] = Field(None, description="API基础URL")
    parameters: Optional[Dict[str, Any]] = Field(None, description="附加参数")


@router.get("", response_model=APIResponse, tags=["配置管理"])
async def get_config(
    config: SystemConfig = Depends(get_system_config),
    include_secrets: bool = Query(False, description="是否包含敏感信息"),
):
    """获取系统配置

    获取当前系统配置，可选择是否包含敏感信息。

    Args:
        config: 系统配置
        include_secrets: 是否包含敏感信息

    Returns:
        APIResponse: 系统配置响应
    """
    # 转换为字典，移除敏感信息
    config_dict = config.model_dump()

    # 如果不包含敏感信息，移除所有密钥
    if not include_secrets:
        # 移除所有API密钥
        for provider_key in config_dict.get("ai_service", {}):
            if isinstance(
                config_dict["ai_service"].get(provider_key), dict
            ) and "api_key" in config_dict["ai_service"].get(provider_key, {}):
                config_dict["ai_service"][provider_key]["api_key"] = "********"

    return APIResponse(success=True, message="获取配置成功", data=config_dict)


@router.put("", response_model=APIResponse, tags=["配置管理"])
async def update_config(
    request: ConfigUpdateRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """更新系统配置

    部分更新系统配置，仅更新请求中包含的字段。

    Args:
        request: 配置更新请求
        config: 系统配置

    Returns:
        APIResponse: 更新结果响应
    """
    try:
        # 更新AI提供商
        if request.ai_provider:
            config.ai_service.provider = request.ai_provider

        # 更新API密钥
        if request.api_key and request.ai_provider:
            provider_config = config.ai_service.get_provider_config()
            if provider_config:
                provider_config.api_key = SecretStr(request.api_key)

        # 更新模型名称
        if request.model and request.ai_provider:
            provider_config = config.ai_service.get_provider_config()
            if provider_config and hasattr(provider_config, "model"):
                provider_config.model = request.model

        # 更新API基础URL
        if request.base_url and request.ai_provider:
            provider_config = config.ai_service.get_provider_config()
            if provider_config:
                provider_config.base_url = request.base_url

        # 更新输出目录
        if request.output_dir:
            if not os.path.exists(request.output_dir):
                os.makedirs(request.output_dir, exist_ok=True)
            config.output_dir = request.output_dir

        # 更新允许的视频格式
        if request.allowed_formats:
            config.allowed_formats = request.allowed_formats

        # 更新最大并发任务数
        if request.max_concurrent_tasks is not None:
            config.max_concurrent_tasks = request.max_concurrent_tasks

        # 保存配置到文件（这里需要实现配置文件的保存逻辑）
        # 由于未实现配置存储机制，目前仅返回成功

        return APIResponse(success=True, message="配置更新成功", data=None)

    except Exception as e:
        logger.error(f"更新配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


@router.post("/providers/test", response_model=APIResponse, tags=["配置管理"])
async def test_provider(request: ProviderTestRequest):
    """测试AI服务提供商配置

    测试指定AI服务提供商的API密钥和配置是否有效。

    Args:
        request: 提供商测试请求

    Returns:
        APIResponse: 测试结果响应
    """
    try:
        # 导入相关服务模块
        from ...services.ai_service import AIServiceFactory

        # 创建临时配置
        provider_config = None

        # 根据提供商类型创建相应配置
        if request.provider == AIProviderType.OPENAI:
            from ...schemas.config import OpenAIConfig

            provider_config = OpenAIConfig(
                api_key=SecretStr(request.api_key),
                model=request.model or "gpt-3.5-turbo",
            )
            if request.base_url:
                provider_config.base_url = request.base_url

        elif request.provider == AIProviderType.ZHIPUAI:
            from ...schemas.config import ZhipuAIConfig

            provider_config = ZhipuAIConfig(
                api_key=SecretStr(request.api_key),
                model=request.model or "glm-4",
            )
            if request.base_url:
                provider_config.base_url = request.base_url

        # 可以为其他提供商添加类似的配置创建逻辑

        if not provider_config:
            return APIResponse(
                success=False,
                message=f"不支持的AI服务提供商: {request.provider}",
                data=None,
            )

        # 创建AI服务
        factory = AIServiceFactory()
        service = factory.create_service(
            request.provider.value, provider_config
        )

        # 测试连接
        test_result = await service.test_connection()

        return APIResponse(
            success=test_result.get("success", False),
            message=test_result.get("message", "测试完成"),
            data=test_result,
        )

    except Exception as e:
        logger.error(f"测试AI服务提供商失败: {e}", exc_info=True)
        return APIResponse(
            success=False,
            message=f"测试失败: {str(e)}",
            data={"error": str(e)},
        )
