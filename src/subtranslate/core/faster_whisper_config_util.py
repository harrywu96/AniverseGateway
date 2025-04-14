"""Faster Whisper GUI配置处理工具。

提供加载和转换Faster Whisper GUI配置文件的功能，
使其能够应用到当前项目的faster-whisper功能中。
"""

import json
import logging
from pathlib import Path
from typing import Union, Optional

from subtranslate.schemas.faster_whisper_config import FasterWhisperGUIConfig
from subtranslate.core.speech_to_text import TranscriptionParameters

# 配置日志
logger = logging.getLogger(__name__)


# 模型名称映射
MODEL_NAMES = [
    "tiny",
    "tiny.en",
    "base",
    "base.en",
    "small",
    "small.en",
    "medium",
    "medium.en",
    "large-v1",
    "large-v2",
    "large-v3",
    "large-v3-turbo",
    "distil-large-v3",
    "distil-large-v2",
    "distil-medium.en",
    "distil-small.en",
]

# 设备类型映射
DEVICE_TYPES = ["cpu", "cuda", "auto"]

# 精度设置映射
PRECISION_TYPES = [
    "int8",
    "int8_float16",
    "int8_bfloat16",
    "int16",
    "float16",
    "float32",
    "bfloat16",
]

# 输出格式映射
OUTPUT_FORMATS = ["ASS", "JSON", "LRC", "SMI", "SRT", "TXT", "VTT"]


def load_faster_whisper_gui_config(
    config_path: Union[str, Path],
) -> FasterWhisperGUIConfig:
    """加载Faster Whisper GUI配置文件

    Args:
        config_path: 配置文件路径

    Returns:
        加载的配置对象
    """
    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_path}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config_data = json.load(f)

        return FasterWhisperGUIConfig.model_validate(config_data)

    except json.JSONDecodeError:
        logger.error(f"配置文件格式错误: {config_path}")
        raise
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        raise


def convert_to_transcription_parameters(
    gui_config: FasterWhisperGUIConfig,
) -> TranscriptionParameters:
    """将Faster Whisper GUI配置转换为当前项目的转写参数

    Args:
        gui_config: Faster Whisper GUI配置对象

    Returns:
        转换后的转写参数
    """
    # 处理模型配置
    model_param = gui_config.model_param

    # 获取模型名称
    model_size = MODEL_NAMES[model_param.modelName]
    if (
        model_param.use_v3_model
        and model_size.startswith("large")
        and not ("v3" in model_size)
    ):
        model_size = "large-v3"

    # 获取设备类型
    device = DEVICE_TYPES[model_param.device]

    # 获取计算精度
    compute_type = PRECISION_TYPES[model_param.preciese]

    # 处理转写参数
    trans_param = gui_config.Transcription_param

    # 温度列表处理
    temperatures = [
        float(t) for t in trans_param.temperature.split(",") if t.strip()
    ]

    # VAD参数处理
    vad_param = gui_config.vad_param
    vad_parameters = {
        "threshold": vad_param.threshold,
        "min_speech_duration_ms": int(vad_param.minSpeechDuration),
        "min_silence_duration_ms": int(vad_param.minSilenceDuration),
        "speech_pad_ms": int(vad_param.speechPad),
    }

    # 创建转写参数
    return TranscriptionParameters(
        # 模型配置
        model_size=model_size,
        model_dir=(
            model_param.model_path
            if model_param.model_path
            else model_param.download_root
        ),
        device=device,
        compute_type=compute_type,
        # 转写设置
        language=None,  # 使用自动检测
        task="translate" if trans_param.task else "transcribe",
        initial_prompt=(
            trans_param.initial_prompt if trans_param.initial_prompt else None
        ),
        # 分段设置
        vad_filter=vad_param.use_VAD,
        vad_parameters=vad_parameters,
        # 字幕设置
        word_timestamps=trans_param.word_timestamps,
        # 高级设置
        beam_size=int(trans_param.beam_size),
        best_of=int(trans_param.best_of),
        patience=float(trans_param.patience),
        temperature=temperatures,
        compression_ratio_threshold=float(
            trans_param.compression_ratio_threshold
        ),
        no_speech_threshold=float(trans_param.no_speech_threshold),
        condition_on_previous_text=trans_param.condition_on_previous_text,
        # 后处理选项
        suppress_blank=trans_param.suppress_blank,
        suppress_tokens=[
            int(t.strip())
            for t in trans_param.suppress_tokens.split(",")
            if t.strip()
        ],
    )


def get_output_format(gui_config: FasterWhisperGUIConfig) -> str:
    """从GUI配置中获取输出格式

    Args:
        gui_config: Faster Whisper GUI配置对象

    Returns:
        输出格式字符串
    """
    format_index = gui_config.output_whisperX.outputFormat
    if format_index < 0 or format_index >= len(OUTPUT_FORMATS):
        return "srt"  # 默认为SRT

    return OUTPUT_FORMATS[format_index].lower()


def save_transcription_parameters(
    params: TranscriptionParameters, output_path: Union[str, Path]
) -> None:
    """保存转写参数到JSON文件

    Args:
        params: 转写参数
        output_path: 输出路径
    """
    output_path = Path(output_path)

    # 确保父目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 转换为字典并保存
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(params.model_dump(), f, indent=2, ensure_ascii=False)

    logger.info(f"转写参数已保存到: {output_path}")


def apply_gui_config_to_parameters(
    gui_config_path: Union[str, Path],
    output_path: Optional[Union[str, Path]] = None,
) -> TranscriptionParameters:
    """从GUI配置文件应用设置到转写参数

    Args:
        gui_config_path: GUI配置文件路径
        output_path: 可选的输出参数保存路径

    Returns:
        应用了GUI配置的转写参数
    """
    # 加载GUI配置
    gui_config = load_faster_whisper_gui_config(gui_config_path)

    # 转换为转写参数
    params = convert_to_transcription_parameters(gui_config)

    # 如果指定了输出路径，保存参数
    if output_path:
        save_transcription_parameters(params, output_path)

    return params
