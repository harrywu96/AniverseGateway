#!/usr/bin/env python
"""
字幕提取示例脚本 - SubTranslate项目演示

这个脚本展示了如何使用SubTranslate项目的字幕提取功能。
它接受一个视频文件或目录路径，然后提取和显示所有可用的字幕。

使用方法:
    python subtitle_extract_example.py /path/to/video.mp4
    python subtitle_extract_example.py /path/to/videos/
"""

import os
import sys
from pathlib import Path

# 确保可以导入项目模块
sys.path.insert(0, os.path.abspath("."))

from src.subtranslate.core.ffmpeg import FFmpegTool
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor


def extract_subtitles(video_path, output_dir=None, language=None):
    """从视频中提取字幕

    Args:
        video_path: 视频文件路径
        output_dir: 输出目录 (默认为视频所在目录)
        language: 首选语言代码 (如: eng, chi, jpn)

    Returns:
        tuple: (所有字幕列表, 最佳字幕路径)
    """
    print(f"处理视频: {video_path}")

    # 初始化工具
    ffmpeg = FFmpegTool()
    extractor = SubtitleExtractor(ffmpeg)

    # 获取视频信息
    video_info = ffmpeg.create_video_info(video_path)
    print(f"视频格式: {video_info.format}")
    print(f"视频时长: {video_info.duration:.2f}秒")
    print(f"含内嵌字幕: {'是' if video_info.has_embedded_subtitle else '否'}")

    # 设置输出目录
    if output_dir is None:
        output_dir = Path(video_path).parent
    else:
        output_dir = Path(output_dir)
        os.makedirs(output_dir, exist_ok=True)

    print(f"提取字幕到: {output_dir}")

    # 提取字幕
    all_subs, best_sub = extractor.auto_extract_subtitles(
        video_info, output_dir=output_dir, preferred_language=language
    )

    # 显示结果
    if all_subs:
        print(f"\n成功提取 {len(all_subs)} 个字幕文件:")
        for i, sub in enumerate(all_subs, 1):
            mark = " (推荐)" if sub == best_sub else ""
            print(f"  {i}. {sub.name}{mark}")
    else:
        print("\n未找到字幕")

    return all_subs, best_sub


def process_directory(directory_path, output_dir=None, language=None):
    """处理目录中的所有视频文件

    Args:
        directory_path: 视频目录路径
        output_dir: 输出目录
        language: 首选语言代码
    """
    dir_path = Path(directory_path)
    print(f"扫描目录: {dir_path}")

    # 支持的视频扩展名
    video_extensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"]

    # 查找所有视频文件
    video_files = []
    for ext in video_extensions:
        video_files.extend(list(dir_path.glob(f"*{ext}")))

    if not video_files:
        print(f"在目录 {dir_path} 中未找到视频文件")
        return

    print(f"找到 {len(video_files)} 个视频文件")

    # 处理每个视频文件
    for video in video_files:
        # 为每个视频创建单独的输出目录
        video_output = output_dir
        if output_dir is None:
            video_output = dir_path / f"{video.stem}_subs"

        print("\n" + "=" * 60)
        extract_subtitles(video, video_output, language)


def main():
    """主入口函数"""
    if len(sys.argv) < 2:
        print(
            "使用方法: python subtitle_extract_example.py <视频路径或目录> [首选语言代码]"
        )
        print("例如: python subtitle_extract_example.py /movies/example.mkv chi")
        sys.exit(1)

    # 获取路径和可选的语言代码
    path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else None

    target_path = Path(path)

    if not target_path.exists():
        print(f"错误: 路径不存在 - {path}")
        sys.exit(1)

    # 根据路径类型处理
    if target_path.is_dir():
        process_directory(target_path, language=language)
    else:
        extract_subtitles(target_path, language=language)


if __name__ == "__main__":
    main()
