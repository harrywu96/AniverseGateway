"""API依赖项模块

本模块提供FastAPI依赖注入功能，用于访问系统配置和各种服务实例。
"""

import os
import logging
from typing import Dict, Optional
from functools import lru_cache

from fastapi import Depends, HTTPException, Header, Security, status
from fastapi.security import APIKeyHeader

from ..schemas.config import SystemConfig
from ..core.subtitle_translator import SubtitleTranslator
from ..core.subtitle_extractor import SubtitleExtractor
from ..core.ffmpeg import FFmpegTool
from ..services.video_storage import VideoStorageService
from ..services.subtitle_storage import SubtitleStorageService
from ..services.provider_service import ProviderService

logger = logging.getLogger("subtranslate.api.dependencies")

# 定义API密钥安全依赖
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@lru_cache()
def get_system_config() -> SystemConfig:
    """获取系统配置实例

    返回:
        SystemConfig: 系统配置实例
    """
    try:
        return SystemConfig.from_env()
    except Exception as e:
        logger.error(f"加载系统配置失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"加载系统配置失败: {str(e)}",
        )


def get_api_key(
    x_api_key: Optional[str] = Security(api_key_header),
    config: SystemConfig = Depends(get_system_config),
) -> Optional[str]:
    """获取API密钥

    Args:
        x_api_key: 请求头中的API密钥
        config: 系统配置

    Returns:
        Optional[str]: API密钥
    """
    # 如果未配置API密钥，允许所有请求
    if config.api.api_key is None:
        return None

    # 否则验证API密钥
    expected_api_key = config.api.api_key.get_secret_value()
    if x_api_key != expected_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的API密钥",
        )
    return x_api_key


def verify_api_key(
    api_key: Optional[str] = Depends(get_api_key),
) -> None:
    """验证API密钥

    Args:
        api_key: API密钥

    Raises:
        HTTPException: 未通过验证时抛出
    """
    # API密钥为None表示未配置API密钥验证，允许请求
    pass  # 前面已经验证过


def get_provider_service(
    config: SystemConfig = Depends(get_system_config),
) -> ProviderService:
    """获取提供商服务实例

    Args:
        config: 系统配置

    Returns:
        ProviderService: 提供商服务实例
    """
    return ProviderService(config)


def get_subtitle_translator(
    config: SystemConfig = get_system_config(),
) -> SubtitleTranslator:
    """获取字幕翻译器实例

    Args:
        config: 系统配置

    Returns:
        SubtitleTranslator: 字幕翻译器实例
    """
    return SubtitleTranslator(config)


def get_subtitle_extractor(
    config: SystemConfig = get_system_config(),
) -> SubtitleExtractor:
    """获取字幕提取器实例

    Args:
        config: 系统配置

    Returns:
        SubtitleExtractor: 字幕提取器实例
    """
    ffmpeg_tool = FFmpegTool()
    return SubtitleExtractor(ffmpeg_tool)


def get_video_storage(
    config: SystemConfig = get_system_config(),
) -> VideoStorageService:
    """获取视频存储服务实例

    Args:
        config: 系统配置

    Returns:
        VideoStorageService: 视频存储服务实例
    """
    return VideoStorageService(config.temp_dir)


def get_subtitle_storage(
    config: SystemConfig = get_system_config(),
) -> SubtitleStorageService:
    """获取字幕存储服务实例

    Args:
        config: 系统配置

    Returns:
        SubtitleStorageService: 字幕存储服务实例
    """
    return SubtitleStorageService(config.temp_dir)


# 任务管理器实例存储
_task_managers: Dict[str, object] = {}


def get_task_manager(
    task_type: str, config: SystemConfig = get_system_config()
):
    """获取特定类型的任务管理器

    Args:
        task_type: 任务类型
        config: 系统配置

    Returns:
        任务管理器实例
    """
    global _task_managers

    if task_type not in _task_managers:
        # 根据任务类型创建不同的管理器
        if task_type == "translation":
            from ..services.task_manager import TranslationTaskManager

            _task_managers[task_type] = TranslationTaskManager(config)
        # 可以扩展其他类型的任务管理器

    return _task_managers[task_type]
