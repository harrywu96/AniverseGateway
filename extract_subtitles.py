#!/usr/bin/env python
"""
字幕提取工具 - SubTranslate项目测试脚本

使用方法:
    python extract_subtitles.py /path/to/video_directory
    或指定特定视频文件:
    python extract_subtitles.py /path/to/video/file.mp4

选项:
    --output-dir PATH   指定字幕输出目录 (默认: 与视频相同目录)
    --language LANG     指定首选语言代码 (如: eng, chi, jpn)
    --verbose           显示详细日志
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Union

# 确保从项目根目录导入
sys.path.insert(0, os.path.abspath("."))

from src.subtranslate.core.ffmpeg import FFmpegTool
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor
from src.subtranslate.schemas.video import VideoInfo


def setup_logging(verbose: bool = False) -> logging.Logger:
    """设置日志"""
    level = logging.DEBUG if verbose else logging.INFO

    # 创建日志对象
    logger = logging.getLogger("subtitle_extractor")
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


def process_video(
    video_path: Path, output_dir: Path, language: str, logger: logging.Logger
) -> List[Path]:
    """处理单个视频文件并提取字幕

    Args:
        video_path: 视频文件路径
        output_dir: 输出目录
        language: 首选语言代码
        logger: 日志对象

    Returns:
        List[Path]: 提取的字幕文件列表
    """
    logger.info(f"处理视频: {video_path}")

    try:
        # 初始化工具
        ffmpeg = FFmpegTool()
        extractor = SubtitleExtractor(ffmpeg)

        # 从视频文件创建VideoInfo对象
        video_info = ffmpeg.create_video_info(video_path)

        # 打印视频信息
        logger.info(f"视频格式: {video_info.format}")
        logger.info(f"视频时长: {video_info.duration:.2f}秒")
        logger.info(f"有内嵌字幕: {'是' if video_info.has_embedded_subtitle else '否'}")

        # 指定输出目录
        if output_dir is None:
            output_dir = video_path.parent

        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)

        # 提取字幕
        logger.info(f"正在提取字幕到: {output_dir}")
        all_subtitles, best_subtitle = extractor.auto_extract_subtitles(
            video_info, output_dir=output_dir, preferred_language=language
        )

        # 显示结果
        if all_subtitles:
            logger.info(f"成功提取 {len(all_subtitles)} 个字幕文件:")
            for i, sub_path in enumerate(all_subtitles, 1):
                is_best = " (推荐)" if sub_path == best_subtitle else ""
                logger.info(f"  {i}. {sub_path.name}{is_best}")

            if best_subtitle:
                logger.info(f"推荐字幕: {best_subtitle.name}")

            return all_subtitles
        else:
            logger.error("未找到字幕")
            return []

    except Exception as e:
        logger.error(f"处理视频时出错: {str(e)}")
        return []


def process_directory(
    directory: Path, output_dir: Path, language: str, logger: logging.Logger
) -> None:
    """处理目录中的所有视频文件

    Args:
        directory: 视频目录路径
        output_dir: 输出目录
        language: 首选语言代码
        logger: 日志对象
    """
    logger.info(f"扫描目录: {directory}")

    # 支持的视频扩展名
    video_extensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"]

    # 查找所有视频文件
    video_files = []
    for ext in video_extensions:
        video_files.extend(list(directory.glob(f"*{ext}")))

    if not video_files:
        logger.error(f"在目录 {directory} 中未找到视频文件")
        return

    logger.info(f"找到 {len(video_files)} 个视频文件")

    # 处理每个视频文件
    for video_path in video_files:
        # 为每个视频创建单独的输出目录
        if output_dir:
            video_output_dir = output_dir / video_path.stem
        else:
            video_output_dir = directory / f"{video_path.stem}_subtitles"

        # 处理视频
        process_video(video_path, video_output_dir, language, logger)
        logger.info("=" * 50)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="SubTranslate字幕提取工具")
    parser.add_argument("target", help="视频文件或目录的路径")
    parser.add_argument("--output-dir", "-o", help="字幕输出目录")
    parser.add_argument(
        "--language", "-l", default=None, help="首选语言代码 (如: eng, chi, jpn)"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="显示详细日志")

    args = parser.parse_args()

    # 设置日志
    logger = setup_logging(args.verbose)

    # 解析路径
    target_path = Path(args.target)

    # 解析输出目录
    output_dir = Path(args.output_dir) if args.output_dir else None

    if not target_path.exists():
        logger.error(f"指定的路径不存在: {target_path}")
        return

    # 处理目录或单个文件
    if target_path.is_dir():
        process_directory(target_path, output_dir, args.language, logger)
    else:
        # 如果是单个文件，根据需要创建输出目录
        if output_dir:
            video_output_dir = output_dir
        else:
            video_output_dir = target_path.parent / f"{target_path.stem}_subtitles"

        process_video(target_path, video_output_dir, args.language, logger)


if __name__ == "__main__":
    main()
