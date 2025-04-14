"""字幕转写CLI工具

提供命令行接口，用于将视频或音频文件转写为SRT字幕。
"""

import os
import sys
import logging
import argparse
from pathlib import Path
from typing import List, Optional, Union

# 确保从项目根目录导入
sys.path.insert(0, os.path.abspath("."))

from src.subtranslate.core.speech_to_text import (
    SpeechToText,
    TranscriptionParameters,
    WhisperModelSize,
)


def setup_logging(verbose: bool = False) -> logging.Logger:
    """设置日志

    Args:
        verbose: 是否显示详细日志

    Returns:
        logging.Logger: 日志对象
    """
    level = logging.DEBUG if verbose else logging.INFO

    # 创建日志对象
    logger = logging.getLogger("transcribe")
    logger.setLevel(level)

    # 创建控制台处理器
    handler = logging.StreamHandler()
    handler.setLevel(level)

    # 设置格式
    formatter = logging.Formatter("[%(levelname)s] %(message)s")
    handler.setFormatter(formatter)

    # 添加处理器
    logger.addHandler(handler)

    return logger


def process_file(
    file_path: Path,
    output_dir: Optional[Path],
    model_size: str,
    language: Optional[str],
    task: str,
    device: str,
    compute_type: str,
    keep_audio: bool,
    verbose: bool,
) -> None:
    """处理单个文件

    Args:
        file_path: 文件路径
        output_dir: 输出目录
        model_size: 模型大小
        language: 语言代码
        task: 任务类型
        device: 计算设备
        compute_type: 计算精度
        keep_audio: 是否保留临时音频文件
        verbose: 是否显示详细日志
    """
    logger = setup_logging(verbose)
    logger.info(f"处理文件: {file_path}")

    # 确定输出目录
    if output_dir is None:
        output_dir = file_path.parent
    else:
        output_dir = Path(output_dir)
        os.makedirs(output_dir, exist_ok=True)

    # 创建转写参数
    params = TranscriptionParameters(
        model_size=model_size,
        language=language,
        task=task,
        device=device,
        compute_type=compute_type,
        vad_filter=True,
        word_timestamps=True,
    )

    # 初始化转写器
    transcriber = SpeechToText(parameters=params)

    try:
        # 进度回调函数
        def progress_callback(progress: float) -> None:
            percent = int(progress * 100)
            sys.stdout.write(f"\r转写进度: {percent}%")
            sys.stdout.flush()

        # 判断文件类型
        file_ext = file_path.suffix.lower()
        audio_extensions = [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"]
        video_extensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm"]

        result = None
        if file_ext in audio_extensions:
            logger.info("检测到音频文件，开始转写...")
            result = transcriber.transcribe_audio(
                audio_path=file_path,
                output_dir=output_dir,
                progress_callback=progress_callback,
            )
        elif file_ext in video_extensions:
            logger.info("检测到视频文件，开始提取音频并转写...")
            result = transcriber.transcribe_video(
                video_path=file_path,
                output_dir=output_dir,
                keep_audio=keep_audio,
                progress_callback=progress_callback,
            )
        else:
            logger.error(f"不支持的文件类型: {file_ext}")
            return

        # 打印结果
        print("\n")  # 换行
        logger.info(f"转写完成！检测到语言: {result.language}")
        logger.info(f"生成的字幕文件: {result.subtitle_path}")

    except Exception as e:
        logger.error(f"转写失败: {e}")
        sys.exit(1)


def process_directory(
    directory: Path,
    output_dir: Optional[Path],
    model_size: str,
    language: Optional[str],
    task: str,
    device: str,
    compute_type: str,
    keep_audio: bool,
    verbose: bool,
    extensions: List[str],
) -> None:
    """处理目录中的所有支持文件

    Args:
        directory: 目录路径
        output_dir: 输出目录
        model_size: 模型大小
        language: 语言代码
        task: 任务类型
        device: 计算设备
        compute_type: 计算精度
        keep_audio: 是否保留临时音频文件
        verbose: 是否显示详细日志
        extensions: 支持的文件扩展名列表
    """
    logger = setup_logging(verbose)
    logger.info(f"扫描目录: {directory}")

    # 查找所有支持的文件
    files = []
    for ext in extensions:
        files.extend(list(directory.glob(f"*{ext}")))

    if not files:
        logger.error(f"在目录 {directory} 中未找到支持的文件")
        return

    logger.info(f"找到 {len(files)} 个文件")

    # 处理每个文件
    for i, file_path in enumerate(files, 1):
        logger.info(f"[{i}/{len(files)}] 处理文件: {file_path.name}")

        # 为每个文件创建单独的输出目录（如果指定了输出目录）
        file_output_dir = None
        if output_dir:
            file_output_dir = output_dir
        else:
            # 在原目录下创建输出
            file_output_dir = directory

        # 处理文件
        process_file(
            file_path=file_path,
            output_dir=file_output_dir,
            model_size=model_size,
            language=language,
            task=task,
            device=device,
            compute_type=compute_type,
            keep_audio=keep_audio,
            verbose=verbose,
        )
        logger.info("=" * 50)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="SubTranslate 语音转写工具")
    parser.add_argument("target", help="视频或音频文件/目录的路径")
    parser.add_argument(
        "-o", "--output-dir", help="字幕输出目录（默认为与源文件相同目录）"
    )
    parser.add_argument(
        "-m",
        "--model",
        default="medium",
        choices=[
            "tiny",
            "base",
            "small",
            "medium",
            "large",
            "large-v2",
            "large-v3",
        ],
        help="模型大小（默认为medium）",
    )
    parser.add_argument("-l", "--language", help="语言代码（默认自动检测）")
    parser.add_argument(
        "-t",
        "--task",
        default="transcribe",
        choices=["transcribe", "translate"],
        help="任务类型：transcribe（转写）或translate（翻译为英文）",
    )
    parser.add_argument(
        "-d",
        "--device",
        default="cuda" if hasattr(sys, "getwindowsversion") else "cpu",
        choices=["cuda", "cpu", "mps"],
        help="计算设备（默认为cuda，如果可用）",
    )
    parser.add_argument(
        "-c",
        "--compute-type",
        default="float16",
        choices=["float16", "float32", "int8"],
        help="计算精度类型（默认为float16）",
    )
    parser.add_argument(
        "-k", "--keep-audio", action="store_true", help="保留提取的音频文件"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="显示详细日志"
    )

    args = parser.parse_args()

    # 解析路径
    target_path = Path(args.target)
    output_dir = Path(args.output_dir) if args.output_dir else None

    if not target_path.exists():
        print(f"错误: 指定的路径不存在: {target_path}")
        sys.exit(1)

    # 支持的文件扩展名
    supported_extensions = [
        ".wav",
        ".mp3",
        ".m4a",
        ".flac",
        ".ogg",
        ".aac",  # 音频
        ".mp4",
        ".mkv",
        ".avi",
        ".mov",
        ".wmv",
        ".webm",  # 视频
    ]

    # 处理目录或单个文件
    if target_path.is_dir():
        process_directory(
            directory=target_path,
            output_dir=output_dir,
            model_size=args.model,
            language=args.language,
            task=args.task,
            device=args.device,
            compute_type=args.compute_type,
            keep_audio=args.keep_audio,
            verbose=args.verbose,
            extensions=supported_extensions,
        )
    else:
        process_file(
            file_path=target_path,
            output_dir=output_dir,
            model_size=args.model,
            language=args.language,
            task=args.task,
            device=args.device,
            compute_type=args.compute_type,
            keep_audio=args.keep_audio,
            verbose=args.verbose,
        )


if __name__ == "__main__":
    main()
