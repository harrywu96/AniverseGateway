"""字幕模型模块

定义字幕相关的数据结构。
"""

from typing import List, Optional
from pydantic import BaseModel, Field


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
