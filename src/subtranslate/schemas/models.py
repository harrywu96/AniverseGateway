"""模型相关的数据模型

定义与模型管理相关的请求和响应模型。
"""

from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field

from .api import APIResponse
from .config import ModelCapability


class ModelInfo(BaseModel):
    """模型信息"""

    id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    description: Optional[str] = Field(None, description="模型描述")
    provider: str = Field(..., description="提供商ID")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    capabilities: Optional[List[ModelCapability]] = Field(
        None, description="模型能力"
    )
    parameters: Optional[Dict[str, Any]] = Field(None, description="模型参数")


class ModelsResponse(APIResponse):
    """模型列表响应"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "获取模型列表成功",
                "data": {
                    "models": [
                        {
                            "id": "llama3",
                            "name": "Llama 3",
                            "description": "Meta的Llama 3模型",
                            "provider": "ollama",
                            "context_window": 4096,
                        }
                    ]
                },
            }
        }


class OllamaConfigRequest(BaseModel):
    """Ollama配置请求"""

    base_url: str = Field(..., description="Ollama服务基础URL")
    model: str = Field(..., description="要使用的模型名称")
    api_key: Optional[str] = Field(None, description="API密钥（可选）")
    temperature: Optional[float] = Field(0.3, description="温度参数")
    top_p: Optional[float] = Field(0.7, description="Top P参数")
    top_k: Optional[int] = Field(40, description="Top K参数")


class OllamaConfigResponse(APIResponse):
    """Ollama配置响应"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Ollama配置保存成功",
                "data": {
                    "base_url": "http://localhost:11434",
                    "model": "llama3",
                    "api_key": "********",
                },
            }
        }


class LocalModelConfigRequest(BaseModel):
    """本地模型配置请求"""

    name: str = Field(..., description="模型名称")
    base_url: str = Field(..., description="API基础URL")
    model: str = Field(..., description="要使用的模型名称")
    model_path: Optional[str] = Field(None, description="模型文件路径")
    model_type: str = Field(default="gguf", description="模型类型")
    api_key: Optional[str] = Field(None, description="API密钥（可选）")
    temperature: Optional[float] = Field(0.3, description="温度参数")
    top_p: Optional[float] = Field(0.7, description="Top P参数")
    top_k: Optional[int] = Field(40, description="Top K参数")
    additional_parameters: Optional[Dict[str, Any]] = Field(
        None, description="额外参数"
    )


class LocalModelConfigResponse(APIResponse):
    """本地模型配置响应"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "本地模型配置保存成功",
                "data": {
                    "id": "local_model_1",
                    "name": "本地Llama模型",
                    "base_url": "http://localhost:8080",
                    "model": "llama-7b",
                    "model_path": "/path/to/model.gguf",
                },
            }
        }


class ModelTestRequest(BaseModel):
    """模型测试请求"""

    provider: str = Field(..., description="提供商ID")
    base_url: str = Field(..., description="API基础URL")
    model: Optional[str] = Field(None, description="模型名称")
    api_key: Optional[str] = Field(None, description="API密钥")
    parameters: Optional[Dict[str, Any]] = Field(None, description="额外参数")


class ModelTestResponse(APIResponse):
    """模型测试响应"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "模型连接测试成功",
                "data": {
                    "model": "llama-7b",
                    "response_time": 1.2,
                    "model_info": {"context_window": 4096},
                },
            }
        }
