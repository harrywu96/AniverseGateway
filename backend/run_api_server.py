"""启动API服务器的快捷脚本

此脚本是启动API服务器的快捷方式。
"""

import sys
from pathlib import Path

# 添加当前目录的父目录到Python路径，确保能正确导入backend模块
current_dir = Path(__file__).parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

# 现在导入run_server函数
from backend.main import run_server

if __name__ == "__main__":
    run_server()
