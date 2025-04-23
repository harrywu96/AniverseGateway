"""提供商管理API路由模块

提供AI服务提供商管理相关的API接口。
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException

from ...schemas.api import APIResponse
from ...schemas.config import AIProviderType, FormatType
from ...schemas.provider import (
    ProviderInfo,
    ProviderListResponse,
    ProviderModelListResponse,
    ProviderTestRequest,
    ProviderCreateRequest,
    ProviderUpdateRequest,
    ModelCreateRequest,
    ModelDeleteRequest,
)
from ...services.provider_service import ProviderService
from ..dependencies import get_system_config, get_provider_service

# 配置日志
logger = logging.getLogger("subtranslate.api.providers")

# 创建路由器
router = APIRouter()


@router.get("", response_model=APIResponse, tags=["提供商管理"])
async def get_providers(
    provider_service: ProviderService = Depends(get_provider_service),
):
    """获取所有提供商信息

    获取系统支持的所有AI服务提供商信息。

    Returns:
        APIResponse: 提供商列表响应
    """
    try:
        providers = provider_service.get_provider_list()
        current_provider_info = provider_service.get_current_provider()
        current_provider = (
            current_provider_info.id if current_provider_info else None
        )

        response = ProviderListResponse(
            providers=providers,
            current_provider=current_provider,
        )

        return APIResponse(
            success=True,
            message="获取提供商列表成功",
            data=response.model_dump(),
        )
    except Exception as e:
        logger.error(f"获取提供商列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取提供商列表失败: {str(e)}"
        )


@router.get("/{provider_id}", response_model=APIResponse, tags=["提供商管理"])
async def get_provider_info(
    provider_id: str,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """获取指定提供商信息

    获取指定AI服务提供商的详细信息。

    Args:
        provider_id: 提供商ID

    Returns:
        APIResponse: 提供商信息响应
    """
    try:
        provider_info = provider_service.get_provider_info(provider_id)
        print("provider_info", provider_info)
        if not provider_info:
            raise HTTPException(
                status_code=404, detail=f"未找到提供商: {provider_id}"
            )

        return APIResponse(
            success=True,
            message="获取提供商信息成功",
            data=provider_info.model_dump(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取提供商信息失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取提供商信息失败: {str(e)}"
        )


@router.get(
    "/{provider_id}/models", response_model=APIResponse, tags=["提供商管理"]
)
async def get_provider_models(
    provider_id: str,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """获取提供商模型列表

    获取指定AI服务提供商支持的模型列表。

    Args:
        provider_id: 提供商ID

    Returns:
        APIResponse: 模型列表响应
    """
    try:
        # 获取提供商信息，检查是否存在
        provider_info = provider_service.get_provider_info(provider_id)
        if not provider_info:
            raise HTTPException(
                status_code=404, detail=f"未找到提供商: {provider_id}"
            )

        # 获取模型列表
        models_response = provider_service.get_provider_models(provider_id)

        return APIResponse(
            success=True,
            message="获取模型列表成功",
            data=models_response.model_dump(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取提供商模型列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取提供商模型列表失败: {str(e)}"
        )


@router.post("/test", response_model=APIResponse, tags=["提供商管理"])
async def test_provider(
    request: ProviderTestRequest,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """测试提供商连接

    测试与指定AI服务提供商的连接是否正常。

    Args:
        request: 测试请求

    Returns:
        APIResponse: 测试结果响应
    """
    try:
        test_result = await provider_service.test_provider_connection(
            provider_id=request.provider,
            api_key=request.api_key,
            base_url=request.base_url,
            model=request.model,
            format_type=request.format_type,
            parameters=request.parameters,
        )

        return APIResponse(
            success=test_result.success,
            message=test_result.message,
            data=test_result.model_dump(),
        )
    except Exception as e:
        logger.error(f"测试提供商连接失败: {e}", exc_info=True)
        return APIResponse(
            success=False,
            message=f"测试失败: {str(e)}",
            data={"error": str(e)},
        )


@router.post("/custom", response_model=APIResponse, tags=["提供商管理"])
async def create_custom_provider(
    request: ProviderCreateRequest,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """创建自定义提供商

    创建一个新的自定义API服务提供商。

    Args:
        request: 创建请求

    Returns:
        APIResponse: 创建结果响应
    """
    try:
        success, provider_id = provider_service.create_custom_provider(
            name=request.name,
            api_key=request.api_key,
            base_url=request.base_url,
            default_model=request.default_model,
            format_type=request.format_type,
            headers=request.headers,
            models=request.models,
            endpoints=request.endpoints,
            model_parameters=request.model_parameters,
            custom_parser=request.custom_parser,
        )

        if not success:
            return APIResponse(
                success=False,
                message="创建自定义提供商失败",
                data=None,
            )

        return APIResponse(
            success=True,
            message="创建自定义提供商成功",
            data={
                "provider_type": AIProviderType.CUSTOM,
                "provider_id": provider_id,
            },
        )
    except Exception as e:
        logger.error(f"创建自定义提供商失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"创建自定义提供商失败: {str(e)}"
        )


@router.put("/{provider_id}", response_model=APIResponse, tags=["提供商管理"])
async def update_provider(
    provider_id: str,
    request: ProviderUpdateRequest,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """更新提供商配置

    更新指定AI服务提供商的配置。

    Args:
        provider_id: 提供商ID
        request: 更新请求

    Returns:
        APIResponse: 更新结果响应
    """
    try:
        if provider_id != request.provider:
            raise HTTPException(
                status_code=400, detail="路径参数与请求体中的提供商ID不匹配"
            )

        # 对于自定义提供商的特殊处理
        if provider_id == "custom" and (request.models or request.endpoints):
            # 这里需要更完整的更新逻辑，但为了简单起见，暂时不实现
            success = provider_service.update_provider_config(
                provider_id=provider_id,
                api_key=request.api_key,
                base_url=request.base_url,
                default_model=request.default_model,
            )
        else:
            # 普通提供商更新
            success = provider_service.update_provider_config(
                provider_id=provider_id,
                api_key=request.api_key,
                base_url=request.base_url,
                default_model=request.default_model,
            )

        if not success:
            return APIResponse(
                success=False,
                message="更新提供商配置失败",
                data=None,
            )

        return APIResponse(
            success=True,
            message="更新提供商配置成功",
            data=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新提供商配置失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"更新提供商配置失败: {str(e)}"
        )


@router.post(
    "/activate/{provider_id}", response_model=APIResponse, tags=["提供商管理"]
)
async def activate_provider(
    provider_id: str,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """激活提供商

    设置指定的AI服务提供商为当前活动提供商。

    Args:
        provider_id: 提供商ID

    Returns:
        APIResponse: 激活结果响应
    """
    try:
        success = provider_service.set_active_provider(provider_id)

        if not success:
            return APIResponse(
                success=False,
                message=f"激活提供商失败: {provider_id} 可能未配置",
                data=None,
            )

        return APIResponse(
            success=True,
            message=f"成功激活提供商: {provider_id}",
            data=None,
        )
    except Exception as e:
        logger.error(f"激活提供商失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"激活提供商失败: {str(e)}"
        )


@router.post("/models", response_model=APIResponse, tags=["提供商管理"])
async def create_model(
    request: ModelCreateRequest,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """创建模型

    为指定的AI服务提供商创建一个新的模型配置。
    目前仅支持为自定义提供商创建模型。

    Args:
        request: 创建请求

    Returns:
        APIResponse: 创建结果响应
    """
    try:
        # 目前仅支持为自定义提供商创建模型
        if request.provider != "custom":
            raise HTTPException(
                status_code=400, detail="目前仅支持为自定义提供商创建模型"
            )

        success = provider_service.add_custom_model(
            model_id=request.id,
            name=request.name,
            context_window=request.context_window,
            capabilities=request.capabilities,
            parameters=request.parameters,
            is_default=request.is_default,
        )

        if not success:
            return APIResponse(
                success=False,
                message="创建模型失败，可能模型ID已存在",
                data=None,
            )

        return APIResponse(
            success=True,
            message="创建模型成功",
            data={"model_id": request.id},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建模型失败: {str(e)}")


@router.delete("/models", response_model=APIResponse, tags=["提供商管理"])
async def delete_model(
    request: ModelDeleteRequest,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """删除模型

    删除指定的模型配置。
    目前仅支持删除自定义提供商的模型。

    Args:
        request: 删除请求

    Returns:
        APIResponse: 删除结果响应
    """
    try:
        # 目前仅支持删除自定义提供商的模型
        if request.provider != "custom":
            raise HTTPException(
                status_code=400, detail="目前仅支持删除自定义提供商的模型"
            )

        success = provider_service.delete_custom_model(request.model_id)

        if not success:
            return APIResponse(
                success=False,
                message="删除模型失败",
                data=None,
            )

        return APIResponse(
            success=True,
            message="删除模型成功",
            data=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除模型失败: {str(e)}")


@router.post(
    "/custom/{provider_id}/activate",
    response_model=APIResponse,
    tags=["提供商管理"],
)
async def activate_custom_provider(
    provider_id: str,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """激活自定义提供商

    将指定的自定义提供商设置为当前激活的自定义提供商。

    Args:
        provider_id: 提供商ID

    Returns:
        APIResponse: 激活结果响应
    """
    try:
        success = provider_service.set_active_custom_provider(provider_id)

        if not success:
            return APIResponse(
                success=False,
                message=f"激活自定义提供商失败: 提供商ID {provider_id} 不存在",
                data=None,
            )

        return APIResponse(
            success=True,
            message=f"成功激活自定义提供商",
            data={"provider_id": provider_id},
        )
    except Exception as e:
        logger.error(f"激活自定义提供商失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"激活自定义提供商失败: {str(e)}"
        )


@router.delete(
    "/custom/{provider_id}", response_model=APIResponse, tags=["提供商管理"]
)
async def delete_custom_provider(
    provider_id: str,
    provider_service: ProviderService = Depends(get_provider_service),
):
    """删除自定义提供商

    删除指定的自定义提供商。

    Args:
        provider_id: 提供商ID

    Returns:
        APIResponse: 删除结果响应
    """
    try:
        success = provider_service.delete_custom_provider(provider_id)

        if not success:
            return APIResponse(
                success=False,
                message=f"删除自定义提供商失败: 提供商ID {provider_id} 不存在",
                data=None,
            )

        return APIResponse(
            success=True,
            message=f"删除自定义提供商成功",
            data=None,
        )
    except Exception as e:
        logger.error(f"删除自定义提供商失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"删除自定义提供商失败: {str(e)}"
        )


@router.get("/custom/list", response_model=APIResponse, tags=["提供商管理"])
async def list_custom_providers(
    provider_service: ProviderService = Depends(get_provider_service),
):
    """获取所有自定义提供商

    获取所有已配置的自定义提供商列表。

    Returns:
        APIResponse: 自定义提供商列表响应
    """
    try:
        # 获取自定义提供商列表
        if (
            not provider_service.config.ai_service.custom
            or not provider_service.config.ai_service.custom.providers
        ):
            return APIResponse(
                success=True,
                message="没有自定义提供商",
                data={"providers": [], "active_provider": None},
            )

        # 准备提供商数据
        providers_data = []
        for (
            provider_id,
            provider,
        ) in provider_service.config.ai_service.custom.providers.items():
            # 将SecretStr转换为描述性文本
            api_key_masked = "********" if provider.api_key else ""

            providers_data.append(
                {
                    "id": provider_id,
                    "name": provider.name,
                    "base_url": provider.base_url,
                    "api_key": api_key_masked,
                    "model": provider.model,
                    "format_type": str(provider.format_type),
                    "model_count": (
                        len(provider.models) if provider.models else 0
                    ),
                    "is_active": provider_id
                    == provider_service.config.ai_service.custom.active_provider,
                }
            )

        return APIResponse(
            success=True,
            message="获取自定义提供商列表成功",
            data={
                "providers": providers_data,
                "active_provider": provider_service.config.ai_service.custom.active_provider,
            },
        )
    except Exception as e:
        logger.error(f"获取自定义提供商列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取自定义提供商列表失败: {str(e)}"
        )
