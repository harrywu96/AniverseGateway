#!/usr/bin/env python
"""
SubTranslate 项目字幕提取工具 - 简化命令行版本

这个脚本是一个独立的命令行工具，用于从视频中提取字幕。
它是 SubTranslate 项目核心功能的简化版本。

使用方法:
    python extract_subs.py 视频文件路径 [输出目录]
"""
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入所需模块
from src.subtranslate.core.ffmpeg import FFmpegTool
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor


def main():
    """主函数"""
    # 处理命令行参数
    if len(sys.argv) < 2:
        print("用法: python extract_subs.py <视频文件路径> [输出目录] [语言代码]")
        sys.exit(1)

    # 获取视频路径
    video_path = Path(sys.argv[1])
    if not video_path.exists():
        print(f"错误: 视频文件不存在 - {video_path}")
        sys.exit(1)

    # 获取输出目录 (可选)
    output_dir = None
    if len(sys.argv) > 2:
        output_dir = Path(sys.argv[2])
        os.makedirs(output_dir, exist_ok=True)

    # 获取语言代码 (可选)
    language = None
    if len(sys.argv) > 3:
        language = sys.argv[3]

    try:
        # 初始化FFmpeg工具和字幕提取器
        ffmpeg = FFmpegTool()
        extractor = SubtitleExtractor(ffmpeg)

        # 获取视频信息
        print(f"正在分析视频: {video_path}")
        video_info = ffmpeg.create_video_info(video_path)

        # 显示视频信息
        print(f"视频格式: {video_info.format}")
        print(f"视频时长: {video_info.duration:.2f}秒")
        print(f"含内嵌字幕: {'是' if video_info.has_embedded_subtitle else '否'}")

        # 设置输出目录
        if output_dir is None:
            output_dir = video_path.parent

        # 提取字幕
        print(f"开始提取字幕到: {output_dir}")
        all_subtitles, best_subtitle = extractor.auto_extract_subtitles(
            video_info, output_dir=output_dir, preferred_language=language
        )

        # 显示结果
        if all_subtitles:
            print(f"\n已提取 {len(all_subtitles)} 个字幕文件:")
            for i, sub_path in enumerate(all_subtitles, 1):
                is_best = " [推荐]" if sub_path == best_subtitle else ""
                print(f"  {i}. {sub_path}{is_best}")
        else:
            print("\n未找到字幕")

    except Exception as e:
        print(f"错误: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
