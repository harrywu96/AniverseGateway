"""后端代码迁移脚本

此脚本用于将旧的后端代码结构迁移到新的结构中。
"""

import os
import shutil
import re
from pathlib import Path

# 定义源目录和目标目录
SRC_ROOT = Path("src/subtranslate")
DEST_ROOT = Path("backend")

# 定义需要迁移的目录
DIRS_TO_MIGRATE = [
    "api/routers",
    "core",
    "schemas",
    "services",
]

# 定义导入路径替换规则
IMPORT_REPLACEMENTS = [
    (r"from \.\.", r"from backend"),
    (r"from \.", r"from backend"),
    (r"from subtranslate\.", r"from backend."),
]


def ensure_dir(path):
    """确保目录存在"""
    os.makedirs(path, exist_ok=True)


def copy_and_update_file(src_file, dest_file):
    """复制文件并更新导入路径"""
    print(f"迁移文件: {src_file} -> {dest_file}")
    
    # 确保目标目录存在
    ensure_dir(dest_file.parent)
    
    # 读取源文件内容
    with open(src_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 更新导入路径
    for pattern, replacement in IMPORT_REPLACEMENTS:
        content = re.sub(pattern, replacement, content)
    
    # 写入目标文件
    with open(dest_file, "w", encoding="utf-8") as f:
        f.write(content)


def migrate_directory(src_dir, dest_dir):
    """迁移目录中的所有Python文件"""
    src_path = SRC_ROOT / src_dir
    dest_path = DEST_ROOT / src_dir
    
    # 确保目标目录存在
    ensure_dir(dest_path)
    
    # 迁移所有Python文件
    for src_file in src_path.glob("*.py"):
        dest_file = dest_path / src_file.name
        copy_and_update_file(src_file, dest_file)


def main():
    """主函数"""
    print("开始迁移后端代码...")
    
    # 迁移所有指定目录
    for dir_path in DIRS_TO_MIGRATE:
        migrate_directory(dir_path, dir_path)
    
    print("后端代码迁移完成！")


if __name__ == "__main__":
    main()
