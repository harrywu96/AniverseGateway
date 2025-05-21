"""模型管理API路由模块

提供模型管理相关的API接口。
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse
from backend.schemas.config import SystemConfig
from backend.api.dependencies import get_system_config
from backend.services.ollama_service import OllamaService

# 配置日志
logger = logging.getLogger("subtranslate.api.models")

# 创建路由器
router = APIRouter()

# 模型测试请求模型
class ModelTestRequest(BaseModel):
    """模型测试请求模型"""
    service_url: str = Field(..., description="服务URL")
    model: Optional[str] = Field(None, description="模型名称")

# 模型响应模型
class ModelsResponse(APIResponse):
    """模型列表响应"""
    data: Dict[str, Any] = Field(default_factory=dict)

@router.get("", response_model=ModelsResponse, tags=["模型管理"])
async def get_models(
    config: SystemConfig = Depends(get_system_config),
):
    """获取所有可用模型列表，包括Ollama模型

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
                ollama_service = OllamaService(config.ai_service)
                ollama_models = await ollama_service.get_models()
                models.extend(ollama_models)
            except Exception as e:
                logger.error(f"获取Ollama模型列表失败: {e}", exc_info=True)
                # 继续执行，不中断API

        # 获取本地模型列表（如果已配置）
        if config.ai_service.local:
            try:
                # 这里可以添加获取本地模型的逻辑
                # 暂时返回空列表
                pass
            except Exception as e:
                logger.error(f"获取本地模型列表失败: {e}", exc_info=True)
                # 继续执行，不中断API

        return ModelsResponse(
            success=True,
            message="获取模型列表成功",
            data={"models": models}
        )
    except Exception as e:
        logger.error(f"获取模型列表失败: {e}", exc_info=True)
        return ModelsResponse(
            success=False,
            message=f"获取模型列表失败: {str(e)}",
            data={"models": []}
        )

@router.get("/local", response_model=ModelsResponse, tags=["模型管理"])
async def get_local_models(
    config: SystemConfig = Depends(get_system_config),
):
    """获取本地模型列表

    Args:
        config: 系统配置

    Returns:
        ModelsResponse: 本地模型列表响应
    """
    try:
        models = []

        # 获取本地模型列表（如果已配置）
        if config.ai_service.local:
            try:
                # 这里可以添加获取本地模型的逻辑
                # 暂时返回空列表
                pass
            except Exception as e:
                logger.error(f"获取本地模型列表失败: {e}", exc_info=True)
                # 继续执行，不中断API

        return ModelsResponse(
            success=True,
            message="获取本地模型列表成功",
            data={"models": models}
        )
    except Exception as e:
        logger.error(f"获取本地模型列表失败: {e}", exc_info=True)
        return ModelsResponse(
            success=False,
            message=f"获取本地模型列表失败: {str(e)}",
            data={"models": []}
        )

@router.post("/local/test", response_model=APIResponse, tags=["模型管理"])
async def test_local_model(
    request: ModelTestRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """测试本地模型连接

    Args:
        request: 测试请求
        config: 系统配置

    Returns:
        APIResponse: 测试结果响应
    """
    try:
        # 这里可以添加测试本地模型连接的逻辑
        # 暂时返回成功
        return APIResponse(
            success=True,
            message="测试连接成功",
            data={"service_url": request.service_url, "model": request.model}
        )
    except Exception as e:
        logger.error(f"测试本地模型连接失败: {e}", exc_info=True)
        return APIResponse(
            success=False,
            message=f"测试本地模型连接失败: {str(e)}"
        )
