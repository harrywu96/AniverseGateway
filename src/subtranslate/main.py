"""SubTranslate 主模块。

该模块是应用程序的入口点，用于启动API服务器和命令行接口。
"""

import os
import sys

from .schemas.video import VideoInfo, VideoFormat, ProcessingStatus
from .schemas.task import SubtitleTask, TaskStatus, TranslationConfig, TranslationStyle
from .schemas.api import (
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
from .schemas.config import (
    SystemConfig,
    OpenAIConfig,
    FFmpegConfig,
    LoggingConfig,
    APIConfig,
)


def test_models():
    """测试模型实例化和验证"""
    # 测试视频信息模型
    video = VideoInfo(
        filename="test.mp4", path="/path/to/test.mp4", format=VideoFormat.MP4
    )
    print(f"视频ID: {video.id}")
    print(f"视频格式: {video.format}")
    print(f"视频状态: {video.status}")

    # 测试任务模型
    config = TranslationConfig(
        style=TranslationStyle.NATURAL,
        preserve_formatting=True,
        glossary={"AI": "人工智能"},
    )
    task = SubtitleTask(
        video_id=video.id, source_path="/path/to/subtitle.srt", config=config
    )
    print(f"任务ID: {task.id}")
    print(f"任务状态: {task.status}")
    print(f"翻译风格: {task.config.style}")

    # 测试API模型
    response = APIResponse(success=True, message="操作成功", data={"id": task.id})
    print(f"API响应: {response.model_dump_json()}")

    # 测试配置模型
    openai_config = OpenAIConfig(api_key="sk-xxx", model="gpt-4")
    system_config = SystemConfig(openai=openai_config, debug=True)
    print(f"系统配置: {system_config.model_dump()}")


if __name__ == "__main__":
    test_models()
    print("所有模型测试通过！")
