"""视频管理API路由模块

提供视频加载、分析和管理功能。
"""

import os
import logging
import shutil
import hashlib
from typing import Optional, Dict, Any, Tuple
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

from backend.schemas.api import APIResponse, VideoDetailResponse
from backend.schemas.subtitle import SubtitleLine, SubtitlePreview
from backend.schemas.config import SystemConfig
from backend.core.subtitle_extractor import SubtitleExtractor, SubtitleFormat
from backend.services.video_storage import VideoStorageService
from backend.services.subtitle_storage import SubtitleStorageService
from backend.api.dependencies import (
    get_system_config,
    get_subtitle_extractor,
    get_video_storage,
    get_subtitle_storage,
)


# 配置日志
logger = logging.getLogger("subtranslate.api.videos")


# 创建路由器
router = APIRouter()


def _generate_file_fingerprint(
    file_path: str, sample_size: int = 1024 * 1024
) -> Tuple[str, Dict[str, Any]]:
    """生成文件指纹

    使用文件的元数据和部分内容哈希值生成唯一指纹，用于识别重复上传的视频文件。

    Args:
        file_path: 文件路径
        sample_size: 用于计算哈希值的文件头部大小（字节），默认1MB

    Returns:
        Tuple[str, Dict[str, Any]]: 指纹字符串和指纹详细信息字典
    """
    try:
        path = Path(file_path)
        if not path.exists():
            return "", {}

        # 获取文件元数据
        stat = path.stat()
        file_size = stat.st_size
        file_mtime = stat.st_mtime
        file_name = path.name

        # 计算文件头部的哈希值
        content_hash = ""
        try:
            with open(file_path, "rb") as f:
                # 读取文件头部
                content = f.read(min(sample_size, file_size))
                # 计算SHA-256哈希值
                content_hash = hashlib.sha256(content).hexdigest()
        except Exception as e:
            logger.warning(f"计算文件哈希值失败: {e}")

        # 构建指纹信息
        fingerprint_info = {
            "name": file_name,
            "size": file_size,
            "mtime": file_mtime,
            "content_hash": content_hash,
        }

        # 生成指纹字符串
        fingerprint = f"{file_name}_{file_size}_{content_hash[:16]}"

        return fingerprint, fingerprint_info
    except Exception as e:
        logger.error(f"生成文件指纹失败: {e}")
        return "", {}


# 视频列表响应模型
class VideoListResponse(APIResponse):
    """视频列表响应模型"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "获取视频列表成功",
                "data": [
                    {
                        "id": "48094602-cdde-4ce6-94fe-4b6c4b1762f7",
                        "filename": "example.mp4",
                        "duration": 120.5,
                        "has_embedded_subtitle": True,
                        "format": "mp4",
                        "status": "ready",
                        "created_at": "2023-01-01T12:00:00",
                    }
                ],
            }
        }


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


# Electron应用使用的嵌套请求模型
class ElectronVideoLoadRequest(BaseModel):
    """Electron应用使用的视频加载请求包装模型"""

    request: VideoLoadRequest = Field(..., description="视频加载请求")

    class Config:
        """模型配置"""

        json_schema_extra = {
            "example": {
                "request": {
                    "file_path": "/path/to/video.mp4",
                    "auto_extract_subtitles": True,
                }
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


# 字幕内容响应模型
class SubtitleContentResponse(APIResponse):
    """字幕内容响应模型"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "获取字幕内容成功",
                "data": {
                    "lines": [
                        {
                            "index": 1,
                            "start": "00:00:01,000",
                            "end": "00:00:04,000",
                            "text": "这是字幕内容",
                            "start_ms": 1000,
                            "end_ms": 4000,
                        }
                    ],
                    "total_lines": 100,
                    "language": "eng",
                    "format": "srt",
                    "duration_seconds": 600,
                },
            }
        }


@router.get("", response_model=VideoListResponse, tags=["视频管理"])
async def list_videos(
    config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """获取所有视频列表

    获取当前系统中所有已加载的视频信息列表。

    Args:
        config: 系统配置
        video_storage: 视频存储服务

    Returns:
        VideoListResponse: 视频列表响应
    """
    try:
        # 获取所有视频
        videos = video_storage.list_videos()

        # 转换为简化的响应格式
        video_list = []
        for video in videos:
            video_list.append(
                {
                    "id": video.id,
                    "filename": video.filename,
                    "duration": video.duration,
                    "has_embedded_subtitle": video.has_embedded_subtitle,
                    "format": video.format.value,
                    "status": video.status.value,
                    "created_at": video.created_at.isoformat(),
                    "path": video.path,
                    "subtitle_tracks_count": (
                        len(video.subtitle_tracks)
                        if video.subtitle_tracks
                        else 0
                    ),
                    "external_subtitles_count": (
                        len(video.external_subtitles)
                        if video.external_subtitles
                        else 0
                    ),
                }
            )

        return VideoListResponse(
            success=True, message="获取视频列表成功", data=video_list
        )
    except Exception as e:
        logger.error(f"获取视频列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"获取视频列表失败: {str(e)}"
        )


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
        logger.info(f"开始加载视频文件: {request.file_path}")
        logger.info(f"VideoStorageService实例ID: {id(video_storage)}")
        logger.info(f"加载前的视频存储数量: {len(video_storage.videos)}")
        logger.info(
            f"当前存储的所有视频ID: {list(video_storage.videos.keys())}"
        )

        # 检查文件是否存在
        if not os.path.exists(request.file_path):
            logger.error(f"视频文件不存在: {request.file_path}")
            raise HTTPException(status_code=404, detail="视频文件不存在")

        # 获取文件信息
        file_path = Path(request.file_path)
        file_extension = file_path.suffix.lower().lstrip(".")
        logger.info(f"文件扩展名: {file_extension}")

        # 检查文件格式
        if file_extension not in config.allowed_formats:
            logger.error(f"不支持的视频格式: {file_extension}")
            raise HTTPException(
                status_code=400,
                detail=f"不支持的视频格式: {file_extension}，支持的格式: {config.allowed_formats}",
            )

        # 保存到视频存储
        logger.info(f"开始保存视频到存储: {file_path}")
        video_info = video_storage.save_video(str(file_path), file_path.name)
        logger.info(f"视频已保存到存储，ID: {video_info.id}")

        # 分析视频信息
        logger.info(f"开始分析视频信息: {video_info.id}")
        video_info = await extractor.analyze_video(video_info)
        logger.info(
            f"视频分析完成: {video_info.id}, 时长: {video_info.duration}秒"
        )

        # 如果需要自动提取字幕
        if request.auto_extract_subtitles:
            logger.info(f"开始提取字幕轨道: {video_info.id}")
            # 提取字幕轨道信息
            subtitle_tracks = await extractor.list_subtitle_tracks(video_info)
            video_info.subtitle_tracks = subtitle_tracks
            logger.info(f"字幕轨道提取完成，共 {len(subtitle_tracks)} 个轨道")

            # 查找外挂字幕
            logger.info(f"开始查找外挂字幕: {video_info.id}")
            external_subtitles = await extractor.find_external_subtitles(
                video_info
            )
            video_info.external_subtitles = external_subtitles
            logger.info(
                f"外挂字幕查找完成，共 {len(external_subtitles)} 个文件"
            )

        # 更新存储中的视频信息
        logger.info(f"更新存储中的视频信息: {video_info.id}")
        video_storage.videos[video_info.id] = video_info
        logger.info(
            f"视频信息已更新，当前视频数量: {len(video_storage.videos)}"
        )
        logger.info(
            f"当前存储的所有视频ID: {list(video_storage.videos.keys())}"
        )

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
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """获取视频信息

    通过视频ID获取已加载视频的详细信息。

    Args:
        video_id: 视频ID
        config: 系统配置
        video_storage: 视频存储服务
        extractor: 字幕提取器

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    logger.info(f"获取视频信息，ID: {video_id}")
    logger.info(f"VideoStorageService实例ID: {id(video_storage)}")
    logger.info(f"当前存储的视频数量: {len(video_storage.videos)}")
    logger.info(f"当前存储的所有视频ID: {list(video_storage.videos.keys())}")

    video_info = video_storage.get_video(video_id)
    if not video_info:
        logger.warning(f"视频不存在，ID: {video_id}")
        raise HTTPException(status_code=404, detail="视频不存在")

    # 检查视频是否包含字幕轨道信息，如果没有则提取
    if not video_info.subtitle_tracks or len(video_info.subtitle_tracks) == 0:
        logger.info(f"视频 {video_id} 没有字幕轨道信息，尝试提取")
        try:
            # 提取字幕轨道信息
            subtitle_tracks = await extractor.list_subtitle_tracks(video_info)
            if subtitle_tracks and len(subtitle_tracks) > 0:
                video_info.subtitle_tracks = subtitle_tracks
                logger.info(f"成功提取到 {len(subtitle_tracks)} 个字幕轨道")

                # 查找外挂字幕
                external_subtitles = await extractor.find_external_subtitles(
                    video_info
                )
                if external_subtitles:
                    video_info.external_subtitles = external_subtitles
                    logger.info(
                        f"成功找到 {len(external_subtitles)} 个外挂字幕"
                    )

                # 更新存储中的视频信息
                video_storage.videos[video_id] = video_info
                logger.info(f"已更新视频 {video_id} 的字幕轨道信息")
            else:
                logger.warning(f"未能提取到字幕轨道信息")
        except Exception as e:
            logger.error(f"提取字幕轨道信息失败: {e}")
            # 继续返回视频信息，即使没有字幕轨道

    logger.info(
        f"成功获取视频信息: {video_info.id}, 文件名: {video_info.filename}"
    )
    return VideoDetailResponse(
        success=True, message="获取视频信息成功", data=video_info
    )


@router.get(
    "/by-frontend-id/{frontend_id}",
    response_model=VideoDetailResponse,
    tags=["视频管理"],
)
async def get_video_by_frontend_id(
    frontend_id: str,
    config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """通过前端ID获取视频信息

    使用前端生成的ID查询视频信息，通过ID映射表查找对应的后端ID。

    Args:
        frontend_id: 前端生成的视频ID
        config: 系统配置
        video_storage: 视频存储服务
        extractor: 字幕提取器

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    logger.info(f"通过前端ID获取视频信息，前端ID: {frontend_id}")

    # 检查VideoStorageService是否支持通过前端ID查询
    if not hasattr(video_storage, "get_by_frontend_id") or not callable(
        getattr(video_storage, "get_by_frontend_id")
    ):
        logger.warning("VideoStorageService不支持通过前端ID查询")
        raise HTTPException(status_code=501, detail="不支持通过前端ID查询")

    # 通过前端ID查询视频
    video_info = video_storage.get_by_frontend_id(frontend_id)
    if not video_info:
        logger.warning(f"未找到前端ID对应的视频，前端ID: {frontend_id}")
        raise HTTPException(status_code=404, detail="未找到前端ID对应的视频")

    # 检查视频是否包含字幕轨道信息，如果没有则提取
    if not video_info.subtitle_tracks or len(video_info.subtitle_tracks) == 0:
        logger.info(f"视频 {video_info.id} 没有字幕轨道信息，尝试提取")
        try:
            # 提取字幕轨道信息
            subtitle_tracks = await extractor.list_subtitle_tracks(video_info)
            if subtitle_tracks and len(subtitle_tracks) > 0:
                video_info.subtitle_tracks = subtitle_tracks
                logger.info(f"成功提取到 {len(subtitle_tracks)} 个字幕轨道")

                # 查找外挂字幕
                external_subtitles = await extractor.find_external_subtitles(
                    video_info
                )
                if external_subtitles:
                    video_info.external_subtitles = external_subtitles
                    logger.info(
                        f"成功找到 {len(external_subtitles)} 个外挂字幕"
                    )

                # 更新存储中的视频信息
                video_storage.videos[video_info.id] = video_info
                logger.info(f"已更新视频 {video_info.id} 的字幕轨道信息")
            else:
                logger.warning(f"未能提取到字幕轨道信息")
        except Exception as e:
            logger.error(f"提取字幕轨道信息失败: {e}")
            # 继续返回视频信息，即使没有字幕轨道

    logger.info(
        f"通过前端ID成功获取视频信息: {video_info.id}, 文件名: {video_info.filename}"
    )
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


@router.get(
    "/{video_id}/subtitles/{track_index}/content",
    response_model=SubtitleContentResponse,
    tags=["视频管理"],
)
async def get_video_subtitle_content(
    video_id: str,
    track_index: int,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """获取视频字幕轨道内容

    获取指定视频的指定字幕轨道的完整内容。

    Args:
        video_id: 视频ID
        track_index: 字幕轨道索引
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务
        subtitle_storage: 字幕存储服务

    Returns:
        SubtitleContentResponse: 字幕内容响应
    """
    try:
        # 获取视频信息
        video_info = video_storage.get_video(video_id)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")

        # 检查字幕轨道是否存在
        if (
            not video_info.subtitle_tracks
            or len(video_info.subtitle_tracks) <= track_index
        ):
            raise HTTPException(status_code=404, detail="字幕轨道不存在")

        # 获取字幕轨道信息
        track = video_info.subtitle_tracks[track_index]

        # 安全获取轨道语言信息
        track_language = None
        if hasattr(track, "language"):
            track_language = track.language
        elif isinstance(track, dict) and "language" in track:
            track_language = track["language"]
        else:
            logger.warning(f"字幕轨道 {track_index} 缺少语言信息，使用默认值")
            track_language = "unknown"

        logger.info(
            f"字幕轨道信息: index={track_index}, "
            f"language={track_language}, track_type={type(track)}"
        )

        # 创建临时目录
        output_dir = Path(config.temp_dir) / "subtitles"
        output_dir.mkdir(parents=True, exist_ok=True)

        # 提取字幕内容
        subtitle_path = extractor.extract_embedded_subtitle(
            video_info,
            track_index=track_index,
            output_dir=output_dir,
            target_format=SubtitleFormat.SRT,  # 默认使用SRT格式
        )

        if not subtitle_path or not os.path.exists(str(subtitle_path)):
            raise HTTPException(status_code=500, detail="提取字幕内容失败")

        # 读取字幕文件
        with open(str(subtitle_path), "r", encoding="utf-8") as f:
            content = f.read()

        # 解析字幕内容
        from backend.api.routers.subtitles import _parse_subtitle_lines

        lines = _parse_subtitle_lines(content, "srt")

        # 计算总行数和总时长
        total_lines = len(lines)
        duration_seconds = 0
        if lines:
            last_line = lines[-1]
            duration_seconds = last_line.end_ms / 1000.0

        # 构建完整内容响应
        subtitle_preview = SubtitlePreview(
            lines=lines,
            total_lines=total_lines,
            language=track_language,
            format="srt",
            duration_seconds=duration_seconds,
        )

        return SubtitleContentResponse(
            success=True,
            message="获取字幕内容成功",
            data=subtitle_preview,
        )

    except Exception as e:
        logger.error(f"获取字幕内容失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"获取字幕内容失败: {str(e)}"
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
    request: dict,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """从本地路径加载视频文件（Electron应用专用）

    接收本地视频文件路径，直接加载视频，用于与Electron前端集成。
    支持两种请求格式:
    1. 直接格式: {"file_path": "...", "auto_extract_subtitles": true}
    2. 嵌套格式: {"request": {"file_path": "...", "auto_extract_subtitles": true}}

    Args:
        request: 视频加载请求(支持直接和嵌套格式)
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        VideoDetailResponse: 视频详情响应
    """
    try:
        # 处理请求格式，支持直接和嵌套格式
        logger.info(f"接收到本地视频加载请求原始数据: {request}")
        logger.info(f"VideoStorageService实例ID: {id(video_storage)}")
        logger.info(f"当前存储的视频数量: {len(video_storage.videos)}")
        logger.info(
            f"当前存储的所有视频ID: {list(video_storage.videos.keys())}"
        )

        if "request" in request:
            # 嵌套格式
            video_request_data = request["request"]
            logger.info("检测到嵌套格式请求")
        else:
            # 直接格式
            video_request_data = request
            logger.info("检测到直接格式请求")

        # 转换为VideoLoadRequest对象
        video_request = VideoLoadRequest(**video_request_data)
        logger.info(f"处理后的视频加载请求: {video_request}")

        # 检查文件路径
        if not video_request.file_path:
            logger.error("请求中缺少必要的file_path字段")
            raise HTTPException(status_code=400, detail="缺少必要的文件路径")

        # 生成文件指纹，用于检测重复上传
        file_path = Path(video_request.file_path)
        if not file_path.exists():
            logger.error(f"文件不存在: {file_path}")
            raise HTTPException(
                status_code=404, detail=f"文件不存在: {file_path}"
            )

        # 使用新的指纹生成函数
        file_fingerprint, fingerprint_info = _generate_file_fingerprint(
            str(file_path)
        )
        if not file_fingerprint:
            logger.warning(f"无法生成文件指纹，将继续上传: {file_path}")
        else:
            logger.info(f"生成的文件指纹: {file_fingerprint}")
            logger.info(f"指纹详细信息: {fingerprint_info}")

        # 检查是否已经上传过该文件
        for video_id, video in video_storage.videos.items():
            # 生成已存在视频的指纹
            existing_path = Path(video.path)
            if existing_path.exists():
                existing_fingerprint, existing_info = (
                    _generate_file_fingerprint(str(existing_path))
                )

                if existing_fingerprint:
                    logger.info(
                        f"现有视频指纹: {existing_fingerprint}, ID: {video_id}"
                    )

                    # 如果文件名相同且内容哈希匹配，认为是同一个文件
                    if (
                        file_fingerprint
                        and existing_fingerprint
                        and fingerprint_info.get("name")
                        == existing_info.get("name")
                        and fingerprint_info.get("content_hash")
                        == existing_info.get("content_hash")
                    ):

                        logger.info(
                            f"检测到重复上传的视频: {file_path.name}, 返回现有视频ID: {video_id}"
                        )

                        # 如果请求中包含前端ID，添加到映射
                        if "frontend_id" in video_request_data:
                            frontend_id = video_request_data["frontend_id"]
                            if hasattr(
                                video_storage, "add_id_mapping"
                            ) and callable(
                                getattr(video_storage, "add_id_mapping")
                            ):
                                video_storage.add_id_mapping(
                                    frontend_id, video_id
                                )
                                logger.info(
                                    f"添加ID映射: 前端ID {frontend_id} -> 后端ID {video_id}"
                                )

                        # 检查视频是否包含字幕轨道信息，如果没有则提取
                        if (
                            not video.subtitle_tracks
                            or len(video.subtitle_tracks) == 0
                        ):
                            logger.info(
                                f"视频 {video_id} 没有字幕轨道信息，尝试提取"
                            )
                            try:
                                # 提取字幕轨道信息
                                subtitle_tracks = (
                                    await extractor.list_subtitle_tracks(video)
                                )
                                if (
                                    subtitle_tracks
                                    and len(subtitle_tracks) > 0
                                ):
                                    video.subtitle_tracks = subtitle_tracks
                                    logger.info(
                                        f"成功提取到 {len(subtitle_tracks)} 个字幕轨道"
                                    )

                                    # 查找外挂字幕
                                    external_subtitles = await extractor.find_external_subtitles(
                                        video
                                    )
                                    if external_subtitles:
                                        video.external_subtitles = (
                                            external_subtitles
                                        )
                                        logger.info(
                                            f"成功找到 {len(external_subtitles)} 个外挂字幕"
                                        )

                                    # 更新存储中的视频信息
                                    video_storage.videos[video_id] = video
                                    logger.info(
                                        f"已更新视频 {video_id} 的字幕轨道信息"
                                    )
                                else:
                                    logger.warning(f"未能提取到字幕轨道信息")
                            except Exception as e:
                                logger.error(f"提取字幕轨道信息失败: {e}")
                                # 继续返回视频信息，即使没有字幕轨道

                        return VideoDetailResponse(
                            success=True,
                            message="视频已存在，返回现有信息",
                            data=video,
                        )

                    # 退化方案：如果内容哈希不可用，使用文件名和大小进行匹配
                    elif (
                        file_path.name == video.filename
                        and abs(
                            fingerprint_info.get("size", 0)
                            - existing_info.get("size", 0)
                        )
                        < 1024
                    ):  # 允许1KB的误差

                        logger.info(
                            f"使用退化方案检测到重复上传的视频: {file_path.name}, 返回现有视频ID: {video_id}"
                        )

                        # 如果请求中包含前端ID，添加到映射
                        if "frontend_id" in video_request_data:
                            frontend_id = video_request_data["frontend_id"]
                            if hasattr(
                                video_storage, "add_id_mapping"
                            ) and callable(
                                getattr(video_storage, "add_id_mapping")
                            ):
                                video_storage.add_id_mapping(
                                    frontend_id, video_id
                                )
                                logger.info(
                                    f"添加ID映射: 前端ID {frontend_id} -> 后端ID {video_id}"
                                )

                        # 检查视频是否包含字幕轨道信息，如果没有则提取
                        if (
                            not video.subtitle_tracks
                            or len(video.subtitle_tracks) == 0
                        ):
                            logger.info(
                                f"视频 {video_id} 没有字幕轨道信息，尝试提取"
                            )
                            try:
                                # 提取字幕轨道信息
                                subtitle_tracks = (
                                    await extractor.list_subtitle_tracks(video)
                                )
                                if (
                                    subtitle_tracks
                                    and len(subtitle_tracks) > 0
                                ):
                                    video.subtitle_tracks = subtitle_tracks
                                    logger.info(
                                        f"成功提取到 {len(subtitle_tracks)} 个字幕轨道"
                                    )

                                    # 查找外挂字幕
                                    external_subtitles = await extractor.find_external_subtitles(
                                        video
                                    )
                                    if external_subtitles:
                                        video.external_subtitles = (
                                            external_subtitles
                                        )
                                        logger.info(
                                            f"成功找到 {len(external_subtitles)} 个外挂字幕"
                                        )

                                    # 更新存储中的视频信息
                                    video_storage.videos[video_id] = video
                                    logger.info(
                                        f"已更新视频 {video_id} 的字幕轨道信息"
                                    )
                                else:
                                    logger.warning(f"未能提取到字幕轨道信息")
                            except Exception as e:
                                logger.error(f"提取字幕轨道信息失败: {e}")
                                # 继续返回视频信息，即使没有字幕轨道

                        return VideoDetailResponse(
                            success=True,
                            message="视频已存在，返回现有信息",
                            data=video,
                        )

        # 如果没有找到匹配的视频，正常加载
        logger.info("未找到匹配的视频，开始正常加载")
        response = await load_video(
            video_request, config, extractor, video_storage
        )

        # 记录加载结果
        if response.success and response.data:
            logger.info(
                f"视频加载成功，ID: {response.data.id}, 文件名: {response.data.filename}"
            )
            logger.info(f"加载后的视频存储数量: {len(video_storage.videos)}")
            logger.info(
                f"当前存储的所有视频ID: {list(video_storage.videos.keys())}"
            )
        else:
            logger.warning(f"视频加载失败: {response.message}")

        return response
    except Exception as e:
        logger.error(f"本地视频加载失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"本地视频加载失败: {str(e)}"
        )


@router.post("/clear-cache", response_model=APIResponse, tags=["视频管理"])
async def clear_cache(
    config: SystemConfig = Depends(get_system_config),
    video_storage: VideoStorageService = Depends(get_video_storage),
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """清除临时缓存

    清除所有临时文件和内存中的视频信息。

    Args:
        config: 系统配置
        video_storage: 视频存储服务
        subtitle_storage: 字幕存储服务

    Returns:
        APIResponse: 操作响应
    """
    try:
        # 清除视频存储
        video_count = len(video_storage.videos)
        video_storage.clear_all()

        # 清除字幕存储
        subtitle_count = len(subtitle_storage._subtitles)
        subtitle_storage.clear_all()

        # 清除临时目录
        temp_dir = Path(config.temp_dir)
        if temp_dir.exists():
            # 先删除目录下的所有文件
            for item in temp_dir.glob("*"):
                if item.is_file():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)

            # 重新创建目录结构
            temp_dir.mkdir(exist_ok=True)
            (temp_dir / "subtitles").mkdir(exist_ok=True)

        return APIResponse(
            success=True,
            message=f"清除缓存成功，删除了{video_count}个视频和{subtitle_count}个字幕文件",
            data={
                "cleared_videos": video_count,
                "cleared_subtitles": subtitle_count,
            },
        )
    except Exception as e:
        logger.error(f"清除缓存失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")
