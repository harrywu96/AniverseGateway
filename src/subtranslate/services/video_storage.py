"""视频存储服务模块

提供视频文件的存储和管理功能，用于管理当前会话中的视频信息。
支持将视频信息持久化到磁盘，以便在服务重启后恢复。
"""

import os
import json
import logging
import traceback
from typing import Dict, List, Optional, Any
from pathlib import Path
from uuid import uuid4
from datetime import datetime

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

        # 存储视频信息的字典
        self.videos: Dict[str, VideoInfo] = {}

        # 前端ID到后端ID的映射
        self.id_mapping: Dict[str, str] = {}

        # 持久化存储文件路径
        self.storage_file = self.temp_dir / "video_storage.json"

        logger.info(
            f"VideoStorageService实例初始化，ID: {id(self)}, 临时目录: {temp_dir}"
        )

        # 从磁盘加载视频信息
        self._load_from_disk()

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

            # 持久化到磁盘
            self._save_to_disk()
            logger.info(f"视频信息已持久化到磁盘")

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

        # 从ID映射中删除
        for frontend_id, backend_id in list(self.id_mapping.items()):
            if backend_id == video_id:
                del self.id_mapping[frontend_id]
                logger.info(f"从ID映射中删除了前端ID: {frontend_id}")

        # 持久化到磁盘
        self._save_to_disk()
        logger.info(f"删除视频后已更新磁盘存储")

        return True

    def clear_all(self):
        """清空所有视频"""
        for video_id in list(self.videos.keys()):
            self.delete_video(video_id)

        # 清空ID映射
        self.id_mapping.clear()

        # 确保持久化存储也被更新
        self._save_to_disk()
        logger.info("已清空所有视频和ID映射，并更新磁盘存储")

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

    def _save_to_disk(self) -> None:
        """将视频信息保存到磁盘

        将当前内存中的视频信息和ID映射持久化到JSON文件中
        """
        try:
            # 准备要保存的数据
            data = {
                "videos": {},
                "id_mapping": self.id_mapping,
                "last_updated": datetime.now().isoformat(),
            }

            # 将VideoInfo对象转换为可序列化的字典
            for video_id, video_info in self.videos.items():
                # 使用VideoInfo的to_dict方法获取字典表示
                video_dict = video_info.to_dict()
                # 确保datetime对象被正确序列化
                if isinstance(video_dict.get("created_at"), datetime):
                    video_dict["created_at"] = video_dict[
                        "created_at"
                    ].isoformat()
                data["videos"][video_id] = video_dict

            # 写入文件
            with open(self.storage_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            logger.info(f"视频信息已保存到磁盘: {self.storage_file}")
            logger.info(f"保存的视频数量: {len(self.videos)}")
            logger.info(f"保存的ID映射数量: {len(self.id_mapping)}")
        except Exception as e:
            logger.error(f"保存视频信息到磁盘失败: {e}")
            logger.error(f"异常堆栈: {traceback.format_exc()}")

    def _load_from_disk(self) -> None:
        """从磁盘加载视频信息

        从JSON文件中加载视频信息和ID映射到内存中
        """
        if not self.storage_file.exists():
            logger.info(f"存储文件不存在，跳过加载: {self.storage_file}")
            return

        try:
            # 读取文件
            with open(self.storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 加载ID映射
            if "id_mapping" in data and isinstance(data["id_mapping"], dict):
                self.id_mapping = data["id_mapping"]
                logger.info(f"从磁盘加载了 {len(self.id_mapping)} 个ID映射")

            # 加载视频信息
            if "videos" in data and isinstance(data["videos"], dict):
                videos_data = data["videos"]
                loaded_count = 0

                for video_id, video_dict in videos_data.items():
                    try:
                        # 检查文件是否存在
                        if "path" in video_dict and os.path.exists(
                            video_dict["path"]
                        ):
                            # 将字符串日期转换回datetime对象
                            if "created_at" in video_dict and isinstance(
                                video_dict["created_at"], str
                            ):
                                try:
                                    video_dict["created_at"] = (
                                        datetime.fromisoformat(
                                            video_dict["created_at"]
                                        )
                                    )
                                except ValueError:
                                    # 如果日期格式无效，使用当前时间
                                    video_dict["created_at"] = datetime.now()

                            # 创建VideoInfo对象
                            video_info = VideoInfo(**video_dict)

                            # 检查字幕轨道信息是否存在
                            if (
                                not hasattr(video_info, "subtitle_tracks")
                                or not video_info.subtitle_tracks
                            ):
                                logger.warning(
                                    f"视频 {video_id} 没有字幕轨道信息，可能需要重新提取"
                                )
                            elif len(video_info.subtitle_tracks) == 0:
                                logger.warning(
                                    f"视频 {video_id} 的字幕轨道列表为空，可能需要重新提取"
                                )
                            else:
                                logger.info(
                                    f"视频 {video_id} 包含 {len(video_info.subtitle_tracks)} 个字幕轨道"
                                )

                            self.videos[video_id] = video_info
                            loaded_count += 1
                        else:
                            logger.warning(
                                f"视频文件不存在，跳过加载: {video_dict.get('path', '未知路径')}"
                            )
                    except Exception as e:
                        logger.error(f"加载视频 {video_id} 失败: {e}")

                logger.info(f"从磁盘加载了 {loaded_count} 个视频信息")
                logger.info(
                    f"当前存储的所有视频ID: {list(self.videos.keys())}"
                )

            logger.info(f"从磁盘加载视频信息完成: {self.storage_file}")
        except Exception as e:
            logger.error(f"从磁盘加载视频信息失败: {e}")
            logger.error(f"异常堆栈: {traceback.format_exc()}")

    def add_id_mapping(self, frontend_id: str, backend_id: str) -> None:
        """添加前端ID到后端ID的映射

        Args:
            frontend_id: 前端生成的ID
            backend_id: 后端生成的ID
        """
        if not frontend_id or not backend_id:
            logger.warning(
                f"无效的ID映射: 前端ID={frontend_id}, 后端ID={backend_id}"
            )
            return

        self.id_mapping[frontend_id] = backend_id
        logger.info(f"添加ID映射: 前端ID {frontend_id} -> 后端ID {backend_id}")

        # 持久化到磁盘
        self._save_to_disk()

    def get_by_frontend_id(self, frontend_id: str) -> Optional[VideoInfo]:
        """通过前端ID获取视频信息

        Args:
            frontend_id: 前端生成的ID

        Returns:
            Optional[VideoInfo]: 视频信息对象，如果不存在则返回None
        """
        if not frontend_id or frontend_id not in self.id_mapping:
            logger.warning(f"未找到前端ID的映射: {frontend_id}")
            return None

        backend_id = self.id_mapping[frontend_id]
        logger.info(f"找到ID映射: 前端ID {frontend_id} -> 后端ID {backend_id}")

        return self.get_video(backend_id)
