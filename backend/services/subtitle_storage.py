"""字幕存储服务模块

提供字幕文件的存储和管理功能。
"""

import os
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from backend.schemas.subtitle import SubtitleInfo


class SubtitleStorageService:
    """字幕存储服务"""

    def __init__(self, storage_dir: Optional[str] = None):
        """初始化字幕存储服务

        Args:
            storage_dir: 存储目录路径，默认为临时目录
        """
        self.storage_dir = (
            Path(storage_dir) if storage_dir else Path("/tmp/subtitles")
        )
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._subtitles: Dict[str, SubtitleInfo] = {}

    def save_subtitle(
        self, content: str, format: str, video_id: Optional[str] = None
    ) -> SubtitleInfo:
        """保存字幕文件

        Args:
            content: 字幕内容
            format: 字幕格式
            video_id: 关联视频ID

        Returns:
            字幕信息
        """
        subtitle_id = str(uuid.uuid4())
        file_path = self.storage_dir / f"{subtitle_id}.{format}"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        subtitle_info = SubtitleInfo(
            id=subtitle_id,
            path=str(file_path),
            format=format,
            video_id=video_id,
            total_lines=len(content.splitlines()),
        )
        self._subtitles[subtitle_id] = subtitle_info
        return subtitle_info

    def get_subtitle(self, subtitle_id: str) -> Optional[SubtitleInfo]:
        """获取字幕信息

        Args:
            subtitle_id: 字幕ID

        Returns:
            字幕信息，如果不存在则返回None
        """
        return self._subtitles.get(subtitle_id)

    def list_subtitles(
        self, video_id: Optional[str] = None
    ) -> List[SubtitleInfo]:
        """列出所有字幕

        Args:
            video_id: 视频ID过滤

        Returns:
            字幕信息列表
        """
        if video_id:
            return [
                s for s in self._subtitles.values() if s.video_id == video_id
            ]
        return list(self._subtitles.values())

    def update_subtitle(
        self, subtitle_id: str, **kwargs
    ) -> Optional[SubtitleInfo]:
        """更新字幕信息

        Args:
            subtitle_id: 字幕ID
            **kwargs: 要更新的字段

        Returns:
            更新后的字幕信息，如果不存在则返回None
        """
        if subtitle_id not in self._subtitles:
            return None

        subtitle = self._subtitles[subtitle_id]
        for key, value in kwargs.items():
            if hasattr(subtitle, key):
                setattr(subtitle, key, value)
        return subtitle

    def delete_subtitle(self, subtitle_id: str) -> bool:
        """删除字幕

        Args:
            subtitle_id: 字幕ID

        Returns:
            是否删除成功
        """
        if subtitle_id not in self._subtitles:
            return False

        subtitle = self._subtitles[subtitle_id]
        try:
            if os.path.exists(subtitle.path):
                os.remove(subtitle.path)
            del self._subtitles[subtitle_id]
            return True
        except Exception:
            return False

    def clear_all(self) -> None:
        """清除所有字幕"""
        for subtitle in self._subtitles.values():
            if os.path.exists(subtitle.path):
                os.remove(subtitle.path)
        self._subtitles.clear()
