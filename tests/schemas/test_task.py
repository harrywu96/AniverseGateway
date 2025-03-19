"""任务模型的单元测试。"""

import pytest
from datetime import datetime

from subtranslate.schemas.task import (
    SubtitleTask,
    TaskStatus,
    TranslationConfig,
    TranslationStyle,
)


def test_translation_config_create():
    """测试 TranslationConfig 模型创建"""
    config = TranslationConfig()
    assert config.style == TranslationStyle.NATURAL
    assert config.preserve_formatting is True
    assert config.handle_cultural_references is True
    assert isinstance(config.glossary, dict)
    assert len(config.glossary) == 0

    # 测试自定义配置
    config = TranslationConfig(
        style=TranslationStyle.FORMAL,
        preserve_formatting=False,
        glossary={"test": "测试"},
    )
    assert config.style == TranslationStyle.FORMAL
    assert config.preserve_formatting is False
    assert "test" in config.glossary
    assert config.glossary["test"] == "测试"


def test_subtitle_task_create():
    """测试 SubtitleTask 模型创建"""
    task = SubtitleTask(video_id="test_video_id", source_path="/path/to/subtitle.srt")
    assert task.id is not None
    assert task.video_id == "test_video_id"
    assert task.source_path == "/path/to/subtitle.srt"
    assert task.status == TaskStatus.QUEUED
    assert task.progress == 0.0
    assert task.source_language == "en"
    assert task.target_language == "zh"
    assert task.result_path is None
    assert task.config is not None
    assert task.config.style == TranslationStyle.NATURAL


def test_subtitle_task_update_progress():
    """测试更新任务进度"""
    task = SubtitleTask(video_id="test_video_id", source_path="/path/to/subtitle.srt")

    # 测试正常更新
    task.update_progress(50.5)
    assert task.progress == 50.5

    # 测试边界值
    task.update_progress(-10)
    assert task.progress == 0.0

    task.update_progress(110)
    assert task.progress == 100.0


def test_subtitle_task_mark_completed():
    """测试标记任务为已完成"""
    task = SubtitleTask(video_id="test_video_id", source_path="/path/to/subtitle.srt")

    result_path = "/path/to/result.srt"
    task.mark_completed(result_path)

    assert task.status == TaskStatus.COMPLETED
    assert task.progress == 100.0
    assert task.result_path == result_path
    assert task.completed_at is not None


def test_subtitle_task_mark_failed():
    """测试标记任务为失败"""
    task = SubtitleTask(video_id="test_video_id", source_path="/path/to/subtitle.srt")

    error_message = "测试错误信息"
    task.mark_failed(error_message)

    assert task.status == TaskStatus.FAILED
    assert task.error_message == error_message
    assert task.completed_at is not None


def test_subtitle_task_to_dict():
    """测试转换为字典"""
    created_at = datetime(2023, 1, 1, 12, 0, 0)
    config = TranslationConfig(style=TranslationStyle.LITERAL)

    task = SubtitleTask(
        id="test_id",
        video_id="test_video_id",
        source_path="/path/to/subtitle.srt",
        created_at=created_at,
        config=config,
    )

    result = task.to_dict()
    assert result["id"] == "test_id"
    assert result["video_id"] == "test_video_id"
    assert result["status"] == "queued"
    assert result["created_at"] == created_at
    assert result["config"]["style"] == "literal"
