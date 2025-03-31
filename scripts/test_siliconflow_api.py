#!/usr/bin/env python
"""
SiliconFlow API测试脚本

这个脚本用于测试与SiliconFlow API的连接是否正常工作，
会从.env文件中加载API密钥，并进行一个简单的API调用。
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional

import httpx
from dotenv import load_dotenv

# 将项目根目录添加到系统路径，确保可以导入项目模块
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))


def load_environment_variables() -> Dict[str, str]:
    """
    从.env文件加载环境变量，并返回SiliconFlow相关的配置
    """
    # 加载.env文件
    env_path = root_dir / ".env"
    if not env_path.exists():
        print(
            "错误: 未找到.env文件，请在项目根目录创建.env文件并配置SiliconFlow API密钥"
        )
        print("可以参考.env.example文件中的示例进行配置")
        sys.exit(1)

    load_dotenv(env_path, override=True)

    # 获取SiliconFlow配置
    config = {
        "api_key": os.getenv("SILICONFLOW_API_KEY"),
        "base_url": os.getenv(
            "SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1"
        ),
        "model": os.getenv("SILICONFLOW_MODEL", "deepseek-ai/DeepSeek-V2.5"),
        "max_tokens": int(os.getenv("SILICONFLOW_MAX_TOKENS", "4096")),
        "temperature": float(os.getenv("SILICONFLOW_TEMPERATURE", "0.3")),
        "top_p": float(os.getenv("SILICONFLOW_TOP_P", "0.7")),
        "top_k": int(os.getenv("SILICONFLOW_TOP_K", "50")),
        "frequency_penalty": float(
            os.getenv("SILICONFLOW_FREQUENCY_PENALTY", "0.0")
        ),
    }
    print(config)
    # 验证API密钥是否存在
    if not config["api_key"]:
        print("错误: SILICONFLOW_API_KEY 未在.env文件中设置")
        sys.exit(1)

    return config


async def test_siliconflow_api(
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    测试SiliconFlow API连接是否正常工作

    Args:
        config: SiliconFlow API配置

    Returns:
        API响应的JSON数据，如果发生错误则返回None
    """
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    # 准备请求数据
    payload = {
        "model": config["model"],
        "messages": [
            {"role": "system", "content": "你是一个有用的AI助手。"},
            {
                "role": "user",
                "content": "你好，请简单地回应这条消息以测试API连接。",
            },
        ],
        "max_tokens": config["max_tokens"],
        "temperature": config["temperature"],
        "top_p": config["top_p"],
        "top_k": config["top_k"],
        "frequency_penalty": config["frequency_penalty"],
    }

    # 设置超时时间为30秒
    timeout = httpx.Timeout(30.0)

    try:
        # 创建异步客户端
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{config['base_url']}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code == 200:
                result = response.json()
                return result
            else:
                print(f"错误: API调用失败，状态码: {response.status_code}")
                print(f"响应内容: {response.text}")
                return None
    except Exception as e:
        print(f"错误: 调用API时发生异常: {str(e)}")
        return None


def sync_test_siliconflow_api(
    config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    SiliconFlow API连接测试的同步版本

    Args:
        config: SiliconFlow API配置

    Returns:
        API响应的JSON数据，如果发生错误则返回None
    """
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    # 准备请求数据
    payload = {
        "model": config["model"],
        "messages": [
            {"role": "system", "content": "你是一个有用的AI助手。"},
            {
                "role": "user",
                "content": "你好，请简单地回应这条消息以测试API连接。",
            },
        ],
        "max_tokens": config["max_tokens"],
        "temperature": config["temperature"],
        "top_p": config["top_p"],
        "top_k": config["top_k"],
        "frequency_penalty": config["frequency_penalty"],
    }

    # 设置超时时间为30秒
    timeout = httpx.Timeout(30.0)

    try:
        # 创建同步客户端
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                f"{config['base_url']}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code == 200:
                result = response.json()
                return result
            else:
                print(f"错误: API调用失败，状态码: {response.status_code}")
                print(f"响应内容: {response.text}")
                return None
    except Exception as e:
        print(f"错误: 调用API时发生异常: {str(e)}")
        return None


async def main_async():
    """异步主函数"""
    print("开始测试SiliconFlow API连接...")
    config = load_environment_variables()
    print(f"使用模型: {config['model']}")
    print(f"基础URL: {config['base_url']}")

    result = await test_siliconflow_api(config)
    if result:
        print("\n测试成功! API连接正常")
        print("API返回的响应:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

        # 提取并显示AI的回复
        if "choices" in result and len(result["choices"]) > 0:
            message = result["choices"][0].get("message", {})
            content = message.get("content", "")
            if content:
                print("\nAI回复: " + content)
    else:
        print("\n测试失败! 无法连接到SiliconFlow API")


def main():
    """同步主函数"""
    print("开始测试SiliconFlow API连接...")
    config = load_environment_variables()
    print(f"使用模型: {config['model']}")
    print(f"基础URL: {config['base_url']}")

    result = sync_test_siliconflow_api(config)
    if result:
        print("\n测试成功! API连接正常")
        print("API返回的响应:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

        # 提取并显示AI的回复
        if "choices" in result and len(result["choices"]) > 0:
            message = result["choices"][0].get("message", {})
            content = message.get("content", "")
            if content:
                print("\nAI回复: " + content)
    else:
        print("\n测试失败! 无法连接到SiliconFlow API")


if __name__ == "__main__":
    import asyncio

    # 检查是否能使用异步函数
    try:
        asyncio.run(main_async())
    except (NotImplementedError, RuntimeError):
        # 如果异步运行失败，回退到同步版本
        print("异步运行失败，使用同步方式测试API...")
        main()
