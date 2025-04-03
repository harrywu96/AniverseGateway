"""SubTranslate API 服务器应用程序

本模块提供SubTranslate的FastAPI后端服务实现，包括各种API端点和WebSocket支持。
"""

import logging
import asyncio
import os
from typing import Callable, Dict, List, Optional, Any

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from ..schemas.config import SystemConfig
from ..schemas.api import APIResponse, ErrorResponse
from ..core.subtitle_translator import SubtitleTranslator
from ..core.subtitle_extractor import SubtitleExtractor
from .routers import (
    videos,
    subtitles,
    tasks,
    translate,
    config,
    templates,
    export,
)
from .dependencies import (
    get_system_config,
    get_subtitle_translator,
    get_subtitle_extractor,
)


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("subtranslate.api")


# 创建FastAPI应用
app = FastAPI(
    title="SubTranslate API",
    description="SubTranslate智能视频字幕翻译系统API",
    version="0.1.0",
)


# 配置CORS
def configure_cors(app: FastAPI, config: SystemConfig):
    """配置CORS中间件

    Args:
        app: FastAPI应用实例
        config: 系统配置
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.api.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# WebSocket连接管理器
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


# WebSocket端点
@app.websocket("/ws/tasks/{task_id}")
async def websocket_task_progress(
    websocket: WebSocket,
    task_id: str,
    config: SystemConfig = Depends(get_system_config),
):
    """任务进度WebSocket端点

    Args:
        websocket: WebSocket连接
        task_id: 任务ID
        config: 系统配置
    """
    await manager.connect(websocket, task_id)
    try:
        while True:
            # 保持连接，等待消息
            data = await websocket.receive_text()
            # 可以处理客户端发来的消息，如暂停/恢复命令
            await websocket.send_json({"status": "received", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)


# 异常处理
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理"""
    return ErrorResponse(
        success=False,
        message=str(exc.detail),
        error_code=f"HTTP_{exc.status_code}",
    ).model_dump()


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    """验证错误处理"""
    return ErrorResponse(
        success=False,
        message="请求参数验证失败",
        error_code="VALIDATION_ERROR",
        error_details={"errors": exc.errors()},
    ).model_dump()


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理"""
    logger.error(f"未处理的异常: {exc}", exc_info=True)
    return ErrorResponse(
        success=False,
        message=f"服务器内部错误: {str(exc)}",
        error_code="INTERNAL_ERROR",
    ).model_dump()


# 应用启动和关闭事件
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("SubTranslate API服务启动")

    # 获取配置
    config = get_system_config()

    # 配置CORS
    configure_cors(app, config)

    # 创建必要的目录
    os.makedirs(config.temp_dir, exist_ok=True)
    if config.output_dir:
        os.makedirs(config.output_dir, exist_ok=True)


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("SubTranslate API服务关闭")


# 加载路由
app.include_router(videos.router, prefix="/api/videos", tags=["视频管理"])
app.include_router(
    subtitles.router, prefix="/api/subtitles", tags=["字幕提取"]
)
app.include_router(tasks.router, prefix="/api/tasks", tags=["翻译任务"])
app.include_router(
    translate.router, prefix="/api/translate", tags=["实时翻译"]
)
app.include_router(config.router, prefix="/api/config", tags=["配置管理"])
app.include_router(
    templates.router, prefix="/api/templates", tags=["提示模板"]
)
app.include_router(export.router, prefix="/api/export", tags=["导出功能"])


# 首页和健康检查端点
@app.get("/", response_model=APIResponse, tags=["系统"])
async def root():
    """API根端点"""
    return APIResponse(
        success=True,
        message="SubTranslate API服务正在运行",
        data={"name": "SubTranslate API", "version": "0.1.0"},
    )


@app.get("/api/health", response_model=APIResponse, tags=["系统"])
async def health_check():
    """健康检查端点"""
    return APIResponse(
        success=True, message="服务健康", data={"status": "healthy"}
    )
