"""Pytest 配置文件。"""

import os
import sys
import pytest
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


# 添加测试文件目录
@pytest.fixture
def test_files_dir():
    """测试文件目录路径"""
    return Path(__file__).parent / "schemas" / "test_files"
