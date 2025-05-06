"""构建脚本

此脚本用于构建项目，包括前端和后端。
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
BACKEND_ROOT = PROJECT_ROOT / "backend"
OUTPUT_DIR = PROJECT_ROOT / "dist"


def setup_environment():
    """设置环境变量"""
    os.environ["NODE_ENV"] = "production"
    
    # Windows系统设置控制台编码为UTF-8
    if platform.system() == "Windows":
        os.system("chcp 65001 > nul")


def build_frontend():
    """构建前端"""
    print("正在构建前端...")
    
    # 构建前端命令
    frontend_cmd = ["pnpm", "build"]
    
    # 执行构建命令
    result = subprocess.run(
        frontend_cmd,
        cwd=PROJECT_ROOT,
        env=os.environ.copy(),
        check=True
    )
    
    if result.returncode != 0:
        print("前端构建失败！")
        sys.exit(1)
    
    print("前端构建成功！")


def prepare_backend():
    """准备后端代码"""
    print("正在准备后端代码...")
    
    # 创建输出目录
    backend_output_dir = OUTPUT_DIR / "backend"
    os.makedirs(backend_output_dir, exist_ok=True)
    
    # 复制后端代码
    for item in BACKEND_ROOT.glob("**/*"):
        if item.is_file() and not item.name.endswith(".pyc") and "__pycache__" not in str(item):
            # 计算相对路径
            rel_path = item.relative_to(BACKEND_ROOT)
            dest_path = backend_output_dir / rel_path
            
            # 确保目标目录存在
            os.makedirs(dest_path.parent, exist_ok=True)
            
            # 复制文件
            shutil.copy2(item, dest_path)
    
    print("后端代码准备完成！")


def main():
    """主函数"""
    print("开始构建项目...")
    
    # 设置环境变量
    setup_environment()
    
    # 清理输出目录
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    
    # 创建输出目录
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 构建前端
    build_frontend()
    
    # 准备后端代码
    prepare_backend()
    
    print("项目构建完成！")


if __name__ == "__main__":
    main()
