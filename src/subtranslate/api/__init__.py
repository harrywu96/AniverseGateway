"""SubTranslate API 模块

提供FastAPI后端接口，与桌面应用集成。
"""

import os
import sys
import signal
import uvicorn
import logging

from typing import Optional
from .app import app
from .routers import (
    translate,
    video,
    settings,
    speech_to_text,
)


def start_api_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    log_level: str = "info",
    reload: bool = False,
):
    """启动API服务器

    Args:
        host: 监听主机，默认为127.0.0.1
        port: 监听端口，默认为8000
        log_level: 日志级别，默认为info
        reload: 是否启用热重载，开发时使用
    """
    uvicorn.run(
        "subtranslate.api.app:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=reload,
    )


def start_api_server_background(
    host: str = "127.0.0.1", port: int = 8000, log_level: str = "info"
) -> Optional[int]:
    """在后台启动API服务器（仅Unix系统）

    使用fork创建子进程运行服务器。

    Args:
        host: 监听主机，默认为127.0.0.1
        port: 监听端口，默认为8000
        log_level: 日志级别，默认为info

    Returns:
        Optional[int]: 子进程ID，如果平台不支持则返回None
    """
    # Windows平台不支持fork
    if sys.platform == "win32":
        logging.warning("Windows平台不支持后台运行，使用普通模式启动")
        start_api_server(host, port, log_level)
        return None

    # Unix平台使用fork
    pid = os.fork()
    if pid == 0:
        # 子进程运行服务器
        start_api_server(host, port, log_level)
        sys.exit(0)
    else:
        # 父进程返回子进程ID
        return pid


def shutdown_api_server(pid: int) -> bool:
    """关闭API服务器（仅Unix系统）

    向指定的进程发送SIGTERM信号。

    Args:
        pid: API服务器进程ID

    Returns:
        bool: 是否成功发送信号
    """
    if sys.platform == "win32":
        logging.warning("Windows平台不支持此方法关闭服务器")
        return False

    try:
        os.kill(pid, signal.SIGTERM)
        return True
    except OSError as e:
        logging.error(f"关闭API服务器失败: {e}")
        return False


# 确保在router_modules列表中包含speech_to_text模块
router_modules = [
    translate,
    video,
    settings,
    speech_to_text,
]
