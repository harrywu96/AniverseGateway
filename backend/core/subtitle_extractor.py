"""字幕提取模块，负责从视频中提取字幕并转换为SRT格式。"""

import logging
import os
import re
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

from backend.core.ffmpeg import FFmpegError, FFmpegTool
from backend.schemas.video import VideoInfo, ProcessingStatus
from backend.schemas.subtitle import (
    SubtitleTrack as PydanticSubtitleTrack,
)

logger = logging.getLogger(__name__)


class SubtitleFormat(str, Enum):
    """支持的字幕格式"""

    SRT = "srt"
    ASS = "ass"
    SSA = "ssa"
    VTT = "vtt"
    SUB = "sub"
    IDX = "idx"
    UNKNOWN = "unknown"


class SubtitleTrack:
    """字幕轨道信息"""

    def __init__(
        self,
        index: int,
        language: Optional[str] = None,
        title: Optional[str] = None,
        codec: Optional[str] = None,
        is_default: bool = False,
        is_forced: bool = False,
        stream_info: Optional[Dict] = None,
    ):
        """初始化字幕轨道

        Args:
            index: 字幕轨道索引
            language: 字幕语言代码
            title: 字幕标题
            codec: 字幕编码
            is_default: 是否为默认轨道
            is_forced: 是否为强制轨道
            stream_info: 原始流信息
        """
        self.index = index
        self.language = language
        self.title = title
        self.codec = codec
        self.is_default = is_default
        self.is_forced = is_forced
        self.stream_info = stream_info or {}

    def __str__(self) -> str:
        """返回字幕轨道的字符串表示"""
        lang = self.language or "未知"
        title = f", 标题: {self.title}" if self.title else ""
        default = ", 默认" if self.is_default else ""
        forced = ", 强制" if self.is_forced else ""

        return f"轨道 #{self.index}: {lang}{title}{default}{forced}"

    @classmethod
    def from_stream_info(
        cls, stream_info: Dict, index: int
    ) -> "SubtitleTrack":
        """从流信息创建字幕轨道对象

        Args:
            stream_info: 流信息字典
            index: 轨道索引

        Returns:
            SubtitleTrack: 创建的字幕轨道对象
        """
        # 获取语言标签，可能存在于不同位置
        language = None
        tags = stream_info.get("tags", {})
        if tags:
            language = tags.get("language") or tags.get("LANGUAGE")

        # 获取标题
        title = tags.get("title") or tags.get("NAME")

        # 获取编解码器名称
        codec = stream_info.get("codec_name")

        # 检查是否为默认轨道或强制轨道
        disposition = stream_info.get("disposition", {})
        is_default = bool(disposition.get("default", 0))
        is_forced = bool(disposition.get("forced", 0))

        return cls(
            index=index,
            language=language,
            title=title,
            codec=codec,
            is_default=is_default,
            is_forced=is_forced,
            stream_info=stream_info,
        )


class SubtitleExtractor:
    """字幕提取器，用于从视频中提取字幕"""

    def __init__(self, ffmpeg_tool: Optional[FFmpegTool] = None):
        """初始化字幕提取器

        Args:
            ffmpeg_tool: FFmpeg工具实例，如果为None则创建新实例
        """
        self.ffmpeg = ffmpeg_tool or FFmpegTool()

    def detect_subtitle_files(
        self, video_path: Union[str, Path]
    ) -> List[Path]:
        """检测与视频关联的外挂字幕文件

        Args:
            video_path: 视频文件路径

        Returns:
            List[Path]: 找到的字幕文件列表
        """
        video_path = Path(video_path)
        if not video_path.exists():
            logger.warning(f"视频文件不存在: {video_path}")
            return []

        # 获取不带扩展名的文件名和所在目录
        stem = video_path.stem
        directory = video_path.parent

        # 常见字幕扩展名
        subtitle_extensions = [
            ".srt",
            ".ass",
            ".ssa",
            ".vtt",
            ".sub",
            ".idx",
            ".smi",
        ]

        # 查找同名字幕文件
        subtitle_files = []
        for ext in subtitle_extensions:
            # 查找完全相同名称的字幕文件
            exact_match = directory / f"{stem}{ext}"
            if exact_match.exists():
                subtitle_files.append(exact_match)

            # 查找包含语言代码的字幕文件（如 video.en.srt, video.zh.srt 等）
            language_pattern = directory.glob(f"{stem}.*.{ext[1:]}")
            subtitle_files.extend(list(language_pattern))

        return subtitle_files

    def get_subtitle_format(
        self, subtitle_path: Union[str, Path]
    ) -> SubtitleFormat:
        """确定字幕文件的格式

        Args:
            subtitle_path: 字幕文件路径

        Returns:
            SubtitleFormat: 字幕格式
        """
        path = Path(subtitle_path)
        ext = path.suffix.lower().lstrip(".")

        try:
            return SubtitleFormat(ext)
        except ValueError:
            # 如果扩展名不在预定义的格式中，尝试分析文件内容
            try:
                with open(path, "r", encoding="utf-8") as f:
                    first_lines = "".join([f.readline() for _ in range(10)])

                if re.search(
                    r"\d+:\d+:\d+[,.]\d+ --> \d+:\d+:\d+[,.]\d+", first_lines
                ):
                    return SubtitleFormat.SRT
                elif (
                    "[Script Info]" in first_lines and "Format:" in first_lines
                ):
                    return SubtitleFormat.ASS
                elif "WEBVTT" in first_lines:
                    return SubtitleFormat.VTT

            except (UnicodeDecodeError, IOError):
                # 如果无法读取文件或解码错误，当作未知格式
                pass

        return SubtitleFormat.UNKNOWN

    def extract_embedded_subtitle(
        self,
        video_info: VideoInfo,
        track_index: int,
        output_dir: Optional[Union[str, Path]] = None,
        target_format: SubtitleFormat = SubtitleFormat.SRT,
    ) -> Optional[Path]:
        """从视频中提取内嵌字幕

        Args:
            video_info: 视频信息对象
            track_index: 要提取的字幕轨道索引
            output_dir: 输出目录，如果为None则使用视频所在目录
            target_format: 目标字幕格式

        Returns:
            Optional[Path]: 提取的字幕文件路径，如果提取失败则为None
        """
        video_path = Path(video_info.path)
        if not video_path.exists():
            logger.error(f"视频文件不存在: {video_path}")
            return None

        # 更新视频状态
        video_info.status = ProcessingStatus.EXTRACTING

        # 如果未指定输出目录，使用视频所在目录
        if output_dir is None:
            output_dir = video_path.parent
        else:
            output_dir = Path(output_dir)
            os.makedirs(output_dir, exist_ok=True)

        # 确定输出文件路径
        output_file = (
            output_dir
            / f"{video_path.stem}.track{track_index}.{target_format}"
        )

        try:
            # 构建FFmpeg命令提取字幕
            cmd = [
                self.ffmpeg.ffmpeg_binary,
                "-i",
                str(video_path),
                "-map",
                f"0:s:{track_index}",
            ]

            # 根据目标格式添加相应的编码选项
            if target_format == SubtitleFormat.SRT:
                cmd.extend(["-c:s", "srt"])
            elif target_format in [SubtitleFormat.ASS, SubtitleFormat.SSA]:
                cmd.extend(["-c:s", "ass"])
            elif target_format == SubtitleFormat.VTT:
                cmd.extend(["-c:s", "webvtt"])

            # 添加输出文件路径和覆盖选项
            cmd.extend(["-y", str(output_file)])

            # 执行命令
            self.ffmpeg.run_command(cmd)

            if output_file.exists():
                logger.info(f"成功从视频提取字幕到: {output_file}")
                return output_file
            else:
                logger.error(f"字幕提取后找不到输出文件: {output_file}")
                return None

        except FFmpegError as e:
            logger.error(f"提取字幕失败: {str(e)}")
            return None
        finally:
            # 重置视频状态
            video_info.status = ProcessingStatus.PENDING

    def convert_to_srt(
        self,
        subtitle_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
    ) -> Optional[Path]:
        """将字幕文件转换为SRT格式

        Args:
            subtitle_path: 字幕文件路径
            output_path: 输出文件路径，如果为None则使用原文件路径修改扩展名

        Returns:
            Optional[Path]: 转换后的SRT文件路径，如果转换失败则为None
        """
        subtitle_path = Path(subtitle_path)
        if not subtitle_path.exists():
            logger.error(f"字幕文件不存在: {subtitle_path}")
            return None

        # 如果文件已经是SRT格式，直接返回路径
        if subtitle_path.suffix.lower() == ".srt":
            try:
                # 验证SRT格式是否有效
                with open(subtitle_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if re.search(
                        r"\d+\s+\d+:\d+:\d+,\d+ --> \d+:\d+:\d+,\d+", content
                    ):
                        return subtitle_path
            except (UnicodeDecodeError, IOError):
                # 如果文件无法读取或不是有效的SRT，继续尝试转换
                pass

        # 确定输出文件路径
        if output_path is None:
            output_path = subtitle_path.with_suffix(".srt")
        else:
            output_path = Path(output_path)

        try:
            # 构建FFmpeg命令转换字幕
            cmd = [
                self.ffmpeg.ffmpeg_binary,
                "-i",
                str(subtitle_path),
                "-c:s",
                "srt",
                "-y",
                str(output_path),
            ]

            # 执行命令
            self.ffmpeg.run_command(cmd)

            if output_path.exists():
                logger.info(f"成功将字幕转换为SRT格式: {output_path}")
                return output_path
            else:
                logger.error(f"字幕转换后找不到输出文件: {output_path}")
                return None

        except FFmpegError as e:
            logger.error(f"转换字幕失败: {str(e)}")
            return None

    def get_subtitle_tracks(
        self, video_path: Union[str, Path]
    ) -> List[SubtitleTrack]:
        """获取视频中的字幕轨道列表

        Args:
            video_path: 视频文件路径

        Returns:
            List[SubtitleTrack]: 字幕轨道列表
        """
        try:
            # 获取视频中的字幕流
            streams = self.ffmpeg.get_subtitle_streams(video_path)

            tracks = []
            for i, stream in enumerate(streams):
                # 创建字幕轨道对象
                track = SubtitleTrack.from_stream_info(stream, i)
                tracks.append(track)

            return tracks

        except Exception as e:
            logger.error(f"获取字幕轨道失败: {str(e)}")
            return []

    def select_best_track(
        self, tracks: List[SubtitleTrack], language: Optional[str] = None
    ) -> Optional[int]:
        """根据语言和其他条件选择最佳字幕轨道

        Args:
            tracks: 字幕轨道列表
            language: 首选语言代码

        Returns:
            Optional[int]: 最佳轨道的索引，如果没有合适的轨道则为None
        """
        if not tracks:
            return None

        # 如果指定了语言，尝试查找匹配的轨道
        if language:
            # 首先查找默认的指定语言轨道
            for track in tracks:
                if (
                    track.language == language
                    and track.is_default
                    and not track.is_forced
                ):
                    return track.index

            # 然后查找任何指定语言的轨道
            for track in tracks:
                if track.language == language and not track.is_forced:
                    return track.index

        # 如果没有找到匹配的语言轨道，尝试查找默认轨道
        for track in tracks:
            if track.is_default and not track.is_forced:
                return track.index

        # 如果没有默认轨道，返回第一个非强制轨道
        for track in tracks:
            if not track.is_forced:
                return track.index

        # 如果只有强制轨道，返回第一个
        if tracks:
            return tracks[0].index

        return None

    def auto_extract_subtitles(
        self,
        video_info: VideoInfo,
        output_dir: Optional[Union[str, Path]] = None,
        preferred_language: Optional[str] = None,
    ) -> Tuple[List[Path], Optional[Path]]:
        """自动提取视频的字幕，包括内嵌字幕和外挂字幕

        Args:
            video_info: 视频信息对象
            output_dir: 输出目录
            preferred_language: 首选语言代码

        Returns:
            Tuple[List[Path], Optional[Path]]:
                - 所有提取的字幕文件列表
                - 推荐使用的字幕文件（最佳匹配）
        """
        video_path = Path(video_info.path)
        if not video_path.exists():
            logger.error(f"视频文件不存在: {video_path}")
            return [], None

        # 如果未指定输出目录，使用视频所在目录
        if output_dir is None:
            output_dir = video_path.parent
        else:
            output_dir = Path(output_dir)
            os.makedirs(output_dir, exist_ok=True)

        all_subtitles = []
        best_subtitle = None

        # 1. 查找外挂字幕文件
        external_subs = self.detect_subtitle_files(video_path)

        # 将外挂字幕转换为SRT格式
        for sub_path in external_subs:
            srt_path = self.convert_to_srt(
                sub_path, output_dir / f"{sub_path.stem}.converted.srt"
            )
            if srt_path:
                all_subtitles.append(srt_path)

                # 如果文件名中包含首选语言代码，将其设为最佳字幕
                if preferred_language and re.search(
                    f"[._-]{preferred_language}[._-]", sub_path.name.lower()
                ):
                    best_subtitle = srt_path

        # 2. 如果视频有内嵌字幕，提取它们
        if video_info.has_embedded_subtitle:
            tracks = self.get_subtitle_tracks(video_path)

            if tracks:
                # 选择最佳轨道
                best_track_index = self.select_best_track(
                    tracks, preferred_language
                )

                if best_track_index is not None:
                    # 提取最佳轨道
                    extracted_path = self.extract_embedded_subtitle(
                        video_info,
                        best_track_index,
                        output_dir,
                        SubtitleFormat.SRT,
                    )

                    if extracted_path:
                        all_subtitles.append(extracted_path)

                        # 如果还没有最佳字幕或者这个轨道语言匹配首选语言，将其设为最佳字幕
                        if best_subtitle is None or (
                            preferred_language
                            and tracks[best_track_index].language
                            == preferred_language
                        ):
                            best_subtitle = extracted_path

                # 提取其他轨道
                for track in tracks:
                    if track.index != best_track_index:
                        extracted_path = self.extract_embedded_subtitle(
                            video_info,
                            track.index,
                            output_dir,
                            SubtitleFormat.SRT,
                        )

                        if extracted_path:
                            all_subtitles.append(extracted_path)

        # 如果没有找到最佳字幕但有其他字幕，选择第一个作为最佳字幕
        if best_subtitle is None and all_subtitles:
            best_subtitle = all_subtitles[0]

        return all_subtitles, best_subtitle

    async def analyze_video(self, video_info: VideoInfo) -> VideoInfo:
        """分析视频信息，填充视频的元数据

        Args:
            video_info: 视频信息对象

        Returns:
            VideoInfo: 更新后的视频信息对象
        """
        try:
            # 检测格式并更新
            try:
                format_value = self.ffmpeg.detect_video_format(video_info.path)
                video_info.format = format_value
            except Exception as e:
                logger.warning(f"检测视频格式失败: {str(e)}")
                # 保持默认格式

            # 获取持续时间
            try:
                video_info.duration = self.ffmpeg.get_video_duration(
                    video_info.path
                )
            except Exception as e:
                logger.warning(f"获取视频时长失败: {str(e)}")
                # duration将保持为None

            # 检测是否包含内嵌字幕
            try:
                video_info.has_embedded_subtitle = (
                    self.ffmpeg.has_embedded_subtitles(video_info.path)
                )
            except Exception as e:
                logger.warning(f"检测内嵌字幕失败: {str(e)}")
                video_info.has_embedded_subtitle = False

            logger.info(
                f"视频分析完成: {video_info.filename}, 格式: {video_info.format}, "
                f"时长: {video_info.duration}, "
                f"包含字幕: {video_info.has_embedded_subtitle}"
            )
            return video_info
        except Exception as e:
            logger.error(f"视频分析失败: {str(e)}")
            # 返回原始视频信息
            return video_info

    async def list_subtitle_tracks(
        self, video_info: VideoInfo
    ) -> List[PydanticSubtitleTrack]:
        """列出视频中的字幕轨道

        Args:
            video_info: 视频信息对象

        Returns:
            List[PydanticSubtitleTrack]: 字幕轨道列表（Pydantic模型）
        """
        try:
            # 获取视频中的字幕流
            streams = self.ffmpeg.get_subtitle_streams(video_info.path)

            tracks = []
            for i, stream in enumerate(streams):
                # 创建字幕轨道对象
                track = SubtitleTrack.from_stream_info(stream, i)
                # 转换为Pydantic模型
                pydantic_track = PydanticSubtitleTrack.from_extractor_track(
                    track
                )
                tracks.append(pydantic_track)

                logger.info(f"发现字幕轨道: {track}")

            return tracks
        except Exception as e:
            logger.error(f"获取字幕轨道失败: {str(e)}")
            return []

    async def find_external_subtitles(
        self, video_info: VideoInfo
    ) -> List[Dict[str, str]]:
        """查找与视频关联的外挂字幕文件

        Args:
            video_info: 视频信息对象

        Returns:
            List[Dict[str, str]]: 外挂字幕信息列表，每个字典包含路径、语言和格式信息
        """
        try:
            # 获取视频路径
            video_path = Path(video_info.path)

            # 查找外挂字幕文件
            subtitle_files = self.detect_subtitle_files(video_path)

            # 构建结果
            external_subtitles = []
            for sub_path in subtitle_files:
                # 尝试从文件名中推断语言代码
                language = ""  # 默认空字符串而不是None
                filename = sub_path.stem

                # 常见的语言代码模式: filename.en.srt, filename_zh.srt
                language_match = re.search(
                    r"[._-]([a-z]{2,3})[._-]?$", filename
                )
                if language_match:
                    language = language_match.group(1)

                # 获取字幕格式
                subtitle_format = self.get_subtitle_format(sub_path)

                external_subtitles.append(
                    {
                        "path": str(sub_path),
                        "language": language,  # 现在总是字符串
                        "format": subtitle_format.value,
                    }
                )

                logger.info(
                    f"发现外挂字幕: {sub_path}, 语言: {language or '未知'}, "
                    f"格式: {subtitle_format}"
                )

            return external_subtitles
        except Exception as e:
            logger.error(f"查找外挂字幕失败: {str(e)}")
            return []
