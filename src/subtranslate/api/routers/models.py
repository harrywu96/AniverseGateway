"""模型管理API路由模块

提供模型管理相关的API接口，包括获取模型列表、测试模型连接等功能。
"""

import json
import logging
import os
import uuid
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import SecretStr

from ...schemas.api import APIResponse
from ...schemas.config import (
    SystemConfig,
    AIProviderType,
    LocalModelConfig,
    OllamaConfig,
)
from ...schemas.models import (
    ModelInfo,
    ModelsResponse,
    OllamaConfigRequest,
    OllamaConfigResponse,
    LocalModelConfigRequest,
    LocalModelConfigResponse,
    ModelTestRequest,
    ModelTestResponse,
)
from ...services.ai_service import AIServiceFactory
from ..dependencies import get_system_config

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()


@router.get("", response_model=ModelsResponse, tags=["模型管理"])
async def get_models(
    config: SystemConfig = Depends(get_system_config),
):
    """获取所有可用模型列表

    获取系统支持的所有模型列表，包括Ollama模型和本地模型。

    Args:
        config: 系统配置

    Returns:
        ModelsResponse: 模型列表响应
    """
    try:
        models = []

        # 获取Ollama模型列表（如果已配置）
        if config.ai_service.ollama:
            try:
                # 创建Ollama服务实例
                ollama_service = AIServiceFactory.create_service(
                    AIProviderType.OLLAMA.value, config.ai_service
                )
                # 获取模型列表
                ollama_models = await ollama_service.get_models()
                models.extend(ollama_models)
            except Exception as e:
                logger.warning(f"获取Ollama模型列表失败: {e}")

        # 获取本地模型列表（如果已配置）
        if config.ai_service.local:
            # 本地模型可能没有API获取列表的功能，使用配置中的模型
            local_model = {
                "id": config.ai_service.local.model,
                "name": config.ai_service.local.model,
                "description": "本地模型",
                "provider": AIProviderType.LOCAL.value,
                "context_window": 4096,  # 默认值
            }
            models.append(local_model)

        # 返回模型列表
        return ModelsResponse(
            success=True,
            message="获取模型列表成功",
            data={"models": models},
        )
    except Exception as e:
        logger.error(f"获取模型列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")


@router.post("/test", response_model=ModelTestResponse, tags=["模型管理"])
async def test_model(request: ModelTestRequest):
    """测试模型连接

    测试与指定模型的连接是否正常。

    Args:
        request: 测试请求

    Returns:
        ModelTestResponse: 测试结果响应
    """
    try:
        # 根据提供商类型创建临时配置
        if request.provider == AIProviderType.OLLAMA.value:
            # 创建临时Ollama配置
            ollama_config = OllamaConfig(
                api_key=SecretStr(request.api_key) if request.api_key else None,
                base_url=request.base_url,
                model=request.model or "llama3",
            )
            
            # 创建临时AI服务配置
            from ...schemas.config import AIServiceConfig
            temp_config = AIServiceConfig(
                provider=AIProviderType.OLLAMA,
                ollama=ollama_config,
            )
            
            # 创建服务实例
            service = AIServiceFactory.create_service(
                AIProviderType.OLLAMA.value, temp_config
            )
            
        elif request.provider == AIProviderType.LOCAL.value:
            # 创建临时本地模型配置
            local_config = LocalModelConfig(
                api_key=SecretStr(request.api_key) if request.api_key else None,
                base_url=request.base_url,
                model=request.model or "default",
            )
            
            # 创建临时AI服务配置
            from ...schemas.config import AIServiceConfig
            temp_config = AIServiceConfig(
                provider=AIProviderType.LOCAL,
                local=local_config,
            )
            
            # 创建服务实例
            service = AIServiceFactory.create_service(
                AIProviderType.LOCAL.value, temp_config
            )
            
        else:
            raise HTTPException(
                status_code=400, detail=f"不支持的提供商类型: {request.provider}"
            )
        
        # 测试连接
        test_result = await service.test_connection()
        
        return ModelTestResponse(
            success=test_result.get("success", False),
            message=test_result.get("message", "测试完成"),
            data=test_result,
        )
        
    except Exception as e:
        logger.error(f"测试模型连接失败: {e}", exc_info=True)
        return ModelTestResponse(
            success=False,
            message=f"测试失败: {str(e)}",
            data={"error": str(e)},
        )


@router.post("/ollama", response_model=OllamaConfigResponse, tags=["模型管理"])
async def save_ollama_config(
    request: OllamaConfigRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """保存Ollama配置

    保存Ollama服务的配置信息。

    Args:
        request: Ollama配置请求
        config: 系统配置

    Returns:
        OllamaConfigResponse: 配置保存响应
    """
    try:
        # 创建或更新Ollama配置
        ollama_config = OllamaConfig(
            api_key=SecretStr(request.api_key) if request.api_key else None,
            base_url=request.base_url,
            model=request.model,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
        )
        
        # 更新系统配置
        config.ai_service.ollama = ollama_config
        
        # 保存配置到文件（这里需要实现配置文件的保存逻辑）
        # 由于未实现配置存储机制，目前仅返回成功
        
        return OllamaConfigResponse(
            success=True,
            message="Ollama配置保存成功",
            data={
                "base_url": request.base_url,
                "model": request.model,
                "api_key": "********" if request.api_key else None,
            },
        )
        
    except Exception as e:
        logger.error(f"保存Ollama配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存Ollama配置失败: {str(e)}")


@router.get("/ollama", response_model=APIResponse, tags=["模型管理"])
async def get_ollama_config(
    config: SystemConfig = Depends(get_system_config),
):
    """获取Ollama配置

    获取当前Ollama服务的配置信息。

    Args:
        config: 系统配置

    Returns:
        APIResponse: Ollama配置响应
    """
    try:
        if not config.ai_service.ollama:
            return APIResponse(
                success=True,
                message="Ollama未配置",
                data=None,
            )
            
        # 获取Ollama配置
        ollama_config = config.ai_service.ollama
        
        # 返回配置信息（不包含API密钥）
        return APIResponse(
            success=True,
            message="获取Ollama配置成功",
            data={
                "base_url": ollama_config.base_url,
                "model": ollama_config.model,
                "api_key": "********" if ollama_config.api_key else None,
                "temperature": ollama_config.temperature,
                "top_p": ollama_config.top_p,
                "top_k": ollama_config.top_k,
            },
        )
        
    except Exception as e:
        logger.error(f"获取Ollama配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取Ollama配置失败: {str(e)}")


@router.post("/local", response_model=LocalModelConfigResponse, tags=["模型管理"])
async def save_local_model_config(
    request: LocalModelConfigRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """保存本地模型配置

    保存本地模型的配置信息。

    Args:
        request: 本地模型配置请求
        config: 系统配置

    Returns:
        LocalModelConfigResponse: 配置保存响应
    """
    try:
        # 创建或更新本地模型配置
        local_config = LocalModelConfig(
            api_key=SecretStr(request.api_key) if request.api_key else None,
            base_url=request.base_url,
            model=request.model,
            model_path=request.model_path,
            model_type=request.model_type,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
        )
        
        # 如果有额外参数，添加到配置中
        if request.additional_parameters:
            local_config.additional_parameters = request.additional_parameters
            
        # 更新系统配置
        config.ai_service.local = local_config
        
        # 生成模型ID
        model_id = f"local_{uuid.uuid4().hex[:8]}"
        
        # 保存配置到文件（这里需要实现配置文件的保存逻辑）
        # 由于未实现配置存储机制，目前仅返回成功
        
        return LocalModelConfigResponse(
            success=True,
            message="本地模型配置保存成功",
            data={
                "id": model_id,
                "name": request.name,
                "base_url": request.base_url,
                "model": request.model,
                "model_path": request.model_path,
            },
        )
        
    except Exception as e:
        logger.error(f"保存本地模型配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存本地模型配置失败: {str(e)}")


@router.get("/local", response_model=APIResponse, tags=["模型管理"])
async def get_local_model_config(
    config: SystemConfig = Depends(get_system_config),
):
    """获取本地模型配置

    获取当前本地模型的配置信息。

    Args:
        config: 系统配置

    Returns:
        APIResponse: 本地模型配置响应
    """
    try:
        if not config.ai_service.local:
            return APIResponse(
                success=True,
                message="本地模型未配置",
                data=None,
            )
            
        # 获取本地模型配置
        local_config = config.ai_service.local
        
        # 返回配置信息（不包含API密钥）
        return APIResponse(
            success=True,
            message="获取本地模型配置成功",
            data={
                "base_url": local_config.base_url,
                "model": local_config.model,
                "model_path": local_config.model_path,
                "model_type": local_config.model_type,
                "api_key": "********" if local_config.api_key else None,
                "temperature": local_config.temperature,
                "top_p": local_config.top_p,
                "top_k": local_config.top_k,
            },
        )
        
    except Exception as e:
        logger.error(f"获取本地模型配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取本地模型配置失败: {str(e)}")
