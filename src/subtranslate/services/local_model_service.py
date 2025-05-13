"""本地模型服务

提供与本地运行的模型服务通信的功能，支持GGUF格式的模型。
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..schemas.config import AIServiceConfig, LocalModelConfig
from .ai_service import AIService
from .utils import async_retry, TokenCounter

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

        self.config = config.local
        self.api_key = (
            self.config.api_key.get_secret_value()
            if self.config.api_key
            else None
        )
        self.base_url = self.config.base_url
        self.model = self.config.model
        self.model_path = self.config.model_path
        self.model_type = self.config.model_type
        self.max_tokens = self.config.max_tokens
        self.temperature = self.config.temperature
        self.top_p = self.config.top_p
        self.top_k = self.config.top_k
        self.timeout = self.config.timeout
        self.max_retries = self.config.max_retries
        self.token_counter = TokenCounter()

        # 设置请求头
        self.headers = {"Content-Type": "application/json"}
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"

    @async_retry(exceptions=(httpx.HTTPError, json.JSONDecodeError))
    async def _make_chat_request(
        self, messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """发送聊天请求到本地模型服务

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/v1/chat/completions"

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        # 添加可选参数
        if self.top_p is not None:
            payload["top_p"] = self.top_p
        if self.top_k is not None:
            payload["top_k"] = self.top_k

        # 添加其他额外参数
        if self.config.additional_parameters:
            payload.update(self.config.additional_parameters)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=self.headers, json=payload)
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
        return self.token_counter.count_tokens(text)

    async def test_connection(self) -> Dict[str, Any]:
        """测试与本地模型服务的连接

        Returns:
            Dict[str, Any]: 测试结果
        """
        try:
            # 发送简单的测试请求
            test_message = [
                {"role": "user", "content": "Hello, are you working?"}
            ]
            response = await self._make_chat_request(test_message)
            
            # 检查响应是否包含预期的字段
            if "choices" in response and len(response["choices"]) > 0:
                return {
                    "success": True,
                    "message": "连接测试成功",
                    "model_info": {
                        "model": self.model,
                        "model_type": self.model_type,
                    },
                }
            else:
                return {
                    "success": False,
                    "message": "连接测试失败: 响应格式不正确",
                    "error": "响应缺少必要字段",
                }
        except Exception as e:
            logger.error(f"本地模型服务连接测试失败: {e}")
            return {
                "success": False,
                "message": f"连接测试失败: {str(e)}",
                "error": str(e),
            }
