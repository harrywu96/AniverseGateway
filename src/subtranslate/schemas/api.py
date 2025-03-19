"""API请求和响应相关的数据模型。"""

from typing import List, Optional, Any, Dict, Union

from pydantic import BaseModel, Field

from .video import VideoInfo
from .task import SubtitleTask


class APIResponse(BaseModel):
    """API通用响应模型"""

    success: bool = Field(..., description="请求是否成功")
    message: str = Field(default="", description="响应消息")
    data: Optional[Any] = Field(None, description="响应数据")


class VideoUploadRequest(BaseModel):
    """视频上传请求模型"""

    filename: str = Field(..., description="文件名")
    content_type: str = Field(..., description="内容类型")


class TaskCreateRequest(BaseModel):
    """任务创建请求模型"""

    video_id: str = Field(..., description="视频ID")
    source_language: Optional[str] = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    translation_config: Optional[Dict[str, Any]] = Field(None, description="翻译配置")


class VideoListResponse(APIResponse):
    """视频列表响应模型"""

    data: List[VideoInfo]


class TaskListResponse(APIResponse):
    """任务列表响应模型"""

    data: List[SubtitleTask]


class VideoDetailResponse(APIResponse):
    """视频详情响应模型"""

    data: VideoInfo


class TaskDetailResponse(APIResponse):
    """任务详情响应模型"""

    data: SubtitleTask


class ErrorResponse(APIResponse):
    """错误响应模型"""

    success: bool = Field(default=False, description="请求是否成功")
    error_code: str = Field(..., description="错误代码")
    error_details: Optional[Dict[str, Any]] = Field(None, description="错误详情")


class ProgressUpdateEvent(BaseModel):
    """进度更新事件模型，用于WebSocket实时更新"""

    task_id: str = Field(..., description="任务ID")
    progress: float = Field(..., description="进度百分比")
    status: str = Field(..., description="当前状态")
    message: Optional[str] = Field(None, description="状态消息")
