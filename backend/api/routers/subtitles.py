"""字幕提取API路由模块

提供字幕提取、加载和预览功能。
"""

import os
import logging
import re
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse
from backend.schemas.config import SystemConfig
from backend.schemas.subtitle import SubtitleLine, SubtitlePreview
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
        json_schema_extra = {
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


# 字幕完整内容响应模型
class SubtitleFullContentResponse(APIResponse):
    """字幕完整内容响应模型"""

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "获取字幕完整内容成功",
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
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """从视频中提取字幕

    根据视频ID和轨道索引，从视频中提取字幕并转换为指定格式。

    Args:
        request: 提取请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务
        subtitle_storage: 字幕存储服务

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

        # 读取字幕内容
        with open(subtitle_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 保存到字幕存储服务
        subtitle_info = subtitle_storage.save_subtitle(
            content=content,
            format=request.output_format,
            video_id=request.video_id,
        )

        # 返回成功响应
        return APIResponse(
            success=True,
            message="提取字幕成功",
            data={
                "subtitle_id": subtitle_info.id,
                "path": subtitle_info.path,
                "format": subtitle_info.format,
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
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """加载外部字幕文件

    加载指定路径的字幕文件，并分析其内容。

    Args:
        request: 加载请求
        config: 系统配置
        extractor: 字幕提取器
        video_storage: 视频存储服务
        subtitle_storage: 字幕存储服务

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

        # 读取字幕内容
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 保存到字幕存储服务
        subtitle_info = subtitle_storage.save_subtitle(
            content=content,
            format=subtitle_format,
            video_id=request.video_id,
        )

        # 如果提供了语言信息，更新字幕信息
        if request.language:
            subtitle_storage.update_subtitle(
                subtitle_info.id, language=request.language
            )

        # 返回成功响应
        return APIResponse(
            success=True,
            message="字幕加载成功",
            data={
                "id": subtitle_info.id,
                "path": subtitle_info.path,
                "format": subtitle_info.format,
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
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """预览字幕内容

    获取字幕的预览内容，支持分页查看。

    Args:
        subtitle_id: 字幕ID
        start_line: 起始行号
        line_count: 预览行数
        config: 系统配置
        extractor: 字幕提取器
        subtitle_storage: 字幕存储服务

    Returns:
        SubtitlePreviewResponse: 字幕预览响应
    """
    try:
        # 获取字幕信息
        subtitle_info = subtitle_storage.get_subtitle(subtitle_id)
        if not subtitle_info:
            raise HTTPException(status_code=404, detail="字幕不存在")

        # 检查文件是否存在
        if not os.path.exists(subtitle_info.path):
            raise HTTPException(status_code=404, detail="字幕文件不存在")

        # 读取字幕文件
        with open(subtitle_info.path, "r", encoding="utf-8") as f:
            content = f.read()

        # 解析字幕内容
        lines = _parse_subtitle_lines(content, subtitle_info.format)

        # 计算总行数和总时长
        total_lines = len(lines)
        duration_seconds = 0
        if lines:
            last_line = lines[-1]
            duration_seconds = last_line.end_ms / 1000.0

        # 分页处理
        end_line = min(start_line + line_count, total_lines)
        preview_lines = (
            lines[start_line:end_line] if start_line < total_lines else []
        )

        # 构建预览响应
        preview = SubtitlePreview(
            lines=preview_lines,
            total_lines=total_lines,
            language=subtitle_info.language,
            format=subtitle_info.format,
            duration_seconds=duration_seconds,
        )

        return SubtitlePreviewResponse(
            success=True,
            message="获取预览成功",
            data=preview,
        )

    except Exception as e:
        logger.error(f"预览字幕失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"预览字幕失败: {str(e)}")


@router.get(
    "/{subtitle_id}/content",
    response_model=SubtitleFullContentResponse,
    tags=["字幕提取"],
)
async def get_subtitle_content(
    subtitle_id: str,
    config: SystemConfig = Depends(get_system_config),
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """获取字幕完整内容

    获取字幕的完整内容，用于前端显示。

    Args:
        subtitle_id: 字幕ID
        config: 系统配置
        subtitle_storage: 字幕存储服务

    Returns:
        SubtitleFullContentResponse: 字幕完整内容响应
    """
    try:
        # 获取字幕信息
        subtitle_info = subtitle_storage.get_subtitle(subtitle_id)
        if not subtitle_info:
            raise HTTPException(status_code=404, detail="字幕不存在")

        # 检查文件是否存在
        if not os.path.exists(subtitle_info.path):
            raise HTTPException(status_code=404, detail="字幕文件不存在")

        # 读取字幕文件
        with open(subtitle_info.path, "r", encoding="utf-8") as f:
            content = f.read()

        # 解析字幕内容
        lines = _parse_subtitle_lines(content, subtitle_info.format)

        # 计算总行数和总时长
        total_lines = len(lines)
        duration_seconds = 0
        if lines:
            last_line = lines[-1]
            duration_seconds = last_line.end_ms / 1000.0

        # 构建完整内容响应
        full_content = SubtitlePreview(
            lines=lines,
            total_lines=total_lines,
            language=subtitle_info.language,
            format=subtitle_info.format,
            duration_seconds=duration_seconds,
        )

        return SubtitleFullContentResponse(
            success=True,
            message="获取字幕完整内容成功",
            data=full_content,
        )

    except Exception as e:
        logger.error(f"获取字幕完整内容失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"获取字幕完整内容失败: {str(e)}"
        )


@router.get("/{subtitle_id}", response_model=APIResponse, tags=["字幕提取"])
async def get_subtitle_info(
    subtitle_id: str,
    config: SystemConfig = Depends(get_system_config),
    subtitle_storage: SubtitleStorageService = Depends(get_subtitle_storage),
):
    """获取字幕信息

    通过字幕ID获取字幕的详细信息。

    Args:
        subtitle_id: 字幕ID
        config: 系统配置
        subtitle_storage: 字幕存储服务

    Returns:
        APIResponse: 字幕信息响应
    """
    try:
        # 获取字幕信息
        subtitle_info = subtitle_storage.get_subtitle(subtitle_id)
        if not subtitle_info:
            raise HTTPException(status_code=404, detail="字幕不存在")

        return APIResponse(
            success=True,
            message="获取字幕信息成功",
            data=subtitle_info,
        )

    except Exception as e:
        logger.error(f"获取字幕信息失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"获取字幕信息失败: {str(e)}"
        )


def _parse_subtitle_lines(content: str, format: str) -> List[SubtitleLine]:
    """解析字幕内容为字幕行列表

    Args:
        content: 字幕内容
        format: 字幕格式

    Returns:
        List[SubtitleLine]: 字幕行列表
    """
    lines = []

    # 目前只支持SRT格式的解析
    if format.lower() == "srt":
        # 分割字幕块
        blocks = re.split(r"\n\s*\n", content.strip())

        for block in blocks:
            lines_in_block = block.strip().split("\n")
            if len(lines_in_block) < 3:
                continue

            # 解析索引
            try:
                index = int(lines_in_block[0])
            except ValueError:
                continue

            # 解析时间轴
            time_line = lines_in_block[1]
            time_match = re.match(
                r"(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)", time_line
            )
            if not time_match:
                continue

            start_time = time_match.group(1)
            end_time = time_match.group(2)

            # 转换时间为毫秒
            start_ms = _time_to_ms(start_time)
            end_ms = _time_to_ms(end_time)

            # 获取字幕文本
            text = "\n".join(lines_in_block[2:])

            # 创建字幕行对象
            line = SubtitleLine(
                index=index,
                start=start_time,
                end=end_time,
                text=text,
                start_ms=start_ms,
                end_ms=end_ms,
            )

            lines.append(line)

    return lines


def _time_to_ms(time_str: str) -> int:
    """将时间字符串转换为毫秒

    Args:
        time_str: 时间字符串，格式为 HH:MM:SS,mmm

    Returns:
        int: 毫秒数
    """
    # 替换逗号为点，以便使用浮点数解析
    time_str = time_str.replace(",", ".")

    # 分割时间部分
    hours, minutes, seconds = time_str.split(":")

    # 计算总毫秒数
    total_ms = int(
        float(hours) * 3600000 + float(minutes) * 60000 + float(seconds) * 1000
    )

    return total_ms
