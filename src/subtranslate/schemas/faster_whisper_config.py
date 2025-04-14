"""Faster Whisper GUI配置兼容模式。

提供与Faster Whisper GUI配置文件(fasterWhisperGUIConfig.json)兼容的配置模型，
用于将其配置应用到当前项目的faster-whisper相关功能中。
"""

from enum import Enum
from pydantic import BaseModel, Field


class ClipMode(int, Enum):
    """剪辑模式枚举"""

    DEFAULT = 0
    # 其他剪辑模式


class FasterWhisperModelParam(BaseModel):
    """Faster Whisper模型参数"""

    localModel: bool = Field(default=True, description="是否使用本地模型")
    onlineModel: bool = Field(default=False, description="是否使用在线模型")
    model_path: str = Field(default="", description="本地模型路径")
    modelName: int = Field(default=6, description="模型名称索引")
    use_v3_model: bool = Field(default=True, description="是否使用V3模型")
    device: int = Field(
        default=1, description="设备类型索引，0:cpu, 1:cuda, 2:auto"
    )
    deviceIndex: str = Field(default="0", description="设备索引")
    preciese: int = Field(default=5, description="精度设置索引")
    thread_num: str = Field(default="4", description="线程数量")
    num_worker: str = Field(default="1", description="工作线程数")
    download_root: str = Field(default="", description="模型下载根目录")
    local_files_only: bool = Field(default=True, description="仅使用本地文件")


class VADParam(BaseModel):
    """语音活动检测参数"""

    use_VAD: bool = Field(default=False, description="是否使用VAD")
    threshold: float = Field(default=0.5, description="VAD阈值")
    minSpeechDuration: str = Field(
        default="250", description="最小语音时长(ms)"
    )
    minSilenceDuration: str = Field(
        default="100", description="最小静音时长(ms)"
    )
    maxSpeechDuration: str = Field(default="30", description="最大语音时长(s)")
    speechPad: str = Field(default="2000", description="语音填充时长(ms)")


class SettingParam(BaseModel):
    """全局设置参数"""

    saveConfig: bool = Field(default=True, description="是否保存配置")
    autoLoadModel: bool = Field(default=False, description="自动加载模型")
    language: int = Field(default=0, description="界面语言索引")
    huggingface_user_token: str = Field(
        default="", description="Huggingface用户令牌"
    )
    autoGoToOutputPage: int = Field(
        default=2, description="自动转到输出页面设置"
    )
    autoClearTempFiles: bool = Field(
        default=False, description="自动清理临时文件"
    )
    themeColor: str = Field(default="#cb457d", description="主题颜色")


class TranscriptionParam(BaseModel):
    """转写参数"""

    aggregate_contents: bool = Field(default=False, description="是否聚合内容")
    language: int = Field(default=10, description="语言索引")
    task: bool = Field(
        default=False, description="任务模式，False为转写，True为翻译"
    )
    beam_size: str = Field(default="10", description="束搜索大小")
    best_of: str = Field(default="5", description="最优样本数")
    patience: str = Field(default="1.0", description="耐心值")
    length_penalty: str = Field(default="2.0", description="长度惩罚")
    temperature: str = Field(
        default="0.2,0.4,0.6,0.8,1.0", description="温度参数列表"
    )
    compression_ratio_threshold: str = Field(
        default="2.4", description="压缩比阈值"
    )
    log_prob_threshold: str = Field(default="-1.0", description="对数概率阈值")
    no_speech_threshold: str = Field(default="0", description="无语音阈值")
    condition_on_previous_text: bool = Field(
        default=True, description="基于前文生成"
    )
    initial_prompt: str = Field(default="", description="初始提示")
    prefix: str = Field(default="", description="前缀")
    suppress_blank: bool = Field(default=True, description="抑制空白")
    suppress_tokens: str = Field(default="-1", description="抑制令牌")
    without_timestamps: bool = Field(default=False, description="不生成时间戳")
    max_initial_timestamp: str = Field(
        default="9999999.0", description="最大初始时间戳"
    )
    word_timestamps: bool = Field(default=False, description="单词时间戳")
    prepend_punctuations: str = Field(
        default="\"'([{-", description="前置标点符号"
    )
    append_punctuations: str = Field(
        default="\"',.!?:)]}-", description="后置标点符号"
    )
    repetition_penalty: str = Field(default="1.0", description="重复惩罚")
    no_repeat_ngram_size: str = Field(
        default="0", description="不重复n元组大小"
    )
    prompt_reset_on_temperature: str = Field(
        default="0.5", description="温度重置提示阈值"
    )
    chunk_length: str = Field(default="30", description="分块长度(秒)")
    clip_mode: int = Field(default=0, description="剪辑模式")
    max_new_tokens: str = Field(default="448", description="最大新令牌数")
    clip_timestamps: str = Field(default="", description="剪辑时间戳")
    hallucination_silence_threshold: str = Field(
        default="0", description="幻觉静音阈值"
    )
    hotwords: str = Field(default="", description="热词")
    language_detection_threshold: str = Field(
        default="0.5", description="语言检测阈值"
    )
    language_detection_segments: str = Field(
        default="1", description="语言检测段数"
    )


class OutputWhisperX(BaseModel):
    """WhisperX输出配置"""

    tabMovable: bool = Field(default=True, description="标签可移动")
    tabScrollable: bool = Field(default=False, description="标签可滚动")
    tabShadowEnabled: bool = Field(default=False, description="标签阴影启用")
    tabMaxWidth: int = Field(default=230, description="标签最大宽度")
    closeDisplayMode: int = Field(default=0, description="关闭显示模式")
    whisperXMinSpeaker: int = Field(
        default=0, description="WhisperX最小发言人数"
    )
    whisperXMaxSpeaker: int = Field(
        default=0, description="WhisperX最大发言人数"
    )
    outputFormat: int = Field(default=5, description="输出格式索引")
    outputEncoding: int = Field(default=1, description="输出编码索引")


class DemucsConfig(BaseModel):
    """Demucs声音分离配置"""

    overlap: float = Field(default=0.25, description="重叠比例")
    segment: float = Field(default=30.0, description="分段长度(秒)")
    tracks: int = Field(default=1, description="音轨数量")


class FasterWhisperGUIConfig(BaseModel):
    """Faster Whisper GUI完整配置"""

    theme: str = Field(default="dark", description="界面主题")
    demucs: DemucsConfig = Field(
        default_factory=DemucsConfig, description="Demucs配置"
    )
    model_param: FasterWhisperModelParam = Field(
        default_factory=FasterWhisperModelParam, description="模型参数"
    )
    vad_param: VADParam = Field(
        default_factory=VADParam, description="VAD参数"
    )
    setting: SettingParam = Field(
        default_factory=SettingParam, description="全局设置"
    )
    Transcription_param: TranscriptionParam = Field(
        default_factory=TranscriptionParam, description="转写参数"
    )
    output_whisperX: OutputWhisperX = Field(
        default_factory=OutputWhisperX, description="WhisperX输出配置"
    )
