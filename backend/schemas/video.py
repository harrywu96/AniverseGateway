"""视频信息相关的数据模型。"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ProcessingStatus(str, Enum):
    """视频处理状态枚举"""

    PENDING = "pending"
    EXTRACTING = "extracting"
    TRANSLATING = "translating"
    MERGING = "merging"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoFormat(str, Enum):
    """支持的视频格式枚举"""

    MP4 = "mp4"
    MKV = "mkv"
    AVI = "avi"
    WEBM = "webm"
    OTHER = "other"


class VideoInfo(BaseModel):
    """视频信息模型，存储视频相关的元数据和处理状态。"""

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="视频唯一标识符"
    )
    filename: str = Field(..., description="视频文件名")
    path: str = Field(..., description="视频文件路径")
    duration: Optional[float] = Field(None, description="视频时长（秒）")
    has_embedded_subtitle: bool = Field(False, description="是否包含内嵌字幕")
    format: VideoFormat = Field(..., description="视频格式")
    status: ProcessingStatus = Field(
        default=ProcessingStatus.PENDING, description="处理状态"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="创建时间"
    )
    subtitle_tracks: List[Any] = Field(
        default_factory=list, description="字幕轨道列表"
    )
    external_subtitles: List[Dict[str, Any]] = Field(
        default_factory=list, description="外挂字幕列表"
    )

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "id": "vid_12345",
                "filename": "movie.mp4",
                "path": "/videos/movie.mp4",
                "duration": 3600.5,
                "has_embedded_subtitle": True,
                "format": "mp4",
                "status": "pending",
                "created_at": "2023-05-20T14:30:00Z",
                "subtitle_tracks": [],
                "external_subtitles": [],
            }
        }

    def to_dict(self) -> dict:
        """转换为字典表示"""
        return self.model_dump()

    def to_api_representation(self) -> dict:
        """转换为API表示形式"""
        data = self.to_dict()
        data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_file_path(
        cls, filepath: str, format_override: Optional[VideoFormat] = None
    ):
        """从文件路径创建视频信息模型

        Args:
            filepath: 视频文件路径
            format_override: 可选的格式覆盖值

        Returns:
            VideoInfo: 创建的视频信息模型实例
        """
        from pathlib import Path

        path = Path(filepath)
        filename = path.name

        # 如果未提供格式，则从文件扩展名推断
        if format_override is None:
            suffix = path.suffix.lower().lstrip(".")
            try:
                format_value = VideoFormat(suffix)
            except ValueError:
                format_value = VideoFormat.OTHER
        else:
            format_value = format_override

        return cls(
            filename=filename, path=str(path.absolute()), format=format_value
        )
