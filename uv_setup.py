#!/usr/bin/env python
"""UV 包管理工具

该脚本提供了使用 UV 包管理器安装和更新依赖项的工具函数。
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def ensure_uv_installed():
    """检查并安装 UV 包管理器"""
    try:
        subprocess.run(
            ["uv", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        print("✅ UV 已安装")
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        print("⚠️ UV 未安装，正在尝试安装...")
        try:
            if sys.platform == "win32":
                # Windows 安装方式
                subprocess.run(
                    ["pip", "install", "--user", "uv"],
                    check=True,
                )
            else:
                # Linux/macOS 安装方式
                subprocess.run(
                    ["curl", "-LsSf", "https://astral.sh/uv/install.sh"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )
            print("✅ UV 安装成功")
            return True
        except subprocess.SubprocessError:
            print("❌ 无法安装 UV，请手动安装: https://github.com/astral-sh/uv")
            return False


def setup_venv():
    """创建并激活虚拟环境"""
    print("📦 创建虚拟环境...")
    try:
        if not os.path.exists(".venv"):
            subprocess.run(
                ["uv", "venv"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
            print("✅ 虚拟环境创建成功")
        else:
            print("✅ 虚拟环境已存在")
        return True
    except subprocess.SubprocessError as e:
        print(f"❌ 创建虚拟环境失败: {e}")
        return False


def install_dependencies(dev=False):
    """安装依赖项

    Args:
        dev: 是否安装开发依赖
    """
    print("📦 安装依赖项...")
    try:
        if dev:
            subprocess.run(
                ["uv", "pip", "install", "-e", ".[dev]"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
        else:
            subprocess.run(
                ["uv", "pip", "install", "-e", "."],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
        print("✅ 依赖项安装成功")
        return True
    except subprocess.SubprocessError as e:
        print(f"❌ 安装依赖项失败: {e}")
        return False


def sync_dependencies():
    """使用 requirements.txt 同步依赖项"""
    print("📦 同步依赖项...")
    try:
        subprocess.run(
            ["uv", "pip", "sync", "requirements.txt"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        print("✅ 依赖项同步成功")
        return True
    except subprocess.SubprocessError as e:
        print(f"❌ 同步依赖项失败: {e}")
        return False


def clean_environment():
    """清理环境，移除虚拟环境和缓存"""
    print("🧹 清理环境...")
    try:
        if os.path.exists(".venv"):
            import shutil

            shutil.rmtree(".venv")
            print("✅ 虚拟环境已移除")
        else:
            print("✅ 没有找到虚拟环境，无需清理")

        if os.path.exists(".pytest_cache"):
            import shutil

            shutil.rmtree(".pytest_cache")
            print("✅ pytest 缓存已清理")

        if os.path.exists("__pycache__"):
            import shutil

            shutil.rmtree("__pycache__")
            print("✅ Python 缓存已清理")

        # 查找并清理所有 __pycache__ 目录
        for path in Path(".").rglob("__pycache__"):
            import shutil

            shutil.rmtree(path)
        print("✅ 所有 Python 缓存已清理")

        return True
    except Exception as e:
        print(f"❌ 清理环境失败: {e}")
        return False


def check_environment():
    """检查环境是否设置正确"""
    print("🔍 检查环境...")

    # 检查虚拟环境
    if not os.path.exists(".venv"):
        print("❌ 虚拟环境不存在")
        return False

    # 检查项目安装
    try:
        import subtranslate

        print(
            f"✅ SubTranslate 已安装 (版本: {getattr(subtranslate, '__version__', 'unknown')})"
        )
    except ImportError:
        print("❌ SubTranslate 未安装")
        return False

    # 检查必要的依赖项
    dependencies = ["pydantic", "httpx", "ffmpeg"]
    missing = []

    for dep in dependencies:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)

    if missing:
        print(f"❌ 缺少依赖项: {', '.join(missing)}")
        return False
    else:
        print("✅ 所有核心依赖项已安装")

    # 检查环境变量
    if not os.path.exists(".env"):
        print("⚠️ .env 文件不存在，建议从 .env.example 创建")
    else:
        print("✅ .env 文件存在")

    # 检查 OpenAI API 密钥
    if "OPENAI_API_KEY" in os.environ:
        print("✅ OPENAI_API_KEY 环境变量已设置")
    else:
        print("⚠️ OPENAI_API_KEY 环境变量未设置")

    print("✅ 环境检查完成")
    return True


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="UV 包管理工具")
    parser.add_argument(
        "action",
        choices=["setup", "install", "sync", "clean", "check"],
        help="要执行的操作",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="是否包含开发依赖",
    )

    args = parser.parse_args()

    if not ensure_uv_installed():
        return 1

    if args.action == "setup":
        if not setup_venv():
            return 1
        if not install_dependencies(args.dev):
            return 1
    elif args.action == "install":
        if not install_dependencies(args.dev):
            return 1
    elif args.action == "sync":
        if not sync_dependencies():
            return 1
    elif args.action == "clean":
        if not clean_environment():
            return 1
    elif args.action == "check":
        if not check_environment():
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
