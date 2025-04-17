"""视频管理API路由模块

提供视频加载、分析和管理功能。
"""

import os
import logging
from typing import Optional
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    File,
    UploadFile,
    Query,
)
from pydantic import BaseModel, Field

from ...schemas.api import APIResponse, VideoDetailResponse
from ...schemas.video import VideoFormat
from ...schemas.config import SystemConfig
from ...core.subtitle_extractor import SubtitleExtractor
from ...services.video_storage import VideoStorageService
from ..dependencies import (
    get_system_config,
    get_subtitle_extractor,
    get_video_storage,
)


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

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "file_path": "/path/to/video.mp4",
                "auto_extract_subtitles": True,
            }
        }


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
        json_schema_extra = {
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
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """加载本地视频文件

    加载指定路径的视频文件，分析其基本信息，可选择性地自动提取字幕轨道。

    Args:
        request: 加载请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

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

        # 保存到视频存储
        video_info = video_storage.save_video(str(file_path), file_path.name)

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

        # 更新存储中的视频信息
        video_storage.videos[video_info.id] = video_info

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
    video_id: str,
    config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """获取视频信息

    通过视频ID获取已加载视频的详细信息。

    Args:
        video_id: 视频ID
        config: 系统配置
        video_storage: 视频存储服务

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    video_info = video_storage.get_video(video_id)
    if not video_info:
        raise HTTPException(status_code=404, detail="视频不存在")

    return VideoDetailResponse(
        success=True, message="获取视频信息成功", data=video_info
    )


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
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """获取视频可用字幕轨道

    获取指定视频的内嵌字幕轨道和外挂字幕文件信息。

    Args:
        video_id: 视频ID
        refresh: 是否重新扫描
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        VideoSubtitlesResponse: 视频字幕响应
    """
    try:
        # 获取视频信息
        video_info = video_storage.get_video(video_id)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")

        # 如果需要刷新或没有字幕信息
        if refresh or not video_info.subtitle_tracks:
            # 提取字幕轨道信息
            subtitle_tracks = await extractor.list_subtitle_tracks(video_info)
            video_info.subtitle_tracks = subtitle_tracks

            # 查找外挂字幕
            external_subtitles = await extractor.find_external_subtitles(
                video_info
            )
            video_info.external_subtitles = external_subtitles

            # 更新存储中的视频信息
            video_storage.videos[video_id] = video_info

        # 构建响应数据
        internal_tracks = []
        for track in video_info.subtitle_tracks:
            internal_tracks.append(
                {
                    "index": track.index,
                    "language": track.language,
                    "title": track.title,
                    "format": track.codec or "unknown",
                    "is_default": track.is_default,
                    "is_forced": track.is_forced,
                }
            )

        external_subtitles = []
        for subtitle in video_info.external_subtitles:
            external_subtitles.append(
                {
                    "path": subtitle.path,
                    "language": subtitle.language,
                    "format": subtitle.format,
                }
            )

        return VideoSubtitlesResponse(
            success=True,
            message="获取字幕轨道成功",
            data={
                "internal_tracks": internal_tracks,
                "external_subtitles": external_subtitles,
            },
        )

    except Exception as e:
        logger.error(f"获取字幕轨道失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"获取字幕轨道失败: {str(e)}"
        )


@router.post("/upload", response_model=VideoDetailResponse, tags=["视频管理"])
async def upload_video(
    file: UploadFile = File(...),
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """上传视频文件

    接收上传的视频文件，保存到临时目录，并返回基本信息。

    Args:
        file: 上传的视频文件
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    try:
        # 获取文件扩展名
        filename = file.filename
        if not filename:
            raise HTTPException(status_code=400, detail="无效的文件名")

        file_extension = Path(filename).suffix.lower().lstrip(".")

        # 检查文件格式
        if file_extension not in config.allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的视频格式: {file_extension}，支持的格式: {config.allowed_formats}",
            )

        # 创建临时文件
        temp_file = (
            Path(config.temp_dir) / f"upload_{uuid4()}.{file_extension}"
        )

        # 保存上传的文件
        with open(temp_file, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # 保存到视频存储
        video_info = video_storage.save_video(str(temp_file), filename)

        # 分析视频信息
        video_info = await extractor.analyze_video(video_info)

        # 更新存储中的视频信息
        video_storage.videos[video_info.id] = video_info

        return VideoDetailResponse(
            success=True, message="视频上传成功", data=video_info
        )

    except Exception as e:
        logger.error(f"上传视频失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"上传视频失败: {str(e)}")


@router.post(
    "/upload-local", response_model=VideoDetailResponse, tags=["视频管理"]
)
async def upload_local_video(
    request: VideoLoadRequest,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """从本地路径加载视频文件（Electron应用专用）

    接收本地视频文件路径，直接加载视频，用于与Electron前端集成。

    Args:
        request: 视频加载请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    try:
        logger.info(f"接收到本地视频加载请求: {request}")

        # 检查文件路径
        if not request.file_path:
            logger.error("请求中缺少必要的file_path字段")
            raise HTTPException(status_code=400, detail="缺少必要的文件路径")

        return await load_video(request, config, extractor, video_storage)
    except Exception as e:
        logger.error(f"本地视频加载失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"本地视频加载失败: {str(e)}"
        )
