"""提供商服务管理模块

管理AI服务提供商的配置、测试和模型列表。
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from ..schemas.config import (
    AIProviderType,
    AIServiceConfig,
    CustomAPIConfig,
    FormatType,
    ModelCapability,
    ModelEndpoint,
    CustomModelConfig,
    SystemConfig,
)
from ..schemas.provider import (
    ModelInfo,
    ProviderInfo,
    ProviderModelListResponse,
    ProviderTestResponse,
    ModelTestResult,
)
from .ai_service import AIServiceFactory

logger = logging.getLogger(__name__)


class ProviderService:
    """提供商服务，管理AI提供商的配置和模型信息"""

    def __init__(self, config: SystemConfig):
        """初始化提供商服务

        Args:
            config: 系统配置
        """
        self.config = config
        self.provider_info_cache: Dict[AIProviderType, ProviderInfo] = {}
        self.models_cache: Dict[AIProviderType, List[ModelInfo]] = {}
        self._load_provider_info()
        self._load_predefined_models()

    def _load_provider_info(self) -> None:
        """加载所有提供商信息"""
        # 初始化预定义提供商信息
        self.provider_info_cache = {
            AIProviderType.OPENAI: ProviderInfo(
                id=AIProviderType.OPENAI,
                name="OpenAI",
                description="OpenAI API服务，提供GPT系列模型",
                logo_url="/assets/logos/openai.png",
                website="https://openai.com",
                is_configured=self.config.ai_service.openai is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.OPENAI,
            ),
            AIProviderType.ANTHROPIC: ProviderInfo(
                id=AIProviderType.ANTHROPIC,
                name="Anthropic",
                description="Anthropic Claude系列模型",
                logo_url="/assets/logos/anthropic.png",
                website="https://anthropic.com",
                is_configured=self.config.ai_service.anthropic is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.ANTHROPIC,
            ),
            AIProviderType.GEMINI: ProviderInfo(
                id=AIProviderType.GEMINI,
                name="Google Gemini",
                description="Google Gemini AI模型",
                logo_url="/assets/logos/gemini.png",
                website="https://deepmind.google/technologies/gemini/",
                is_configured=self.config.ai_service.gemini is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.GEMINI,
            ),
            AIProviderType.ZHIPUAI: ProviderInfo(
                id=AIProviderType.ZHIPUAI,
                name="智谱AI",
                description="智谱AI提供的GLM系列模型",
                logo_url="/assets/logos/zhipu.png",
                website="https://open.bigmodel.cn/",
                is_configured=self.config.ai_service.zhipuai is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.ZHIPUAI,
            ),
            AIProviderType.BAIDU: ProviderInfo(
                id=AIProviderType.BAIDU,
                name="百度文心一言",
                description="百度文心一言大模型",
                logo_url="/assets/logos/baidu.png",
                website="https://yiyan.baidu.com/",
                is_configured=self.config.ai_service.baidu is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.BAIDU,
            ),
            AIProviderType.AZURE: ProviderInfo(
                id=AIProviderType.AZURE,
                name="Azure OpenAI",
                description="微软Azure OpenAI服务",
                logo_url="/assets/logos/azure.png",
                website="https://azure.microsoft.com/en-us/products/ai-services/openai-service",
                is_configured=self.config.ai_service.azure is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.AZURE,
            ),
            AIProviderType.VOLCENGINE: ProviderInfo(
                id=AIProviderType.VOLCENGINE,
                name="火山引擎",
                description="字节跳动火山引擎提供的Skylark模型",
                logo_url="/assets/logos/volcengine.png",
                website="https://www.volcengine.com/",
                is_configured=self.config.ai_service.volcengine is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.VOLCENGINE,
            ),
            AIProviderType.SILICONFLOW: ProviderInfo(
                id=AIProviderType.SILICONFLOW,
                name="SiliconFlow",
                description="SiliconFlow AI提供的模型服务",
                logo_url="/assets/logos/siliconflow.png",
                website="https://siliconflow.com/",
                is_configured=self.config.ai_service.siliconflow is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.SILICONFLOW,
            ),
            AIProviderType.OLLAMA: ProviderInfo(
                id=AIProviderType.OLLAMA,
                name="Ollama",
                description="Ollama本地模型服务",
                logo_url="/assets/logos/ollama.png",
                website="https://ollama.ai/",
                is_configured=self.config.ai_service.ollama is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.OLLAMA,
            ),
            AIProviderType.LOCAL: ProviderInfo(
                id=AIProviderType.LOCAL,
                name="本地模型",
                description="其他本地模型服务",
                logo_url="/assets/logos/local.png",
                website="",
                is_configured=self.config.ai_service.local is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.LOCAL,
            ),
            AIProviderType.CUSTOM: ProviderInfo(
                id=AIProviderType.CUSTOM,
                name="自定义API",
                description="自定义API服务",
                logo_url="/assets/logos/custom.png",
                website="",
                is_configured=self.config.ai_service.custom is not None,
                is_active=self.config.ai_service.provider
                == AIProviderType.CUSTOM,
            ),
        }

        # 更新自定义提供商的模型数量
        if (
            self.config.ai_service.custom
            and self.config.ai_service.custom.models
        ):
            self.provider_info_cache[AIProviderType.CUSTOM].model_count = len(
                self.config.ai_service.custom.models
            )
            if self.config.ai_service.custom.model:
                self.provider_info_cache[
                    AIProviderType.CUSTOM
                ].default_model = self.config.ai_service.custom.model

    def _load_predefined_models(self) -> None:
        """加载预定义的模型列表"""
        # OpenAI 模型
        self.models_cache[AIProviderType.OPENAI] = [
            ModelInfo(
                id="gpt-4o",
                name="GPT-4o",
                provider=AIProviderType.OPENAI,
                context_window=128000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                is_default=True,
                description="OpenAI最新的多模态GPT-4o模型",
            ),
            ModelInfo(
                id="gpt-4-turbo",
                name="GPT-4 Turbo",
                provider=AIProviderType.OPENAI,
                context_window=128000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="OpenAI GPT-4 Turbo模型",
            ),
            ModelInfo(
                id="gpt-4",
                name="GPT-4",
                provider=AIProviderType.OPENAI,
                context_window=8192,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="OpenAI GPT-4模型",
            ),
            ModelInfo(
                id="gpt-3.5-turbo",
                name="GPT-3.5 Turbo",
                provider=AIProviderType.OPENAI,
                context_window=16385,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="OpenAI GPT-3.5 Turbo模型",
            ),
        ]

        # Anthropic 模型
        self.models_cache[AIProviderType.ANTHROPIC] = [
            ModelInfo(
                id="claude-3-opus",
                name="Claude 3 Opus",
                provider=AIProviderType.ANTHROPIC,
                context_window=200000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                is_default=True,
                description="Anthropic最强大的Claude 3 Opus模型",
            ),
            ModelInfo(
                id="claude-3-sonnet",
                name="Claude 3 Sonnet",
                provider=AIProviderType.ANTHROPIC,
                context_window=200000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                description="Anthropic Claude 3 Sonnet模型，平衡性能和速度",
            ),
            ModelInfo(
                id="claude-3-haiku",
                name="Claude 3 Haiku",
                provider=AIProviderType.ANTHROPIC,
                context_window=200000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                description="Anthropic Claude 3 Haiku模型，快速响应",
            ),
        ]

        # Gemini 模型
        self.models_cache[AIProviderType.GEMINI] = [
            ModelInfo(
                id="gemini-1.5-pro",
                name="Gemini 1.5 Pro",
                provider=AIProviderType.GEMINI,
                context_window=1000000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                is_default=True,
                description="Google最新的多模态Gemini 1.5 Pro模型",
            ),
            ModelInfo(
                id="gemini-1.5-flash",
                name="Gemini 1.5 Flash",
                provider=AIProviderType.GEMINI,
                context_window=1000000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                description="Google Gemini 1.5 Flash模型，快速响应",
            ),
            ModelInfo(
                id="gemini-pro",
                name="Gemini Pro",
                provider=AIProviderType.GEMINI,
                context_window=32768,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="Google Gemini Pro模型",
            ),
        ]

        # 智谱AI模型
        self.models_cache[AIProviderType.ZHIPUAI] = [
            ModelInfo(
                id="glm-4",
                name="GLM-4",
                provider=AIProviderType.ZHIPUAI,
                context_window=128000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                is_default=True,
                description="智谱AI最新的GLM-4模型",
            ),
            ModelInfo(
                id="glm-3-turbo",
                name="GLM-3-Turbo",
                provider=AIProviderType.ZHIPUAI,
                context_window=32000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="智谱AI GLM-3-Turbo模型",
            ),
        ]

        # 百度文心一言模型
        self.models_cache[AIProviderType.BAIDU] = [
            ModelInfo(
                id="ernie-bot-4",
                name="文心一言4.0",
                provider=AIProviderType.BAIDU,
                context_window=30000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                    ModelCapability.VISION,
                ],
                is_default=True,
                description="百度最新的文心一言4.0模型",
            ),
            ModelInfo(
                id="ernie-bot-turbo",
                name="文心一言Turbo",
                provider=AIProviderType.BAIDU,
                context_window=6000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.COMPLETION,
                ],
                description="百度文心一言Turbo模型",
            ),
        ]

        # 加载自定义模型
        if (
            self.config.ai_service.custom
            and self.config.ai_service.custom.models
        ):
            custom_models = []
            for model_config in self.config.ai_service.custom.models:
                default_model = self.config.ai_service.custom.model
                custom_models.append(
                    ModelInfo(
                        id=model_config.id,
                        name=model_config.name,
                        provider=AIProviderType.CUSTOM,
                        context_window=model_config.context_window,
                        capabilities=model_config.capabilities,
                        is_default=model_config.id == default_model,
                        default_parameters=model_config.parameters,
                    )
                )
            self.models_cache[AIProviderType.CUSTOM] = custom_models

    def get_provider_list(self) -> List[ProviderInfo]:
        """获取所有提供商信息列表

        Returns:
            List[ProviderInfo]: 提供商信息列表
        """
        return list(self.provider_info_cache.values())

    def get_provider_info(
        self, provider_id: AIProviderType
    ) -> Optional[ProviderInfo]:
        """获取指定提供商信息

        Args:
            provider_id: 提供商ID

        Returns:
            Optional[ProviderInfo]: 提供商信息，不存在则返回None
        """
        return self.provider_info_cache.get(provider_id)

    def get_current_provider(self) -> ProviderInfo:
        """获取当前使用的提供商信息

        Returns:
            ProviderInfo: 当前提供商信息
        """
        current_provider = self.config.ai_service.provider
        return self.provider_info_cache.get(
            current_provider, self.provider_info_cache[AIProviderType.OPENAI]
        )

    def get_provider_models(
        self, provider_id: AIProviderType
    ) -> ProviderModelListResponse:
        """获取指定提供商的模型列表

        Args:
            provider_id: 提供商ID

        Returns:
            ProviderModelListResponse: 模型列表响应
        """
        models = self.models_cache.get(provider_id, [])
        return ProviderModelListResponse(provider=provider_id, models=models)

    async def test_provider_connection(
        self,
        provider_id: AIProviderType,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        format_type: Optional[FormatType] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ProviderTestResponse:
        """测试提供商连接

        Args:
            provider_id: 提供商ID
            api_key: API密钥
            base_url: API基础URL
            model: 测试使用的模型
            format_type: API格式类型
            parameters: 额外参数

        Returns:
            ProviderTestResponse: 测试结果
        """
        from pydantic import SecretStr

        try:
            # 创建临时配置用于测试
            temp_config = None
            factory = AIServiceFactory()

            if provider_id == AIProviderType.CUSTOM:
                from ..schemas.config import CustomAPIConfig

                # 使用默认模型或提供的模型
                test_model = model or "default"

                # 使用默认格式或提供的格式
                test_format = format_type or FormatType.OPENAI

                # 创建自定义API配置
                temp_config = CustomAPIConfig(
                    api_key=SecretStr(api_key),
                    base_url=base_url,
                    model=test_model,
                    format_type=test_format,
                    model_parameters=parameters or {},
                )
            elif provider_id == AIProviderType.OPENAI:
                from ..schemas.config import OpenAIConfig

                # 使用默认模型或提供的模型
                test_model = model or "gpt-3.5-turbo"

                # 创建OpenAI配置
                temp_config = OpenAIConfig(
                    api_key=SecretStr(api_key),
                    base_url=base_url,
                    model=test_model,
                )
            # TODO: 为其他提供商添加测试配置

            if not temp_config:
                return ProviderTestResponse(
                    provider=provider_id,
                    success=False,
                    message=f"不支持的提供商测试: {provider_id}",
                    models_tested=[],
                )

            # 创建服务并测试连接
            service = factory.create_service(provider_id, temp_config)

            start_time = time.time()
            test_result = await service.test_connection()
            response_time = time.time() - start_time

            # 格式化测试结果
            model_test_result = ModelTestResult(
                model_id=test_model,
                success=test_result.get("success", False),
                message=test_result.get("message", "测试完成"),
                response_time=response_time,
                response_data=test_result.get("data"),
            )

            return ProviderTestResponse(
                provider=provider_id,
                success=model_test_result.success,
                message=model_test_result.message,
                models_tested=[model_test_result],
            )

        except Exception as e:
            logger.error(f"测试提供商连接失败: {e}", exc_info=True)
            return ProviderTestResponse(
                provider=provider_id,
                success=False,
                message=f"测试失败: {str(e)}",
                models_tested=[],
            )

    def create_custom_provider(
        self,
        name: str,
        api_key: str,
        base_url: str,
        default_model: str,
        format_type: FormatType,
        headers: Dict[str, str],
        models: List[CustomModelConfig],
        endpoints: Dict[str, ModelEndpoint],
        model_parameters: Dict[str, Any],
        custom_parser: Optional[str] = None,
    ) -> bool:
        """创建自定义提供商

        Args:
            name: 提供商名称
            api_key: API密钥
            base_url: API基础URL
            default_model: 默认模型ID
            format_type: API格式类型
            headers: 请求头
            models: 模型列表
            endpoints: API端点
            model_parameters: 模型参数
            custom_parser: 自定义解析器

        Returns:
            bool: 是否创建成功
        """
        from pydantic import SecretStr

        try:
            # 更新自定义提供商配置
            if not self.config.ai_service.custom:
                self.config.ai_service.custom = CustomAPIConfig(
                    api_key=SecretStr(api_key),
                    base_url=base_url,
                    model=default_model,
                    format_type=format_type,
                    headers=headers,
                    model_parameters=model_parameters,
                    endpoints=endpoints,
                    models=models,
                    custom_parser=custom_parser,
                )
            else:
                self.config.ai_service.custom.api_key = SecretStr(api_key)
                self.config.ai_service.custom.base_url = base_url
                self.config.ai_service.custom.model = default_model
                self.config.ai_service.custom.format_type = format_type
                self.config.ai_service.custom.headers = headers
                self.config.ai_service.custom.model_parameters = (
                    model_parameters
                )
                self.config.ai_service.custom.endpoints = endpoints
                self.config.ai_service.custom.models = models
                self.config.ai_service.custom.custom_parser = custom_parser

            # 更新缓存
            self.provider_info_cache[AIProviderType.CUSTOM].name = name
            self.provider_info_cache[AIProviderType.CUSTOM].is_configured = (
                True
            )
            self.provider_info_cache[AIProviderType.CUSTOM].model_count = len(
                models
            )
            self.provider_info_cache[AIProviderType.CUSTOM].default_model = (
                default_model
            )

            # 更新模型缓存
            custom_models = []
            for model_config in models:
                custom_models.append(
                    ModelInfo(
                        id=model_config.id,
                        name=model_config.name,
                        provider=AIProviderType.CUSTOM,
                        context_window=model_config.context_window,
                        capabilities=model_config.capabilities,
                        is_default=model_config.id == default_model,
                        default_parameters=model_config.parameters,
                    )
                )
            self.models_cache[AIProviderType.CUSTOM] = custom_models

            # 保存配置
            # TODO: 实现配置保存逻辑

            return True
        except Exception as e:
            logger.error(f"创建自定义提供商失败: {e}", exc_info=True)
            return False

    def update_provider_config(
        self,
        provider_id: AIProviderType,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        **kwargs,
    ) -> bool:
        """更新提供商配置

        Args:
            provider_id: 提供商ID
            api_key: API密钥
            base_url: API基础URL
            default_model: 默认模型ID
            **kwargs: 其他参数

        Returns:
            bool: 是否更新成功
        """
        from pydantic import SecretStr

        try:
            provider_config = None

            # 根据提供商类型获取配置
            if provider_id == AIProviderType.OPENAI:
                provider_config = self.config.ai_service.openai
                if not provider_config:
                    from ..schemas.config import OpenAIConfig

                    self.config.ai_service.openai = OpenAIConfig(
                        api_key=SecretStr(api_key or ""),
                        base_url=base_url,
                        model=default_model or "gpt-4",
                    )
                    provider_config = self.config.ai_service.openai
            # TODO: 为其他提供商添加配置更新逻辑
            elif provider_id == AIProviderType.CUSTOM:
                provider_config = self.config.ai_service.custom
                if not provider_config:
                    # 对于自定义提供商，需要使用create_custom_provider方法
                    return False

            if not provider_config:
                return False

            # 更新配置
            if api_key:
                provider_config.api_key = SecretStr(api_key)

            if base_url is not None:
                provider_config.base_url = base_url

            if default_model and hasattr(provider_config, "model"):
                provider_config.model = default_model

            # 更新提供商信息缓存
            self.provider_info_cache[provider_id].is_configured = True
            if default_model:
                self.provider_info_cache[provider_id].default_model = (
                    default_model
                )

            # 保存配置
            # TODO: 实现配置保存逻辑

            return True
        except Exception as e:
            logger.error(f"更新提供商配置失败: {e}", exc_info=True)
            return False

    def set_active_provider(self, provider_id: AIProviderType) -> bool:
        """设置活动提供商

        Args:
            provider_id: 提供商ID

        Returns:
            bool: 是否设置成功
        """
        try:
            # 检查提供商是否已配置
            provider_info = self.provider_info_cache.get(provider_id)
            if not provider_info or not provider_info.is_configured:
                return False

            # 更新当前提供商
            self.config.ai_service.provider = provider_id

            # 更新提供商信息缓存
            for pid, info in self.provider_info_cache.items():
                self.provider_info_cache[pid].is_active = pid == provider_id

            # 保存配置
            # TODO: 实现配置保存逻辑

            return True
        except Exception as e:
            logger.error(f"设置活动提供商失败: {e}", exc_info=True)
            return False

    def add_custom_model(
        self,
        model_id: str,
        name: str,
        context_window: int = 4096,
        capabilities: List[ModelCapability] = None,
        parameters: Dict[str, Any] = None,
        is_default: bool = False,
    ) -> bool:
        """添加自定义模型

        Args:
            model_id: 模型ID
            name: 模型名称
            context_window: 上下文窗口大小
            capabilities: 模型能力列表
            parameters: 模型默认参数
            is_default: 是否设为默认模型

        Returns:
            bool: 是否添加成功
        """
        if capabilities is None:
            capabilities = [ModelCapability.CHAT]
        if parameters is None:
            parameters = {}

        try:
            if not self.config.ai_service.custom:
                return False

            # 检查模型ID是否已存在
            existing_models = [
                m.id for m in self.config.ai_service.custom.models
            ]
            if model_id in existing_models:
                return False

            # 创建新模型配置
            new_model = CustomModelConfig(
                id=model_id,
                name=name,
                context_window=context_window,
                capabilities=capabilities,
                parameters=parameters,
            )

            # 添加到模型列表
            self.config.ai_service.custom.models.append(new_model)

            # 如果是默认模型，更新默认模型
            if is_default:
                self.config.ai_service.custom.model = model_id

            # 更新模型缓存
            model_info = ModelInfo(
                id=model_id,
                name=name,
                provider=AIProviderType.CUSTOM,
                context_window=context_window,
                capabilities=capabilities,
                is_default=is_default,
                default_parameters=parameters,
            )

            if AIProviderType.CUSTOM not in self.models_cache:
                self.models_cache[AIProviderType.CUSTOM] = []

            if is_default:
                # 将其他模型设为非默认
                for m in self.models_cache[AIProviderType.CUSTOM]:
                    m.is_default = False

            self.models_cache[AIProviderType.CUSTOM].append(model_info)

            # 更新提供商信息缓存
            self.provider_info_cache[AIProviderType.CUSTOM].model_count = len(
                self.config.ai_service.custom.models
            )
            if is_default:
                self.provider_info_cache[
                    AIProviderType.CUSTOM
                ].default_model = model_id

            # 保存配置
            # TODO: 实现配置保存逻辑

            return True
        except Exception as e:
            logger.error(f"添加自定义模型失败: {e}", exc_info=True)
            return False

    def delete_custom_model(self, model_id: str) -> bool:
        """删除自定义模型

        Args:
            model_id: 模型ID

        Returns:
            bool: 是否删除成功
        """
        try:
            if not self.config.ai_service.custom:
                return False

            # 检查是否为默认模型
            is_default = self.config.ai_service.custom.model == model_id
            if is_default and len(self.config.ai_service.custom.models) > 1:
                # 如果是默认模型且有其他模型，需要设置新的默认模型
                for m in self.config.ai_service.custom.models:
                    if m.id != model_id:
                        self.config.ai_service.custom.model = m.id
                        break

            # 删除模型
            self.config.ai_service.custom.models = [
                m
                for m in self.config.ai_service.custom.models
                if m.id != model_id
            ]

            # 更新模型缓存
            if AIProviderType.CUSTOM in self.models_cache:
                self.models_cache[AIProviderType.CUSTOM] = [
                    m
                    for m in self.models_cache[AIProviderType.CUSTOM]
                    if m.id != model_id
                ]

            # 更新提供商信息缓存
            self.provider_info_cache[AIProviderType.CUSTOM].model_count = len(
                self.config.ai_service.custom.models
            )

            # 保存配置
            # TODO: 实现配置保存逻辑

            return True
        except Exception as e:
            logger.error(f"删除自定义模型失败: {e}", exc_info=True)
            return False
