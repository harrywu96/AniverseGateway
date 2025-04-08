"""字幕提取API路由模块

提供字幕提取、加载和预览功能。
"""

import os
import logging
from typing import Optional
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ...schemas.api import APIResponse
from ...schemas.config import SystemConfig
from ...core.subtitle_extractor import SubtitleExtractor, SubtitleFormat
from ...services.video_storage import VideoStorageService
from ..dependencies import (
    get_system_config,
    get_subtitle_extractor,
    get_video_storage,
)


# 配置日志
logger = logging.getLogger("subtranslate.api.subtitles")


# 创建路由器
router = APIRouter()


# 字幕提取请求模型
class SubtitleExtractRequest(BaseModel):
    """字幕提取请求模型"""

    video_id: str = Field(..., description="视频ID")
    track_index: Optional[int] = Field(
        None, description="字幕轨道索引，不提供则使用默认轨道"
    )
    output_format: str = Field(default="srt", description="输出格式")


# 字幕加载请求模型
class SubtitleLoadRequest(BaseModel):
    """字幕加载请求模型"""

    file_path: str = Field(..., description="字幕文件路径")
    language: Optional[str] = Field(None, description="字幕语言")
    video_id: Optional[str] = Field(None, description="关联视频ID")


# 字幕预览响应模型
class SubtitlePreviewResponse(APIResponse):
    """字幕预览响应模型"""

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "获取预览成功",
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
                    "language": "zh",
                    "format": "srt",
                    "duration_seconds": 600,
                },
            }
        }


# 字幕行模型
class SubtitleLine(BaseModel):
    """字幕行模型"""

    index: int
    start: str
    end: str
    text: str
    start_ms: int
    end_ms: int


# 字幕信息模型
class SubtitleInfo(BaseModel):
    """字幕信息模型"""

    id: str = Field(..., description="字幕ID")
    path: str = Field(..., description="字幕文件路径")
    format: str = Field(..., description="字幕格式")
    language: Optional[str] = Field(None, description="字幕语言")
    total_lines: int = Field(default=0, description="总行数")
    video_id: Optional[str] = Field(None, description="关联视频ID")


@router.post("/extract", response_model=APIResponse, tags=["字幕提取"])
async def extract_subtitle(
    request: SubtitleExtractRequest,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """从视频中提取字幕

    根据视频ID和轨道索引，从视频中提取字幕并转换为指定格式。

    Args:
        request: 提取请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        APIResponse: 操作响应，包含提取后的字幕ID
    """
    try:
        # 获取视频信息
        video_info = video_storage.get_video(request.video_id)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")

        # 提取字幕
        output_dir = Path(config.temp_dir) / "subtitles"
        output_dir.mkdir(parents=True, exist_ok=True)

        subtitle_path = await extractor.extract_embedded_subtitle(
            video_info,
            track_index=request.track_index,
            output_dir=output_dir,
            target_format=SubtitleFormat(request.output_format),
        )

        if not subtitle_path:
            raise HTTPException(status_code=400, detail="提取字幕失败")

        # 创建字幕ID
        subtitle_id = str(uuid4())

        # 返回成功响应
        return APIResponse(
            success=True,
            message="提取字幕成功",
            data={
                "subtitle_id": subtitle_id,
                "path": str(subtitle_path),
                "format": request.output_format,
            },
        )

    except Exception as e:
        logger.error(f"提取字幕失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"提取字幕失败: {str(e)}")


@router.post("/load", response_model=APIResponse, tags=["字幕提取"])
async def load_subtitle(
    request: SubtitleLoadRequest,
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
    video_storage: VideoStorageService = Depends(get_video_storage),
):
    """加载外部字幕文件

    加载指定路径的字幕文件，并分析其内容。

    Args:
        request: 加载请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务

    Returns:
        APIResponse: 操作响应，包含加载后的字幕ID
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="字幕文件不存在")

        # 获取文件信息
        file_path = Path(request.file_path)

        # 尝试加载字幕文件
        subtitle_format = await extractor.detect_subtitle_format(
            str(file_path)
        )
        if not subtitle_format:
            raise HTTPException(status_code=400, detail="不支持的字幕格式")

        # 创建字幕ID
        subtitle_id = str(uuid4())

        # 如果提供了视频ID，检查视频是否存在
        if request.video_id:
            video_info = video_storage.get_video(request.video_id)
            if not video_info:
                raise HTTPException(status_code=404, detail="关联的视频不存在")

        # 返回成功响应
        return APIResponse(
            success=True,
            message="字幕加载成功",
            data={
                "id": subtitle_id,
                "path": str(file_path),
                "format": subtitle_format,
                "language": request.language,
                "video_id": request.video_id,
            },
        )

    except Exception as e:
        logger.error(f"加载字幕失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"加载字幕失败: {str(e)}")


@router.get(
    "/{subtitle_id}/preview",
    response_model=SubtitlePreviewResponse,
    tags=["字幕提取"],
)
async def preview_subtitle(
    subtitle_id: str,
    start_line: int = Query(0, description="起始行号"),
    line_count: int = Query(20, description="预览行数"),
    config: SystemConfig = Depends(get_system_config),
    extractor: SubtitleExtractor = Depends(get_subtitle_extractor),
):
    """预览字幕内容

    获取字幕的预览内容，支持分页查看。

    Args:
        subtitle_id: 字幕ID
        start_line: 起始行号
        line_count: 预览行数
        config: 系统配置
        extractor: 字幕提取器

    Returns:
        SubtitlePreviewResponse: 字幕预览响应
    """
    try:
        # 这里需要根据字幕ID获取字幕信息
        # 由于未实现存储，返回未实现错误
        raise HTTPException(status_code=501, detail="功能未实现")

    except Exception as e:
        logger.error(f"预览字幕失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"预览字幕失败: {str(e)}")


@router.get("/{subtitle_id}", response_model=APIResponse, tags=["字幕提取"])
async def get_subtitle_info(
    subtitle_id: str, config: SystemConfig = Depends(get_system_config)
):
    """获取字幕信息

    通过字幕ID获取字幕的详细信息。

    Args:
        subtitle_id: 字幕ID
        config: 系统配置

    Returns:
        APIResponse: 字幕信息响应
    """
    # 这里需要从存储中获取字幕信息
    # 目前返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")
