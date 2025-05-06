"""字幕导出API路由模块

提供字幕导出和保存功能。
"""

import os
import logging
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse
from backend.schemas.config import SystemConfig
from backend.services.subtitle_export import SubtitleExporter
from backend.api.dependencies import get_system_config


# 配置日志
logger = logging.getLogger("subtranslate.api.export")


# 创建路由器
router = APIRouter()


# 字幕导出请求模型
class SubtitleExportRequest(BaseModel):
    """字幕导出请求模型"""

    content: str = Field(..., description="翻译后的字幕内容")
    format: str = Field(default="srt", description="导出格式")
    output_path: Optional[str] = Field(None, description="输出路径")
    filename: Optional[str] = Field(None, description="文件名")
    original_subtitle_path: Optional[str] = Field(
        None, description="原字幕路径"
    )


# 导出格式信息
class ExportFormatInfo(BaseModel):
    """导出格式信息模型"""

    format: str = Field(..., description="格式代码")
    name: str = Field(..., description="格式名称")
    description: str = Field(..., description="格式描述")
    extension: str = Field(..., description="文件扩展名")
    supports_styling: bool = Field(default=False, description="是否支持样式")


@router.post("/subtitles", response_model=APIResponse, tags=["导出功能"])
async def export_subtitle(
    request: SubtitleExportRequest,
    config: SystemConfig = Depends(get_system_config),
):
    """导出字幕文件

    将翻译后的字幕内容导出为指定格式的文件。

    Args:
        request: 导出请求
        config: 系统配置

    Returns:
        APIResponse: 导出结果响应
    """
    try:
        # 确定输出目录
        output_dir = request.output_path or config.output_dir or "."
        os.makedirs(output_dir, exist_ok=True)

        # 确定文件名
        if request.filename:
            filename = request.filename
            if not filename.endswith(f".{request.format}"):
                filename = f"{filename}.{request.format}"
        else:
            # 基于原字幕生成文件名
            if request.original_subtitle_path:
                original_path = Path(request.original_subtitle_path)
                filename = f"{original_path.stem}_translated.{request.format}"
            else:
                filename = f"subtitle_exported.{request.format}"

        # 完整输出路径
        output_path = os.path.join(output_dir, filename)

        # 导出字幕
        result = SubtitleExporter.export_content(
            content=request.content,
            output_path=output_path,
            format=request.format,
        )

        if result:
            return APIResponse(
                success=True,
                message="字幕导出成功",
                data={"output_path": output_path},
            )
        else:
            return APIResponse(
                success=False, message="字幕导出失败", data=None
            )

    except Exception as e:
        logger.error(f"导出字幕失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"导出字幕失败: {str(e)}")


@router.get("/formats", response_model=APIResponse, tags=["导出功能"])
async def get_export_formats():
    """获取支持的导出格式

    获取系统支持的字幕导出格式列表。

    Returns:
        APIResponse: 格式列表响应
    """
    formats = [
        ExportFormatInfo(
            format="srt",
            name="SubRip",
            description="通用字幕格式，广泛支持",
            extension="srt",
            supports_styling=False,
        ),
        ExportFormatInfo(
            format="ass",
            name="Advanced SubStation Alpha",
            description="支持高级样式的字幕格式",
            extension="ass",
            supports_styling=True,
        ),
        ExportFormatInfo(
            format="vtt",
            name="WebVTT",
            description="Web视频字幕格式",
            extension="vtt",
            supports_styling=False,
        ),
    ]

    return APIResponse(
        success=True, message="获取导出格式列表成功", data=formats
    )
