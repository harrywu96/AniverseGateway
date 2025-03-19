"""任务和配置相关的数据模型。"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """任务状态枚举"""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TranslationStyle(str, Enum):
    """翻译风格枚举"""

    LITERAL = "literal"  # 直译
    NATURAL = "natural"  # 自然流畅
    COLLOQUIAL = "colloquial"  # 口语化
    FORMAL = "formal"  # 正式


class TranslationConfig(BaseModel):
    """翻译配置模型，定义翻译任务的参数和选项。"""

    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    preserve_formatting: bool = Field(default=True, description="保留原格式")
    handle_cultural_references: bool = Field(default=True, description="处理文化差异")
    glossary: Dict[str, str] = Field(default_factory=dict, description="术语表")
    context_preservation: bool = Field(default=True, description="保持上下文一致性")

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "style": "natural",
                "preserve_formatting": True,
                "handle_cultural_references": True,
                "glossary": {"AI": "人工智能", "ML": "机器学习"},
                "context_preservation": True,
            }
        }


class SubtitleTask(BaseModel):
    """字幕处理任务模型，包含任务状态、进度和配置信息。"""

    id: str = Field(default_factory=lambda: str(uuid4()), description="任务唯一标识符")
    video_id: str = Field(..., description="关联视频ID")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    status: TaskStatus = Field(default=TaskStatus.QUEUED, description="任务状态")
    progress: float = Field(default=0.0, description="进度百分比")
    source_path: str = Field(..., description="源字幕路径")
    result_path: Optional[str] = Field(None, description="结果字幕路径")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    config: TranslationConfig = Field(
        default_factory=TranslationConfig, description="翻译配置"
    )

    def update_progress(self, progress: float) -> None:
        """更新任务进度

        Args:
            progress: 新的进度值(0.0-100.0)
        """
        self.progress = max(0.0, min(100.0, progress))

    def mark_completed(self, result_path: str) -> None:
        """标记任务为已完成

        Args:
            result_path: 结果字幕文件路径
        """
        self.status = TaskStatus.COMPLETED
        self.progress = 100.0
        self.result_path = result_path
        self.completed_at = datetime.now()

    def mark_failed(self, error_message: str) -> None:
        """标记任务为失败

        Args:
            error_message: 错误信息
        """
        self.status = TaskStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.now()

    def to_dict(self) -> dict:
        """转换为字典表示"""
        return self.model_dump()
