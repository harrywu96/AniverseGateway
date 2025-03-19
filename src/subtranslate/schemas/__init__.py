"""数据模型子包，定义所有的Pydantic模型。

此包包含项目中使用的所有数据模型的定义，使用Pydantic实现。
"""

# 从video模块导出
from .video import VideoInfo, VideoFormat, ProcessingStatus

# 从task模块导出
from .task import SubtitleTask, TaskStatus, TranslationConfig, TranslationStyle

# 从api模块导出
from .api import (
    APIResponse,
    VideoUploadRequest,
    TaskCreateRequest,
    VideoListResponse,
    TaskListResponse,
    VideoDetailResponse,
    TaskDetailResponse,
    ErrorResponse,
    ProgressUpdateEvent,
)

# 从config模块导出
from .config import (
    SystemConfig,
    OpenAIConfig,
    FFmpegConfig,
    LoggingConfig,
    APIConfig,
)

__all__ = [
    # video 模块
    "VideoInfo",
    "VideoFormat",
    "ProcessingStatus",
    # task 模块
    "SubtitleTask",
    "TaskStatus",
    "TranslationConfig",
    "TranslationStyle",
    # api 模块
    "APIResponse",
    "VideoUploadRequest",
    "TaskCreateRequest",
    "VideoListResponse",
    "TaskListResponse",
    "VideoDetailResponse",
    "TaskDetailResponse",
    "ErrorResponse",
    "ProgressUpdateEvent",
    # config 模块
    "SystemConfig",
    "OpenAIConfig",
    "FFmpegConfig",
    "LoggingConfig",
    "APIConfig",
]
