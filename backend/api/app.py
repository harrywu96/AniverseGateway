"""SubTranslate API 服务器应用程序

本模块提供SubTranslate的FastAPI后端服务实现，包括各种API端点和WebSocket支持。
"""

import logging
import os
import sys
from functools import lru_cache

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from fastapi.responses import JSONResponse

from backend.schemas.config import SystemConfig
from backend.schemas.api import APIResponse, ErrorResponse
from .websocket import manager  # 从新模块导入manager
from .dependencies import (
    get_system_config,
    verify_api_key,
)
from .routers import (
    subtitles,
    videos,
    translate,
    tasks,
    export,
    templates,
    config as config_router,
    providers,  # 添加新的providers路由
    speech_to_text,  # 添加speech_to_text路由
)


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("subtranslate.api")


@lru_cache()
def get_app() -> FastAPI:
    """创建FastAPI应用程序实例

    Returns:
        FastAPI: 应用程序实例
    """
    # 创建应用程序
    app = FastAPI(
        title="SubTranslate API",
        description="SubTranslate智能视频字幕翻译系统API",
        version="0.1.0",
    )

    # 获取系统配置
    config = get_system_config()

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.api.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册异常处理
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"未处理的异常: {exc}",
            exc_info=True,
            extra={"path": request.url.path},
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"服务器内部错误: {str(exc)}",
                "data": None,
            },
        )

    # 注册路由
    app.include_router(
        subtitles.router,
        prefix="/api/subtitles",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        videos.router,
        prefix="/api/videos",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        translate.router,
        prefix="/api/translate",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        tasks.router,
        prefix="/api/tasks",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        export.router,
        prefix="/api/export",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        templates.router,
        prefix="/api/templates",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(
        config_router.router,
        prefix="/api/config",
        dependencies=[Depends(verify_api_key)],
    )
    # 添加新的提供商路由
    app.include_router(
        providers.router,
        prefix="/api/providers",
        dependencies=[Depends(verify_api_key)],
    )
    app.include_router(speech_to_text.router)  # 注册speech_to_text路由

    return app


app = get_app()


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
    return JSONResponse(
        content=ErrorResponse(
            success=False,
            message=str(exc.detail),
            error_code=f"HTTP_{exc.status_code}",
        ).model_dump(),
        status_code=exc.status_code,
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    """验证错误处理"""
    return JSONResponse(
        content=ErrorResponse(
            success=False,
            message="请求参数验证失败",
            error_code="VALIDATION_ERROR",
            error_details={"errors": exc.errors()},
        ).model_dump(),
        status_code=422,
    )


# 应用启动和关闭事件
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("SubTranslate API服务启动")

    # 直接输出特定的启动完成消息，以便Electron能够捕获
    print("INFO:     Application startup complete.", flush=True)
    sys.stdout.flush()  # 确保输出被立即刷新

    # 获取配置
    config = get_system_config()

    # 创建必要的目录
    os.makedirs(config.temp_dir, exist_ok=True)
    if config.output_dir:
        os.makedirs(config.output_dir, exist_ok=True)

    # 初始化视频存储服务，确保只有一个实例
    from .dependencies import get_video_storage

    video_storage = get_video_storage(config)
    logger.info(
        f"应用启动时初始化VideoStorageService实例ID: {id(video_storage)}"
    )
    logger.info(f"初始视频存储中的视频数量: {len(video_storage.videos)}")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("SubTranslate API服务关闭")


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
        success=True,
        message="SubTranslate API服务健康状态正常",
        data={"status": "healthy"},
    )
