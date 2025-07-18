"""测试翻译功能的路由模块

提供模拟翻译结果的接口，用于快速测试前端翻译预览功能
"""

import logging
import uuid
import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse
from backend.api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/test", tags=["测试翻译"])


class MockTranslationRequest(BaseModel):
    """模拟翻译请求模型"""

    video_id: str = Field(..., description="视频ID")
    track_index: int = Field(default=0, description="字幕轨道索引")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    subtitle_count: int = Field(default=10, description="模拟字幕条数")


class MockTranslationResponse(APIResponse):
    """模拟翻译响应模型"""

    pass


# 模拟翻译结果数据
MOCK_TRANSLATION_DATA = [
    {
        "original": "Hello, welcome to our presentation.",
        "translated": "你好，欢迎来到我们的演示。",
        "startTime": 1.5,
        "endTime": 4.2,
    },
    {
        "original": "Today we will discuss the latest developments in AI technology.",
        "translated": "今天我们将讨论人工智能技术的最新发展。",
        "startTime": 4.5,
        "endTime": 8.1,
    },
    {
        "original": "Machine learning has revolutionized many industries.",
        "translated": "机器学习已经彻底改变了许多行业。",
        "startTime": 8.5,
        "endTime": 12.3,
    },
    {
        "original": "Natural language processing enables computers to understand human language.",
        "translated": "自然语言处理使计算机能够理解人类语言。",
        "startTime": 12.8,
        "endTime": 17.2,
    },
    {
        "original": "Deep learning models can process vast amounts of data.",
        "translated": "深度学习模型可以处理大量数据。",
        "startTime": 17.5,
        "endTime": 21.1,
    },
    {
        "original": "Computer vision allows machines to interpret visual information.",
        "translated": "计算机视觉允许机器解释视觉信息。",
        "startTime": 21.4,
        "endTime": 25.6,
    },
    {
        "original": "Artificial intelligence is transforming healthcare, finance, and education.",
        "translated": "人工智能正在改变医疗保健、金融和教育领域。",
        "startTime": 26.0,
        "endTime": 30.8,
    },
    {
        "original": "The future of AI holds tremendous potential for innovation.",
        "translated": "人工智能的未来具有巨大的创新潜力。",
        "startTime": 31.2,
        "endTime": 35.5,
    },
    {
        "original": "Thank you for your attention and participation.",
        "translated": "感谢您的关注和参与。",
        "startTime": 36.0,
        "endTime": 39.2,
    },
    {
        "original": "We look forward to your questions and feedback.",
        "translated": "我们期待您的问题和反馈。",
        "startTime": 39.5,
        "endTime": 42.8,
    },
]


@router.post("/mock-translation", response_model=MockTranslationResponse)
async def start_mock_translation(request: MockTranslationRequest):
    """启动模拟翻译任务

    Args:
        request: 模拟翻译请求

    Returns:
        MockTranslationResponse: 包含任务ID的响应
    """
    try:
        # 生成任务ID
        task_id = str(uuid.uuid4())

        logger.info(f"启动模拟翻译任务: {task_id}")

        # 启动后台任务模拟翻译过程
        asyncio.create_task(simulate_translation_process(task_id, request))

        return MockTranslationResponse(
            success=True,
            message="模拟翻译任务已启动",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "subtitle_count": request.subtitle_count,
            },
        )

    except Exception as e:
        logger.error(f"启动模拟翻译任务失败: {e}")
        raise HTTPException(
            status_code=500, detail=f"启动模拟翻译任务失败: {str(e)}"
        )


async def simulate_translation_process(
    task_id: str, request: MockTranslationRequest
):
    """模拟翻译过程

    Args:
        task_id: 任务ID
        request: 翻译请求
    """
    try:
        # 模拟翻译进度
        total_steps = 5
        for step in range(total_steps):
            progress = (step + 1) / total_steps * 100

            # 发送进度更新
            progress_message = {
                "type": "progress",
                "percentage": progress,
                "current": step + 1,
                "total": total_steps,
                "currentItem": f"正在处理第 {step + 1} 个分块...",
                "estimatedTime": (total_steps - step - 1) * 2,  # 每步2秒
            }

            await manager.broadcast(task_id, progress_message)
            logger.info(f"模拟翻译进度: {progress}%")

            # 等待2秒模拟处理时间
            await asyncio.sleep(2)

        # 生成模拟翻译结果
        subtitle_count = min(
            request.subtitle_count, len(MOCK_TRANSLATION_DATA)
        )
        translation_results = []

        for i in range(subtitle_count):
            base_data = MOCK_TRANSLATION_DATA[i % len(MOCK_TRANSLATION_DATA)]
            start_time = base_data["startTime"] + i * 5
            end_time = base_data["endTime"] + i * 5

            # 生成稳定的ID
            time_key = f"{start_time}-{end_time}"
            content_hash = (
                base_data["original"][:20] if base_data["original"] else ""
            )
            stable_id = (
                f"subtitle-{time_key}-{content_hash}".replace(" ", "-")
                .replace(",", "")
                .replace(".", "")
            )

            result = {
                "id": stable_id,  # 添加稳定的ID
                "index": i + 1,
                "startTime": start_time,
                "endTime": end_time,
                "startTimeStr": format_time_to_srt(start_time),
                "endTimeStr": format_time_to_srt(end_time),
                "original": base_data["original"],
                "translated": base_data["translated"],
                "confidence": 0.85 + (i % 3) * 0.05,  # 模拟不同的可信度
            }
            translation_results.append(result)

        # 发送完成消息
        completion_message = {
            "type": "completed",
            "message": f"模拟翻译完成，共处理 {len(translation_results)} 条字幕",
            "results": translation_results,
        }

        await manager.broadcast(task_id, completion_message)
        logger.info(
            f"模拟翻译完成: {task_id}, 结果数量: {len(translation_results)}"
        )

    except Exception as e:
        logger.error(f"模拟翻译过程失败: {e}")
        # 发送错误消息
        error_message = {"type": "error", "message": f"模拟翻译失败: {str(e)}"}
        await manager.broadcast(task_id, error_message)


def format_time_to_srt(seconds: float) -> str:
    """将秒数转换为SRT时间格式

    Args:
        seconds: 秒数

    Returns:
        str: SRT时间格式字符串 (HH:MM:SS,mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


@router.websocket("/ws/{task_id}")
async def websocket_mock_translation_progress(
    websocket: WebSocket, task_id: str
):
    """WebSocket端点，用于实时推送模拟翻译进度

    Args:
        websocket: WebSocket连接
        task_id: 任务ID
    """
    await manager.connect(websocket, task_id)
    try:
        while True:
            # 保持连接活跃，等待客户端消息
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"模拟翻译WebSocket连接断开: {task_id}, 原因: {e}")
    finally:
        manager.disconnect(websocket, task_id)


@router.get("/sample-results")
async def get_sample_translation_results():
    """获取示例翻译结果，用于前端开发测试

    Returns:
        Dict: 包含示例翻译结果的响应
    """
    try:
        # 生成示例结果
        sample_results = []
        for i, data in enumerate(MOCK_TRANSLATION_DATA):
            # 生成稳定的ID
            time_key = f"{data['startTime']}-{data['endTime']}"
            content_hash = data["original"][:20] if data["original"] else ""
            stable_id = (
                f"subtitle-{time_key}-{content_hash}".replace(" ", "-")
                .replace(",", "")
                .replace(".", "")
            )

            result = {
                "id": stable_id,  # 添加稳定的ID
                "index": i + 1,
                "startTime": data["startTime"],
                "endTime": data["endTime"],
                "startTimeStr": format_time_to_srt(data["startTime"]),
                "endTimeStr": format_time_to_srt(data["endTime"]),
                "original": data["original"],
                "translated": data["translated"],
                "confidence": 0.85 + (i % 3) * 0.05,
            }
            sample_results.append(result)

        return {
            "success": True,
            "message": "示例翻译结果",
            "data": {
                "results": sample_results,
                "total_count": len(sample_results),
            },
        }

    except Exception as e:
        logger.error(f"获取示例翻译结果失败: {e}")
        raise HTTPException(
            status_code=500, detail=f"获取示例结果失败: {str(e)}"
        )
