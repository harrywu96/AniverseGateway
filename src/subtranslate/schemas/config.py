"""系统配置相关的数据模型。"""

from enum import Enum
from typing import Optional, List, Dict, Any, Union

from pydantic import BaseModel, Field, SecretStr
import torch


class AIProviderType(str, Enum):
    """AI服务提供商类型"""

    OPENAI = "openai"
    ZHIPUAI = "zhipuai"  # 智谱AI（如ChatGLM）
    VOLCENGINE = "volcengine"  # 火山引擎
    BAIDU = "baidu"  # 百度文心一言
    AZURE = "azure"  # Azure OpenAI服务
    ANTHROPIC = "anthropic"  # Anthropic Claude
    CUSTOM = "custom"  # 自定义API
    SILICONFLOW = "siliconflow"  # SiliconFlow AI服务
    GEMINI = "gemini"  # Google Gemini AI
    OLLAMA = "ollama"  # Ollama本地模型
    LOCAL = "local"  # 其他本地模型服务


class ChatRole(str, Enum):
    """聊天角色类型"""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"


class FormatType(str, Enum):
    """API请求/响应格式类型"""

    OPENAI = "openai"  # OpenAI格式
    ANTHROPIC = "anthropic"  # Anthropic Claude格式
    TEXT_COMPLETION = "text_completion"  # 文本补全格式
    CUSTOM = "custom"  # 自定义解析格式


class ModelCapability(str, Enum):
    """模型能力类型"""

    CHAT = "chat"  # 聊天对话能力
    COMPLETION = "completion"  # 文本补全能力
    EMBEDDING = "embedding"  # 文本嵌入能力
    IMAGE = "image"  # 图像生成能力
    AUDIO = "audio"  # 音频处理能力
    VISION = "vision"  # 图像理解能力
    TRANSLATION = "translation"  # 翻译能力


class BaseAIConfig(BaseModel):
    """基础AI服务配置"""

    api_key: SecretStr = Field(..., description="API密钥")
    base_url: Optional[str] = Field(None, description="API基础URL")
    timeout: int = Field(default=60, description="请求超时时间（秒）")
    max_retries: int = Field(default=3, description="最大重试次数")


class OpenAIConfig(BaseAIConfig):
    """OpenAI配置模型"""

    model: str = Field(default="gpt-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")


class ZhipuAIConfig(BaseAIConfig):
    """智谱AI配置模型"""

    model: str = Field(default="glm-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")


class VolcengineConfig(BaseAIConfig):
    """火山引擎配置模型"""

    model: str = Field(default="skylark-pro", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")


class BaiduConfig(BaseAIConfig):
    """百度文心一言配置模型"""

    model: str = Field(default="ernie-bot-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    secret_key: Optional[SecretStr] = Field(None, description="API密钥")


class AzureOpenAIConfig(BaseAIConfig):
    """Azure OpenAI配置模型"""

    model: str = Field(default="gpt-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    deployment_name: str = Field(..., description="部署名称")
    api_version: str = Field(default="2023-05-15", description="API版本")


class AnthropicConfig(BaseAIConfig):
    """Anthropic Claude配置模型"""

    model: str = Field(default="claude-3-opus", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")


class ModelEndpoint(BaseModel):
    """模型端点配置"""

    name: str = Field(..., description="端点名称")
    path: str = Field(..., description="API路径")
    capabilities: List[ModelCapability] = Field(
        default=[ModelCapability.CHAT], description="模型能力列表"
    )
    format_type: FormatType = Field(
        default=FormatType.OPENAI, description="API请求/响应格式"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="端点特定参数"
    )


class CustomModelConfig(BaseModel):
    """自定义模型配置"""

    id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    context_window: int = Field(default=4096, description="上下文窗口大小")
    capabilities: List[ModelCapability] = Field(
        default=[ModelCapability.CHAT], description="模型能力列表"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="模型默认参数"
    )


class CustomProviderConfig(BaseAIConfig):
    """单个自定义提供商配置"""

    id: str = Field(..., description="提供商ID")
    name: str = Field(..., description="提供商名称")
    model: str = Field(default="default", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    headers: Dict[str, str] = Field(
        default_factory=dict, description="自定义请求头"
    )
    model_parameters: Dict[str, Any] = Field(
        default_factory=dict, description="模型参数"
    )
    format_type: FormatType = Field(
        default=FormatType.OPENAI, description="API请求/响应格式"
    )
    endpoints: Dict[str, ModelEndpoint] = Field(
        default_factory=dict, description="API端点配置"
    )
    models: List[CustomModelConfig] = Field(
        default_factory=list, description="自定义模型列表"
    )
    custom_parser: Optional[str] = Field(
        None, description="自定义响应解析器脚本（Python代码）"
    )


class CustomAPIConfig(BaseModel):
    """自定义API配置模型，支持多个提供商"""

    providers: Dict[str, CustomProviderConfig] = Field(
        default_factory=dict, description="自定义提供商列表"
    )
    active_provider: Optional[str] = Field(
        None, description="当前激活的提供商ID"
    )

    # 兼容旧版本的属性
    api_key: Optional[SecretStr] = Field(
        None, description="默认API密钥（兼容旧版本）"
    )
    base_url: Optional[str] = Field(
        None, description="默认API基础URL（兼容旧版本）"
    )
    model: Optional[str] = Field(
        None, description="默认使用的模型（兼容旧版本）"
    )
    format_type: FormatType = Field(
        default=FormatType.OPENAI,
        description="默认API请求/响应格式（兼容旧版本）",
    )

    def get_active_provider(self) -> Optional[CustomProviderConfig]:
        """获取当前激活的提供商配置

        Returns:
            Optional[CustomProviderConfig]: 当前激活的提供商配置，如果没有则返回None
        """
        if (
            not self.active_provider
            or self.active_provider not in self.providers
        ):
            return None
        return self.providers[self.active_provider]


class SiliconFlowConfig(BaseAIConfig):
    """SiliconFlow AI服务配置"""

    api_key: SecretStr
    base_url: Optional[str] = "https://api.siliconflow.cn/v1"
    model: str = "deepseek-ai/DeepSeek-V2.5"  # 默认模型
    max_tokens: int = 4096
    temperature: float = 0.3
    top_p: Optional[float] = 0.7
    top_k: Optional[int] = 50
    frequency_penalty: Optional[float] = 0.0


class GeminiConfig(BaseAIConfig):
    """Google Gemini配置模型"""

    model: str = Field(default="gemini-pro", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    top_p: Optional[float] = Field(default=0.8, description="Top P参数")
    top_k: Optional[int] = Field(default=40, description="Top K参数")


class OllamaConfig(BaseAIConfig):
    """Ollama本地模型配置"""

    api_key: Optional[SecretStr] = Field(None, description="API密钥（可选）")
    base_url: str = Field(
        default="http://localhost:11434", description="API基础URL"
    )
    model: str = Field(default="llama3", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    top_p: Optional[float] = Field(default=0.8, description="Top P参数")
    top_k: Optional[int] = Field(default=40, description="Top K参数")


class LocalModelConfig(BaseAIConfig):
    """本地模型配置"""

    api_key: Optional[SecretStr] = Field(None, description="API密钥（可选）")
    base_url: str = Field(..., description="API基础URL")
    model: str = Field(default="default", description="使用的模型")
    model_path: Optional[str] = Field(None, description="模型文件路径")
    model_type: str = Field(default="gguf", description="模型类型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    top_p: Optional[float] = Field(default=0.7, description="Top P参数")
    top_k: Optional[int] = Field(default=40, description="Top K参数")
    format_type: FormatType = Field(
        default=FormatType.OPENAI, description="API请求/响应格式"
    )
    additional_parameters: Dict[str, Any] = Field(
        default_factory=dict, description="额外参数"
    )


class AIServiceConfig(BaseModel):
    """AI服务配置，包含所有可能的AI服务配置"""

    provider: AIProviderType
    openai: Optional[OpenAIConfig] = None
    zhipuai: Optional[ZhipuAIConfig] = None
    volcengine: Optional[VolcengineConfig] = None
    baidu: Optional[BaiduConfig] = None
    azure: Optional[AzureOpenAIConfig] = None
    anthropic: Optional[AnthropicConfig] = None
    custom: Optional[CustomAPIConfig] = None
    siliconflow: Optional[SiliconFlowConfig] = None
    gemini: Optional[GeminiConfig] = None
    ollama: Optional[OllamaConfig] = None
    local: Optional[LocalModelConfig] = None

    def get_provider_config(
        self,
    ) -> Union[BaseAIConfig, CustomProviderConfig, None]:
        """获取当前选择的服务提供商配置"""
        if self.provider == AIProviderType.OPENAI:
            return self.openai
        elif self.provider == AIProviderType.ZHIPUAI:
            return self.zhipuai
        elif self.provider == AIProviderType.VOLCENGINE:
            return self.volcengine
        elif self.provider == AIProviderType.BAIDU:
            return self.baidu
        elif self.provider == AIProviderType.AZURE:
            return self.azure
        elif self.provider == AIProviderType.ANTHROPIC:
            return self.anthropic
        elif self.provider == AIProviderType.CUSTOM:
            # 如果是自定义提供商，尝试获取当前激活的提供商配置
            if self.custom and self.custom.active_provider:
                active_provider = self.custom.get_active_provider()
                if active_provider:
                    return active_provider
            # 如果没有激活的提供商或获取失败，返回自定义配置
            return self.custom
        elif self.provider == AIProviderType.SILICONFLOW:
            return self.siliconflow
        elif self.provider == AIProviderType.GEMINI:
            return self.gemini
        elif self.provider == AIProviderType.OLLAMA:
            return self.ollama
        elif self.provider == AIProviderType.LOCAL:
            return self.local
        return None


class FFmpegConfig(BaseModel):
    """FFmpeg配置模型"""

    ffmpeg_path: Optional[str] = Field(
        None, description="FFmpeg可执行文件路径"
    )
    ffprobe_path: Optional[str] = Field(
        None, description="FFprobe可执行文件路径"
    )
    threads: int = Field(default=4, description="使用的线程数")


class LoggingConfig(BaseModel):
    """日志配置模型"""

    level: str = Field(default="INFO", description="日志级别")
    file_path: Optional[str] = Field(None, description="日志文件路径")
    format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="日志格式",
    )


class APIConfig(BaseModel):
    """API服务器配置模型"""

    host: str = Field(default="0.0.0.0", description="监听主机")
    port: int = Field(default=8000, description="监听端口")
    workers: int = Field(default=4, description="工作进程数")
    allowed_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
            "file://*",  # 允许Electron的file://协议访问
        ],
        description="允许的CORS源",
    )
    api_key: Optional[SecretStr] = Field(None, description="API访问密钥")


class SpeechToTextConfig(BaseModel):
    """语音转文字配置"""

    device: str = Field(
        default="cuda" if torch.cuda.is_available() else "cpu",
        description="运算设备，可选值: cuda, cpu, mps",
    )
    compute_type: str = Field(
        default="float16" if torch.cuda.is_available() else "float32",
        description="计算精度，可选值: float16, float32, int8_float16, int8_float32, int8_bfloat16, bfloat16",
    )
    model_dir: Optional[str] = Field(
        default=None, description="模型文件存储目录，默认为~/.cache/whisper"
    )
    default_model: str = Field(
        default="medium",
        description="默认模型大小，可选值: tiny, base, small, medium, large, large-v2, large-v3",
    )
    vad_filter: bool = Field(default=True, description="是否使用VAD过滤静音段")
    word_timestamps: bool = Field(
        default=True, description="是否生成词级时间戳"
    )


class SystemConfig(BaseModel):
    """系统配置模型，包含应用程序所有配置项"""

    ai_service: AIServiceConfig = Field(..., description="AI服务配置")
    ffmpeg: FFmpegConfig = Field(default_factory=FFmpegConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    api: APIConfig = Field(default_factory=APIConfig)
    max_concurrent_tasks: int = Field(default=2, description="最大并发任务数")
    output_dir: Optional[str] = Field(None, description="默认输出目录")
    temp_dir: str = Field(default="./temp", description="临时文件目录")
    allowed_formats: List[str] = Field(
        default=["mp4", "mkv"], description="允许的视频格式"
    )
    debug: bool = Field(default=False, description="调试模式")
    speech_to_text: Optional[SpeechToTextConfig] = Field(
        default=None, description="语音转文字配置"
    )

    @classmethod
    def from_env(cls) -> "SystemConfig":
        """从环境变量加载配置

        Returns:
            SystemConfig: 加载的系统配置
        """
        import os
        from dotenv import load_dotenv

        # 加载.env文件
        load_dotenv()

        # 确定AI服务提供商类型
        provider_str = os.getenv("AI_PROVIDER", "openai").lower()
        try:
            provider = AIProviderType(provider_str)
        except ValueError:
            provider = AIProviderType.OPENAI

        # 创建相应的AI服务配置
        ai_service_config = AIServiceConfig(provider=provider)

        # 配置OpenAI
        if provider == AIProviderType.OPENAI:
            ai_service_config.openai = OpenAIConfig(
                api_key=SecretStr(os.getenv("OPENAI_API_KEY", "")),
                base_url=os.getenv("OPENAI_BASE_URL"),
                model=os.getenv("OPENAI_MODEL", "gpt-4"),
                max_tokens=int(os.getenv("OPENAI_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.3")),
            )
        # 配置智谱AI
        elif provider == AIProviderType.ZHIPUAI:
            ai_service_config.zhipuai = ZhipuAIConfig(
                api_key=SecretStr(os.getenv("ZHIPUAI_API_KEY", "")),
                base_url=os.getenv("ZHIPUAI_BASE_URL"),
                model=os.getenv("ZHIPUAI_MODEL", "glm-4"),
                max_tokens=int(os.getenv("ZHIPUAI_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("ZHIPUAI_TEMPERATURE", "0.3")),
            )
        # 配置火山引擎
        elif provider == AIProviderType.VOLCENGINE:
            ai_service_config.volcengine = VolcengineConfig(
                api_key=SecretStr(os.getenv("VOLCENGINE_API_KEY", "")),
                base_url=os.getenv("VOLCENGINE_BASE_URL"),
                model=os.getenv("VOLCENGINE_MODEL", "skylark-pro"),
                max_tokens=int(os.getenv("VOLCENGINE_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("VOLCENGINE_TEMPERATURE", "0.3")),
            )
        # 配置百度文心一言
        elif provider == AIProviderType.BAIDU:
            ai_service_config.baidu = BaiduConfig(
                api_key=SecretStr(os.getenv("BAIDU_API_KEY", "")),
                secret_key=SecretStr(os.getenv("BAIDU_SECRET_KEY", "")),
                base_url=os.getenv("BAIDU_BASE_URL"),
                model=os.getenv("BAIDU_MODEL", "ernie-bot-4"),
                max_tokens=int(os.getenv("BAIDU_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("BAIDU_TEMPERATURE", "0.3")),
            )
        # 配置Azure OpenAI
        elif provider == AIProviderType.AZURE:
            ai_service_config.azure = AzureOpenAIConfig(
                api_key=SecretStr(os.getenv("AZURE_OPENAI_API_KEY", "")),
                base_url=os.getenv("AZURE_OPENAI_BASE_URL", ""),
                deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", ""),
                api_version=os.getenv(
                    "AZURE_OPENAI_API_VERSION", "2023-05-15"
                ),
                model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4"),
                max_tokens=int(os.getenv("AZURE_OPENAI_MAX_TOKENS", "4096")),
                temperature=float(
                    os.getenv("AZURE_OPENAI_TEMPERATURE", "0.3")
                ),
            )
        # 配置Anthropic
        elif provider == AIProviderType.ANTHROPIC:
            ai_service_config.anthropic = AnthropicConfig(
                api_key=SecretStr(os.getenv("ANTHROPIC_API_KEY", "")),
                base_url=os.getenv("ANTHROPIC_BASE_URL"),
                model=os.getenv("ANTHROPIC_MODEL", "claude-3-opus"),
                max_tokens=int(os.getenv("ANTHROPIC_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("ANTHROPIC_TEMPERATURE", "0.3")),
            )
        # 配置SiliconFlow
        elif provider == AIProviderType.SILICONFLOW:
            ai_service_config.siliconflow = SiliconFlowConfig(
                api_key=SecretStr(os.getenv("SILICONFLOW_API_KEY", "")),
                base_url=os.getenv(
                    "SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1"
                ),
                model=os.getenv(
                    "SILICONFLOW_MODEL", "deepseek-ai/DeepSeek-V2.5"
                ),
                max_tokens=int(os.getenv("SILICONFLOW_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("SILICONFLOW_TEMPERATURE", "0.3")),
                top_p=float(os.getenv("SILICONFLOW_TOP_P", "0.7")),
                top_k=int(os.getenv("SILICONFLOW_TOP_K", "50")),
                frequency_penalty=float(
                    os.getenv("SILICONFLOW_FREQUENCY_PENALTY", "0.0")
                ),
            )
        # 配置Gemini
        elif provider == AIProviderType.GEMINI:
            ai_service_config.gemini = GeminiConfig(
                api_key=SecretStr(os.getenv("GEMINI_API_KEY", "")),
                base_url=os.getenv(
                    "GEMINI_BASE_URL",
                    "https://generativelanguage.googleapis.com/v1",
                ),
                model=os.getenv("GEMINI_MODEL", "gemini-pro"),
                max_tokens=int(os.getenv("GEMINI_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.3")),
                top_p=float(os.getenv("GEMINI_TOP_P", "0.8")),
                top_k=int(os.getenv("GEMINI_TOP_K", "40")),
            )
        # 配置Ollama
        elif provider == AIProviderType.OLLAMA:
            ai_service_config.ollama = OllamaConfig(
                api_key=(
                    SecretStr(os.getenv("OLLAMA_API_KEY", ""))
                    if os.getenv("OLLAMA_API_KEY")
                    else None
                ),
                base_url=os.getenv(
                    "OLLAMA_BASE_URL", "http://localhost:11434"
                ),
                model=os.getenv("OLLAMA_MODEL", "llama3"),
                max_tokens=int(os.getenv("OLLAMA_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("OLLAMA_TEMPERATURE", "0.3")),
                top_p=float(os.getenv("OLLAMA_TOP_P", "0.8")),
                top_k=int(os.getenv("OLLAMA_TOP_K", "40")),
            )
        # 配置其他本地模型
        elif provider == AIProviderType.LOCAL:
            ai_service_config.local = LocalModelConfig(
                api_key=(
                    SecretStr(os.getenv("LOCAL_API_KEY", ""))
                    if os.getenv("LOCAL_API_KEY")
                    else None
                ),
                base_url=os.getenv("LOCAL_BASE_URL", ""),
                model=os.getenv("LOCAL_MODEL", "default"),
                model_path=os.getenv("LOCAL_MODEL_PATH"),
                model_type=os.getenv("LOCAL_MODEL_TYPE", "gguf"),
                max_tokens=int(os.getenv("LOCAL_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("LOCAL_TEMPERATURE", "0.3")),
                top_p=float(os.getenv("LOCAL_TOP_P", "0.7")),
                top_k=int(os.getenv("LOCAL_TOP_K", "40")),
                format_type=FormatType(
                    os.getenv("LOCAL_FORMAT_TYPE", "openai")
                ),
            )
        # 配置自定义API
        elif provider == AIProviderType.CUSTOM:
            headers_str = os.getenv("CUSTOM_API_HEADERS", "{}")
            params_str = os.getenv("CUSTOM_API_MODEL_PARAMS", "{}")
            import json
            import uuid

            try:
                headers = json.loads(headers_str)
                model_parameters = json.loads(params_str)
            except json.JSONDecodeError:
                headers = {}
                model_parameters = {}

            # 创建自定义API配置
            ai_service_config.custom = CustomAPIConfig(
                api_key=SecretStr(os.getenv("CUSTOM_API_KEY", "")),
                base_url=os.getenv("CUSTOM_API_BASE_URL"),
                model=os.getenv("CUSTOM_API_MODEL", "default"),
                format_type=FormatType(
                    os.getenv("CUSTOM_API_FORMAT_TYPE", "openai")
                ),
                providers={},
                active_provider=None,
            )

            # 如果有环境变量中的自定义提供商配置，创建一个默认的自定义提供商
            if os.getenv("CUSTOM_API_KEY") and os.getenv(
                "CUSTOM_API_BASE_URL"
            ):
                default_provider_id = str(uuid.uuid4())
                default_provider = CustomProviderConfig(
                    id=default_provider_id,
                    name="默认自定义提供商",
                    api_key=SecretStr(os.getenv("CUSTOM_API_KEY", "")),
                    base_url=os.getenv("CUSTOM_API_BASE_URL"),
                    model=os.getenv("CUSTOM_API_MODEL", "default"),
                    max_tokens=int(os.getenv("CUSTOM_API_MAX_TOKENS", "4096")),
                    temperature=float(
                        os.getenv("CUSTOM_API_TEMPERATURE", "0.3")
                    ),
                    headers=headers,
                    model_parameters=model_parameters,
                    format_type=FormatType(
                        os.getenv("CUSTOM_API_FORMAT_TYPE", "openai")
                    ),
                )
                ai_service_config.custom.providers[default_provider_id] = (
                    default_provider
                )
                ai_service_config.custom.active_provider = default_provider_id

            # 尝试从配置文件加载自定义提供商
            config_file = os.getenv("CUSTOM_PROVIDERS_CONFIG")
            if config_file and os.path.exists(config_file):
                try:
                    with open(config_file, "r", encoding="utf-8") as f:
                        providers_data = json.load(f)

                    for provider_id, provider_data in providers_data.get(
                        "providers", {}
                    ).items():
                        if (
                            "api_key" in provider_data
                            and "base_url" in provider_data
                        ):
                            provider_config = CustomProviderConfig(
                                id=provider_id,
                                name=provider_data.get("name", "自定义提供商"),
                                api_key=SecretStr(provider_data["api_key"]),
                                base_url=provider_data["base_url"],
                                model=provider_data.get("model", "default"),
                                max_tokens=provider_data.get(
                                    "max_tokens", 4096
                                ),
                                temperature=provider_data.get(
                                    "temperature", 0.3
                                ),
                                headers=provider_data.get("headers", {}),
                                model_parameters=provider_data.get(
                                    "model_parameters", {}
                                ),
                                format_type=FormatType(
                                    provider_data.get("format_type", "openai")
                                ),
                                models=[
                                    CustomModelConfig(**model)
                                    for model in provider_data.get(
                                        "models", []
                                    )
                                ],
                                endpoints={
                                    k: ModelEndpoint(**v)
                                    for k, v in provider_data.get(
                                        "endpoints", {}
                                    ).items()
                                },
                                custom_parser=provider_data.get(
                                    "custom_parser"
                                ),
                            )
                            ai_service_config.custom.providers[provider_id] = (
                                provider_config
                            )

                    # 设置激活的提供商
                    active_provider = providers_data.get("active_provider")
                    if (
                        active_provider
                        and active_provider
                        in ai_service_config.custom.providers
                    ):
                        ai_service_config.custom.active_provider = (
                            active_provider
                        )
                except Exception as e:
                    print(f"加载自定义提供商配置文件失败: {e}")

        # 创建FFmpeg配置
        ffmpeg_config = FFmpegConfig(
            ffmpeg_path=os.getenv("FFMPEG_PATH"),
            ffprobe_path=os.getenv("FFPROBE_PATH"),
            threads=int(os.getenv("FFMPEG_THREADS", "4")),
        )

        # 创建日志配置
        logging_config = LoggingConfig(
            level=os.getenv("LOG_LEVEL", "INFO"),
            file_path=os.getenv("LOG_FILE"),
            format=os.getenv(
                "LOG_FORMAT",
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            ),
        )

        # 创建API配置
        allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
        api_config = APIConfig(
            host=os.getenv("API_HOST", "0.0.0.0"),
            port=int(os.getenv("API_PORT", "8000")),
            workers=int(os.getenv("API_WORKERS", "4")),
            allowed_origins=allowed_origins.split(","),
            api_key=(
                SecretStr(os.getenv("API_KEY", ""))
                if os.getenv("API_KEY")
                else None
            ),
        )

        # 创建系统配置
        allowed_formats = os.getenv("ALLOWED_FORMATS", "mp4,mkv")
        return cls(
            ai_service=ai_service_config,
            ffmpeg=ffmpeg_config,
            logging=logging_config,
            api=api_config,
            max_concurrent_tasks=int(os.getenv("MAX_CONCURRENT_TASKS", "2")),
            output_dir=os.getenv("DEFAULT_OUTPUT_DIR"),
            temp_dir=os.getenv("TEMP_DIR", "./temp"),
            allowed_formats=allowed_formats.split(","),
            debug=os.getenv("APP_DEBUG", "false").lower()
            in ("true", "1", "yes"),
            speech_to_text=SpeechToTextConfig(
                device=os.getenv(
                    "SPEECH_TO_TEXT_DEVICE",
                    "cuda" if torch.cuda.is_available() else "cpu",
                ),
                compute_type=os.getenv(
                    "SPEECH_TO_TEXT_COMPUTE_TYPE",
                    "float16" if torch.cuda.is_available() else "float32",
                ),
                model_dir=os.getenv("SPEECH_TO_TEXT_MODEL_DIR"),
                default_model=os.getenv(
                    "SPEECH_TO_TEXT_DEFAULT_MODEL", "medium"
                ),
                vad_filter=os.getenv(
                    "SPEECH_TO_TEXT_VAD_FILTER", "true"
                ).lower()
                in ("true", "1", "yes"),
                word_timestamps=os.getenv(
                    "SPEECH_TO_TEXT_WORD_TIMESTAMPS", "true"
                ).lower()
                in ("true", "1", "yes"),
            ),
        )
