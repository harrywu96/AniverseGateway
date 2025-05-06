"""视频存储服务模块

提供视频文件的存储和管理功能，用于管理当前会话中的视频信息。
"""

import os
import logging
import traceback
from typing import Dict, List, Optional
from pathlib import Path
from uuid import uuid4

from ..schemas.video import VideoInfo, VideoFormat

logger = logging.getLogger(__name__)


class VideoStorageService:
    """视频存储服务，用于管理当前会话中的视频信息"""

    def __init__(self, temp_dir: str):
        """初始化视频存储服务

        Args:
            temp_dir: 临时文件目录
        """
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.videos: Dict[str, VideoInfo] = {}
        logger.info(
            f"VideoStorageService实例初始化，ID: {id(self)}, 临时目录: {temp_dir}"
        )

    def save_video(self, file_path: str, filename: str) -> VideoInfo:
        """保存视频文件并创建视频信息

        Args:
            file_path: 视频文件路径
            filename: 视频文件名

        Returns:
            VideoInfo: 创建的视频信息对象
        """
        try:
            logger.info(
                f"开始保存视频，文件路径: {file_path}, 文件名: {filename}"
            )
            logger.info(
                f"当前实例ID: {id(self)}, 当前存储的视频数量: {len(self.videos)}"
            )

            # 生成唯一ID
            video_id = str(uuid4())
            logger.info(f"生成的视频ID: {video_id}")

            # 确定目标路径
            target_path = self.temp_dir / f"{video_id}_{filename}"
            logger.info(f"目标路径: {target_path}")

            # 复制文件到临时目录
            import shutil

            shutil.copy2(file_path, target_path)
            logger.info(f"文件已复制到临时目录")

            # 创建视频信息对象
            video_info = VideoInfo(
                id=video_id,
                filename=filename,
                path=str(target_path),
                format=self._get_video_format_from_filename(filename),
            )
            logger.info(
                f"创建的视频信息对象: {video_info.id}, 格式: {video_info.format}"
            )

            # 存储到内存
            self.videos[video_id] = video_info
            logger.info(f"视频已存储到内存，当前视频数量: {len(self.videos)}")
            logger.info(f"当前存储的所有视频ID: {list(self.videos.keys())}")

            return video_info
        except Exception as e:
            logger.error(f"保存视频失败: {e}")
            logger.error(f"异常堆栈: {traceback.format_exc()}")
            raise

    def get_video(self, video_id: str) -> Optional[VideoInfo]:
        """获取视频信息

        Args:
            video_id: 视频ID

        Returns:
            Optional[VideoInfo]: 视频信息对象，如果不存在则返回None
        """
        logger.info(f"尝试获取视频，ID: {video_id}")
        logger.info(
            f"当前实例ID: {id(self)}, 当前存储的视频数量: {len(self.videos)}"
        )
        logger.info(f"当前存储的所有视频ID: {list(self.videos.keys())}")

        video = self.videos.get(video_id)
        if video:
            logger.info(f"找到视频: {video.id}, 文件名: {video.filename}")
        else:
            logger.warning(f"未找到视频，ID: {video_id}")

        return video

    def list_videos(self) -> List[VideoInfo]:
        """获取所有视频信息

        Returns:
            List[VideoInfo]: 视频信息对象列表
        """
        return list(self.videos.values())

    def delete_video(self, video_id: str) -> bool:
        """删除视频

        Args:
            video_id: 视频ID

        Returns:
            bool: 是否删除成功
        """
        if video_id not in self.videos:
            return False

        video_info = self.videos[video_id]

        # 删除文件
        try:
            if os.path.exists(video_info.path):
                os.remove(video_info.path)
        except Exception as e:
            logger.error(f"删除视频文件失败: {e}")

        # 从内存中删除
        del self.videos[video_id]

        return True

    def clear_all(self):
        """清空所有视频"""
        for video_id in list(self.videos.keys()):
            self.delete_video(video_id)

    def _get_video_format_from_filename(self, filename: str) -> VideoFormat:
        """从文件名获取视频格式

        Args:
            filename: 视频文件名

        Returns:
            VideoFormat: 视频格式
        """
        suffix = Path(filename).suffix.lower().lstrip(".")
        try:
            return VideoFormat(suffix)
        except ValueError:
            return VideoFormat.OTHER
