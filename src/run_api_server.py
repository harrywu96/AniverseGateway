"""启动API服务器

启动FastAPI应用程序服务器，提供API服务。
"""

import os
import sys
import uvicorn
import logging
from pathlib import Path
import locale

# 设置系统和Python的默认编码为UTF-8
os.environ["PYTHONIOENCODING"] = "utf-8"

# Windows系统检查并设置控制台编码
if sys.platform == "win32":
    try:
        # 尝试设置控制台代码页为UTF-8
        os.system("chcp 65001 > nul")
    except Exception:
        pass

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 初始化日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api_server.log", encoding="utf-8"),
    ],
)

logger = logging.getLogger("api_server")


def run_server():
    """启动API服务器"""
    # 记录编码信息
    logger.info(f"系统默认编码: {sys.getdefaultencoding()}")
    logger.info(f"文件系统编码: {sys.getfilesystemencoding()}")
    locale_encoding = locale.getpreferredencoding()
    logger.info(f"区域设置: {locale_encoding}")

    # 获取配置参数
    host = os.environ.get("API_HOST", "0.0.0.0")
    port = int(os.environ.get("API_PORT", "8000"))
    reload = os.environ.get("API_RELOAD", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    workers = int(os.environ.get("API_WORKERS", "4"))

    # 记录启动信息
    msg = (
        f"启动API服务器: host={host}, port={port}, "
        f"reload={reload}, workers={workers}"
    )
    logger.info(msg)

    # 启动服务器
    uvicorn.run(
        "subtranslate.api.app:app",
        host=host,
        port=port,
        reload=reload,
        workers=workers,
    )


if __name__ == "__main__":
    run_server()
