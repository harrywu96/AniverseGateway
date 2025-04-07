"""翻译任务API路由模块

提供翻译任务的创建、管理和监控功能。
"""

import logging
import asyncio
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ...schemas.api import APIResponse, ProgressUpdateEvent
from ...schemas.task import SubtitleTask, TranslationConfig, TaskStatus
from ...schemas.config import SystemConfig
from ...core.subtitle_translator import SubtitleTranslator
from ..dependencies import get_system_config, get_subtitle_translator
from ..websocket import manager  # 从websocket模块导入manager


# 配置日志
logger = logging.getLogger("subtranslate.api.tasks")


# 创建路由器
router = APIRouter()


# 任务创建请求模型
class TaskCreateRequest(BaseModel):
    """任务创建请求模型"""

    subtitle_id: str = Field(..., description="字幕ID")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    config: Optional[TranslationConfig] = Field(None, description="翻译配置")


# 任务响应模型
class TaskResponse(APIResponse):
    """任务响应模型"""

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "获取任务成功",
                "data": {
                    "id": "task_123",
                    "status": "processing",
                    "progress": 45.5,
                    "source_language": "en",
                    "target_language": "zh",
                    "created_at": "2023-01-01T12:00:00",
                    "updated_at": "2023-01-01T12:05:00",
                },
            }
        }


# 任务列表响应模型
class TaskListResponse(APIResponse):
    """任务列表响应模型"""

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "获取任务列表成功",
                "data": [
                    {
                        "id": "task_123",
                        "status": "processing",
                        "progress": 45.5,
                        "source_language": "en",
                        "target_language": "zh",
                    }
                ],
            }
        }


async def progress_callback(
    task_id: str, progress: float, status: str, message: Optional[str] = None
):
    """任务进度回调函数，用于向WebSocket客户端推送进度更新

    Args:
        task_id: 任务ID
        progress: 进度百分比
        status: 任务状态
        message: 状态消息
    """
    # 创建进度更新事件
    event = ProgressUpdateEvent(
        task_id=task_id, progress=progress, status=status, message=message
    )

    # 广播给所有订阅此任务的客户端
    await manager.broadcast(task_id, event.model_dump())


async def run_translation_task(
    task: SubtitleTask, translator: SubtitleTranslator
):
    """执行翻译任务

    Args:
        task: 字幕翻译任务
        translator: 字幕翻译器
    """
    try:
        # 设置进度回调
        callback = lambda progress, status, message=None: progress_callback(
            task.id, progress, status, message
        )

        # 执行翻译
        success = await translator.translate_task(
            task, progress_callback=callback
        )

        if not success:
            logger.error(f"翻译任务 {task.id} 执行失败")
    except Exception as e:
        logger.error(f"翻译任务 {task.id} 异常: {e}", exc_info=True)
        # 更新任务状态为失败
        task.mark_failed(str(e))
        # 发送失败通知
        await progress_callback(
            task.id, task.progress, task.status, f"任务失败: {str(e)}"
        )


@router.post("", response_model=TaskResponse, tags=["翻译任务"])
async def create_task(
    request: TaskCreateRequest,
    background_tasks: BackgroundTasks,
    config: SystemConfig = Depends(get_system_config),
    translator: SubtitleTranslator = Depends(get_subtitle_translator),
):
    """创建翻译任务

    创建新的字幕翻译任务，开始异步处理。

    Args:
        request: 任务创建请求
        background_tasks: 后台任务
        config: 系统配置
        translator: 字幕翻译器

    Returns:
        TaskResponse: 任务响应，包含创建的任务信息
    """
    try:
        # 验证字幕ID
        # 由于未实现字幕存储，先返回未实现错误
        raise HTTPException(status_code=501, detail="功能未实现")

    except Exception as e:
        logger.error(f"创建任务失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("", response_model=TaskListResponse, tags=["翻译任务"])
async def list_tasks(
    status: Optional[TaskStatus] = None,
    config: SystemConfig = Depends(get_system_config),
):
    """获取任务列表

    获取所有翻译任务，可根据状态筛选。

    Args:
        status: 任务状态过滤
        config: 系统配置

    Returns:
        TaskListResponse: 任务列表响应
    """
    # 由于未实现任务存储，返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")


@router.get("/{task_id}", response_model=TaskResponse, tags=["翻译任务"])
async def get_task(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """获取任务详情

    通过任务ID获取翻译任务的详细信息。

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        TaskResponse: 任务响应
    """
    # 由于未实现任务存储，返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")


@router.delete("/{task_id}", response_model=APIResponse, tags=["翻译任务"])
async def cancel_task(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """取消任务

    取消正在进行的翻译任务。

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        APIResponse: 操作响应
    """
    # 由于未实现任务存储和取消机制，返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")


@router.put("/{task_id}/pause", response_model=APIResponse, tags=["翻译任务"])
async def pause_task(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """暂停任务

    暂停正在进行的翻译任务。

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        APIResponse: 操作响应
    """
    # 由于未实现任务暂停机制，返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")


@router.put("/{task_id}/resume", response_model=APIResponse, tags=["翻译任务"])
async def resume_task(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """恢复任务

    恢复已暂停的翻译任务。

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        APIResponse: 操作响应
    """
    # 由于未实现任务恢复机制，返回未实现错误
    raise HTTPException(status_code=501, detail="功能未实现")
