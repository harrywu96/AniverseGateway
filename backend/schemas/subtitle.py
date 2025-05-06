"""字幕模型模块

定义字幕相关的数据结构。
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from uuid import uuid4


class SubtitleFormat(str):
    """字幕格式枚举"""

    SRT = "srt"
    ASS = "ass"
    SSA = "ssa"
    VTT = "vtt"
    TXT = "txt"


class SubtitleLine(BaseModel):
    """字幕行模型"""

    index: int = Field(..., description="字幕行索引")
    start: str = Field(..., description="开始时间")
    end: str = Field(..., description="结束时间")
    text: str = Field(..., description="字幕文本")
    start_ms: int = Field(..., description="开始时间(毫秒)")
    end_ms: int = Field(..., description="结束时间(毫秒)")


class SubtitleInfo(BaseModel):
    """字幕信息模型"""

    id: str = Field(..., description="字幕ID")
    path: str = Field(..., description="字幕文件路径")
    format: str = Field(..., description="字幕格式")
    language: Optional[str] = Field(None, description="字幕语言")
    total_lines: int = Field(default=0, description="总行数")
    video_id: Optional[str] = Field(None, description="关联视频ID")


class SubtitlePreview(BaseModel):
    """字幕预览模型"""

    lines: List[SubtitleLine] = Field(..., description="字幕行列表")
    total_lines: int = Field(..., description="总行数")
    language: Optional[str] = Field(None, description="字幕语言")
    format: str = Field(..., description="字幕格式")
    duration_seconds: float = Field(..., description="总时长(秒)")


class SubtitleTrack(BaseModel):
    """字幕轨道信息模型，用于序列化返回给API"""

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="轨道唯一ID"
    )
    index: int = Field(..., description="轨道索引")
    language: Optional[str] = Field(None, description="语言代码")
    title: Optional[str] = Field(None, description="标题")
    codec: Optional[str] = Field(None, description="编码格式")
    is_default: bool = Field(default=False, description="是否为默认轨道")
    is_forced: bool = Field(default=False, description="是否为强制轨道")

    @classmethod
    def from_extractor_track(cls, track) -> "SubtitleTrack":
        """从提取器轨道对象创建模型实例

        Args:
            track: 来自提取器的轨道对象

        Returns:
            SubtitleTrack: 新的序列化友好轨道对象
        """
        return cls(
            index=track.index,
            language=track.language,
            title=track.title,
            codec=track.codec,
            is_default=track.is_default,
            is_forced=track.is_forced,
        )
