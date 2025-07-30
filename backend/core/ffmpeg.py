"""FFmpeg工具集成模块，提供视频和字幕处理的底层功能。"""

import json
import logging
import shlex
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Union, Any

from backend.schemas.video import VideoFormat, VideoInfo
from backend.core.logging_utils import get_logger

logger = get_logger("aniversegateway.core.ffmpeg")


class FFmpegError(Exception):
    """FFmpeg执行错误异常类"""

    pass


class FFmpegTool:
    """FFmpeg工具集成类，提供执行FFmpeg命令的封装"""

    def __init__(
        self, ffmpeg_binary: str = "ffmpeg", ffprobe_binary: str = "ffprobe"
    ):
        """初始化FFmpeg工具

        Args:
            ffmpeg_binary: FFmpeg可执行文件路径或命令名
            ffprobe_binary: FFprobe可执行文件路径或命令名
        """
        self.ffmpeg_binary = ffmpeg_binary
        self.ffprobe_binary = ffprobe_binary
        self._check_ffmpeg_available()

    def _check_ffmpeg_available(self) -> None:
        """检查FFmpeg和FFprobe是否可用

        Raises:
            FFmpegError: 如果FFmpeg或FFprobe不可用
        """
        try:
            subprocess.run(
                [self.ffmpeg_binary, "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
            subprocess.run(
                [self.ffprobe_binary, "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            logger.error(f"FFmpeg或FFprobe不可用: {str(e)}")
            raise FFmpegError(f"FFmpeg或FFprobe不可用: {str(e)}")

    def run_command(
        self, cmd: List[str], check: bool = True, capture_output: bool = True
    ) -> subprocess.CompletedProcess:
        """运行指定的命令

        Args:
            cmd: 要执行的命令列表
            check: 是否在命令返回非零状态时引发异常
            capture_output: 是否捕获标准输出和标准错误

        Returns:
            subprocess.CompletedProcess: 命令执行结果

        Raises:
            FFmpegError: 如果命令执行失败且check为True
        """
        try:
            cmd_str = " ".join(shlex.quote(str(c)) for c in cmd)
            logger.debug(f"执行命令: {cmd_str}")

            kwargs = {}
            if capture_output:
                kwargs.update(
                    {
                        "stdout": subprocess.PIPE,
                        "stderr": subprocess.PIPE,
                        "text": True,
                        "encoding": "utf-8",
                        "errors": "replace",
                    }
                )

            result = subprocess.run(cmd, check=check, **kwargs)
            return result
        except subprocess.SubprocessError as e:
            logger.error(f"命令执行失败: {str(e)}")
            if check:
                raise FFmpegError(f"命令执行失败: {str(e)}")
            return e.stdout

    def get_video_info(self, video_path: Union[str, Path]) -> Dict[str, Any]:
        """获取视频文件的详细信息

        Args:
            video_path: 视频文件的路径

        Returns:
            Dict[str, Any]: 包含视频信息的字典

        Raises:
            FFmpegError: 如果无法获取视频信息
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"视频文件不存在: {video_path}")

        cmd = [
            self.ffprobe_binary,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(video_path),
        ]

        try:
            result = self.run_command(cmd)
            if result.stdout:
                return json.loads(result.stdout)
            raise FFmpegError("无法获取视频信息，输出为空")
        except json.JSONDecodeError as e:
            logger.error(f"解析视频信息失败: {str(e)}")
            raise FFmpegError(f"解析视频信息失败: {str(e)}")

    def detect_video_format(self, video_path: Union[str, Path]) -> VideoFormat:
        """检测视频文件的格式

        Args:
            video_path: 视频文件的路径

        Returns:
            VideoFormat: 检测到的视频格式

        Raises:
            FFmpegError: 如果无法检测视频格式
        """
        try:
            info = self.get_video_info(video_path)
            format_name = info.get("format", {}).get("format_name", "")

            # 将格式名转为小写并处理
            format_name_lower = format_name.lower()
            format_list = [fmt.strip() for fmt in format_name_lower.split(",")]

            # 1. 优先检查MKV格式 - 特殊情况处理
            if "matroska" in format_name_lower:
                return VideoFormat.MKV

            # 2. 检查MP4相关格式
            mp4_formats = ["mp4", "mov", "m4a", "3gp", "3g2", "mj2"]
            if any(fmt in mp4_formats for fmt in format_list):
                return VideoFormat.MP4

            # 3. 检查AVI格式
            if "avi" in format_list:
                return VideoFormat.AVI

            # 4. 检查WEBM格式
            if "webm" in format_list:
                return VideoFormat.WEBM

            # 5. 尝试从文件扩展名判断
            suffix = Path(video_path).suffix.lower().lstrip(".")
            try:
                return VideoFormat(suffix)
            except ValueError:
                pass

            # 6. 返回其他格式
            return VideoFormat.OTHER
        except Exception as e:
            logger.error(f"检测视频格式失败: {str(e)}")
            raise FFmpegError(f"检测视频格式失败: {str(e)}")

    def get_video_duration(self, video_path: Union[str, Path]) -> float:
        """获取视频的持续时间（秒）

        Args:
            video_path: 视频文件的路径

        Returns:
            float: 视频的持续时间（秒）

        Raises:
            FFmpegError: 如果无法获取视频持续时间
        """
        try:
            info = self.get_video_info(video_path)
            duration_str = info.get("format", {}).get("duration")

            if duration_str:
                return float(duration_str)

            # 如果format部分没有duration，尝试从流信息中获取
            streams = info.get("streams", [])
            for stream in streams:
                if (
                    stream.get("codec_type") == "video"
                    and "duration" in stream
                ):
                    return float(stream["duration"])

            raise FFmpegError("无法从视频信息中获取持续时间")
        except Exception as e:
            err_msg = f"获取视频持续时间失败: {str(e)}"
            logger.error(err_msg)
            raise FFmpegError(err_msg)

    def create_video_info(self, video_path: Union[str, Path]) -> VideoInfo:
        """从视频文件创建VideoInfo对象，填充详细信息

        Args:
            video_path: 视频文件的路径

        Returns:
            VideoInfo: 填充了详细信息的VideoInfo对象
        """
        # 首先使用基本方法创建对象
        video_info = VideoInfo.from_file_path(str(video_path))

        try:
            # 检测格式并更新
            try:
                format_value = self.detect_video_format(video_path)
                video_info.format = format_value
            except Exception as e:
                logger.warning(f"检测视频格式失败: {str(e)}")
                # 保持默认格式

            # 获取持续时间
            try:
                video_info.duration = self.get_video_duration(video_path)
            except Exception as e:
                logger.warning(f"获取视频时长失败: {str(e)}")
                # duration将保持为None

            # 检测是否包含内嵌字幕
            try:
                video_info.has_embedded_subtitle = self.has_embedded_subtitles(
                    video_path
                )
            except Exception as e:
                logger.warning(f"检测内嵌字幕失败: {str(e)}")
                video_info.has_embedded_subtitle = False

            return video_info
        except Exception as e:
            msg = f"填充视频信息时出错，使用基本信息: {str(e)}"
            logger.warning(msg)
            return video_info

    def has_embedded_subtitles(self, video_path: Union[str, Path]) -> bool:
        """检测视频是否包含内嵌字幕

        Args:
            video_path: 视频文件的路径

        Returns:
            bool: 如果视频包含内嵌字幕则为True
        """
        try:
            info = self.get_video_info(video_path)
            streams = info.get("streams", [])

            for stream in streams:
                if stream.get("codec_type") == "subtitle":
                    return True

            return False
        except Exception as e:
            logger.error(f"检测内嵌字幕失败: {str(e)}")
            return False

    def get_subtitle_streams(
        self, video_path: Union[str, Path]
    ) -> List[Dict[str, Any]]:
        """获取视频中的字幕流信息列表

        Args:
            video_path: 视频文件的路径

        Returns:
            List[Dict[str, Any]]: 字幕流信息列表
        """
        try:
            info = self.get_video_info(video_path)
            streams = info.get("streams", [])

            subtitle_streams = []
            for stream in streams:
                if stream.get("codec_type") == "subtitle":
                    subtitle_streams.append(stream)

            return subtitle_streams
        except Exception as e:
            logger.error(f"获取字幕流失败: {str(e)}")
            return []
