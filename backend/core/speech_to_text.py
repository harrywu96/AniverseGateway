"""语音转写模块，负责从视频或音频中提取语音并转换为SRT字幕文件。

使用faster-whisper进行语音识别，支持多种模型和配置选项。
"""

import logging
import tempfile
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Callable

from pydantic import BaseModel, Field


def _is_torch_available() -> bool:
    """检测torch是否可用"""
    try:
        import torch

        return True
    except ImportError:
        return False


def _get_torch_device() -> str:
    """获取torch设备"""
    if not _is_torch_available():
        return "cpu"
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


from backend.core.ffmpeg import FFmpegTool, FFmpegError

# 配置日志
logger = logging.getLogger(__name__)


class WhisperModelSize(str, Enum):
    """支持的Whisper模型大小"""

    TINY = "tiny"
    BASE = "base"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    LARGE_V2 = "large-v2"
    LARGE_V3 = "large-v3"


class WhisperModelType(str, Enum):
    """Whisper模型类型"""

    WHISPER = "whisper"
    FASTER_WHISPER = "faster-whisper"


class TranscriptionParameters(BaseModel):
    """语音转写参数配置"""

    # 模型配置
    model_size: Optional[WhisperModelSize] = Field(
        default=WhisperModelSize.MEDIUM,
        description="模型大小，对于本地模型可为None",
    )
    model_type: WhisperModelType = Field(
        default=WhisperModelType.FASTER_WHISPER, description="模型类型"
    )
    model_dir: Optional[str] = Field(
        default=None, description="模型文件目录或本地模型路径"
    )

    # 计算设备配置
    device: str = Field(
        default_factory=_get_torch_device,
        description="执行设备: cuda, cpu, mps",
    )
    compute_type: str = Field(
        default=(
            "float16"
            if _is_torch_available() and _get_torch_device() == "cuda"
            else "float32"
        ),
        description="计算精度类型: float16, float32, int8",
    )

    # 转写设置
    language: Optional[str] = Field(
        default=None, description="音频语言代码，如不指定则自动检测"
    )
    task: str = Field(
        default="transcribe", description="任务类型: transcribe 或 translate"
    )
    initial_prompt: Optional[str] = Field(
        default=None,
        description="初始提示词，可以提高识别特定领域内容的准确性",
    )

    # 分段设置
    vad_filter: bool = Field(
        default=True, description="是否使用语音活动检测过滤静音段"
    )
    vad_parameters: Dict[str, Any] = Field(
        default_factory=lambda: {
            "threshold": 0.5,
            "min_speech_duration_ms": 250,
            "min_silence_duration_ms": 1000,
            "window_size_samples": 1024,
            "speech_pad_ms": 400,
        },
        description="VAD参数",
    )

    # 字幕设置
    word_timestamps: bool = Field(
        default=True, description="是否生成逐字时间戳，用于字幕精确同步"
    )
    output_format: str = Field(
        default="srt", description="输出格式: srt, vtt, txt, json"
    )

    # 高级设置
    beam_size: int = Field(default=5, description="束搜索大小")
    best_of: int = Field(default=5, description="样本生成数量")
    patience: float = Field(default=1.0, description="束搜索耐心值")
    temperature: List[float] = Field(
        default_factory=lambda: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        description="温度值列表，用于生成多样性",
    )
    compression_ratio_threshold: float = Field(
        default=2.4, description="压缩比阈值，过滤重复内容"
    )
    no_speech_threshold: float = Field(
        default=0.6, description="无语音阈值，过滤非语音部分"
    )
    condition_on_previous_text: bool = Field(
        default=True, description="是否基于前文生成后续文本，提高连贯性"
    )

    # 后处理选项
    suppress_blank: bool = Field(default=True, description="是否抑制空白转录")
    suppress_tokens: List[int] = Field(
        default_factory=lambda: [-1], description="要抑制的token列表"
    )
    max_line_width: Optional[int] = Field(
        default=None, description="每行字幕的最大字符数，超过则截断"
    )
    max_line_count: Optional[int] = Field(
        default=None, description="每个字幕片段的最大行数"
    )
    highlight_words: bool = Field(
        default=False, description="是否在字幕中高亮单词"
    )
    end_at_last_full_sentence: bool = Field(
        default=True, description="是否在最后一个完整句子处结束"
    )

    @property
    def is_local_model(self) -> bool:
        """判断是否使用本地模型

        Returns:
            bool: 如果使用本地模型路径返回True，否则返回False
        """
        # 当model_dir有效且model_size为None时，视为使用本地模型
        return self.model_dir is not None and Path(self.model_dir).exists()


class TranscriptionResult(BaseModel):
    """转写结果"""

    text: str = Field(..., description="完整的转写文本")
    segments: List[Dict[str, Any]] = Field(..., description="分段转写结果")
    language: str = Field(..., description="检测到的语言")
    subtitle_path: Optional[Path] = Field(
        None, description="生成的字幕文件路径"
    )


class Segment:
    """转写片段"""

    def __init__(
        self,
        id: int,
        start: float,
        end: float,
        text: str,
        words: Optional[List[Dict[str, Any]]] = None,
        speaker: Optional[str] = None,
    ):
        """初始化转写片段

        Args:
            id: 片段ID
            start: 开始时间（秒）
            end: 结束时间（秒）
            text: 转写文本
            words: 单词列表及其时间戳
            speaker: 说话人标识（如有）
        """
        self.id = id
        self.start = start
        self.end = end
        self.text = text
        self.words = words or []
        self.speaker = speaker

    def __str__(self) -> str:
        """返回片段的字符串表示"""
        return (
            f"[{self.format_timestamp(self.start)} --> "
            f"{self.format_timestamp(self.end)}] {self.text}"
        )

    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """将秒数格式化为SRT时间戳格式 (HH:MM:SS,mmm)

        Args:
            seconds: 秒数

        Returns:
            str: 格式化的时间戳
        """
        td = timedelta(seconds=seconds)
        hours, remainder = divmod(td.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        milliseconds = round(td.microseconds / 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


class SpeechToText:
    """语音转文字模块，基于faster-whisper实现"""

    def __init__(
        self,
        parameters: Optional[TranscriptionParameters] = None,
        ffmpeg_tool: Optional[FFmpegTool] = None,
    ):
        """初始化语音转文字模块

        Args:
            parameters: 转写参数，如果为None则使用默认参数
            ffmpeg_tool: FFmpeg工具实例，如果为None则创建新实例
        """
        self.parameters = parameters or TranscriptionParameters()
        self.ffmpeg = ffmpeg_tool or FFmpegTool()
        self.model = None

    @classmethod
    def from_gui_config(
        cls,
        config_path: Union[str, Path],
        ffmpeg_tool: Optional[FFmpegTool] = None,
    ):
        """从Faster Whisper GUI配置文件创建实例

        Args:
            config_path: GUI配置文件路径
            ffmpeg_tool: FFmpeg工具实例，如果为None则创建新实例

        Returns:
            SpeechToText: 创建的实例
        """
        from backend.core.faster_whisper_config_util import (
            apply_gui_config_to_parameters,
        )

        # 从GUI配置加载参数
        parameters = apply_gui_config_to_parameters(config_path)

        # 创建并返回实例
        return cls(parameters=parameters, ffmpeg_tool=ffmpeg_tool)

    def load_model(self) -> None:
        """加载语音识别模型"""
        try:
            from faster_whisper import WhisperModel

            # 确定是否使用本地模型
            if self.parameters.is_local_model:
                model_path = self.parameters.model_dir

                # 检查model_path目录下是否包含模型文件
                model_files = [
                    "model.bin",
                    "model.onnx",
                    "encoder.onnx",
                    "decoder.onnx",
                    "tokenizer.json",
                    "vocabulary.txt",
                ]

                has_model_files = any(
                    Path(model_path).joinpath(file).exists()
                    for file in model_files
                )

                if not has_model_files:
                    logger.warning(
                        f"本地模型路径 {model_path} 可能无效，"
                        f"未找到任何有效的模型文件: {', '.join(model_files)}"
                    )

                # 使用本地模型路径
                logger.info(
                    f"正在加载本地 faster-whisper 模型 ({model_path})..."
                )
                self.model = WhisperModel(
                    model_size_or_path=model_path,
                    device=self.parameters.device,
                    compute_type=self.parameters.compute_type,
                    download_root=None,  # 本地模型不需要指定下载目录
                )
                logger.info(f"本地模型加载完成: {model_path}")
            else:
                # 使用预定义模型大小
                if not self.parameters.model_size:
                    raise ValueError("未指定模型大小")

                logger.info(
                    f"正在加载 faster-whisper 模型 ({self.parameters.model_size})..."
                )
                self.model = WhisperModel(
                    model_size_or_path=self.parameters.model_size,
                    device=self.parameters.device,
                    compute_type=self.parameters.compute_type,
                    download_root=self.parameters.model_dir,
                )
                logger.info(f"模型加载完成: {self.parameters.model_size}")

        except ImportError:
            logger.error("未安装faster-whisper库，请使用以下命令安装:")
            logger.error("pip install faster-whisper")
            raise ImportError("未安装faster-whisper库")
        except FileNotFoundError as e:
            logger.error(f"找不到模型文件: {e}")
            raise
        except Exception as e:
            logger.error(f"加载模型失败: {e}")
            raise

    def ensure_model_loaded(self) -> None:
        """确保模型已加载"""
        if self.model is None:
            self.load_model()

    def extract_audio_from_video(
        self,
        video_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
    ) -> Path:
        """从视频文件中提取音频

        Args:
            video_path: 视频文件路径
            output_path: 音频输出路径，如果为None则使用临时文件

        Returns:
            Path: 提取的音频文件路径
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"视频文件不存在: {video_path}")

        if output_path is None:
            # 创建临时文件作为音频输出
            with tempfile.NamedTemporaryFile(
                suffix=".wav", delete=False
            ) as temp_file:
                output_path = temp_file.name

        output_path = Path(output_path)

        try:
            logger.info(f"从视频提取音频: {video_path} -> {output_path}")
            self.ffmpeg.extract_audio(
                input_file=str(video_path), output_file=str(output_path)
            )
            return output_path
        except FFmpegError as e:
            logger.error(f"提取音频失败: {e}")
            raise

    def _get_transcription_params(self) -> Dict[str, Any]:
        """获取转写参数字典"""
        params = {
            "language": self.parameters.language,
            "task": self.parameters.task,
            "beam_size": self.parameters.beam_size,
            "best_of": self.parameters.best_of,
            "patience": self.parameters.patience,
            "temperature": self.parameters.temperature,
            "compression_ratio_threshold": (
                self.parameters.compression_ratio_threshold
            ),
            "log_prob_threshold": -5.0,  # 默认值
            "no_speech_threshold": self.parameters.no_speech_threshold,
            "condition_on_previous_text": (
                self.parameters.condition_on_previous_text
            ),
            "initial_prompt": self.parameters.initial_prompt,
            "prefix": None,  # 默认值
            "suppress_blank": self.parameters.suppress_blank,
            "suppress_tokens": self.parameters.suppress_tokens,
            "without_timestamps": not self.parameters.word_timestamps,
            "word_timestamps": self.parameters.word_timestamps,
            "vad_filter": self.parameters.vad_filter,
            "vad_parameters": self.parameters.vad_parameters,
        }

        return params

    def transcribe_audio(
        self,
        audio_path: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> TranscriptionResult:
        """转写音频文件

        Args:
            audio_path: 音频文件路径
            output_dir: 输出目录，如果为None则使用音频文件所在目录
            progress_callback: 进度回调函数

        Returns:
            TranscriptionResult: 转写结果
        """
        # 确保模型已加载
        self.ensure_model_loaded()

        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"音频文件不存在: {audio_path}")

        # 设置输出目录
        if output_dir is None:
            output_dir = audio_path.parent
        else:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 获取转写参数
            transcribe_params = self._get_transcription_params()

            # 添加进度回调
            if progress_callback:
                original_callback = transcribe_params.get("callback", None)

                def combined_callback(segment_i, segment):
                    # 根据转写进度更新UI
                    if progress_callback and hasattr(segment, "progress"):
                        progress_callback(segment.progress)
                    # 调用原始回调
                    if original_callback:
                        original_callback(segment_i, segment)

                transcribe_params["callback"] = combined_callback

            # 执行转写
            logger.info(f"开始转写音频: {audio_path}")
            segments, info = self.model.transcribe(
                str(audio_path), **transcribe_params
            )

            # 收集分段结果
            segments_list = []
            full_text = ""

            for i, segment in enumerate(segments):
                # 添加转写片段到结果列表
                if progress_callback:
                    progress_callback(
                        min(0.95 + (i / 100), 0.99)
                    )  # 0.95-0.99的进度

                words_data = []
                if self.parameters.word_timestamps and segment.words:
                    for word in segment.words:
                        words_data.append(
                            {
                                "start": word.start,
                                "end": word.end,
                                "word": word.word,
                                "probability": word.probability,
                            }
                        )

                # 添加此分段的文本到完整文本
                full_text += segment.text + " "

                # 转换为自定义分段对象
                segments_list.append(
                    {
                        "id": i,
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text,
                        "words": words_data,
                    }
                )

            # 准备结果
            result = TranscriptionResult(
                text=full_text.strip(),
                segments=segments_list,
                language=info.language,
                subtitle_path=None,
            )

            # 如果指定了输出格式，生成字幕文件
            if self.parameters.output_format:
                subtitle_path = (
                    output_dir
                    / f"{audio_path.stem}.{self.parameters.output_format}"
                )
                self.write_subtitle(result, subtitle_path)
                result.subtitle_path = subtitle_path

            # 完成转写
            if progress_callback:
                progress_callback(1.0)  # 100%完成

            logger.info(f"音频转写完成: {audio_path}")
            return result

        except Exception as e:
            logger.error(f"转写失败: {e}")
            raise

    def transcribe_video(
        self,
        video_path: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        keep_audio: bool = False,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> TranscriptionResult:
        """转写视频文件

        Args:
            video_path: 视频文件路径
            output_dir: 输出目录，如果为None则使用视频文件所在目录
            keep_audio: 是否保留提取的音频文件
            progress_callback: 进度回调函数

        Returns:
            TranscriptionResult: 转写结果
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"视频文件不存在: {video_path}")

        # 设置输出目录
        if output_dir is None:
            output_dir = video_path.parent
        else:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

        # 音频输出路径
        audio_path = (
            output_dir / f"{video_path.stem}.wav" if keep_audio else None
        )

        try:
            # 提取音频
            if progress_callback:
                progress_callback(0.05)  # 5%进度

            def audio_progress_callback(progress: float) -> None:
                """音频转写的进度回调"""
                if progress_callback:
                    # 将音频转写的进度映射到5%-95%的总进度范围
                    adjusted_progress = 0.05 + (progress * 0.9)
                    progress_callback(adjusted_progress)

            extracted_audio = self.extract_audio_from_video(
                video_path, audio_path
            )
            if progress_callback:
                progress_callback(0.1)  # 10%进度

            # 转写提取的音频
            result = self.transcribe_audio(
                extracted_audio,
                output_dir,
                progress_callback=audio_progress_callback,
            )

            # 如果不保留音频，删除临时音频文件
            if not keep_audio and extracted_audio.exists():
                extracted_audio.unlink()

            # 使用视频文件名作为字幕文件名
            if result.subtitle_path:
                new_subtitle_path = (
                    output_dir / f"{video_path.stem}."
                    f"{result.subtitle_path.suffix.lstrip('.')}"
                )
                if result.subtitle_path != new_subtitle_path:
                    result.subtitle_path.rename(new_subtitle_path)
                    result.subtitle_path = new_subtitle_path

            return result

        except Exception as e:
            logger.error(f"视频转写失败: {e}")
            raise

    def write_srt(
        self, segments: List[Segment], output_path: Union[str, Path]
    ) -> None:
        """将分段转写结果写入SRT格式字幕文件

        Args:
            segments: 分段转写结果列表
            output_path: 输出文件路径
        """
        output_path = Path(output_path)

        # 确保输出目录存在
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            for i, segment in enumerate(segments, 1):
                # 写入字幕序号
                f.write(f"{i}\n")

                # 写入时间戳
                start_time = Segment.format_timestamp(segment.start)
                end_time = Segment.format_timestamp(segment.end)
                f.write(f"{start_time} --> {end_time}\n")

                # 写入文本内容
                f.write(f"{segment.text.strip()}\n\n")

        logger.info(f"字幕已保存到: {output_path}")

    def write_subtitle(
        self, result: TranscriptionResult, output_path: Union[str, Path]
    ) -> Path:
        """将转写结果写入字幕文件

        Args:
            result: 转写结果
            output_path: 输出文件路径

        Returns:
            Path: 写入的字幕文件路径
        """
        output_path = Path(output_path)

        # 从segments创建Segment对象列表
        segments = []
        for seg in result.segments:
            segment = Segment(
                id=seg["id"],
                start=seg["start"],
                end=seg["end"],
                text=seg["text"],
                words=seg.get("words", []),
            )
            segments.append(segment)

        # 根据文件扩展名选择写入格式
        suffix = output_path.suffix.lower()

        if suffix == ".srt":
            self.write_srt(segments, output_path)
        else:
            # 暂不支持其他格式，默认使用SRT
            logger.warning(f"不支持的字幕格式: {suffix}，使用SRT格式")
            output_path = output_path.with_suffix(".srt")
            self.write_srt(segments, output_path)

        return output_path
