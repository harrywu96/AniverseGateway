"""开发环境启动脚本

此脚本用于启动开发环境，包括前端和后端。
"""

import os
import sys
import subprocess
import platform
import time
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.absolute()


def setup_environment():
    """设置环境变量"""
    os.environ["NODE_ENV"] = "development"
    os.environ["API_PORT"] = "8000"
    os.environ["API_RELOAD"] = "true"
    
    # Windows系统设置控制台编码为UTF-8
    if platform.system() == "Windows":
        os.system("chcp 65001 > nul")


def start_backend():
    """启动后端服务"""
    print("正在启动后端服务...")
    
    # 构建后端启动命令
    backend_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "backend" / "main.py")
    ]
    
    # 启动后端进程
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=PROJECT_ROOT,
        env=os.environ.copy()
    )
    
    # 等待后端启动
    print("等待后端服务启动...")
    time.sleep(2)
    
    return backend_process


def start_frontend():
    """启动前端服务"""
    print("正在启动前端服务...")
    
    # 构建前端启动命令
    if platform.system() == "Windows":
        frontend_cmd = ["pnpm", "dev:win"]
    else:
        frontend_cmd = ["pnpm", "dev"]
    
    # 启动前端进程
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=PROJECT_ROOT,
        env=os.environ.copy()
    )
    
    return frontend_process


def main():
    """主函数"""
    print("启动开发环境...")
    
    # 设置环境变量
    setup_environment()
    
    # 启动后端
    backend_process = start_backend()
    
    # 启动前端
    frontend_process = start_frontend()
    
    try:
        # 等待进程结束
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\n接收到中断信号，正在关闭服务...")
    finally:
        # 关闭进程
        if frontend_process.poll() is None:
            frontend_process.terminate()
        
        if backend_process.poll() is None:
            backend_process.terminate()
        
        print("开发环境已关闭。")


if __name__ == "__main__":
    main()
