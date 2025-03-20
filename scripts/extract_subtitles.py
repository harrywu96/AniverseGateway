#!/usr/bin/env python
"""
字幕提取工具 - SubTranslate项目

从视频中提取字幕并可选择性地转换为SRT格式。

使用方法:
    python scripts/extract_subtitles.py 视频路径 [输出目录] [语言代码]
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from src.subtranslate.core.ffmpeg import FFmpegTool
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor, SubtitleFormat


def print_subtitle_tracks(tracks):
    """打印字幕轨道信息"""
    if not tracks:
        print("未找到字幕轨道")
        return

    print(f"\n找到 {len(tracks)} 个字幕轨道:")
    for i, track in enumerate(tracks, 1):
        print(f"  {i}. {track}")


def extract_subtitles(video_path, output_dir=None, language=None):
    """提取视频中的字幕

    Args:
        video_path: 视频文件路径
        output_dir: 输出目录
        language: 首选语言代码
    """
    video_path = Path(video_path)

    # 初始化工具
    print("初始化FFmpeg工具...")
    ffmpeg = FFmpegTool()
    extractor = SubtitleExtractor(ffmpeg)

    # 获取视频信息
    print(f"分析视频: {video_path}")
    video_info = ffmpeg.create_video_info(video_path)

    # 显示视频信息
    print("\n视频信息:")
    print(f"  文件名: {video_path.name}")
    print(f"  格式: {video_info.format.value}")
    print(f"  时长: {video_info.duration:.2f}秒")
    print(f"  内嵌字幕: {'有' if video_info.has_embedded_subtitle else '无'}")

    # 如果视频有内嵌字幕，显示轨道信息
    if video_info.has_embedded_subtitle:
        tracks = extractor.get_subtitle_tracks(video_path)
        print_subtitle_tracks(tracks)

        # 选择最佳轨道
        best_index = extractor.select_best_track(tracks, language)
        if best_index is not None:
            print(f"\n根据偏好选择的轨道: #{best_index}")

    # 检查外挂字幕
    external_subs = extractor.detect_subtitle_files(video_path)
    if external_subs:
        print(f"\n找到 {len(external_subs)} 个外挂字幕文件:")
        for i, sub in enumerate(external_subs, 1):
            # 尝试确定字幕格式
            subtitle_format = extractor.get_subtitle_format(sub)
            print(f"  {i}. {sub.name} [{subtitle_format.value}]")

    # 设置输出目录
    if output_dir is None:
        output_dir = video_path.parent / f"{video_path.stem}_subtitles"
    else:
        output_dir = Path(output_dir)

    os.makedirs(output_dir, exist_ok=True)
    print(f"\n字幕将提取到: {output_dir}")

    # 自动提取字幕
    print("\n开始提取字幕...")
    all_subs, best_sub = extractor.auto_extract_subtitles(
        video_info, output_dir=output_dir, preferred_language=language
    )

    # 显示结果
    if all_subs:
        print(f"\n成功提取 {len(all_subs)} 个字幕文件:")
        for i, sub in enumerate(all_subs, 1):
            mark = " [推荐]" if sub == best_sub else ""
            print(f"  {i}. {sub}{mark}")

        if best_sub:
            print(f"\n推荐使用的字幕: {best_sub}")
    else:
        print("\n未能找到或提取字幕")


def main():
    """主函数"""
    # 检查命令行参数
    if len(sys.argv) < 2:
        print(f"用法: python {sys.argv[0]} <视频路径> [输出目录] [语言代码]")
        print("例如:")
        print(f"  python {sys.argv[0]} /movies/example.mkv")
        print(f"  python {sys.argv[0]} /movies/example.mkv /output chi")
        sys.exit(1)

    # 获取参数
    video_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    language = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        extract_subtitles(video_path, output_dir, language)
    except Exception as e:
        print(f"错误: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
