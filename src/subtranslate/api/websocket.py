"""WebSocket连接管理器模块

提供WebSocket连接管理功能，用于广播任务进度和状态更新。
"""

import logging
from typing import Dict, List

from fastapi import WebSocket


# 配置日志
logger = logging.getLogger("subtranslate.api.websocket")


class ConnectionManager:
    """WebSocket连接管理器，用于处理实时进度更新"""

    def __init__(self):
        # 每个任务ID对应一组客户端连接
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, task_id: str):
        """添加新连接

        Args:
            websocket: WebSocket连接
            task_id: 任务ID
        """
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = []
        self.active_connections[task_id].append(websocket)
        logger.info(
            f"新WebSocket连接: 任务{task_id}, 当前连接数: {len(self.active_connections[task_id])}"
        )

    def disconnect(self, websocket: WebSocket, task_id: str):
        """移除连接

        Args:
            websocket: WebSocket连接
            task_id: 任务ID
        """
        if task_id in self.active_connections:
            if websocket in self.active_connections[task_id]:
                self.active_connections[task_id].remove(websocket)
            # 如果任务没有活跃连接，则移除任务键
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
        logger.info(f"WebSocket连接关闭: 任务{task_id}")

    async def broadcast(self, task_id: str, message: dict):
        """向指定任务的所有连接广播消息

        Args:
            task_id: 任务ID
            message: 消息内容
        """
        if task_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[task_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"发送WebSocket消息失败: {e}")
                disconnected.append(connection)

        # 移除断开的连接
        for conn in disconnected:
            self.disconnect(conn, task_id)


# 初始化连接管理器
manager = ConnectionManager()
