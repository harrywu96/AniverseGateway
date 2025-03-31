"""任务和配置相关的数据模型。"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from uuid import uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """任务状态枚举"""

    PENDING = "pending"  # 等待处理
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败


class TranslationStyle(str, Enum):
    """翻译风格枚举"""

    LITERAL = "literal"  # 直译
    NATURAL = "natural"  # 自然流畅
    COLLOQUIAL = "colloquial"  # 口语化
    FORMAL = "formal"  # 正式


class PromptTemplate(BaseModel):
    """提示模板模型，定义翻译提示的模板和变量"""

    name: str = Field(..., description="模板名称")
    description: str = Field(default="", description="模板描述")
    system_prompt: str = Field(..., description="系统提示")
    user_prompt: str = Field(..., description="用户提示")
    examples: List[Dict[str, str]] = Field(
        default_factory=list, description="少样本示例"
    )
    is_default: bool = Field(default=False, description="是否为默认模板")
    version: str = Field(default="1.0", description="模板版本")
    created_at: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="创建时间",
    )

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "name": "标准字幕翻译",
                "description": "适用于一般场景的字幕翻译",
                "system_prompt": "你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。",
                "user_prompt": "请将以下字幕从{source_language}翻译成{target_language}，保持风格{style}。\n\n{subtitle_text}",
                "examples": [
                    {
                        "subtitle": "Hello, world!",
                        "translation": "你好，世界！",
                    }
                ],
                "is_default": True,
            }
        }

    def format_system_prompt(self, **kwargs) -> str:
        """格式化系统提示

        Args:
            **kwargs: 格式化参数

        Returns:
            str: 格式化后的系统提示
        """
        return self.system_prompt.format(
            **{k: v for k, v in kwargs.items() if v}
        )

    def format_user_prompt(self, **kwargs) -> str:
        """格式化用户提示

        Args:
            **kwargs: 格式化参数

        Returns:
            str: 格式化后的用户提示
        """
        return self.user_prompt.format(
            **{k: v for k, v in kwargs.items() if v}
        )


class TranslationConfig(BaseModel):
    """翻译配置模型，定义翻译任务的参数和选项。"""

    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    preserve_formatting: bool = Field(default=True, description="保留原格式")
    handle_cultural_references: bool = Field(
        default=True, description="处理文化差异"
    )
    glossary: Dict[str, str] = Field(
        default_factory=dict, description="术语表"
    )
    forbidden_terms: List[str] = Field(
        default_factory=list, description="禁用术语列表"
    )
    context_preservation: bool = Field(
        default=True, description="保持上下文一致性"
    )
    chunk_size: int = Field(default=10, description="字幕分块大小（单位：条）")
    context_window: int = Field(
        default=3, description="上下文窗口大小（单位：条）"
    )
    max_retries: int = Field(default=3, description="翻译失败最大重试次数")
    validate_translations: bool = Field(
        default=True, description="是否验证翻译结果"
    )
    strict_validation: bool = Field(
        default=False, description="是否使用严格验证模式"
    )
    prompt_template: Optional[PromptTemplate] = Field(
        None, description="使用的提示模板"
    )
    prompt_template_name: Optional[str] = Field(
        None, description="提示模板名称（如不使用自定义模板）"
    )

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "style": "natural",
                "preserve_formatting": True,
                "handle_cultural_references": True,
                "glossary": {"AI": "人工智能", "ML": "机器学习"},
                "forbidden_terms": ["机械翻译", "直译"],
                "context_preservation": True,
                "chunk_size": 10,
                "context_window": 3,
                "max_retries": 3,
                "validate_translations": True,
                "strict_validation": False,
                "prompt_template_name": "标准字幕翻译",
            }
        }


class SubtitleTask(BaseModel):
    """字幕处理任务模型，包含任务状态、进度和配置信息。"""

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="任务唯一标识符"
    )
    video_id: str = Field(..., description="关联视频ID")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    status: TaskStatus = Field(
        default=TaskStatus.PENDING, description="任务状态"
    )
    progress: float = Field(default=0.0, description="进度百分比")
    source_path: str = Field(..., description="源字幕路径")
    result_path: Optional[str] = Field(None, description="结果字幕路径")
    created_at: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="创建时间",
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="更新时间",
    )
    completed_at: Optional[str] = Field(None, description="完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    config: TranslationConfig = Field(
        default_factory=TranslationConfig, description="翻译配置"
    )
    total_chunks: int = Field(default=0, description="总分块数")
    completed_chunks: int = Field(default=0, description="已完成分块数")

    def update_progress(self, progress: float) -> None:
        """更新任务进度

        Args:
            progress: 新的进度值(0.0-100.0)
        """
        self.progress = max(0.0, min(100.0, progress))

    def update_chunk_progress(self, completed_chunks: int) -> None:
        """通过已完成的分块数更新进度

        Args:
            completed_chunks: 已完成的分块数
        """
        if self.total_chunks > 0:
            self.completed_chunks = completed_chunks
            self.update_progress((completed_chunks / self.total_chunks) * 100)

    def mark_completed(self, result_path: str) -> None:
        """标记任务为已完成

        Args:
            result_path: 结果字幕文件路径
        """
        self.status = TaskStatus.COMPLETED
        self.progress = 100.0
        self.result_path = result_path
        self.completed_at = datetime.now().isoformat()
        self.updated_at = self.completed_at

    def mark_failed(self, error_message: str) -> None:
        """标记任务为失败

        Args:
            error_message: 错误信息
        """
        self.status = TaskStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.now().isoformat()
        self.updated_at = self.completed_at

    def to_dict(self) -> dict:
        """转换为字典表示"""
        return self.model_dump()
