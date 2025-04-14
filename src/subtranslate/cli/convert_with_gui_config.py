#!/usr/bin/env python
"""使用Faster Whisper GUI配置文件转写视频或音频为字幕的命令行工具。

此工具读取Faster Whisper GUI配置文件，并使用其设置将视频或音频文件转换为字幕文件。
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import List, Optional

from subtranslate.core.speech_to_text import SpeechToText
from subtranslate.core.faster_whisper_config_util import (
    load_faster_whisper_gui_config,
)


# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("convert_with_gui_config")


def convert_files(
    input_files: List[str],
    gui_config_path: str,
    output_dir: Optional[str] = None,
    keep_audio: bool = False,
    show_progress: bool = False,
) -> List[Path]:
    """使用GUI配置转写文件

    Args:
        input_files: 输入文件列表
        gui_config_path: GUI配置文件路径
        output_dir: 输出目录
        keep_audio: 是否保留提取的音频文件
        show_progress: 是否显示进度

    Returns:
        生成的字幕文件路径列表
    """
    # 加载配置并创建转写器
    speech_to_text = SpeechToText.from_gui_config(gui_config_path)

    # 进度回调函数
    def progress_callback(progress: float) -> None:
        if show_progress:
            # 显示进度条
            bar_width = 30
            filled_len = int(round(bar_width * progress))
            bar = "=" * filled_len + "-" * (bar_width - filled_len)
            percent = int(progress * 100)
            sys.stdout.write(f"\r[{bar}] {percent}%")
            sys.stdout.flush()
            if progress >= 1.0:
                sys.stdout.write("\n")

    # 转写每个文件
    output_files = []

    for input_file in input_files:
        input_path = Path(input_file)

        if not input_path.exists():
            logger.error(f"文件不存在: {input_path}")
            continue

        logger.info(f"处理文件: {input_path}")

        try:
            # 设置输出目录
            output_path = None
            if output_dir:
                out_dir = Path(output_dir)
                out_dir.mkdir(parents=True, exist_ok=True)
                output_path = out_dir

            # 判断文件类型
            file_ext = input_path.suffix.lower()
            is_video = file_ext in [
                ".mp4",
                ".mkv",
                ".avi",
                ".mov",
                ".flv",
                ".webm",
            ]

            # 根据文件类型调用不同的转写方法
            if is_video:
                result = speech_to_text.transcribe_video(
                    video_path=input_path,
                    output_dir=output_path,
                    keep_audio=keep_audio,
                    progress_callback=progress_callback,
                )
            else:
                result = speech_to_text.transcribe_audio(
                    audio_path=input_path,
                    output_dir=output_path,
                    progress_callback=progress_callback,
                )

            # 添加输出文件路径到列表
            if result.subtitle_path:
                output_files.append(result.subtitle_path)
                logger.info(f"转写完成，生成字幕文件: {result.subtitle_path}")

        except Exception as e:
            logger.error(f"处理文件失败 {input_path}: {e}")

    return output_files


def main():
    """命令行主函数"""
    parser = argparse.ArgumentParser(
        description="使用Faster Whisper GUI配置文件转写视频或音频为字幕"
    )
    parser.add_argument(
        "input_files", nargs="+", help="输入视频或音频文件路径，支持多个文件"
    )
    parser.add_argument(
        "--config", "-c", required=True, help="Faster Whisper GUI配置文件路径"
    )
    parser.add_argument("--output-dir", "-o", help="输出目录")
    parser.add_argument(
        "--keep-audio", "-k", action="store_true", help="保留提取的音频文件"
    )
    parser.add_argument(
        "--progress", "-p", action="store_true", help="显示进度条"
    )

    args = parser.parse_args()

    try:
        output_files = convert_files(
            input_files=args.input_files,
            gui_config_path=args.config,
            output_dir=args.output_dir,
            keep_audio=args.keep_audio,
            show_progress=args.progress,
        )

        if output_files:
            logger.info(f"成功转写 {len(output_files)} 个文件")
        else:
            logger.warning("没有成功转写任何文件")

    except Exception as e:
        logger.error(f"转写失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
