"""视频信息模型的单元测试。"""

import pytest
from datetime import datetime
from pathlib import Path

from subtranslate.schemas.video import VideoInfo, VideoFormat, ProcessingStatus


def test_video_info_create():
    """测试 VideoInfo 模型创建"""
    video = VideoInfo(
        filename="test.mp4", path="/videos/test.mp4", format=VideoFormat.MP4
    )
    assert video.id is not None
    assert video.filename == "test.mp4"
    assert video.status == ProcessingStatus.PENDING
    assert video.has_embedded_subtitle is False


def test_video_info_validation():
    """测试模型验证"""
    with pytest.raises(ValueError):
        # 缺少必要字段应引发错误
        VideoInfo()

    with pytest.raises(ValueError):
        # 无效枚举值应引发错误
        VideoInfo(
            filename="test.mp4",
            path="/videos/test.mp4",
            format="invalid_format",  # 无效格式
        )


def test_video_info_from_file_path():
    """测试从文件路径创建模型"""
    # 创建测试文件路径
    file_path = str(Path(__file__).parent / "test_files" / "sample.mp4")

    # 测试从路径创建模型
    video = VideoInfo.from_file_path(file_path)
    assert video.filename == "sample.mp4"
    assert video.path == file_path
    assert video.format == VideoFormat.MP4

    # 测试覆盖格式
    video = VideoInfo.from_file_path(file_path, format_override=VideoFormat.MKV)
    assert video.format == VideoFormat.MKV


def test_video_info_to_dict():
    """测试转换为字典"""
    created_at = datetime(2023, 1, 1, 12, 0, 0)
    video = VideoInfo(
        id="test_id",
        filename="test.mp4",
        path="/videos/test.mp4",
        format=VideoFormat.MP4,
        created_at=created_at,
    )

    result = video.to_dict()
    assert result["id"] == "test_id"
    assert result["filename"] == "test.mp4"
    assert result["format"] == "mp4"
    assert result["created_at"] == created_at


def test_video_info_to_api_representation():
    """测试转换为API表示"""
    created_at = datetime(2023, 1, 1, 12, 0, 0)
    video = VideoInfo(
        id="test_id",
        filename="test.mp4",
        path="/videos/test.mp4",
        format=VideoFormat.MP4,
        created_at=created_at,
    )

    result = video.to_api_representation()
    assert result["id"] == "test_id"
    assert result["filename"] == "test.mp4"
    assert result["format"] == "mp4"
    assert result["created_at"] == "2023-01-01T12:00:00"  # ISO格式字符串
