"""自定义AI服务实现模块

提供增强的自定义AI服务实现，支持更灵活的API格式和解析方式。
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import httpx

from backend.schemas.config import (
    CustomAPIConfig,
    FormatType,
    ModelCapability,
    ChatRole,
)
from backend.services.ai_service import AIService, async_retry
from backend.utils import TokenCounter

logger = logging.getLogger(__name__)


class CustomResponseParser:
    """自定义响应解析器，用于解析不同格式的响应"""

    @staticmethod
    def parse_openai_format(response_data: Dict[str, Any]) -> str:
        """解析OpenAI格式的响应

        Args:
            response_data: 响应数据

        Returns:
            str: 响应文本
        """
        try:
            return response_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as e:
            logger.error(f"解析OpenAI格式响应失败: {e}")
            raise ValueError(f"无法解析OpenAI格式响应: {e}")

    @staticmethod
    def parse_anthropic_format(response_data: Dict[str, Any]) -> str:
        """解析Anthropic格式的响应

        Args:
            response_data: 响应数据

        Returns:
            str: 响应文本
        """
        try:
            return response_data["content"][0]["text"].strip()
        except (KeyError, IndexError) as e:
            logger.error(f"解析Anthropic格式响应失败: {e}")
            raise ValueError(f"无法解析Anthropic格式响应: {e}")

    @staticmethod
    def parse_text_completion_format(response_data: Dict[str, Any]) -> str:
        """解析文本补全格式的响应

        Args:
            response_data: 响应数据

        Returns:
            str: 响应文本
        """
        try:
            # 尝试不同的可能路径
            if "text" in response_data:
                return response_data["text"].strip()
            elif (
                "choices" in response_data
                and len(response_data["choices"]) > 0
            ):
                choice = response_data["choices"][0]
                if "text" in choice:
                    return choice["text"].strip()
                elif "content" in choice:
                    return choice["content"].strip()
            elif "response" in response_data:
                return response_data["response"].strip()
            elif "output" in response_data:
                return response_data["output"].strip()
            elif "result" in response_data:
                return response_data["result"].strip()
            elif "generated_text" in response_data:
                return response_data["generated_text"].strip()

            # 如果找不到任何已知路径，返回整个响应的字符串表示
            return json.dumps(response_data)
        except Exception as e:
            logger.error(f"解析文本补全格式响应失败: {e}")
            return json.dumps(response_data)

    @staticmethod
    def execute_custom_parser(code: str, response_data: Dict[str, Any]) -> str:
        """执行自定义解析器代码

        Args:
            code: 解析器代码
            response_data: 响应数据

        Returns:
            str: 解析后的文本
        """
        try:
            # 创建局部变量命名空间
            local_vars = {"response_data": response_data, "result": ""}

            # 执行代码
            exec(code, {}, local_vars)

            # 获取结果
            result = local_vars.get("result", "")

            # 确保结果是字符串
            if not isinstance(result, str):
                result = str(result)

            return result
        except Exception as e:
            logger.error(f"执行自定义解析器失败: {e}", exc_info=True)
            return f"解析器错误: {str(e)}"


class EnhancedCustomAPIService(AIService):
    """增强的自定义API服务实现"""

    def __init__(self, config):
        """初始化增强的自定义API服务

        Args:
            config: 自定义API配置，可以是CustomAPIConfig或CustomProviderConfig
        """
        from backend.schemas.config import (
            CustomAPIConfig,
            CustomProviderConfig,
        )

        self.config = config

        # 处理不同类型的配置
        if isinstance(config, CustomProviderConfig):
            # 如果是单个提供商配置
            self.api_key = config.api_key.get_secret_value()
            self.base_url = config.base_url
            self.model = config.model
            self.max_tokens = config.max_tokens
            self.temperature = config.temperature
            self.timeout = getattr(config, "timeout", 30)
            self.max_retries = getattr(config, "max_retries", 3)
            self.headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                **getattr(config, "headers", {}),
            }
            self.model_parameters = getattr(config, "model_parameters", {})
            self.format_type = getattr(config, "format_type", "openai")
            self.endpoints = getattr(config, "endpoints", {})
            self.custom_parser = getattr(config, "custom_parser", None)
        elif isinstance(config, CustomAPIConfig):
            # 如果是多提供商配置，使用激活的提供商
            active_provider = config.get_active_provider()
            if not active_provider:
                raise ValueError("自定义API配置中没有激活的提供商")

            self.api_key = active_provider.api_key.get_secret_value()
            self.base_url = active_provider.base_url
            self.model = active_provider.model
            self.max_tokens = active_provider.max_tokens
            self.temperature = active_provider.temperature
            self.timeout = getattr(active_provider, "timeout", 30)
            self.max_retries = getattr(active_provider, "max_retries", 3)
            self.headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                **getattr(active_provider, "headers", {}),
            }
            self.model_parameters = getattr(
                active_provider, "model_parameters", {}
            )
            self.format_type = getattr(
                active_provider, "format_type", "openai"
            )
            self.endpoints = getattr(active_provider, "endpoints", {})
            self.custom_parser = getattr(
                active_provider, "custom_parser", None
            )
        else:
            raise ValueError(f"不支持的配置类型: {type(config)}")

        if not self.base_url:
            raise ValueError("自定义API服务需要提供base_url")

        self.parser = CustomResponseParser()
        self.token_counter = TokenCounter()

    def _get_endpoint_url(
        self, capability: ModelCapability = ModelCapability.CHAT
    ) -> str:
        """获取API端点URL

        Args:
            capability: 模型能力

        Returns:
            str: API端点URL
        """
        # 如果定义了特定端点，使用特定端点
        if self.endpoints:
            for endpoint_name, endpoint in self.endpoints.items():
                if capability in endpoint.capabilities:
                    # 确保端点路径与基础URL正确连接
                    if endpoint.path.startswith("/"):
                        return f"{self.base_url.rstrip('/')}{endpoint.path}"
                    else:
                        return f"{self.base_url.rstrip('/')}/{endpoint.path}"

        # 格式化基础URL
        base_url = self._format_api_host(self.base_url)

        # 根据格式类型构建端点URL
        if self.format_type == FormatType.OPENAI:
            return f"{base_url}chat/completions"
        elif self.format_type == FormatType.ANTHROPIC:
            return f"{base_url}messages"
        else:
            return base_url

    def _format_api_host(self, host: str) -> str:
        """格式化API基础URL，类似于Cherry Studio的formatApiHost函数

        Args:
            host: API基础URL

        Returns:
            str: 格式化后的URL
        """
        # 如果已经以斜杠结尾，直接返回
        if host.endswith("/"):
            return host

        # 特殊情况处理，类似于Cherry Studio的逻辑
        if "/api/" in host or "/v1/" in host:
            return f"{host}/"

        # 添加/v1/路径
        return f"{host}/v1/"

    def _format_openai_request(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """格式化OpenAI格式的请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 示例

        Returns:
            Dict[str, Any]: 请求数据
        """
        messages = [{"role": "system", "content": system_prompt}]

        # 添加示例
        if examples and len(examples) > 0:
            for example in examples:
                if "user" in example and "assistant" in example:
                    messages.append(
                        {"role": "user", "content": example["user"]}
                    )
                    messages.append(
                        {"role": "assistant", "content": example["assistant"]}
                    )
                elif "subtitle" in example and "translation" in example:
                    messages.append(
                        {"role": "user", "content": example["subtitle"]}
                    )
                    messages.append(
                        {
                            "role": "assistant",
                            "content": example["translation"],
                        }
                    )

        messages.append({"role": "user", "content": user_prompt})

        return {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            **self.model_parameters,
        }

    def _format_anthropic_request(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """格式化Anthropic格式的请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 示例

        Returns:
            Dict[str, Any]: 请求数据
        """
        messages = []

        # 添加示例
        if examples and len(examples) > 0:
            for example in examples:
                if "user" in example and "assistant" in example:
                    messages.append(
                        {"role": "user", "content": example["user"]}
                    )
                    messages.append(
                        {"role": "assistant", "content": example["assistant"]}
                    )
                elif "subtitle" in example and "translation" in example:
                    messages.append(
                        {"role": "user", "content": example["subtitle"]}
                    )
                    messages.append(
                        {
                            "role": "assistant",
                            "content": example["translation"],
                        }
                    )

        messages.append({"role": "user", "content": user_prompt})

        return {
            "model": self.model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            **self.model_parameters,
        }

    def _format_text_completion_request(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """格式化文本补全格式的请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 示例

        Returns:
            Dict[str, Any]: 请求数据
        """
        # 构建提示文本
        prompt = f"{system_prompt}\n\n"

        # 添加示例
        if examples and len(examples) > 0:
            for example in examples:
                if "user" in example and "assistant" in example:
                    prompt += f"User: {example['user']}\n"
                    prompt += f"Assistant: {example['assistant']}\n\n"
                elif "subtitle" in example and "translation" in example:
                    prompt += f"Original: {example['subtitle']}\n"
                    prompt += f"Translation: {example['translation']}\n\n"

        prompt += f"User: {user_prompt}\nAssistant:"

        return {
            "model": self.model,
            "prompt": prompt,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            **self.model_parameters,
        }

    def _parse_response(self, response_data: Dict[str, Any]) -> str:
        """解析响应数据

        Args:
            response_data: 响应数据

        Returns:
            str: 响应文本
        """
        # 如果有自定义解析器，使用自定义解析器
        if self.custom_parser:
            return self.parser.execute_custom_parser(
                self.custom_parser, response_data
            )

        # 根据格式类型解析
        if self.format_type == FormatType.OPENAI:
            return self.parser.parse_openai_format(response_data)
        elif self.format_type == FormatType.ANTHROPIC:
            return self.parser.parse_anthropic_format(response_data)
        elif self.format_type == FormatType.TEXT_COMPLETION:
            return self.parser.parse_text_completion_format(response_data)
        else:
            # 如果是未知格式，尝试所有解析方法
            try:
                return self.parser.parse_openai_format(response_data)
            except Exception:
                try:
                    return self.parser.parse_anthropic_format(response_data)
                except Exception:
                    return self.parser.parse_text_completion_format(
                        response_data
                    )

    @async_retry(max_retries=3, retry_delay=1, backoff_factor=2)
    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用自定义API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        # 获取API端点URL
        url = self._get_endpoint_url()

        # 根据格式类型格式化请求
        if self.format_type == FormatType.OPENAI:
            payload = self._format_openai_request(
                system_prompt, user_prompt, examples
            )
        elif self.format_type == FormatType.ANTHROPIC:
            payload = self._format_anthropic_request(
                system_prompt, user_prompt, examples
            )
        elif self.format_type == FormatType.TEXT_COMPLETION:
            payload = self._format_text_completion_request(
                system_prompt, user_prompt, examples
            )
        else:
            # 默认使用OpenAI格式
            payload = self._format_openai_request(
                system_prompt, user_prompt, examples
            )

        # 计算超时时间（每1000个token增加5秒超时）
        total_prompt_tokens = await self.get_token_count(
            system_prompt + user_prompt
        )
        dynamic_timeout = self.timeout + (total_prompt_tokens / 1000) * 5

        try:
            logger.info(f"发送请求到: {url}")
            logger.info(
                f"请求头: {dict(self.headers)}"
            )  # 改为info级别便于调试
            logger.info(
                f"请求体: {json.dumps(payload, ensure_ascii=False, indent=2)}"
            )

            async with httpx.AsyncClient(timeout=dynamic_timeout) as client:
                response = await client.post(
                    url, headers=self.headers, json=payload
                )

                # 记录响应状态和内容
                logger.info(
                    f"HTTP响应: {response.status_code} {response.reason_phrase}"
                )
                response_text = response.text
                logger.info(
                    f"响应内容: {response_text[:1000]}{'...' if len(response_text) > 1000 else ''}"
                )

                # 在raise_for_status之前检查具体的错误信息
                if response.status_code >= 400:
                    logger.error(f"API返回错误状态码: {response.status_code}")
                    logger.error(f"错误响应内容: {response_text}")

                response.raise_for_status()

                # 尝试解析JSON
                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    # 如果响应不是JSON格式，尝试处理纯文本响应
                    if response_text.strip():
                        logger.warning(
                            f"响应不是JSON格式，尝试处理为纯文本响应"
                        )
                        # 构造一个简单的兼容结构
                        data = {
                            "choices": [
                                {"message": {"content": response_text}}
                            ]
                        }
                    else:
                        logger.error(f"JSON解析错误: {e}, 响应为空")
                        raise

                # 解析响应
                return self._parse_response(data)
        except httpx.HTTPStatusError as e:
            error_detail = (
                f"HTTP请求错误: {e.response.status_code} - {e.response.text}"
            )
            logger.error(error_detail)
            # 提供更详细的错误信息
            if e.response.status_code == 500:
                error_detail += f"\n请求URL: {url}\n请求头: {dict(self.headers)}\n请求体: {json.dumps(payload, ensure_ascii=False, indent=2)}"
            raise Exception(error_detail)
        except httpx.RequestError as e:
            error_detail = f"请求错误: {e}"
            logger.error(error_detail)
            raise Exception(error_detail)
        except json.JSONDecodeError as e:
            error_detail = f"JSON解析错误: {e}, 响应内容: {response_text[:500] if 'response_text' in locals() else '无法获取响应内容'}"
            logger.error(error_detail)
            raise Exception(error_detail)
        except Exception as e:
            logger.error(f"自定义API请求失败: {e}", exc_info=True)
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return self.token_counter.estimate_tokens(text)

    async def test_connection(
        self, model_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """测试API连接

        Args:
            model_id: 可选的模型ID，如果提供则使用指定模型进行测试

        Returns:
            Dict[str, Any]: 测试结果
        """
        # 如果提供了模型ID，临时切换模型
        original_model = self.model
        if model_id:
            self.model = model_id
            logger.info(f"测试连接使用指定模型: {model_id}")

        try:
            # 获取并记录API端点URL，便于调试
            url = self._get_endpoint_url()
            logger.info(f"测试连接URL: {url}")
            logger.info(f"测试连接请求头: {self.headers}")

            # 简单测试请求
            system_prompt = "You are a helpful assistant."
            user_prompt = "Hello, are you working? Please respond with a simple 'Yes, I am working.'"

            start_time = time.time()
            response = await self.chat_completion(system_prompt, user_prompt)
            elapsed_time = time.time() - start_time

            success = "working" in response.lower()

            return {
                "success": success,
                "message": (
                    f"连接测试成功，响应时间: {elapsed_time:.2f}秒"
                    if success
                    else "响应收到但内容不符合预期"
                ),
                "response": response,
                "response_time": elapsed_time,
                "model_tested": self.model,
            }
        except Exception as e:
            logger.error(f"测试连接失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"测试连接失败: {str(e)}",
                "error": str(e),
                "model_tested": self.model,
            }
        finally:
            # 恢复原始模型
            if model_id:
                self.model = original_model
