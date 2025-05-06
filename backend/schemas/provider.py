"""提供商管理相关的API数据模型。"""

from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from backend.schemas.config import (
    AIProviderType,
    FormatType,
    ModelCapability,
    ModelEndpoint,
    CustomModelConfig,
)


class ModelInfo(BaseModel):
    """模型信息"""

    id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    provider: str = Field(..., description="提供商ID")
    context_window: int = Field(default=4096, description="上下文窗口大小")
    capabilities: List[ModelCapability] = Field(
        default=[ModelCapability.CHAT], description="模型能力列表"
    )
    is_default: bool = Field(default=False, description="是否为默认模型")
    description: Optional[str] = Field(None, description="模型描述")
    default_parameters: Dict[str, Any] = Field(
        default_factory=dict, description="默认参数"
    )


class ProviderModelListResponse(BaseModel):
    """提供商模型列表响应"""

    provider: str = Field(..., description="提供商ID")
    models: List[ModelInfo] = Field(
        default_factory=list, description="模型列表"
    )


class ProviderInfo(BaseModel):
    """提供商信息"""

    id: str = Field(..., description="提供商ID")
    name: str = Field(..., description="提供商名称")
    description: Optional[str] = Field(None, description="提供商描述")
    logo_url: Optional[str] = Field(None, description="提供商Logo URL")
    website: Optional[str] = Field(None, description="提供商官网")
    is_configured: bool = Field(default=False, description="是否已配置")
    is_active: bool = Field(default=False, description="是否激活")
    model_count: int = Field(default=0, description="模型数量")
    default_model: Optional[str] = Field(None, description="默认模型ID")


class ProviderListResponse(BaseModel):
    """提供商列表响应"""

    providers: List[ProviderInfo] = Field(
        default_factory=list, description="提供商列表"
    )
    current_provider: Optional[str] = Field(
        None, description="当前使用的提供商ID"
    )


class ProviderCreateRequest(BaseModel):
    """创建自定义提供商请求"""

    name: str = Field(..., description="提供商名称")
    api_key: str = Field(..., description="API密钥")
    base_url: str = Field(..., description="API基础URL")
    default_model: str = Field(..., description="默认模型ID")
    format_type: FormatType = Field(
        default=FormatType.OPENAI, description="API格式类型"
    )
    headers: Dict[str, str] = Field(default_factory=dict, description="请求头")
    models: List[CustomModelConfig] = Field(
        default_factory=list, description="模型列表"
    )
    endpoints: Dict[str, ModelEndpoint] = Field(
        default_factory=dict, description="API端点"
    )
    model_parameters: Dict[str, Any] = Field(
        default_factory=dict, description="模型参数"
    )
    custom_parser: Optional[str] = Field(None, description="自定义解析器")


class ProviderUpdateRequest(BaseModel):
    """更新提供商请求"""

    provider: str = Field(..., description="提供商ID")
    api_key: Optional[str] = Field(None, description="API密钥")
    base_url: Optional[str] = Field(None, description="API基础URL")
    default_model: Optional[str] = Field(None, description="默认模型ID")
    format_type: Optional[FormatType] = Field(None, description="API格式类型")
    headers: Optional[Dict[str, str]] = Field(None, description="请求头")
    models: Optional[List[CustomModelConfig]] = Field(
        None, description="模型列表"
    )
    endpoints: Optional[Dict[str, ModelEndpoint]] = Field(
        None, description="API端点"
    )
    model_parameters: Optional[Dict[str, Any]] = Field(
        None, description="模型参数"
    )
    custom_parser: Optional[str] = Field(None, description="自定义解析器")


class ProviderTestRequest(BaseModel):
    """测试提供商请求"""

    provider: str = Field(..., description="提供商ID")
    api_key: str = Field(..., description="API密钥")
    base_url: Optional[str] = Field(None, description="API基础URL")
    model: Optional[str] = Field(None, description="模型ID")
    format_type: Optional[FormatType] = Field(None, description="API格式类型")
    parameters: Optional[Dict[str, Any]] = Field(None, description="附加参数")


class ModelTestResult(BaseModel):
    """模型测试结果"""

    model_id: str = Field(..., description="模型ID")
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="测试结果消息")
    response_time: float = Field(..., description="响应时间(秒)")
    response_data: Optional[Dict[str, Any]] = Field(
        None, description="响应数据"
    )


class ProviderTestResponse(BaseModel):
    """提供商测试响应"""

    provider: str = Field(..., description="提供商ID")
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="测试结果消息")
    models_tested: List[ModelTestResult] = Field(
        default_factory=list, description="测试过的模型"
    )


class ModelCreateRequest(BaseModel):
    """创建自定义模型请求"""

    provider: str = Field(..., description="提供商ID")
    id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    context_window: int = Field(default=4096, description="上下文窗口大小")
    capabilities: List[ModelCapability] = Field(
        default=[ModelCapability.CHAT], description="模型能力列表"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="模型默认参数"
    )
    is_default: bool = Field(default=False, description="是否设为默认模型")


class ModelDeleteRequest(BaseModel):
    """删除自定义模型请求"""

    provider: str = Field(..., description="提供商ID")
    model_id: str = Field(..., description="模型ID")
