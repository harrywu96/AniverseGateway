"""AI服务接口和实现

提供与各种AI服务提供商交互的统一接口。
从 src/subtranslate/services/ai_service.py 迁移而来。
"""

import abc
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from backend.schemas.config import (
    AIProviderType,
    AIServiceConfig,
    AnthropicConfig,
    AzureOpenAIConfig,
    BaiduConfig,
    CustomAPIConfig,
    OpenAIConfig,
    SiliconFlowConfig,
    VolcengineConfig,
    ZhipuAIConfig,
    GeminiConfig,
)
from backend.utils import async_retry, TokenCounter
from backend.core.logging_utils import get_logger

logger = get_logger("aniversegateway.services.ai_service")


class AIService(abc.ABC):
    """AI服务抽象基类，定义与AI模型交互的接口。"""

    @abc.abstractmethod
    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本
        """
        pass

    @abc.abstractmethod
    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的文本

        Returns:
            int: 估算的token数量
        """
        pass


class OpenAIService(AIService):
    """OpenAI服务实现"""

    def __init__(self, config: OpenAIConfig):
        """初始化OpenAI服务

        Args:
            config: OpenAI配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url or "https://api.openai.com/v1"
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def _make_chat_request(
        self, messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """发送聊天请求到OpenAI API

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        # 添加日志输出，显示实际的请求URL
        logger.info(f"发送请求到: {url}")
        logger.debug(f"请求数据: {payload}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用OpenAI API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        try:
            response_data = await self._make_chat_request(messages)
            return response_data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"OpenAI API请求失败: {e}")
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return TokenCounter.estimate_tokens(text)


class ZhipuAIService(AIService):
    """智谱AI服务实现"""

    def __init__(self, config: ZhipuAIConfig):
        """初始化智谱AI服务

        Args:
            config: 智谱AI配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = (
            config.base_url or "https://open.bigmodel.cn/api/paas/v3"
        )
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def _make_chat_request(
        self, messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """发送聊天请求到智谱AI API

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用智谱AI API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        try:
            response_data = await self._make_chat_request(messages)
            return response_data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"智谱AI API请求失败: {e}")
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return TokenCounter.estimate_tokens(text)


class VolcengineService(AIService):
    """火山引擎服务实现"""

    def __init__(self, config: VolcengineConfig):
        """初始化火山引擎服务

        Args:
            config: 火山引擎配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url or "https://nebulaai.volces.com/api"
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用火山引擎API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/v1/chat"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        url, headers=headers, json=payload
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
                except Exception as e:
                    logger.error(
                        f"火山引擎API请求失败 (尝试 {attempt+1}/{self.max_retries}): {e}"
                    )
                    if attempt == self.max_retries - 1:
                        raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量（简单估计）

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        # 简单估计：中文每字一个token，英文每4个字符一个token
        chinese_char_count = sum(
            1 for char in text if "\u4e00" <= char <= "\u9fff"
        )
        non_chinese_char_count = len(text) - chinese_char_count
        return chinese_char_count + (non_chinese_char_count // 4)


class BaiduService(AIService):
    """百度文心一言服务实现"""

    def __init__(self, config: BaiduConfig):
        """初始化百度文心一言服务

        Args:
            config: 百度文心一言配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.secret_key = (
            config.secret_key.get_secret_value() if config.secret_key else None
        )
        self.base_url = config.base_url or "https://aip.baidubce.com"
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries
        self._access_token = None

    async def _get_access_token(self) -> str:
        """获取百度API访问令牌

        Returns:
            str: 访问令牌

        Raises:
            Exception: 获取令牌失败时抛出异常
        """
        if not self.secret_key:
            raise ValueError("百度文心一言服务需要提供secret_key")

        url = f"{self.base_url}/oauth/2.0/token"
        params = {
            "grant_type": "client_credentials",
            "client_id": self.api_key,
            "client_secret": self.secret_key,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用百度文心一言API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        # 获取访问令牌
        if not self._access_token:
            self._access_token = await self._get_access_token()

        url = f"{self.base_url}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{self.model}"
        params = {"access_token": self._access_token}
        headers = {"Content-Type": "application/json"}

        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        payload = {
            "messages": messages,
            "max_output_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        url, params=params, headers=headers, json=payload
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["result"].strip()
                except Exception as e:
                    logger.error(
                        f"百度文心一言API请求失败 (尝试 {attempt+1}/{self.max_retries}): {e}"
                    )
                    if attempt == self.max_retries - 1:
                        raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量（简单估计）

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        # 简单估计：中文每字一个token，英文每4个字符一个token
        chinese_char_count = sum(
            1 for char in text if "\u4e00" <= char <= "\u9fff"
        )
        non_chinese_char_count = len(text) - chinese_char_count
        return chinese_char_count + (non_chinese_char_count // 4)


class AzureOpenAIService(AIService):
    """Azure OpenAI服务实现"""

    def __init__(self, config: AzureOpenAIConfig):
        """初始化Azure OpenAI服务

        Args:
            config: Azure OpenAI配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url
        if not self.base_url:
            raise ValueError("Azure OpenAI服务需要提供base_url")
        self.deployment_name = config.deployment_name
        self.api_version = config.api_version
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用Azure OpenAI API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/openai/deployments/{self.deployment_name}/chat/completions?api-version={self.api_version}"
        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        payload = {
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        url, headers=headers, json=payload
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
                except Exception as e:
                    logger.error(
                        f"Azure OpenAI API请求失败 (尝试 {attempt+1}/{self.max_retries}): {e}"
                    )
                    if attempt == self.max_retries - 1:
                        raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量（简单估计）

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        # 简单估计：中文每字一个token，英文每4个字符一个token
        chinese_char_count = sum(
            1 for char in text if "\u4e00" <= char <= "\u9fff"
        )
        non_chinese_char_count = len(text) - chinese_char_count
        return chinese_char_count + (non_chinese_char_count // 4)


class AnthropicService(AIService):
    """Anthropic Claude服务实现"""

    def __init__(self, config: AnthropicConfig):
        """初始化Anthropic Claude服务

        Args:
            config: Anthropic配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url or "https://api.anthropic.com"
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用Anthropic Claude API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        # Claude的消息格式与其他有所不同
        messages = []

        # 如果有少样本示例，添加到消息中
        examples_text = ""
        if examples and len(examples) > 0:
            examples_text = "Examples:\n\n"
            for example in examples:
                if "subtitle" in example and "translation" in example:
                    examples_text += f"Subtitle: {example['subtitle']}\n"
                    examples_text += (
                        f"Translation: {example['translation']}\n\n"
                    )

        # 构建用户消息，包含系统提示、示例和用户提示
        full_prompt = f"{system_prompt}\n\n{examples_text}{user_prompt}"
        messages.append({"role": "user", "content": full_prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        url, headers=headers, json=payload
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["content"][0]["text"].strip()
                except Exception as e:
                    logger.error(
                        f"Anthropic API请求失败 (尝试 {attempt+1}/{self.max_retries}): {e}"
                    )
                    if attempt == self.max_retries - 1:
                        raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量（简单估计）

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        # 简单估计：中文每字一个token，英文每4个字符一个token
        chinese_char_count = sum(
            1 for char in text if "\u4e00" <= char <= "\u9fff"
        )
        non_chinese_char_count = len(text) - chinese_char_count
        return chinese_char_count + (non_chinese_char_count // 4)


class CustomAPIService(AIService):
    """自定义API服务实现"""

    def __init__(self, config: CustomAPIConfig):
        """初始化自定义API服务

        Args:
            config: 自定义API配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url
        if not self.base_url:
            raise ValueError("自定义API服务需要提供base_url")
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.timeout = config.timeout
        self.max_retries = config.max_retries
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            **config.headers,
        }
        self.model_parameters = config.model_parameters or {}

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
        url = f"{self.base_url}"

        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            **self.model_parameters,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        url, headers=self.headers, json=payload
                    )
                    response.raise_for_status()
                    data = response.json()

                    # 尝试从不同的响应结构中提取文本
                    try:
                        # OpenAI格式
                        return data["choices"][0]["message"]["content"].strip()
                    except (KeyError, IndexError):
                        try:
                            # 其他可能的格式
                            return data.get("response", "").strip()
                        except (KeyError, IndexError):
                            # 返回整个响应
                            return json.dumps(data)
                except Exception as e:
                    logger.error(
                        f"自定义API请求失败 (尝试 {attempt+1}/{self.max_retries}): {e}"
                    )
                    if attempt == self.max_retries - 1:
                        raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量（简单估计）

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        # 简单估计：中文每字一个token，英文每4个字符一个token
        chinese_char_count = sum(
            1 for char in text if "\u4e00" <= char <= "\u9fff"
        )
        non_chinese_char_count = len(text) - chinese_char_count
        return chinese_char_count + (non_chinese_char_count // 4)


class SiliconFlowService(AIService):
    """SiliconFlow AI服务实现"""

    def __init__(self, config: SiliconFlowConfig):
        """初始化SiliconFlow服务

        Args:
            config: SiliconFlow服务配置
        """
        self.config = config
        self.api_key = config.api_key.get_secret_value()
        self.base_url = config.base_url
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.top_p = config.top_p
        self.top_k = config.top_k
        self.frequency_penalty = config.frequency_penalty
        self.token_counter = TokenCounter()
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """发送聊天完成请求到SiliconFlow

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出
        """
        url = f"{self.base_url}/chat/completions"

        # 构建消息列表
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # 添加少样本示例（如果有）
        if examples:
            for example in examples:
                if "user" in example:
                    messages.append(
                        {"role": "user", "content": example["user"]}
                    )
                if "assistant" in example:
                    messages.append(
                        {"role": "assistant", "content": example["assistant"]}
                    )

        # 添加用户消息
        messages.append({"role": "user", "content": user_prompt})

        # 构建请求数据
        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "stream": False,
        }

        # 添加可选参数
        if self.top_p is not None:
            data["top_p"] = self.top_p
        if self.top_k is not None:
            data["top_k"] = self.top_k
        if self.frequency_penalty is not None:
            data["frequency_penalty"] = self.frequency_penalty

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"发送请求到SiliconFlow: {url}")
                logger.debug(f"请求数据: {data}")

                response = await client.post(
                    url, headers=self.headers, json=data
                )
                response.raise_for_status()

                result = response.json()
                logger.debug(f"SiliconFlow响应: {result}")

                if "choices" in result and len(result["choices"]) > 0:
                    message = result["choices"][0]["message"]
                    if "content" in message:
                        return message["content"]

                # 如果没有内容，抛出异常
                err_msg = f"响应格式错误: {result}"
                raise Exception(err_msg)
        except httpx.HTTPError as e:
            logger.error(f"SiliconFlow服务请求失败: {str(e)}")
            if e.response and e.response.content:
                try:
                    error_data = e.response.json()
                    logger.error(f"错误详情: {error_data}")
                except json.JSONDecodeError:
                    err_msg = f"错误响应: {e.response.content}"
                    logger.error(err_msg)
            raise

    async def get_token_count(self, text: str) -> int:
        """计算文本的token数量

        Args:
            text: 要计算的文本

        Returns:
            int: token数量
        """
        # SiliconFlow没有提供token计数API，使用通用计数器
        return self.token_counter.count_tokens(text)


class GeminiService(AIService):
    """Google Gemini AI服务实现"""

    def __init__(self, config: GeminiConfig):
        """初始化Gemini服务

        Args:
            config: Gemini配置
        """
        self.api_key = config.api_key.get_secret_value()
        self.base_url = (
            config.base_url or "https://generativelanguage.googleapis.com/v1"
        )
        self.model = config.model
        self.max_tokens = config.max_tokens
        self.temperature = config.temperature
        self.top_p = config.top_p
        self.top_k = config.top_k
        self.timeout = config.timeout
        self.max_retries = config.max_retries

    async def _make_chat_request(
        self, messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """发送聊天请求到Gemini API

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/models/{self.model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }

        # 转换消息格式为Gemini API格式
        contents = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                # Gemini没有system role，将system提示作为user消息
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append(
                    {"role": "model", "parts": [{"text": content}]}
                )

        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": self.max_tokens,
                "temperature": self.temperature,
                "topP": self.top_p,
                "topK": self.top_k,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        examples: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """使用Gemini API发送聊天完成请求

        Args:
            system_prompt: 系统提示
            user_prompt: 用户提示
            examples: 可选的少样本示例

        Returns:
            str: AI的响应文本

        Raises:
            Exception: 请求失败时抛出异常
        """
        messages = [{"role": "system", "content": system_prompt}]

        # 如果有少样本示例，添加到消息中
        if examples and len(examples) > 0:
            for example in examples:
                if "subtitle" in example and "translation" in example:
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

        try:
            response_data = await self._make_chat_request(messages)
            return response_data["candidates"][0]["content"]["parts"][0][
                "text"
            ].strip()
        except Exception as e:
            logger.error(f"Gemini API请求失败: {e}")
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return TokenCounter.estimate_tokens(text)


class AIServiceFactory:
    """AI服务工厂，根据配置创建相应的AI服务实例"""

    @staticmethod
    def create_service(provider_type: str, config) -> AIService:
        """创建AI服务实例

        Args:
            provider_type: 提供商类型
            config: 提供商配置

        Returns:
            AIService: AI服务实例

        Raises:
            ValueError: 配置无效时抛出异常
        """
        if provider_type == AIProviderType.OPENAI.value:
            return OpenAIService(config)
        elif provider_type == AIProviderType.ZHIPUAI.value:
            return ZhipuAIService(config)
        elif provider_type == AIProviderType.VOLCENGINE.value:
            return VolcengineService(config)
        elif provider_type == AIProviderType.BAIDU.value:
            return BaiduService(config)
        elif provider_type == AIProviderType.AZURE.value:
            return AzureOpenAIService(config)
        elif provider_type == AIProviderType.ANTHROPIC.value:
            return AnthropicService(config)
        elif provider_type == AIProviderType.SILICONFLOW.value:
            return SiliconFlowService(config)
        elif provider_type == AIProviderType.CUSTOM.value:
            # 导入并使用增强的自定义服务
            from backend.services.custom_ai_service import (
                EnhancedCustomAPIService,
            )

            return EnhancedCustomAPIService(config)
        elif provider_type == AIProviderType.GEMINI.value:
            return GeminiService(config)
        elif provider_type == AIProviderType.OLLAMA.value:
            from backend.services.ollama_service import OllamaService

            return OllamaService(config)
        elif provider_type == AIProviderType.LOCAL.value:
            from backend.services.local_model_service import LocalModelService

            return LocalModelService(config)
        else:
            raise ValueError(f"不支持的服务提供商: {provider_type}")
