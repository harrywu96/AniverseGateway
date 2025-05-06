"""SubTranslate API 模块

提供FastAPI后端接口，与桌面应用集成。
"""

import os
import sys
import signal
import uvicorn
import logging

from typing import Optional

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
        "backend.api.app:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=reload,
    )
