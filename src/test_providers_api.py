"""测试提供商API的脚本"""

import os
import json
import asyncio
import httpx
from typing import Dict, Any, Optional


# API基础URL
BASE_URL = "http://localhost:8000/api"


async def test_get_providers() -> Dict[str, Any]:
    """测试获取所有提供商信息"""
    print("\n测试获取所有提供商信息...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/providers")
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_get_provider_info(provider_id: str) -> Dict[str, Any]:
    """测试获取指定提供商信息"""
    print(f"\n测试获取提供商信息: {provider_id}...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/providers/{provider_id}")
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_get_provider_models(provider_id: str) -> Dict[str, Any]:
    """测试获取提供商模型列表"""
    print(f"\n测试获取提供商模型列表: {provider_id}...")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/providers/{provider_id}/models"
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_provider_connection(
    provider_id: str,
    api_key: str,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """测试提供商连接"""
    print(f"\n测试提供商连接: {provider_id}...")
    request_data = {
        "provider": provider_id,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }

    # 移除空值
    request_data = {k: v for k, v in request_data.items() if v is not None}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/providers/test",
            json=request_data,
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_create_custom_provider() -> Dict[str, Any]:
    """测试创建自定义提供商"""
    print("\n测试创建自定义提供商...")
    request_data = {
        "name": "测试自定义API",
        "api_key": "sk-test-key",
        "base_url": "https://api.example.com",
        "default_model": "test-model",
        "format_type": "openai",
        "headers": {
            "X-Custom-Header": "custom-value",
        },
        "models": [
            {
                "id": "test-model",
                "name": "测试模型",
                "context_window": 8192,
                "capabilities": ["chat", "completion"],
                "parameters": {
                    "temperature": 0.5,
                },
            }
        ],
        "endpoints": {},
        "model_parameters": {},
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/providers/custom",
            json=request_data,
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_update_provider(
    provider_id: str, api_key: str
) -> Dict[str, Any]:
    """测试更新提供商配置"""
    print(f"\n测试更新提供商配置: {provider_id}...")
    request_data = {
        "provider": provider_id,
        "api_key": api_key,
    }

    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{BASE_URL}/providers/{provider_id}",
            json=request_data,
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_activate_provider(provider_id: str) -> Dict[str, Any]:
    """测试激活提供商"""
    print(f"\n测试激活提供商: {provider_id}...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/providers/activate/{provider_id}"
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_add_custom_model() -> Dict[str, Any]:
    """测试添加自定义模型"""
    print("\n测试添加自定义模型...")
    request_data = {
        "provider": "custom",
        "id": "new-model",
        "name": "新测试模型",
        "context_window": 16384,
        "capabilities": ["chat", "completion", "vision"],
        "parameters": {
            "temperature": 0.7,
            "top_p": 0.9,
        },
        "is_default": True,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/providers/models",
            json=request_data,
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def test_delete_custom_model(model_id: str) -> Dict[str, Any]:
    """测试删除自定义模型"""
    print(f"\n测试删除自定义模型: {model_id}...")
    request_data = {
        "provider": "custom",
        "model_id": model_id,
    }

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{BASE_URL}/providers/models",
            json=request_data,
        )
        data = response.json()
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data


async def main():
    """主测试函数"""
    # 测试获取所有提供商
    await test_get_providers()

    # 测试获取特定提供商信息
    await test_get_provider_info("openai")

    # 测试获取提供商模型列表
    await test_get_provider_models("openai")

    # 从环境变量获取API密钥
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_api_key:
        # 测试提供商连接
        await test_provider_connection("openai", openai_api_key)

        # 测试更新提供商
        await test_update_provider("openai", openai_api_key)

        # 测试激活提供商
        await test_activate_provider("openai")
    else:
        print("未设置OPENAI_API_KEY环境变量，跳过相关测试")

    # 测试创建自定义提供商
    await test_create_custom_provider()

    # 测试添加自定义模型
    await test_add_custom_model()

    # 测试删除自定义模型
    await test_delete_custom_model("new-model")


if __name__ == "__main__":
    asyncio.run(main())
