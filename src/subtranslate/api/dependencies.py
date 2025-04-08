"""API依赖项模块

本模块提供FastAPI依赖注入功能，用于访问系统配置和各种服务实例。
"""

import os
from typing import Dict
from functools import lru_cache

from ..schemas.config import SystemConfig
from ..core.subtitle_translator import SubtitleTranslator
from ..core.subtitle_extractor import SubtitleExtractor
from ..core.ffmpeg import FFmpegTool
from ..services.video_storage import VideoStorageService


@lru_cache
def get_system_config() -> SystemConfig:
    """获取系统配置，并使用lru_cache缓存结果

    Returns:
        SystemConfig: 系统配置实例
    """
    # 先尝试从环境变量加载配置
    config = SystemConfig.from_env()

    # 确保临时目录存在
    if not os.path.exists(config.temp_dir):
        os.makedirs(config.temp_dir, exist_ok=True)

    return config


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
