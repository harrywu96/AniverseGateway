"""提供商服务管理模块

管理AI服务提供商的配置、测试和模型列表。
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from backend.schemas.config import (
    AIProviderType,
    AIServiceConfig,
    CustomAPIConfig,
    CustomProviderConfig,
    FormatType,
    ModelCapability,
    ModelEndpoint,
    CustomModelConfig,
    SystemConfig,
)
from backend.schemas.provider import (
    ModelInfo,
    ProviderInfo,
    ProviderModelListResponse,
    ProviderTestResponse,
    ModelTestResult,
)
from backend.services.ai_service import AIServiceFactory

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

        # 更新自定义提供商的信息
        if self.config.ai_service.custom:
            # 如果有自定义提供商，则更新为已配置状态
            self.provider_info_cache[AIProviderType.CUSTOM].is_configured = (
                True
            )

            # 如果有激活的提供商，则更新模型数量和默认模型
            active_provider = (
                self.config.ai_service.custom.get_active_provider()
            )
            if active_provider and active_provider.models:
                self.provider_info_cache[AIProviderType.CUSTOM].model_count = (
                    len(active_provider.models)
                )
                if active_provider.model:
                    self.provider_info_cache[
                        AIProviderType.CUSTOM
                    ].default_model = active_provider.model

            # 如果没有激活的提供商，但有提供商列表，则显示提供商数量
            elif self.config.ai_service.custom.providers:
                provider_count = len(self.config.ai_service.custom.providers)
                self.provider_info_cache[AIProviderType.CUSTOM].description = (
                    f"自定义API服务 ({provider_count} 个提供商)"
                )

            # 兼容旧版本的模型数量和默认模型
            if (
                hasattr(self.config.ai_service.custom, "models")
                and self.config.ai_service.custom.models
            ):
                self.provider_info_cache[AIProviderType.CUSTOM].model_count = (
                    len(self.config.ai_service.custom.models)
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
        if self.config.ai_service.custom:
            custom_models = []

            # 先尝试加载当前激活的提供商的模型
            active_provider = (
                self.config.ai_service.custom.get_active_provider()
            )
            if active_provider and active_provider.models:
                for model_config in active_provider.models:
                    default_model = active_provider.model
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
            # 兼容旧版本的模型加载
            elif (
                hasattr(self.config.ai_service.custom, "models")
                and self.config.ai_service.custom.models
            ):
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

            # 如果没有激活的提供商，但有提供商列表，则加载所有提供商的模型
            elif self.config.ai_service.custom.providers:
                for (
                    provider_id,
                    provider,
                ) in self.config.ai_service.custom.providers.items():
                    if provider.models:
                        for model_config in provider.models:
                            # 添加提供商名称前缀，以区分不同提供商的模型
                            model_name = (
                                f"{provider.name}: {model_config.name}"
                            )
                            custom_models.append(
                                ModelInfo(
                                    id=model_config.id,
                                    name=model_name,
                                    provider=AIProviderType.CUSTOM,
                                    context_window=model_config.context_window,
                                    capabilities=model_config.capabilities,
                                    is_default=model_config.id
                                    == provider.model,
                                    default_parameters=model_config.parameters,
                                )
                            )

            if custom_models:
                self.models_cache[AIProviderType.CUSTOM] = custom_models

    def get_provider_list(self) -> List[ProviderInfo]:
        """获取所有提供商信息列表

        Returns:
            List[ProviderInfo]: 提供商信息列表
        """
        # 获取预定义提供商列表
        providers = []

        # 只添加硬基流动提供商
        providers.append(self.provider_info_cache[AIProviderType.SILICONFLOW])

        # 如果有自定义提供商，将每个自定义提供商作为独立提供商添加到列表中
        if (
            self.config.ai_service.custom
            and self.config.ai_service.custom.providers
        ):
            for (
                provider_id,
                provider,
            ) in self.config.ai_service.custom.providers.items():
                # 创建一个唯一的提供商ID，格式为 custom-{provider_id}
                unique_id = f"custom-{provider_id}"

                # 创建提供商信息
                provider_info = ProviderInfo(
                    id=unique_id,  # 使用唯一ID
                    name=provider.name,
                    description=f"自定义提供商: {provider.base_url}",
                    logo_url="/assets/logos/custom.png",
                    website="",
                    is_configured=True,
                    is_active=self.config.ai_service.provider
                    == AIProviderType.CUSTOM
                    and self.config.ai_service.custom.active_provider
                    == provider_id,
                    model_count=len(provider.models) if provider.models else 0,
                    default_model=provider.model if provider.model else None,
                )

                providers.append(provider_info)

        return providers

    def get_provider_info(self, provider_id: str) -> Optional[ProviderInfo]:
        """获取指定提供商信息

        Args:
            provider_id: 提供商ID

        Returns:
            Optional[ProviderInfo]: 提供商信息，不存在则返回None
        """
        # 如果是预定义提供商，直接从缓存中获取
        if provider_id in self.provider_info_cache:
            return self.provider_info_cache.get(provider_id)

        # 如果是自定义提供商，格式为 custom-{provider_id}
        if provider_id.startswith("custom-"):
            # 提取真正的提供商ID
            real_provider_id = provider_id[7:]  # 去除 "custom-" 前缀

            # 检查自定义提供商是否存在
            if (
                self.config.ai_service.custom
                and self.config.ai_service.custom.providers
                and real_provider_id in self.config.ai_service.custom.providers
            ):
                provider = self.config.ai_service.custom.providers[
                    real_provider_id
                ]

                # 创建提供商信息
                return ProviderInfo(
                    id=provider_id,
                    name=provider.name,
                    description=f"自定义提供商: {provider.base_url}",
                    logo_url="/assets/logos/custom.png",
                    website="",
                    is_configured=True,
                    is_active=self.config.ai_service.provider
                    == AIProviderType.CUSTOM
                    and self.config.ai_service.custom.active_provider
                    == real_provider_id,
                    model_count=len(provider.models) if provider.models else 0,
                    default_model=provider.model if provider.model else None,
                )

        return None

    def get_current_provider(self) -> ProviderInfo:
        """获取当前使用的提供商信息

        Returns:
            ProviderInfo: 当前提供商信息
        """
        current_provider = self.config.ai_service.provider

        # 如果是自定义提供商，需要找到对应的custom-{id}
        if (
            current_provider == AIProviderType.CUSTOM
            and self.config.ai_service.custom
            and self.config.ai_service.custom.active_provider
        ):
            # 尝试找到当前激活的自定义提供商
            active_provider_id = self.config.ai_service.custom.active_provider
            custom_provider_id = f"custom-{active_provider_id}"

            # 使用get_provider_info方法获取自定义提供商信息
            provider_info = self.get_provider_info(custom_provider_id)
            if provider_info:
                return provider_info

        # 如果不是自定义提供商或者找不到对应的自定义提供商，则使用预定义提供商
        return self.provider_info_cache.get(
            current_provider,
            self.provider_info_cache[AIProviderType.SILICONFLOW],
        )

    def get_provider_models(
        self, provider_id: str
    ) -> ProviderModelListResponse:
        """获取指定提供商的模型列表

        Args:
            provider_id: 提供商ID

        Returns:
            ProviderModelListResponse: 模型列表响应
        """
        # 如果是预定义提供商，直接从缓存中获取
        if provider_id in self.models_cache:
            models = self.models_cache.get(provider_id, [])
            return ProviderModelListResponse(
                provider=provider_id, models=models
            )

        # 如果是自定义提供商，格式为 custom-{provider_id}
        if provider_id.startswith("custom-"):
            # 提取真正的提供商ID
            real_provider_id = provider_id[7:]  # 去除 "custom-" 前缀

            # 检查自定义提供商是否存在
            if (
                self.config.ai_service.custom
                and self.config.ai_service.custom.providers
                and real_provider_id in self.config.ai_service.custom.providers
            ):
                provider = self.config.ai_service.custom.providers[
                    real_provider_id
                ]

                # 加载该提供商的模型
                custom_models = []
                if provider.models:
                    for model_config in provider.models:
                        custom_models.append(
                            ModelInfo(
                                id=model_config.id,
                                name=model_config.name,
                                provider=provider_id,  # 使用完整的提供商ID
                                context_window=model_config.context_window,
                                capabilities=model_config.capabilities,
                                is_default=model_config.id == provider.model,
                                default_parameters=model_config.parameters,
                            )
                        )

                return ProviderModelListResponse(
                    provider=provider_id, models=custom_models
                )

        # 如果没有找到模型，返回空列表
        return ProviderModelListResponse(provider=provider_id, models=[])

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
                from backend.schemas.config import CustomProviderConfig
                import uuid

                # 使用默认模型或提供的模型
                test_model = model or "default"

                # 使用默认格式或提供的格式
                test_format = format_type or FormatType.OPENAI

                # 创建自定义提供商配置
                temp_config = CustomProviderConfig(
                    id=str(uuid.uuid4()),
                    name="测试提供商",
                    api_key=SecretStr(api_key),
                    base_url=base_url,
                    model=test_model,
                    max_tokens=4096,  # 默认值
                    temperature=0.3,  # 默认值
                    format_type=test_format,
                    model_parameters=parameters or {},
                )
            elif provider_id == AIProviderType.OPENAI:
                from backend.schemas.config import OpenAIConfig

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

            # 记录测试的模型结果
            models_tested = []

            # 测试指定模型
            start_time = time.time()
            test_result = await service.test_connection(model)
            response_time = time.time() - start_time

            # 打印测试结果以便调试
            logger.info(f"测试返回结果: {test_result}")

            # 处理响应数据，确保是字典类型
            response_data = None
            if "response" in test_result:
                response = test_result.get("response")
                if isinstance(response, dict):
                    response_data = response
                elif isinstance(response, str):
                    # 将字符串响应包装在字典中
                    response_data = {"text": response}
                    logger.info(f"将字符串响应包装为字典: {response_data}")

            # 格式化测试结果
            model_test_result = ModelTestResult(
                model_id=test_model,
                success=test_result.get("success", False),
                message=test_result.get("message", "测试完成"),
                response_time=response_time,
                response_data=response_data,
            )
            models_tested.append(model_test_result)

            # 汇总测试结果
            overall_success = any(m.success for m in models_tested)
            overall_message = "测试成功" if overall_success else "测试失败"

            return ProviderTestResponse(
                provider=provider_id,
                success=overall_success,
                message=overall_message,
                models_tested=models_tested,
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
        provider_id: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
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
            provider_id: 提供商ID，如果为None则自动生成

        Returns:
            Tuple[bool, Optional[str]]: (是否创建成功, 提供商ID)
        """
        from pydantic import SecretStr
        import uuid

        try:
            # 生成或使用提供商ID
            if not provider_id:
                provider_id = str(uuid.uuid4())

            # 创建提供商配置
            provider_config = CustomProviderConfig(
                id=provider_id,
                name=name,
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

            # 初始化自定义API配置（如果不存在）
            if not self.config.ai_service.custom:
                self.config.ai_service.custom = CustomAPIConfig(
                    providers={},
                    active_provider=None,
                )

            # 添加或更新提供商
            self.config.ai_service.custom.providers[provider_id] = (
                provider_config
            )

            # 如果没有激活的提供商，则将新提供商设为激活
            if not self.config.ai_service.custom.active_provider:
                self.config.ai_service.custom.active_provider = provider_id

            # 更新缓存
            self.provider_info_cache[AIProviderType.CUSTOM].is_configured = (
                True
            )

            # 如果这是当前激活的提供商，更新模型数量和默认模型
            if self.config.ai_service.custom.active_provider == provider_id:
                self.provider_info_cache[AIProviderType.CUSTOM].model_count = (
                    len(models)
                )
                self.provider_info_cache[
                    AIProviderType.CUSTOM
                ].default_model = default_model

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

            # 如果有多个提供商，更新描述
            if len(self.config.ai_service.custom.providers) > 1:
                provider_count = len(self.config.ai_service.custom.providers)
                self.provider_info_cache[AIProviderType.CUSTOM].description = (
                    f"自定义API服务 ({provider_count} 个提供商)"
                )

            # 保存配置
            self._save_config()

            return True, provider_id
        except Exception as e:
            logger.error(f"创建自定义提供商失败: {e}", exc_info=True)
            return False, None

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
                    from backend.schemas.config import OpenAIConfig

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
            self._save_config()

            return True
        except Exception as e:
            logger.error(f"更新提供商配置失败: {e}", exc_info=True)
            return False

    def set_active_provider(self, provider_id: str) -> bool:
        """设置活动提供商

        Args:
            provider_id: 提供商ID

        Returns:
            bool: 是否设置成功
        """
        try:
            # 如果是自定义提供商，格式为 custom-{provider_id}
            if provider_id.startswith("custom-"):
                # 提取真正的提供商ID
                real_provider_id = provider_id[7:]  # 去除 "custom-" 前缀

                # 检查自定义提供商是否存在
                if (
                    self.config.ai_service.custom
                    and self.config.ai_service.custom.providers
                    and real_provider_id
                    in self.config.ai_service.custom.providers
                ):
                    # 设置当前提供商为自定义提供商
                    self.config.ai_service.provider = AIProviderType.CUSTOM

                    # 设置激活的自定义提供商
                    self.config.ai_service.custom.active_provider = (
                        real_provider_id
                    )

                    # 更新提供商信息缓存
                    for pid in self.provider_info_cache:
                        self.provider_info_cache[pid].is_active = False

                    # 保存配置
                    self._save_config()

                    return True
                else:
                    return False
            else:
                # 如果是预定义提供商
                # 检查提供商是否已配置
                provider_info = self.provider_info_cache.get(provider_id)
                if not provider_info or not provider_info.is_configured:
                    return False

                # 更新当前提供商
                self.config.ai_service.provider = provider_id

                # 更新提供商信息缓存
                for pid in self.provider_info_cache:
                    self.provider_info_cache[pid].is_active = (
                        pid == provider_id
                    )

                # 保存配置
                self._save_config()

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
            self._save_config()

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
            self._save_config()

            return True
        except Exception as e:
            logger.error(f"删除自定义模型失败: {e}", exc_info=True)
            return False

    def set_active_custom_provider(self, provider_id: str) -> bool:
        """设置激活的自定义提供商

        Args:
            provider_id: 提供商ID

        Returns:
            bool: 是否设置成功
        """
        try:
            if (
                not self.config.ai_service.custom
                or not self.config.ai_service.custom.providers
            ):
                return False

            # 检查提供商是否存在
            if provider_id not in self.config.ai_service.custom.providers:
                return False

            # 设置激活的提供商
            self.config.ai_service.custom.active_provider = provider_id

            # 更新模型缓存
            active_provider = self.config.ai_service.custom.providers[
                provider_id
            ]
            if active_provider.models:
                custom_models = []
                for model_config in active_provider.models:
                    custom_models.append(
                        ModelInfo(
                            id=model_config.id,
                            name=model_config.name,
                            provider=AIProviderType.CUSTOM,
                            context_window=model_config.context_window,
                            capabilities=model_config.capabilities,
                            is_default=model_config.id
                            == active_provider.model,
                            default_parameters=model_config.parameters,
                        )
                    )
                self.models_cache[AIProviderType.CUSTOM] = custom_models

                # 更新提供商信息缓存
                self.provider_info_cache[AIProviderType.CUSTOM].model_count = (
                    len(active_provider.models)
                )
                if active_provider.model:
                    self.provider_info_cache[
                        AIProviderType.CUSTOM
                    ].default_model = active_provider.model

            # 保存配置
            self._save_config()

            return True
        except Exception as e:
            logger.error(f"设置激活的自定义提供商失败: {e}", exc_info=True)
            return False

    def delete_custom_provider(self, provider_id: str) -> bool:
        """删除自定义提供商

        Args:
            provider_id: 提供商ID

        Returns:
            bool: 是否删除成功
        """
        try:
            if (
                not self.config.ai_service.custom
                or not self.config.ai_service.custom.providers
            ):
                return False

            # 检查提供商是否存在
            if provider_id not in self.config.ai_service.custom.providers:
                return False

            # 如果是当前激活的提供商，需要切换到其他提供商
            if self.config.ai_service.custom.active_provider == provider_id:
                # 如果有其他提供商，切换到第一个
                other_providers = [
                    p
                    for p in self.config.ai_service.custom.providers.keys()
                    if p != provider_id
                ]
                if other_providers:
                    self.config.ai_service.custom.active_provider = (
                        other_providers[0]
                    )
                else:
                    self.config.ai_service.custom.active_provider = None

            # 删除提供商
            del self.config.ai_service.custom.providers[provider_id]

            # 更新提供商信息缓存
            if len(self.config.ai_service.custom.providers) > 0:
                provider_count = len(self.config.ai_service.custom.providers)
                self.provider_info_cache[AIProviderType.CUSTOM].description = (
                    f"自定义API服务 ({provider_count} 个提供商)"
                )

                # 如果还有激活的提供商，更新模型缓存
                if self.config.ai_service.custom.active_provider:
                    active_provider = self.config.ai_service.custom.providers[
                        self.config.ai_service.custom.active_provider
                    ]
                    if active_provider.models:
                        self.provider_info_cache[
                            AIProviderType.CUSTOM
                        ].model_count = len(active_provider.models)
                        if active_provider.model:
                            self.provider_info_cache[
                                AIProviderType.CUSTOM
                            ].default_model = active_provider.model
            else:
                # 如果没有提供商了，重置信息
                self.provider_info_cache[
                    AIProviderType.CUSTOM
                ].is_configured = False
                self.provider_info_cache[AIProviderType.CUSTOM].model_count = 0
                self.provider_info_cache[
                    AIProviderType.CUSTOM
                ].default_model = None
                self.provider_info_cache[AIProviderType.CUSTOM].description = (
                    "自定义API服务"
                )

            # 保存配置
            self._save_config()

            return True
        except Exception as e:
            logger.error(f"删除自定义提供商失败: {e}", exc_info=True)
            return False

    def _save_config(self) -> bool:
        """保存配置到文件

        Returns:
            bool: 是否保存成功
        """
        try:
            # 如果有自定义提供商，将其保存到配置文件
            if (
                self.config.ai_service.custom
                and self.config.ai_service.custom.providers
            ):
                # 准备保存的数据
                providers_data = {
                    "providers": {},
                    "active_provider": self.config.ai_service.custom.active_provider,
                }

                # 处理每个提供商的数据
                for (
                    provider_id,
                    provider,
                ) in self.config.ai_service.custom.providers.items():
                    # 将SecretStr转换为普通字符串
                    api_key = (
                        provider.api_key.get_secret_value()
                        if provider.api_key
                        else ""
                    )

                    # 处理模型数据
                    models_data = []
                    for model in provider.models:
                        models_data.append(
                            {
                                "id": model.id,
                                "name": model.name,
                                "context_window": model.context_window,
                                "capabilities": [
                                    str(cap) for cap in model.capabilities
                                ],
                                "parameters": model.parameters,
                            }
                        )

                    # 处理端点数据
                    endpoints_data = {}
                    for endpoint_name, endpoint in provider.endpoints.items():
                        endpoints_data[endpoint_name] = {
                            "name": endpoint.name,
                            "path": endpoint.path,
                            "capabilities": [
                                str(cap) for cap in endpoint.capabilities
                            ],
                            "format_type": str(endpoint.format_type),
                            "parameters": endpoint.parameters,
                        }

                    # 添加到提供商数据
                    providers_data["providers"][provider_id] = {
                        "name": provider.name,
                        "api_key": api_key,
                        "base_url": provider.base_url,
                        "model": provider.model,
                        "format_type": str(provider.format_type),
                        "headers": provider.headers,
                        "model_parameters": provider.model_parameters,
                        "models": models_data,
                        "endpoints": endpoints_data,
                        "custom_parser": provider.custom_parser,
                    }

                # 确定配置文件路径
                config_dir = os.path.expanduser("~/.subtranslate")
                os.makedirs(config_dir, exist_ok=True)
                config_file = os.path.join(config_dir, "custom_providers.json")

                # 写入配置文件
                with open(config_file, "w", encoding="utf-8") as f:
                    json.dump(providers_data, f, ensure_ascii=False, indent=2)

                # 设置环境变量，使得下次启动时可以加载该配置
                os.environ["CUSTOM_PROVIDERS_CONFIG"] = config_file

                logger.info(f"已保存自定义提供商配置到: {config_file}")

            return True
        except Exception as e:
            logger.error(f"保存配置失败: {e}", exc_info=True)
            return False
