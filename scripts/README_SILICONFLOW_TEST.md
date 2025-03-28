# SiliconFlow API 测试脚本

这个脚本用于测试 SiliconFlow API 的连接是否正常工作。它会从项目根目录的 `.env` 文件中读取 API 密钥和其他配置信息，然后进行一个简单的 API 调用来验证连接。

## 前提条件

1. 您需要有一个有效的 SiliconFlow API 密钥
2. 已安装项目依赖（特别是 `httpx` 和 `python-dotenv`）

## 设置

1. 在项目根目录创建或编辑 `.env` 文件
2. 添加以下配置（可以参考 `.env.example`）:

```
# SiliconFlow配置
SILICONFLOW_API_KEY=您的API密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V2.5
SILICONFLOW_MAX_TOKENS=4096
SILICONFLOW_TEMPERATURE=0.3
SILICONFLOW_TOP_P=0.7
SILICONFLOW_TOP_K=50
SILICONFLOW_FREQUENCY_PENALTY=0.0
```

必须设置的只有 `SILICONFLOW_API_KEY`，其他配置项都有默认值。

## 运行测试脚本

从项目根目录运行:

```bash
python scripts/test_siliconflow_api.py
```

## 预期输出

如果连接成功，脚本将显示:

```
开始测试SiliconFlow API连接...
使用模型: deepseek-ai/DeepSeek-V2.5
基础URL: https://api.siliconflow.cn/v1

测试成功! API连接正常
API返回的响应:
{
  "id": "...",
  "object": "chat.completion",
  "created": ...,
  "model": "deepseek-ai/DeepSeek-V2.5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": ...,
    "completion_tokens": ...,
    "total_tokens": ...
  }
}

AI回复: ...
```

## 故障排除

如果测试失败，脚本会显示错误信息，可能的原因包括:

1. API 密钥无效或过期
2. 网络连接问题
3. API 端点不可用
4. 错误的模型名称

请检查错误消息以获取更具体的信息。

## 脚本功能

该脚本提供了两种测试方式:

1. 异步API调用 (默认)
2. 同步API调用 (作为备选，如果异步调用失败)

脚本会自动尝试使用异步方式，如果不支持则回退到同步方式。 