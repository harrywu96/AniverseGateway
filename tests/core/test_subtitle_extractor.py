"""字幕提取模块的单元测试。"""

import os
import re
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open, PropertyMock

from subtranslate.core.ffmpeg import FFmpegTool, FFmpegError
from subtranslate.core.subtitle_extractor import (
    SubtitleFormat,
    SubtitleTrack,
    SubtitleExtractor,
)
from subtranslate.schemas.video import VideoInfo, VideoFormat, ProcessingStatus


@pytest.fixture
def subtitle_extractor():
    """字幕提取器测试实例"""
    with patch("subtranslate.core.ffmpeg.FFmpegTool") as mock_ffmpeg_cls:
        # 模拟FFmpegTool实例
        mock_ffmpeg = mock_ffmpeg_cls.return_value
        extractor = SubtitleExtractor(ffmpeg_tool=mock_ffmpeg)
        yield extractor


@pytest.fixture
def video_info():
    """测试用视频信息对象"""
    return VideoInfo(
        filename="test_video.mkv",
        path="/path/to/test_video.mkv",
        format=VideoFormat.MKV,
        has_embedded_subtitle=True,
        duration=600.0,
    )


@pytest.fixture
def subtitle_streams():
    """测试用字幕流列表"""
    return [
        {
            "index": 0,
            "codec_type": "subtitle",
            "codec_name": "subrip",
            "tags": {"language": "eng", "title": "English"},
            "disposition": {"default": 1, "forced": 0},
        },
        {
            "index": 1,
            "codec_type": "subtitle",
            "codec_name": "ass",
            "tags": {"language": "chi", "title": "Chinese"},
            "disposition": {"default": 0, "forced": 0},
        },
    ]


class TestSubtitleFormat:
    """SubtitleFormat类的测试用例"""

    def test_subtitle_format_values(self):
        """测试字幕格式枚举值"""
        assert SubtitleFormat.SRT == "srt"
        assert SubtitleFormat.ASS == "ass"
        assert SubtitleFormat.VTT == "vtt"
        assert SubtitleFormat.UNKNOWN == "unknown"


class TestSubtitleTrack:
    """SubtitleTrack类的测试用例"""

    def test_init(self):
        """测试初始化"""
        track = SubtitleTrack(
            index=1,
            language="eng",
            title="English",
            codec="subrip",
            is_default=True,
            is_forced=False,
        )

        assert track.index == 1
        assert track.language == "eng"
        assert track.title == "English"
        assert track.codec == "subrip"
        assert track.is_default is True
        assert track.is_forced is False
        assert track.stream_info == {}

    def test_str_representation(self):
        """测试字符串表示"""
        track = SubtitleTrack(
            index=1, language="eng", title="English", is_default=True, is_forced=False
        )

        expected = "轨道 #1: eng, 标题: English, 默认"
        assert str(track) == expected

        # 测试无语言和标题的情况
        track = SubtitleTrack(index=2)
        assert str(track) == "轨道 #2: 未知"

    def test_from_stream_info(self, subtitle_streams):
        """测试从流信息创建轨道对象"""
        # 英文轨道 (默认)
        eng_track = SubtitleTrack.from_stream_info(subtitle_streams[0], 0)

        assert eng_track.index == 0
        assert eng_track.language == "eng"
        assert eng_track.title == "English"
        assert eng_track.codec == "subrip"
        assert eng_track.is_default is True
        assert eng_track.is_forced is False

        # 中文轨道 (非默认)
        chi_track = SubtitleTrack.from_stream_info(subtitle_streams[1], 1)

        assert chi_track.index == 1
        assert chi_track.language == "chi"
        assert chi_track.title == "Chinese"
        assert chi_track.codec == "ass"
        assert chi_track.is_default is False
        assert chi_track.is_forced is False


class TestSubtitleExtractor:
    """SubtitleExtractor类的测试用例"""

    def test_init(self):
        """测试初始化"""
        # 使用提供的FFmpegTool实例
        ffmpeg = MagicMock()
        extractor = SubtitleExtractor(ffmpeg_tool=ffmpeg)
        assert extractor.ffmpeg is ffmpeg

        # 不提供FFmpegTool实例，应自动创建
        with patch(
            "subtranslate.core.subtitle_extractor.FFmpegTool"
        ) as mock_ffmpeg_cls:
            mock_ffmpeg = mock_ffmpeg_cls.return_value
            extractor = SubtitleExtractor()
            assert extractor.ffmpeg is mock_ffmpeg
            assert mock_ffmpeg_cls.called

    def test_detect_subtitle_files(self, subtitle_extractor):
        """测试检测外挂字幕文件"""
        with (
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.glob") as mock_glob,
            patch("pathlib.Path.__truediv__") as mock_div,
        ):
            # 模拟文件存在和目录glob结果
            mock_exact_match = MagicMock(spec=Path)
            mock_language_match = MagicMock(spec=Path)
            mock_div.return_value = mock_exact_match
            mock_glob.return_value = [mock_language_match]

            # 视频路径
            video_path = "/path/to/video.mp4"

            # 调用方法
            results = subtitle_extractor.detect_subtitle_files(video_path)

            # 验证结果
            assert len(results) == 14  # 7个扩展名 * (1个精确匹配 + 1个语言匹配)
            assert results.count(mock_exact_match) == 7  # 每个扩展名一个精确匹配
            assert results.count(mock_language_match) == 7  # 每个扩展名一个语言匹配

    def test_get_subtitle_format(self, subtitle_extractor):
        """测试确定字幕文件格式"""
        # 测试通过扩展名判断
        with patch.object(
            Path, "suffix", new_callable=PropertyMock, return_value=".srt"
        ):
            with patch.object(Path, "exists", return_value=True):
                result = subtitle_extractor.get_subtitle_format("/path/to/subtitle.srt")
                assert result == SubtitleFormat.SRT

        # 测试通过内容判断SRT
        srt_content = "1\n00:00:01,000 --> 00:00:05,000\nTest subtitle"
        with patch.object(
            Path, "suffix", new_callable=PropertyMock, return_value=".txt"
        ):
            with patch.object(Path, "exists", return_value=True):
                with patch("builtins.open", mock_open(read_data=srt_content)):
                    result = subtitle_extractor.get_subtitle_format(
                        "/path/to/subtitle.txt"
                    )
                    assert result == SubtitleFormat.SRT

        # 测试通过内容判断ASS
        ass_content = "[Script Info]\nTitle: Test\nFormat: Layer, Start"
        with patch.object(
            Path, "suffix", new_callable=PropertyMock, return_value=".txt"
        ):
            with patch.object(Path, "exists", return_value=True):
                with patch("builtins.open", mock_open(read_data=ass_content)):
                    result = subtitle_extractor.get_subtitle_format(
                        "/path/to/subtitle.txt"
                    )
                    assert result == SubtitleFormat.ASS

        # 测试未知格式
        with patch.object(
            Path, "suffix", new_callable=PropertyMock, return_value=".xyz"
        ):
            with patch.object(Path, "exists", return_value=True):
                with patch("builtins.open", mock_open(read_data="Unknown")):
                    result = subtitle_extractor.get_subtitle_format(
                        "/path/to/subtitle.xyz"
                    )
                    assert result == SubtitleFormat.UNKNOWN

    def test_extract_embedded_subtitle(self, subtitle_extractor, video_info):
        """测试提取内嵌字幕"""
        with (
            patch("pathlib.Path.exists", return_value=True),
            patch("os.makedirs") as mock_makedirs,
            patch.object(subtitle_extractor.ffmpeg, "run_command") as mock_run,
        ):
            # 模拟输出文件存在
            with patch("pathlib.Path.exists", side_effect=[True, True]):
                # 第一个True是视频文件存在检查，第二个True是输出文件存在检查

                # 调用方法
                result = subtitle_extractor.extract_embedded_subtitle(
                    video_info, 0, "/output/dir", SubtitleFormat.SRT
                )

                # 验证结果和方法调用
                assert result is not None
                assert video_info.status == ProcessingStatus.PENDING  # 应重置为PENDING
                mock_makedirs.assert_called_once_with(
                    Path("/output/dir"), exist_ok=True
                )
                mock_run.assert_called_once()

                # 验证命令参数
                cmd_args = mock_run.call_args[0][0]
                assert "-map" in cmd_args
                assert "0:s:0" in cmd_args  # 使用了正确的轨道索引
                assert "-c:s" in cmd_args
                assert "srt" in cmd_args  # 使用了正确的格式

    def test_extract_embedded_subtitle_failure(self, subtitle_extractor, video_info):
        """测试提取内嵌字幕失败的情况"""
        with (
            patch("pathlib.Path.exists", return_value=True),
            patch("os.makedirs"),
            patch.object(subtitle_extractor.ffmpeg, "run_command") as mock_run,
        ):
            # 模拟输出文件不存在
            with patch("pathlib.Path.exists", side_effect=[True, False]):
                # 第一个True是视频文件存在检查，第二个False是输出文件不存在

                # 调用方法
                result = subtitle_extractor.extract_embedded_subtitle(
                    video_info, 0, "/output/dir", SubtitleFormat.SRT
                )

                # 验证结果
                assert result is None
                assert video_info.status == ProcessingStatus.PENDING  # 应重置为PENDING

            # 模拟命令执行失败
            mock_run.side_effect = FFmpegError("Failed to extract subtitle")

            with patch("pathlib.Path.exists", return_value=True):
                # 调用方法
                result = subtitle_extractor.extract_embedded_subtitle(
                    video_info, 0, "/output/dir", SubtitleFormat.SRT
                )

                # 验证结果
                assert result is None
                assert video_info.status == ProcessingStatus.PENDING  # 应重置为PENDING

    def test_convert_to_srt(self, subtitle_extractor):
        """测试转换字幕到SRT格式"""
        with (
            patch("pathlib.Path.exists", return_value=True),
            patch.object(subtitle_extractor.ffmpeg, "run_command") as mock_run,
            patch("pathlib.Path.suffix", return_value=".ass"),
        ):
            # 模拟输出文件存在
            with patch("pathlib.Path.exists", side_effect=[True, True]):
                # 第一个True是字幕文件存在检查，第二个True是输出文件存在检查

                # 调用方法
                result = subtitle_extractor.convert_to_srt(
                    "/path/to/subtitle.ass", "/output/subtitle.srt"
                )

                # 验证结果和方法调用
                assert result is not None
                mock_run.assert_called_once()

                # 验证命令参数
                cmd_args = mock_run.call_args[0][0]
                assert "-c:s" in cmd_args
                assert "srt" in cmd_args

    def test_convert_to_srt_already_srt(self, subtitle_extractor):
        """测试文件已经是SRT格式的情况"""
        srt_content = "1\n00:00:01,000 --> 00:00:05,000\nTest subtitle"

        with (
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.suffix", return_value=".srt"),
            patch("builtins.open", mock_open(read_data=srt_content)),
        ):
            # 调用方法
            result = subtitle_extractor.convert_to_srt("/path/to/subtitle.srt")

            # 验证结果 - 应直接返回输入路径
            assert result is not None

    def test_get_subtitle_tracks(self, subtitle_extractor, subtitle_streams):
        """测试获取字幕轨道列表"""
        with patch.object(
            subtitle_extractor.ffmpeg,
            "get_subtitle_streams",
            return_value=subtitle_streams,
        ):
            # 调用方法
            tracks = subtitle_extractor.get_subtitle_tracks("/path/to/video.mp4")

            # 验证结果
            assert len(tracks) == 2
            assert tracks[0].language == "eng"
            assert tracks[0].is_default is True
            assert tracks[1].language == "chi"
            assert tracks[1].is_default is False

    def test_select_best_track(self, subtitle_extractor):
        """测试选择最佳字幕轨道"""
        # 创建测试轨道
        eng_default = SubtitleTrack(0, "eng", is_default=True)
        eng_forced = SubtitleTrack(1, "eng", is_forced=True)
        chi_normal = SubtitleTrack(2, "chi")
        jp_normal = SubtitleTrack(3, "jpn")
        tracks = [eng_default, eng_forced, chi_normal, jp_normal]

        # 测试指定语言且有默认轨道
        best_index = subtitle_extractor.select_best_track(tracks, "eng")
        assert best_index == 0  # 应选择英文默认轨道

        # 测试指定语言无默认轨道
        best_index = subtitle_extractor.select_best_track(tracks, "chi")
        assert best_index == 2  # 应选择中文轨道

        # 测试不存在的语言，应选择默认轨道
        best_index = subtitle_extractor.select_best_track(tracks, "fre")
        assert best_index == 0  # 应选择默认轨道

        # 测试无默认轨道的情况
        no_default_tracks = [eng_forced, chi_normal, jp_normal]
        best_index = subtitle_extractor.select_best_track(no_default_tracks)
        assert best_index == 2  # 应选择第一个非强制轨道(chi_normal的index是2)

        # 测试仅有强制轨道的情况
        forced_tracks = [eng_forced]
        best_index = subtitle_extractor.select_best_track(forced_tracks)
        assert best_index == 1  # 应选择第一个轨道(eng_forced的index是1)

        # 测试空轨道列表
        best_index = subtitle_extractor.select_best_track([])
        assert best_index is None

    def test_auto_extract_subtitles(
        self, subtitle_extractor, video_info, subtitle_streams
    ):
        """测试自动提取字幕"""
        # 模拟外挂字幕检测
        external_paths = [Path("/path/to/video.en.srt"), Path("/path/to/video.zh.srt")]

        # 模拟各函数的返回值
        with (
            patch.object(
                subtitle_extractor, "detect_subtitle_files", return_value=external_paths
            ),
            patch.object(
                subtitle_extractor,
                "convert_to_srt",
                return_value=Path("/output/converted.srt"),
            ),
            patch.object(subtitle_extractor, "get_subtitle_tracks") as mock_get_tracks,
            patch.object(subtitle_extractor, "select_best_track", return_value=0),
            patch.object(
                subtitle_extractor,
                "extract_embedded_subtitle",
                return_value=Path("/output/extracted.srt"),
            ),
            patch("pathlib.Path.exists", return_value=True),
            patch("os.makedirs"),
            patch("re.search", return_value=True),
        ):
            # 模拟获取轨道返回两个轨道
            tracks = [SubtitleTrack(0, "eng", is_default=True), SubtitleTrack(1, "chi")]
            mock_get_tracks.return_value = tracks

            # 调用方法
            all_subs, best_sub = subtitle_extractor.auto_extract_subtitles(
                video_info, "/output/dir", "eng"
            )

            # 验证结果
            assert len(all_subs) == 4  # 2个外挂 + 1个最佳内嵌 + 1个额外内嵌轨道
            assert best_sub is not None

            # 验证轨道提取次数
            assert subtitle_extractor.extract_embedded_subtitle.call_count == 2

            # 再次调用但无匹配语言
            with patch("re.search", return_value=False):
                # 重置模拟对象
                subtitle_extractor.extract_embedded_subtitle.reset_mock()

                all_subs, best_sub = subtitle_extractor.auto_extract_subtitles(
                    video_info, "/output/dir", "fre"  # 不存在的语言
                )

                # 验证结果
                assert len(all_subs) == 4  # 2个外挂 + 2个内嵌轨道
                assert best_sub is not None
                assert subtitle_extractor.extract_embedded_subtitle.call_count == 2
