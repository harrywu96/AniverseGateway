"""打包脚本

此脚本用于打包应用程序，生成可分发的安装包。
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
ELECTRON_APP_ROOT = FRONTEND_ROOT / "electron-app"


def setup_environment():
    """设置环境变量"""
    os.environ["NODE_ENV"] = "production"
    
    # Windows系统设置控制台编码为UTF-8
    if platform.system() == "Windows":
        os.system("chcp 65001 > nul")


def build_project():
    """构建项目"""
    print("正在构建项目...")
    
    # 调用构建脚本
    build_script = PROJECT_ROOT / "scripts" / "build.py"
    
    result = subprocess.run(
        [sys.executable, str(build_script)],
        cwd=PROJECT_ROOT,
        env=os.environ.copy(),
        check=True
    )
    
    if result.returncode != 0:
        print("项目构建失败！")
        sys.exit(1)
    
    print("项目构建成功！")


def package_app():
    """打包应用程序"""
    print("正在打包应用程序...")
    
    # 构建打包命令
    if platform.system() == "Windows":
        package_cmd = ["pnpm", "exec", "electron-builder", "--win"]
    elif platform.system() == "Darwin":
        package_cmd = ["pnpm", "exec", "electron-builder", "--mac"]
    else:
        package_cmd = ["pnpm", "exec", "electron-builder", "--linux"]
    
    # 执行打包命令
    result = subprocess.run(
        package_cmd,
        cwd=ELECTRON_APP_ROOT,
        env=os.environ.copy(),
        check=True
    )
    
    if result.returncode != 0:
        print("应用程序打包失败！")
        sys.exit(1)
    
    print("应用程序打包成功！")


def main():
    """主函数"""
    print("开始打包应用程序...")
    
    # 设置环境变量
    setup_environment()
    
    # 构建项目
    build_project()
    
    # 打包应用程序
    package_app()
    
    print("应用程序打包完成！")


if __name__ == "__main__":
    main()
