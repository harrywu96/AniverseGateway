#!/usr/bin/env python
"""
重置虚拟环境脚本

这个脚本会删除现有的 .venv 目录并使用 UV 创建一个新的虚拟环境。
"""

import os
import shutil
import subprocess
import sys
import time
from datetime import datetime


def reset_venv():
    """删除并重新创建虚拟环境"""
    print("🧹 正在清理现有虚拟环境...")

    # 尝试关闭所有可能使用 .venv 中文件的进程
    try:
        if sys.platform == "win32":
            # 尝试强制关闭所有可能使用虚拟环境的进程
            subprocess.run(
                ["taskkill", "/F", "/IM", "python.exe", "/T"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(1)  # 给系统时间关闭进程
    except Exception:
        pass  # 忽略错误

    # 删除 .venv 目录
    venv_path = os.path.join(os.getcwd(), ".venv")
    delete_success = False

    if os.path.exists(venv_path):
        try:
            # 使用 shutil 递归删除目录
            shutil.rmtree(venv_path, ignore_errors=True)
            time.sleep(1)  # 等待文件系统完成删除操作

            # 如果目录仍存在，尝试逐个删除文件
            if os.path.exists(venv_path):
                print("⚠️ 无法一次性删除目录，尝试逐个删除文件...")

                # 在 Windows 上，某些文件可能被锁定，跳过它们
                for root, dirs, files in os.walk(venv_path, topdown=False):
                    for file in files:
                        try:
                            file_path = os.path.join(root, file)
                            os.chmod(file_path, 0o777)  # 尝试更改权限
                            os.remove(file_path)
                        except Exception as e:
                            print(f"⚠️ 无法删除文件 {file_path}: {e}")

                    for dir in dirs:
                        try:
                            dir_path = os.path.join(root, dir)
                            os.rmdir(dir_path)
                        except Exception as e:
                            print(f"⚠️ 无法删除目录 {dir_path}: {e}")

                # 最后尝试删除主目录
                try:
                    os.rmdir(venv_path)
                    delete_success = True
                except Exception as e:
                    print(f"⚠️ 无法删除主目录 {venv_path}: {e}")
                    delete_success = False
            else:
                delete_success = True

            if delete_success:
                print("✅ 旧虚拟环境已删除")

        except Exception as e:
            print(f"⚠️ 清理虚拟环境时出错: {e}")
            delete_success = False

        # 如果删除失败，尝试重命名
        if not delete_success and os.path.exists(venv_path):
            try:
                print("⚠️ 尝试通过重命名方式移除旧虚拟环境...")
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                backup_path = f"{venv_path}_old_{timestamp}"
                os.rename(venv_path, backup_path)
                print(
                    f"✅ 旧虚拟环境已重命名为 {os.path.basename(backup_path)}"
                )
                delete_success = True
            except Exception as e:
                print(f"❌ 重命名虚拟环境失败: {e}")
                print(
                    "❌ 无法清理现有虚拟环境，请尝试手动删除 .venv 目录后重试"
                )
                return False
    else:
        print("✅ 没有找到现有虚拟环境")
        delete_success = True

    # 检查 UV 是否已安装
    try:
        subprocess.run(
            ["uv", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        print("✅ UV 已安装")
    except (subprocess.SubprocessError, FileNotFoundError):
        print("❌ UV 未安装，请先安装 UV")
        print("Windows: pip install --user uv")
        print("Linux/macOS: curl -LsSf https://astral.sh/uv/install.sh | sh")
        return False

    # 创建新的虚拟环境
    print("📦 创建新的虚拟环境...")
    try:
        subprocess.run(
            ["uv", "venv"],
            check=True,
        )
        print("✅ 新虚拟环境创建成功")

        # 打印激活指令
        print("\n🚀 要激活虚拟环境，请运行以下命令：")
        if sys.platform == "win32":
            print("PowerShell: .venv\\Scripts\\Activate.ps1")
            print("CMD: .venv\\Scripts\\activate.bat")
        else:
            print("source .venv/bin/activate")

        print("\n📦 要安装依赖，请激活环境后运行：")
        print("uv pip sync requirements.txt")

        return True
    except subprocess.SubprocessError as e:
        print(f"❌ 创建虚拟环境失败: {e}")
        return False


if __name__ == "__main__":
    reset_venv()
