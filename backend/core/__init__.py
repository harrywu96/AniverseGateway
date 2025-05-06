"""Core模块包含项目的核心功能和类。"""

from backend.core.ffmpeg import FFmpegTool
from backend.core.subtitle_extractor import SubtitleExtractor, SubtitleTrack
from backend.core.subtitle_translator import SubtitleTranslator
from backend.core.speech_to_text import (
    SpeechToText,
    TranscriptionParameters,
)

# 导出faster-whisper配置相关功能
from backend.core.faster_whisper_config_util import (
    load_faster_whisper_gui_config,
    convert_to_transcription_parameters,
    get_output_format,
    save_transcription_parameters,
    apply_gui_config_to_parameters,
    WhisperConfigManager,
)

__all__ = [
    "FFmpegTool",
    "SubtitleExtractor",
    "SubtitleTrack",
    "SubtitleTranslator",
    "SpeechToText",
    "TranscriptionParameters",
    "load_faster_whisper_gui_config",
    "convert_to_transcription_parameters",
    "get_output_format",
    "save_transcription_parameters",
    "apply_gui_config_to_parameters",
    "WhisperConfigManager",
]
