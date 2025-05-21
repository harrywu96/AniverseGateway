"""Ollama服务实现

提供与本地运行的Ollama模型服务通信的功能。
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from backend.schemas.config import AIServiceConfig, OllamaConfig
from backend.services.ai_service import AIService
from backend.utils import TokenCounter, async_retry

logger = logging.getLogger(__name__)


class OllamaService(AIService):
    """Ollama服务实现，用于与本地运行的Ollama模型服务通信"""

    def __init__(self, config: AIServiceConfig):
        """初始化Ollama服务

        Args:
            config: AI服务配置

        Raises:
            ValueError: 配置无效时抛出异常
        """
        if not config.ollama:
            raise ValueError("Ollama配置缺失")

        self.ollama_config: OllamaConfig = config.ollama
        self.api_key = self.ollama_config.api_key.get_secret_value() if self.ollama_config.api_key else None
        self.base_url = self.ollama_config.base_url
        self.model = self.ollama_config.model
        self.max_tokens = self.ollama_config.max_tokens
        self.temperature = self.ollama_config.temperature
        self.top_p = self.ollama_config.top_p
        self.top_k = self.ollama_config.top_k
        self.timeout = self.ollama_config.timeout
        self.max_retries = self.ollama_config.max_retries
        self.token_counter = TokenCounter()

    @async_retry(max_retries=3, retry_delay=1, backoff_factor=2, exceptions=(httpx.HTTPError, json.JSONDecodeError))
    async def _make_chat_request(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """发送聊天请求到Ollama API

        Args:
            messages: 消息列表

        Returns:
            Dict[str, Any]: API响应

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/api/chat"
        headers = {
            "Content-Type": "application/json",
        }
        
        # 如果有API密钥，添加到请求头
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        # Ollama API格式
        payload = {
            "model": self.model,
            "messages": messages,
            "options": {
                "num_predict": self.max_tokens,
                "temperature": self.temperature,
            }
        }
        
        # 添加可选参数
        if self.top_p:
            payload["options"]["top_p"] = self.top_p
        if self.top_k:
            payload["options"]["top_k"] = self.top_k

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
        """使用Ollama API发送聊天完成请求

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
            return response_data["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Ollama API请求失败: {e}")
            raise

    async def get_token_count(self, text: str) -> int:
        """估算文本的token数量

        Args:
            text: 需要计算的token数量的文本

        Returns:
            int: 估算的token数量
        """
        return self.token_counter.estimate_tokens(text)
    
    async def get_models(self) -> List[Dict[str, Any]]:
        """获取可用的Ollama模型列表

        Returns:
            List[Dict[str, Any]]: 模型列表

        Raises:
            Exception: 请求失败时抛出异常
        """
        url = f"{self.base_url}/api/tags"
        headers = {}
        
        # 如果有API密钥，添加到请求头
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                # 转换为标准格式
                models = []
                for model_data in data.get("models", []):
                    models.append({
                        "id": model_data.get("name"),
                        "name": model_data.get("name"),
                        "size": model_data.get("size"),
                        "modified_at": model_data.get("modified_at"),
                        "details": model_data
                    })
                return models
        except Exception as e:
            logger.error(f"获取Ollama模型列表失败: {e}")
            raise
