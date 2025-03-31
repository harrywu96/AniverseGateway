"""SubTranslate 主模块。

该模块是应用程序的入口点，用于启动API服务器和命令行接口。
"""

import os
import sys
import asyncio
import argparse

from .schemas.video import VideoInfo, VideoFormat, ProcessingStatus
from .schemas.task import (
    SubtitleTask,
    TaskStatus,
    TranslationConfig,
    TranslationStyle,
)
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
from .core.subtitle_translator import SubtitleTranslator
from .services.subtitle_export import SubtitleExporter


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
    response = APIResponse(
        success=True, message="操作成功", data={"id": task.id}
    )
    print(f"API响应: {response.model_dump_json()}")

    # 测试配置模型
    openai_config = OpenAIConfig(api_key="sk-xxx", model="gpt-4")
    system_config = SystemConfig(openai=openai_config, debug=True)
    print(f"系统配置: {system_config.model_dump()}")


def main():
    """应用程序主入口点"""
    # 获取命令行参数
    parser = argparse.ArgumentParser(
        description="SubTranslate - 智能视频字幕翻译系统"
    )
    parser.add_argument("--video", "-v", help="视频文件路径")
    parser.add_argument("--subtitle", "-s", help="字幕文件路径（可选）")
    parser.add_argument(
        "--source-lang", "-sl", default="en", help="源语言代码（默认：en）"
    )
    parser.add_argument(
        "--target-lang", "-tl", default="zh", help="目标语言代码（默认：zh）"
    )
    parser.add_argument(
        "--style", default="natural", help="翻译风格（默认：natural）"
    )

    args = parser.parse_args()

    if not args.video and not args.subtitle:
        parser.print_help()
        return

    # 从环境变量加载配置
    config = SystemConfig.from_env()

    # 如果有视频文件，先处理视频提取字幕
    if args.video:
        # 视频处理逻辑...
        pass

    # 如果直接提供了字幕文件，或者已从视频提取了字幕
    subtitle_path = args.subtitle  # 或者从视频提取的字幕路径

    if subtitle_path:
        # 创建翻译任务
        task = SubtitleTranslator.create_task(
            video_id="manual_task",
            source_path=subtitle_path,
            source_language=args.source_lang,
            target_language=args.target_lang,
            style=args.style,
        )

        # 执行翻译
        translator = SubtitleTranslator(config)
        asyncio.run(translator.translate_task(task))

        # 如果任务成功，显示输出文件路径
        if task.status == "completed":
            print(f"翻译完成！输出文件：{task.result_path}")
        else:
            print(f"翻译失败：{task.error_message}")


if __name__ == "__main__":
    test_models()
    main()
    print("所有模型测试通过！")
