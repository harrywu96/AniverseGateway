#!/usr/bin/env python
"""
字幕提取工具 - SubTranslate项目

从视频中提取字幕并可选择性地转换为SRT格式。
这个脚本展示了如何使用SubTranslate的字幕提取子系统。

使用方法:
    python scripts/subtitle_extract.py 视频路径 [输出目录] [语言代码]
"""

import os
import sys
import traceback
from pathlib import Path

# 添加项目根目录到Python路径
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

# 导入依赖，必须放在path修改之后
from src.subtranslate.core.ffmpeg import FFmpegTool
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor


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
    try:
        ffmpeg = FFmpegTool()
        extractor = SubtitleExtractor(ffmpeg)
    except Exception as e:
        print(f"初始化FFmpeg工具失败: {str(e)}")
        raise

    # 获取视频信息
    print(f"分析视频: {video_path}")
    try:
        video_info = ffmpeg.create_video_info(video_path)
    except Exception as e:
        print(f"获取视频信息失败: {str(e)}")
        raise

    # 显示视频信息
    print("\n视频信息:")
    print(f"  文件名: {video_path.name}")
    print(f"  格式: {video_info.format.value}")

    # 安全处理时长，防止duration为None导致格式化错误
    if video_info.duration is not None:
        print(f"  时长: {video_info.duration:.2f}秒")
    else:
        print("  时长: 未知")

    print(f"  内嵌字幕: {'有' if video_info.has_embedded_subtitle else '无'}")

    # 如果视频有内嵌字幕，显示轨道信息
    if video_info.has_embedded_subtitle:
        try:
            tracks = extractor.get_subtitle_tracks(video_path)
            print_subtitle_tracks(tracks)

            # 选择最佳轨道
            best_index = extractor.select_best_track(tracks, language)
            if best_index is not None:
                print(f"\n根据偏好选择的轨道: #{best_index}")
        except Exception as e:
            print(f"获取内嵌字幕信息失败: {str(e)}")
            # 继续执行，不阻止尝试外挂字幕

    # 检查外挂字幕
    try:
        external_subs = extractor.detect_subtitle_files(video_path)
        if external_subs:
            print(f"\n找到 {len(external_subs)} 个外挂字幕文件:")
            for i, sub in enumerate(external_subs, 1):
                # 尝试确定字幕格式
                try:
                    subtitle_format = extractor.get_subtitle_format(sub)
                    print(f"  {i}. {sub.name} [{subtitle_format.value}]")
                except Exception as e:
                    print(f"  {i}. {sub.name} [未知格式: {str(e)}]")
    except Exception as e:
        print(f"检查外挂字幕失败: {str(e)}")
        external_subs = []

    # 设置输出目录
    if output_dir is None:
        output_dir = video_path.parent / f"{video_path.stem}_subtitles"
    else:
        output_dir = Path(output_dir)

    try:
        os.makedirs(output_dir, exist_ok=True)
        print(f"\n字幕将提取到: {output_dir}")
    except Exception as e:
        print(f"创建输出目录失败: {str(e)}")
        raise

    # 自动提取字幕
    print("\n开始提取字幕...")
    try:
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
    except Exception as e:
        print(f"提取字幕过程中出错: {str(e)}")
        traceback.print_exc()


def process_directory(dir_path, output_dir=None, language=None):
    """处理目录中的所有视频文件

    Args:
        dir_path: 视频目录路径
        output_dir: 总输出目录
        language: 首选语言代码
    """
    dir_path = Path(dir_path)
    print(f"扫描目录: {dir_path}")

    # 支持的视频扩展名
    video_extensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"]

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
        print("\n" + "=" * 60)
        print(f"处理视频: {video.name}")

        # 为每个视频创建单独的输出目录
        video_output = output_dir
        if output_dir is None:
            video_output = dir_path / f"{video.stem}_subtitles"

        extract_subtitles(video, video_output, language)


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
    target_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    language = sys.argv[3] if len(sys.argv) > 3 else None

    if not target_path.exists():
        print(f"错误: 指定的路径不存在 - {target_path}")
        sys.exit(1)

    try:
        # 根据目标类型选择处理方式
        if target_path.is_dir():
            process_directory(target_path, output_dir, language)
        else:
            extract_subtitles(target_path, output_dir, language)
    except Exception as e:
        print(f"错误: {str(e)}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
