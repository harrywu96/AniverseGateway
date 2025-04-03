"""视频管理API路由模块

提供视频加载、分析和管理功能。
"""

import os
import logging
from typing import List, Optional
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    File,
    UploadFile,
    Form,
    Query,
)
from pydantic import BaseModel, Field

from ...schemas.api import APIResponse, VideoDetailResponse, ErrorResponse
from ...schemas.video import VideoInfo, VideoFormat
from ...schemas.config import SystemConfig
from ...core.subtitle_extractor import SubtitleExtractor
from ..dependencies import get_system_config, get_subtitle_extractor


# 配置日志
logger = logging.getLogger("subtranslate.api.videos")


# 创建路由器
router = APIRouter()


# 视频加载请求模型
class VideoLoadRequest(BaseModel):
    """视频加载请求模型"""

    file_path: str = Field(..., description="视频文件路径")
    auto_extract_subtitles: bool = Field(
        default=True, description="是否自动提取字幕"
    )


# 视频子标题轨道信息
class SubtitleTrackInfo(BaseModel):
    """字幕轨道信息"""

    index: int = Field(..., description="轨道索引")
    language: Optional[str] = Field(None, description="语言代码")
    title: Optional[str] = Field(None, description="标题")
    format: str = Field(..., description="格式")
    is_default: bool = Field(default=False, description="是否为默认轨道")
    is_forced: bool = Field(default=False, description="是否为强制轨道")


# 视频字幕信息响应
class VideoSubtitlesResponse(APIResponse):
    """视频字幕响应模型"""

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "获取字幕轨道成功",
                "data": {
                    "internal_tracks": [
                        {
                            "index": 0,
                            "language": "eng",
                            "title": "English",
                            "format": "subrip",
                            "is_default": True,
                            "is_forced": False,
                        }
                    ],
                    "external_subtitles": [
                        {
                            "path": "/path/to/subtitle.srt",
                            "language": "zh",
                            "format": "subrip",
                        }
                    ],
                },
            }
        }


@router.post("/load", response_model=VideoDetailResponse, tags=["视频管理"])
async def load_video(
    request: VideoLoadRequest,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """加载本地视频文件

    加载指定路径的视频文件，分析其基本信息，可选择性地自动提取字幕轨道。

    Args:
        request: 加载请求
        config: 系统配置
        extractor: 字幕提取器

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="视频文件不存在")

        # 获取文件信息
        file_path = Path(request.file_path)
        file_extension = file_path.suffix.lower().lstrip(".")

        # 检查文件格式
        if file_extension not in config.allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的视频格式: {file_extension}，支持的格式: {config.allowed_formats}",
            )

        # 创建视频信息对象
        video_format = VideoFormat(file_extension)
        video_info = VideoInfo(
            id=str(uuid4()),
            filename=file_path.name,
            path=str(file_path),
            format=video_format,
        )

        # 分析视频信息
        video_info = await extractor.analyze_video(video_info)

        # 如果需要自动提取字幕
        if request.auto_extract_subtitles:
            # 提取字幕轨道信息
            subtitle_tracks = await extractor.list_subtitle_tracks(video_info)
            video_info.subtitle_tracks = subtitle_tracks

            # 查找外挂字幕
            external_subtitles = await extractor.find_external_subtitles(
                video_info
            )
            video_info.external_subtitles = external_subtitles

        return VideoDetailResponse(
            success=True, message="视频加载成功", data=video_info
        )

    except Exception as e:
        logger.error(f"加载视频失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"加载视频失败: {str(e)}")


@router.get(
    "/{video_id}", response_model=VideoDetailResponse, tags=["视频管理"]
)
async def get_video_info(
    video_id: str, config: SystemConfig = Depends(get_system_config)
):
    """获取视频信息

    通过视频ID获取已加载视频的详细信息。

    Args:
        video_id: 视频ID
        config: 系统配置

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    # 在实际实现中，这里可能需要从某种存储中获取视频信息
    # 目前暂时返回错误，表示功能未完全实现
    raise HTTPException(status_code=501, detail="功能未实现")


@router.get(
    "/{video_id}/subtitles",
    response_model=VideoSubtitlesResponse,
    tags=["视频管理"],
)
async def get_video_subtitles(
    video_id: str,
    refresh: bool = Query(False, description="是否重新扫描字幕"),
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """获取视频可用字幕轨道

    获取指定视频的内嵌字幕轨道和外挂字幕文件信息。

    Args:
        video_id: 视频ID
        refresh: 是否重新扫描
        config: 系统配置
        extractor: 字幕提取器

    Returns:
        VideoSubtitlesResponse: 视频字幕响应
    """
    # 同样，这里需要先从存储中获取视频信息
    # 目前暂时返回错误
    raise HTTPException(status_code=501, detail="功能未实现")
