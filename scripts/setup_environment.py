#!/usr/bin/env python3
"""
环境设置脚本 - 用于创建虚拟环境并安装所有依赖
这个脚本会使用UV处理所有依赖，包括直接从GitHub安装火山引擎SDK
"""

import os
import sys
import subprocess
import argparse
import platform
import shutil
from pathlib import Path


def run_command(cmd, cwd=None, env=None, check=True, capture_output=False):
    """运行shell命令并处理错误"""
    print(f"执行: {' '.join(cmd)}")
    result = subprocess.run(
        cmd, cwd=cwd, env=env, check=check, capture_output=capture_output
    )
    return result


def is_uv_installed():
    """检查UV是否已经安装"""
    try:
        subprocess.run(["uv", "--version"], check=True, capture_output=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def install_uv():
    """安装UV包管理器"""
    print("安装UV包管理器...")

    system = platform.system().lower()
    if system == "windows":
        install_cmd = (
            'powershell -Command "(Invoke-WebRequest -Uri '
            "https://github.com/astral-sh/uv/releases/download/0.1.24/uv-x86_64-pc-windows-msvc.exe "
            '-OutFile uv.exe)" && move uv.exe %USERPROFILE%\\.cargo\\bin\\uv.exe'
        )
        subprocess.run(install_cmd, shell=True, check=True)
    elif system == "darwin":  # macOS
        install_cmd = [
            "curl",
            "-LsSf",
            "https://astral.sh/uv/install.sh",
            "|",
            "sh",
        ]
        subprocess.run(" ".join(install_cmd), shell=True, check=True)
    elif system == "linux":
        install_cmd = [
            "curl",
            "-LsSf",
            "https://astral.sh/uv/install.sh",
            "|",
            "sh",
        ]
        subprocess.run(" ".join(install_cmd), shell=True, check=True)
    else:
        print(f"不支持的操作系统: {system}")
        sys.exit(1)

    print("UV安装完成！")


def create_venv(venv_path):
    """创建虚拟环境"""
    print(f"创建虚拟环境: {venv_path}")
    run_command(["uv", "venv", venv_path])


def install_dependencies(venv_path, dev=False):
    """安装项目依赖"""
    print("正在安装项目依赖...")

    # 安装项目依赖
    if dev:
        run_command(["uv", "pip", "install", "-e", ".[dev]"])
    else:
        run_command(["uv", "pip", "install", "-e", "."])

    # 安装火山引擎依赖
    print("正在安装火山引擎核心SDK...")
    run_command(["uv", "pip", "install", "volc-sdk-python"])

    # 下载并安装火山引擎ML平台SDK
    ml_sdk_url = (
        "https://ml-platform-public-examples-cn-beijing.tos-cn-beijing.volces.com/"
        "python_sdk_installer/volcengine_ml_platform-1.1.0b2-py3-none-any.whl"
    )
    ml_sdk_file = "volcengine_ml_platform-1.1.0b2-py3-none-any.whl"

    print(f"正在下载火山引擎ML平台SDK: {ml_sdk_url}")
    run_command(["curl", "-L", "-o", ml_sdk_file, ml_sdk_url])

    print("正在安装火山引擎ML平台SDK...")
    run_command(["uv", "pip", "install", ml_sdk_file])

    # 清理下载的文件
    os.remove(ml_sdk_file)


def main():
    parser = argparse.ArgumentParser(description="设置项目环境并安装所有依赖")
    parser.add_argument(
        "--venv", default=".venv", help="虚拟环境目录路径 (默认: .venv)"
    )
    parser.add_argument("--dev", action="store_true", help="安装开发依赖")
    parser.add_argument(
        "--force", action="store_true", help="强制重新创建虚拟环境"
    )

    args = parser.parse_args()

    # 检查UV是否安装
    if not is_uv_installed():
        install_uv()

    # 处理虚拟环境
    venv_path = Path(args.venv).absolute()
    if venv_path.exists() and args.force:
        print(f"删除现有虚拟环境: {venv_path}")
        shutil.rmtree(venv_path)

    if not venv_path.exists():
        create_venv(venv_path)

    # 安装依赖
    install_dependencies(venv_path, args.dev)

    print("\n环境设置完成！")
    if platform.system().lower() == "windows":
        print(f"激活虚拟环境: {venv_path}\\Scripts\\activate")
    else:
        print(f"激活虚拟环境: source {venv_path}/bin/activate")


if __name__ == "__main__":
    main()
