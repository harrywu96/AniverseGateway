"""本地模型服务实现

提供与本地运行的模型服务通信的功能。
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from backend.schemas.config import AIServiceConfig, LocalModelConfig, FormatType
from backend.services.ai_service import AIService
from backend.utils import TokenCounter, async_retry

logger = logging.getLogger(__name__)


class LocalModelService(AIService):
    """本地模型服务，用于与本地运行的模型服务通信"""

    def __init__(self, config: AIServiceConfig):
        """初始化本地模型服务

        Args:
            config: AI服务配置

        Raises:
            ValueError: 配置无效时抛出异常
        """
        if not config.local:
            raise ValueError("本地模型配置缺失")

        self.local_config: LocalModelConfig = config.local
        self.api_key = self.local_config.api_key.get_secret_value() if self.local_config.api_key else None
        self.base_url = self.local_config.base_url
        self.model = self.local_config.model
        self.max_tokens = self.local_config.max_tokens
        self.temperature = self.local_config.temperature
        self.format_type = self.local_config.format_type
        self.timeout = self.local_config.timeout
        self.max_retries = self.local_config.max_retries
        self.additional_parameters = self.local_config.additional_parameters
        self.token_counter = TokenCounter()

    @async_retry(max_retries=3, retry_delay=1, backoff_factor=2, exceptions=(httpx.HTTPError, json.JSONDecodeError))
    async def _make_chat_request(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """发送聊天请求到本地模型服务

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        # 根据格式类型构建不同的请求
        if self.format_type == FormatType.OPENAI:
            url = f"{self.base_url}/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
            }
            
            # 如果有API密钥，添加到请求头
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                **self.additional_parameters
            }
        elif self.format_type == FormatType.TEXT_COMPLETION:
            url = f"{self.base_url}/v1/completions"
            headers = {
                "Content-Type": "application/json",
            }
            
            # 如果有API密钥，添加到请求头
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            # 将消息转换为文本
            prompt = ""
            for msg in messages:
                role = msg["role"]
                content = msg["content"]
                if role == "system":
                    prompt += f"System: {content}\n\n"
                elif role == "user":
                    prompt += f"User: {content}\n\n"
                elif role == "assistant":
                    prompt += f"Assistant: {content}\n\n"
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                **self.additional_parameters
            }
        else:
            # 默认使用OpenAI格式
            url = f"{self.base_url}/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
            }
            
            # 如果有API密钥，添加到请求头
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                **self.additional_parameters
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
        """使用本地模型服务发送聊天完成请求

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
            
            # 根据格式类型解析响应
            if self.format_type == FormatType.OPENAI:
                return response_data["choices"][0]["message"]["content"].strip()
            elif self.format_type == FormatType.TEXT_COMPLETION:
                return response_data["choices"][0]["text"].strip()
            else:
                # 默认使用OpenAI格式
                return response_data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"本地模型服务请求失败: {e}")
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return self.token_counter.estimate_tokens(text)
