"""前端代码迁移脚本

此脚本用于将旧的前端代码结构迁移到新的结构中。
"""

import os
import shutil
import re
from pathlib import Path

# 定义源目录和目标目录
SRC_ELECTRON_ROOT = Path("src/packages/electron-app")
DEST_ELECTRON_ROOT = Path("frontend/electron-app")

SRC_SHARED_ROOT = Path("src/packages/shared")
DEST_SHARED_ROOT = Path("frontend/shared")

# 定义需要迁移的目录和文件
ELECTRON_DIRS_TO_MIGRATE = [
    "src/components",
    "src/context",
    "src/pages",
    "src/services",
    "src/styles",
    "src/types",
    "src/utils",
    "electron/main",
    "electron/preload",
    "public",
]

ELECTRON_FILES_TO_MIGRATE = [
    "src/App.tsx",
    "src/main.tsx",
    "src/electron-mock.ts",
    "src/electron.d.ts",
    "vite.config.ts",
    "electron-builder.json",
    "package.json",
    "index.html",
]

SHARED_DIRS_TO_MIGRATE = [
    "src",
]

SHARED_FILES_TO_MIGRATE = [
    "package.json",
]

# 定义需要排除的文件（重复的JS文件）
FILES_TO_EXCLUDE = [
    "electron/main/index.js",
    "electron/preload.js",
    "preload.js",
    "vite.config.js",
]


def ensure_dir(path):
    """确保目录存在"""
    os.makedirs(path, exist_ok=True)


def copy_directory(src_dir, dest_dir, exclude_files=None):
    """复制目录中的所有文件，排除指定文件"""
    if exclude_files is None:
        exclude_files = []
    
    # 确保目标目录存在
    ensure_dir(dest_dir)
    
    # 遍历源目录中的所有文件和子目录
    for item in os.listdir(src_dir):
        src_item = os.path.join(src_dir, item)
        dest_item = os.path.join(dest_dir, item)
        
        # 检查是否为排除文件
        rel_path = os.path.relpath(src_item, SRC_ELECTRON_ROOT)
        if rel_path in exclude_files:
            print(f"排除文件: {rel_path}")
            continue
        
        if os.path.isdir(src_item):
            # 递归复制子目录
            copy_directory(src_item, dest_item, exclude_files)
        else:
            # 复制文件
            print(f"复制文件: {src_item} -> {dest_item}")
            shutil.copy2(src_item, dest_item)


def copy_file(src_file, dest_file):
    """复制单个文件"""
    print(f"复制文件: {src_file} -> {dest_file}")
    
    # 确保目标目录存在
    ensure_dir(os.path.dirname(dest_file))
    
    # 复制文件
    shutil.copy2(src_file, dest_file)


def migrate_electron():
    """迁移Electron应用代码"""
    print("开始迁移Electron应用代码...")
    
    # 迁移目录
    for dir_path in ELECTRON_DIRS_TO_MIGRATE:
        src_path = SRC_ELECTRON_ROOT / dir_path
        dest_path = DEST_ELECTRON_ROOT / dir_path
        
        if src_path.exists():
            copy_directory(src_path, dest_path, FILES_TO_EXCLUDE)
    
    # 迁移文件
    for file_path in ELECTRON_FILES_TO_MIGRATE:
        src_file = SRC_ELECTRON_ROOT / file_path
        dest_file = DEST_ELECTRON_ROOT / file_path
        
        if src_file.exists():
            copy_file(src_file, dest_file)
    
    print("Electron应用代码迁移完成！")


def migrate_shared():
    """迁移共享代码"""
    print("开始迁移共享代码...")
    
    # 迁移目录
    for dir_path in SHARED_DIRS_TO_MIGRATE:
        src_path = SRC_SHARED_ROOT / dir_path
        dest_path = DEST_SHARED_ROOT / dir_path
        
        if src_path.exists():
            copy_directory(src_path, dest_path)
    
    # 迁移文件
    for file_path in SHARED_FILES_TO_MIGRATE:
        src_file = SRC_SHARED_ROOT / file_path
        dest_file = DEST_SHARED_ROOT / file_path
        
        if src_file.exists():
            copy_file(src_file, dest_file)
    
    print("共享代码迁移完成！")


def main():
    """主函数"""
    print("开始迁移前端代码...")
    
    # 迁移Electron应用代码
    migrate_electron()
    
    # 迁移共享代码
    migrate_shared()
    
    print("前端代码迁移完成！")


if __name__ == "__main__":
    main()
