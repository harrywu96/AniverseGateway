#!/usr/bin/env python
"""
SubTranslate 项目 UV 依赖管理脚本

此脚本提供了常用的 UV 命令封装，以简化依赖管理操作。
使用方法：
    python uv_setup.py [命令]

可用命令:
    setup       - 创建虚拟环境并安装所有依赖
    update      - 更新所有依赖
    add [包名]  - 添加新的依赖包
    dev [包名]  - 添加开发依赖包
    freeze      - 更新 requirements.txt
    clean       - 清理虚拟环境并重新安装
    check       - 检查环境和依赖状态
"""

import os
import sys
import subprocess
import platform
from pathlib import Path


# 确定 UV 命令，优先使用系统中安装的版本
UV_CMD = "uv"
if platform.system() == "Windows":
    ACTIVATE_CMD = str(Path(".venv/Scripts/activate"))
else:
    ACTIVATE_CMD = ". .venv/bin/activate"

# 项目根目录
PROJECT_ROOT = Path(__file__).parent


def run_command(cmd, shell=True):
    """运行系统命令并打印输出"""
    print(f"\033[1;34m执行命令: {cmd}\033[0m")
    result = subprocess.run(cmd, shell=shell, text=True, capture_output=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(f"\033[1;31m{result.stderr}\033[0m")
    return result.returncode


def check_uv():
    """检查 UV 是否已安装"""
    try:
        result = subprocess.run([UV_CMD, "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"\033[1;32mUV 已安装: {result.stdout.strip()}\033[0m")
            return True
    except FileNotFoundError:
        pass

    print("\033[1;31mUV 未安装，请按照以下指南安装：\033[0m")
    print(
        "\033[1;33m- Windows: curl.exe -sSf https://astral.sh/uv/install.ps1"
        " | powershell\033[0m"
    )
    print(
        "\033[1;33m- macOS/Linux: curl -sSf https://astral.sh/uv/install.sh"
        " | sh\033[0m"
    )
    print("\033[1;33m安装后，请重新运行此脚本。\033[0m")
    return False


def setup_env():
    """创建虚拟环境并安装所有依赖"""
    print("\033[1;32m===== 设置 SubTranslate 开发环境 =====\033[0m")

    # 创建虚拟环境
    if not Path(".venv").exists():
        print("创建虚拟环境...")
        run_command(f"{UV_CMD} venv")
    else:
        print("虚拟环境已存在。")

    # 安装依赖
    print("安装项目依赖...")
    if platform.system() == "Windows":
        run_command(f".venv\\Scripts\\activate && {UV_CMD} pip sync requirements.txt")
    else:
        run_command(f"source .venv/bin/activate && {UV_CMD} pip sync requirements.txt")

    print("\033[1;32m===== 环境设置完成 =====\033[0m")
    print("要激活环境，请运行:")
    if platform.system() == "Windows":
        print("  .venv\\Scripts\\activate")
    else:
        print("  source .venv/bin/activate")


def update_deps():
    """更新所有依赖"""
    print("\033[1;32m===== 更新 SubTranslate 依赖 =====\033[0m")
    if platform.system() == "Windows":
        run_command(
            f".venv\\Scripts\\activate && {UV_CMD} pip sync requirements.txt --upgrade"
        )
    else:
        run_command(
            f"source .venv/bin/activate && {UV_CMD} pip sync requirements.txt --upgrade"
        )

    # 更新 requirements.txt
    freeze_deps()


def add_package(package_name, dev=False):
    """添加新的依赖包"""
    if not package_name:
        print("\033[1;31m错误: 请指定要添加的包名\033[0m")
        return

    dev_flag = "--dev" if dev else ""
    print(
        f"\033[1;32m===== 添加{'开发' if dev else ''}依赖: "
        f"{package_name} =====\033[0m"
    )

    if platform.system() == "Windows":
        run_command(
            f".venv\\Scripts\\activate && {UV_CMD} pip add {dev_flag} {package_name}"
        )
    else:
        run_command(
            f"source .venv/bin/activate && {UV_CMD} pip add {dev_flag} {package_name}"
        )

    # 更新 requirements.txt
    freeze_deps()


def freeze_deps():
    """更新 requirements.txt"""
    print("\033[1;32m===== 更新 requirements.txt =====\033[0m")

    if platform.system() == "Windows":
        # 运行时依赖
        run_command(
            f".venv\\Scripts\\activate && {UV_CMD} pip freeze --exclude-extras > "
            f"requirements.tmp"
        )
        # 开发依赖
        run_command(
            f".venv\\Scripts\\activate && {UV_CMD} pip freeze --only-extras=dev >> "
            f"requirements.tmp"
        )
    else:
        # 运行时依赖
        run_command(
            f"source .venv/bin/activate && {UV_CMD} pip freeze --exclude-extras > "
            f"requirements.tmp"
        )
        # 开发依赖
        run_command(
            f"source .venv/bin/activate && {UV_CMD} pip freeze --only-extras=dev >> "
            f"requirements.tmp"
        )

    # 添加注释
    with open("requirements.tmp", "r") as f:
        content = f.read()

    # 添加分隔和注释
    with open("requirements.txt", "w") as f:
        f.write("# 运行时依赖\n")
        runtime_deps = []
        dev_deps = []

        for line in content.splitlines():
            if "extra == 'dev'" in line:
                dev_deps.append(line)
            else:
                runtime_deps.append(line)

        f.write("\n".join(runtime_deps))
        f.write("\n\n# 开发依赖\n")
        f.write("\n".join(dev_deps))

    # 删除临时文件
    os.remove("requirements.tmp")
    print("\033[1;32mrequirements.txt 已更新\033[0m")


def clean_env():
    """清理虚拟环境并重新安装"""
    print("\033[1;32m===== 清理 SubTranslate 环境 =====\033[0m")

    if Path(".venv").exists():
        print("删除旧虚拟环境...")
        if platform.system() == "Windows":
            run_command("rmdir /s /q .venv")
        else:
            run_command("rm -rf .venv")

    # 重新设置环境
    setup_env()


def check_status():
    """检查环境和依赖状态"""
    print("\033[1;32m===== 检查 SubTranslate 环境状态 =====\033[0m")

    # 检查虚拟环境
    if not Path(".venv").exists():
        print("\033[1;31m虚拟环境未创建\033[0m")
    else:
        print("\033[1;32m虚拟环境已创建\033[0m")

    # 检查已安装的包
    print("\n已安装的依赖:")
    if platform.system() == "Windows":
        run_command(f".venv\\Scripts\\activate && {UV_CMD} pip list")
    else:
        run_command(f"source .venv/bin/activate && {UV_CMD} pip list")

    # 检查过时的依赖
    print("\n过时的依赖:")
    if platform.system() == "Windows":
        run_command(f".venv\\Scripts\\activate && {UV_CMD} pip list --outdated")
    else:
        run_command(f"source .venv/bin/activate && {UV_CMD} pip list --outdated")


def main():
    """主函数"""
    if not check_uv():
        return

    # 解析命令行参数
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1].lower()

    if command == "setup":
        setup_env()
    elif command == "update":
        update_deps()
    elif command == "add" and len(sys.argv) > 2:
        add_package(sys.argv[2])
    elif command == "dev" and len(sys.argv) > 2:
        add_package(sys.argv[2], dev=True)
    elif command == "freeze":
        freeze_deps()
    elif command == "clean":
        clean_env()
    elif command == "check":
        check_status()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
