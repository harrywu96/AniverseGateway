"""核心功能模块

提供SubTranslate的核心功能实现，包括视频处理、字幕提取和翻译等。"""

from .ffmpeg import FFmpegTool
from .subtitle_extractor import SubtitleExtractor, SubtitleTrack
from .subtitle_translator import SubtitleTranslator

__all__ = [
    "FFmpegTool",
    "SubtitleExtractor",
    "SubtitleTrack",
    "SubtitleTranslator",
]
