"""系统配置相关的数据模型。"""

from enum import Enum
from typing import Optional, List, Dict, Any, Union

from pydantic import BaseModel, Field, SecretStr


class AIProviderType(str, Enum):
    """AI服务提供商类型"""

    OPENAI = "openai"
    ZHIPUAI = "zhipuai"  # 智谱AI（如ChatGLM）
    VOLCENGINE = "volcengine"  # 火山引擎
    BAIDU = "baidu"  # 百度文心一言
    AZURE = "azure"  # Azure OpenAI服务
    ANTHROPIC = "anthropic"  # Anthropic Claude
    CUSTOM = "custom"  # 自定义API


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


class CustomAPIConfig(BaseAIConfig):
    """自定义API配置模型"""

    model: str = Field(default="default", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")
    headers: Dict[str, str] = Field(default_factory=dict, description="自定义请求头")
    model_parameters: Dict[str, Any] = Field(
        default_factory=dict, description="模型参数"
    )


class AIServiceConfig(BaseModel):
    """AI服务配置"""

    provider: AIProviderType = Field(
        default=AIProviderType.OPENAI, description="服务提供商"
    )
    openai: Optional[OpenAIConfig] = None
    zhipuai: Optional[ZhipuAIConfig] = None
    volcengine: Optional[VolcengineConfig] = None
    baidu: Optional[BaiduConfig] = None
    azure: Optional[AzureOpenAIConfig] = None
    anthropic: Optional[AnthropicConfig] = None
    custom: Optional[CustomAPIConfig] = None

    def get_provider_config(self) -> Union[BaseAIConfig, None]:
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
            return self.custom
        return None


class FFmpegConfig(BaseModel):
    """FFmpeg配置模型"""

    ffmpeg_path: Optional[str] = Field(None, description="FFmpeg可执行文件路径")
    ffprobe_path: Optional[str] = Field(None, description="FFprobe可执行文件路径")
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
        default=["http://localhost:3000"], description="允许的CORS源"
    )
    api_key: Optional[SecretStr] = Field(None, description="API访问密钥")


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
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15"),
                model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4"),
                max_tokens=int(os.getenv("AZURE_OPENAI_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("AZURE_OPENAI_TEMPERATURE", "0.3")),
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
        # 配置自定义API
        elif provider == AIProviderType.CUSTOM:
            headers_str = os.getenv("CUSTOM_API_HEADERS", "{}")
            params_str = os.getenv("CUSTOM_API_MODEL_PARAMS", "{}")
            import json

            try:
                headers = json.loads(headers_str)
                model_parameters = json.loads(params_str)
            except json.JSONDecodeError:
                headers = {}
                model_parameters = {}

            ai_service_config.custom = CustomAPIConfig(
                api_key=SecretStr(os.getenv("CUSTOM_API_KEY", "")),
                base_url=os.getenv("CUSTOM_API_BASE_URL"),
                model=os.getenv("CUSTOM_API_MODEL", "default"),
                max_tokens=int(os.getenv("CUSTOM_API_MAX_TOKENS", "4096")),
                temperature=float(os.getenv("CUSTOM_API_TEMPERATURE", "0.3")),
                headers=headers,
                model_parameters=model_parameters,
            )

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
                "LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
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
                SecretStr(os.getenv("API_KEY", "")) if os.getenv("API_KEY") else None
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
            debug=os.getenv("APP_DEBUG", "false").lower() in ("true", "1", "yes"),
        )
