"""配置模型的单元测试。"""

import os
import pytest
from unittest import mock
from pathlib import Path

from subtranslate.schemas.config import (
    OpenAIConfig,
    FFmpegConfig,
    LoggingConfig,
    APIConfig,
    SystemConfig,
)


def test_openai_config():
    """测试 OpenAI 配置模型"""
    config = OpenAIConfig(api_key="test_key")
    assert config.api_key.get_secret_value() == "test_key"
    assert config.model == "gpt-4"
    assert config.max_tokens == 4096
    assert config.temperature == 0.3


def test_ffmpeg_config():
    """测试 FFmpeg 配置模型"""
    config = FFmpegConfig()
    assert config.ffmpeg_path is None
    assert config.ffprobe_path is None
    assert config.threads == 4

    config = FFmpegConfig(
        ffmpeg_path="/usr/bin/ffmpeg", ffprobe_path="/usr/bin/ffprobe", threads=8
    )
    assert config.ffmpeg_path == "/usr/bin/ffmpeg"
    assert config.ffprobe_path == "/usr/bin/ffprobe"
    assert config.threads == 8


def test_logging_config():
    """测试日志配置模型"""
    config = LoggingConfig()
    assert config.level == "INFO"
    assert config.file_path is None

    config = LoggingConfig(level="DEBUG", file_path="/var/log/app.log")
    assert config.level == "DEBUG"
    assert config.file_path == "/var/log/app.log"


def test_api_config():
    """测试 API 配置模型"""
    config = APIConfig()
    assert config.host == "0.0.0.0"
    assert config.port == 8000
    assert config.workers == 4
    assert config.allowed_origins == ["http://localhost:3000"]
    assert config.api_key is None

    config = APIConfig(
        host="127.0.0.1", port=5000, allowed_origins=["https://example.com"]
    )
    assert config.host == "127.0.0.1"
    assert config.port == 5000
    assert config.allowed_origins == ["https://example.com"]


def test_system_config():
    """测试系统配置模型"""
    openai_config = OpenAIConfig(api_key="test_key")
    config = SystemConfig(openai=openai_config, debug=True, max_concurrent_tasks=4)

    assert config.openai.api_key.get_secret_value() == "test_key"
    assert config.ffmpeg.threads == 4
    assert config.logging.level == "INFO"
    assert config.api.host == "0.0.0.0"
    assert config.max_concurrent_tasks == 4
    assert config.debug is True
    assert config.allowed_formats == ["mp4", "mkv"]


@mock.patch.dict(
    os.environ,
    {
        "OPENAI_API_KEY": "env_test_key",
        "OPENAI_MODEL": "gpt-3.5-turbo",
        "FFMPEG_PATH": "/custom/ffmpeg",
        "LOG_LEVEL": "DEBUG",
        "API_PORT": "9000",
        "ALLOWED_ORIGINS": "http://localhost:3000,https://example.com",
        "MAX_CONCURRENT_TASKS": "8",
        "APP_DEBUG": "true",
    },
)
def test_system_config_from_env():
    """测试从环境变量加载系统配置"""
    # 模拟 load_dotenv 函数
    with mock.patch("dotenv.load_dotenv"):
        config = SystemConfig.from_env()

    # 验证从环境变量加载的配置
    assert config.openai.api_key.get_secret_value() == "env_test_key"
    assert config.openai.model == "gpt-3.5-turbo"
    assert config.ffmpeg.ffmpeg_path == "/custom/ffmpeg"
    assert config.logging.level == "DEBUG"
    assert config.api.port == 9000
    assert len(config.api.allowed_origins) == 2
    assert "http://localhost:3000" in config.api.allowed_origins
    assert "https://example.com" in config.api.allowed_origins
    assert config.max_concurrent_tasks == 8
    assert config.debug is True
