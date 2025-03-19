"""系统配置相关的数据模型。"""

from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, SecretStr


class OpenAIConfig(BaseModel):
    """OpenAI配置模型"""

    api_key: SecretStr = Field(..., description="OpenAI API密钥")
    model: str = Field(default="gpt-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大token数")
    temperature: float = Field(default=0.3, description="温度参数")


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

    openai: OpenAIConfig
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

        # 创建OpenAI配置
        openai_config = OpenAIConfig(
            api_key=SecretStr(os.getenv("OPENAI_API_KEY", "")),
            model=os.getenv("OPENAI_MODEL", "gpt-4"),
            max_tokens=int(os.getenv("OPENAI_MAX_TOKENS", "4096")),
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.3")),
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
            openai=openai_config,
            ffmpeg=ffmpeg_config,
            logging=logging_config,
            api=api_config,
            max_concurrent_tasks=int(os.getenv("MAX_CONCURRENT_TASKS", "2")),
            output_dir=os.getenv("DEFAULT_OUTPUT_DIR"),
            temp_dir=os.getenv("TEMP_DIR", "./temp"),
            allowed_formats=allowed_formats.split(","),
            debug=os.getenv("APP_DEBUG", "false").lower() in ("true", "1", "yes"),
        )
