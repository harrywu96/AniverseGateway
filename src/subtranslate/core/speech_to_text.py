"""语音转写模块，负责从视频或音频中提取语音并转换为SRT字幕文件。

使用faster-whisper进行语音识别，支持多种模型和配置选项。
"""

import logging
import os
import tempfile
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Callable

import torch
from pydantic import BaseModel, Field

from subtranslate.core.ffmpeg import FFmpegTool, FFmpegError

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
    model_size: WhisperModelSize = Field(
        default=WhisperModelSize.MEDIUM, description="模型大小"
    )
    model_type: WhisperModelType = Field(
        default=WhisperModelType.FASTER_WHISPER, description="模型类型"
    )
    model_dir: Optional[str] = Field(
        default=None, description="模型文件目录，默认使用~/.cache/whisper"
    )

    # 计算设备配置
    device: str = Field(
        default="cuda" if torch.cuda.is_available() else "cpu",
        description="执行设备: cuda, cpu, mps",
    )
    compute_type: str = Field(
        default="float16" if torch.cuda.is_available() else "float32",
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
        return f"[{self.format_timestamp(self.start)} --> {self.format_timestamp(self.end)}] {self.text}"

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

    def load_model(self) -> None:
        """加载语音识别模型"""
        try:
            from faster_whisper import WhisperModel

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
            output_path: 输出音频文件路径，如果为None则创建临时文件

        Returns:
            Path: 提取的音频文件路径
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"视频文件不存在: {video_path}")

        # 如果未指定输出路径，创建临时文件
        if output_path is None:
            temp_dir = Path(tempfile.gettempdir()) / "subtranslate"
            os.makedirs(temp_dir, exist_ok=True)
            output_path = temp_dir / f"{video_path.stem}_audio.wav"
        else:
            output_path = Path(output_path)
            os.makedirs(output_path.parent, exist_ok=True)

        # 构建FFmpeg命令
        cmd = [
            self.ffmpeg.ffmpeg_binary,
            "-i",
            str(video_path),
            "-vn",  # 禁用视频
            "-ar",
            "16000",  # 设置采样率为16kHz
            "-ac",
            "1",  # 单声道
            "-c:a",
            "pcm_s16le",  # 16位PCM编码
            "-y",  # 覆盖已有文件
            str(output_path),
        ]

        # 执行命令
        try:
            self.ffmpeg.run_command(cmd)
            logger.info(f"成功从视频提取音频: {output_path}")
            return output_path
        except FFmpegError as e:
            logger.error(f"提取音频失败: {e}")
            raise

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
            progress_callback: 进度回调函数，参数为0-1之间的进度值

        Returns:
            TranscriptionResult: 转写结果
        """
        # 确保模型已加载
        self.ensure_model_loaded()

        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"音频文件不存在: {audio_path}")

        # 确定输出目录
        if output_dir is None:
            output_dir = audio_path.parent
        else:
            output_dir = Path(output_dir)
            os.makedirs(output_dir, exist_ok=True)

        # 执行转写
        logger.info(f"开始转写音频: {audio_path}")

        try:
            # 准备参数
            vad_parameters = None
            if self.parameters.vad_filter:
                vad_parameters = self.parameters.vad_parameters

            # 转写音频
            segments_generator, info = self.model.transcribe(
                audio=str(audio_path),
                language=self.parameters.language,
                task=self.parameters.task,
                beam_size=self.parameters.beam_size,
                best_of=self.parameters.best_of,
                patience=self.parameters.patience,
                temperature=self.parameters.temperature[0],
                initial_prompt=self.parameters.initial_prompt,
                compression_ratio_threshold=self.parameters.compression_ratio_threshold,
                no_speech_threshold=self.parameters.no_speech_threshold,
                condition_on_previous_text=self.parameters.condition_on_previous_text,
                word_timestamps=self.parameters.word_timestamps,
                vad_filter=self.parameters.vad_filter,
                vad_parameters=vad_parameters,
            )

            # 收集segments并应用后处理
            segments_list = []
            all_text = ""

            for i, segment in enumerate(segments_generator):
                # 创建Segment对象
                seg = Segment(
                    id=i + 1,
                    start=segment.start,
                    end=segment.end,
                    text=segment.text.strip(),
                    words=(
                        [
                            {
                                "word": w.word,
                                "start": w.start,
                                "end": w.end,
                                "probability": w.probability,
                            }
                            for w in segment.words
                        ]
                        if segment.words
                        else None
                    ),
                )

                segments_list.append(seg)
                all_text += seg.text + " "

                # 更新进度
                if progress_callback:
                    # 估计还有10个片段未处理
                    progress_callback(min(0.9, i / (i + 10)))

            # 将结果写入SRT文件
            srt_path = output_dir / f"{audio_path.stem}.srt"
            self.write_srt(segments_list, srt_path)

            # 完成进度
            if progress_callback:
                progress_callback(1.0)

            # 创建返回结果
            result = TranscriptionResult(
                text=all_text.strip(),
                segments=[
                    {
                        "id": s.id,
                        "start": s.start,
                        "end": s.end,
                        "text": s.text,
                        "words": s.words,
                        "speaker": s.speaker,
                    }
                    for s in segments_list
                ],
                language=info.language,
                subtitle_path=srt_path,
            )

            logger.info(f"转写完成, 生成SRT文件: {srt_path}")
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
        """转写视频文件为字幕

        Args:
            video_path: 视频文件路径
            output_dir: 输出目录，如果为None则使用视频文件所在目录
            keep_audio: 是否保留提取的音频文件
            progress_callback: 进度回调函数，参数为0-1之间的进度值

        Returns:
            TranscriptionResult: 转写结果
        """
        video_path = Path(video_path)

        # 确定输出目录
        if output_dir is None:
            output_dir = video_path.parent
        else:
            output_dir = Path(output_dir)
            os.makedirs(output_dir, exist_ok=True)

        # 提取音频
        logger.info(f"从视频提取音频: {video_path}")

        # 如果要保留音频，将其保存到输出目录
        audio_path = None
        if keep_audio:
            audio_path = output_dir / f"{video_path.stem}_audio.wav"

        try:
            # 更新进度
            if progress_callback:
                progress_callback(0.1)

            # 提取音频
            audio_path = self.extract_audio_from_video(video_path, audio_path)

            # 更新进度
            if progress_callback:
                progress_callback(0.2)

            # 创建进度回调的适配器
            def audio_progress_callback(progress: float) -> None:
                if progress_callback:
                    # 将音频转写的进度(0-1)映射到整体进度的0.2-0.9
                    progress_callback(0.2 + progress * 0.7)

            # 转写音频
            result = self.transcribe_audio(
                audio_path,
                output_dir,
                progress_callback=audio_progress_callback,
            )

            # 如果不保留音频文件，则删除
            if not keep_audio and audio_path and audio_path.exists():
                audio_path.unlink()
                logger.info(f"已删除临时音频文件: {audio_path}")

            # 完成进度
            if progress_callback:
                progress_callback(1.0)

            return result

        except Exception as e:
            # 清理临时文件
            if not keep_audio and audio_path and audio_path.exists():
                try:
                    audio_path.unlink()
                except Exception:
                    logger.warning(f"无法删除临时音频文件: {audio_path}")

            logger.error(f"视频转写失败: {e}")
            raise

    def write_srt(
        self, segments: List[Segment], output_path: Union[str, Path]
    ) -> None:
        """将转写结果写入SRT文件

        Args:
            segments: 转写片段列表
            output_path: 输出文件路径
        """
        output_path = Path(output_path)
        os.makedirs(output_path.parent, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            for segment in segments:
                # SRT格式: 序号 + 时间戳 + 文本 + 空行
                f.write(f"{segment.id}\n")
                start_time = Segment.format_timestamp(segment.start)
                end_time = Segment.format_timestamp(segment.end)
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{segment.text}\n\n")

        logger.info(f"已写入SRT文件: {output_path}")
