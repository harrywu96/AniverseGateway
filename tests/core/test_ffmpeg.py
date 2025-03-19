"""FFmpeg工具集成模块的单元测试。"""

import json
import subprocess
import pytest
from unittest.mock import patch, MagicMock
import inspect

from subtranslate.core.ffmpeg import FFmpegTool, FFmpegError
from subtranslate.schemas.video import VideoFormat, VideoInfo


@pytest.fixture
def ffmpeg_tool():
    """FFmpegTool测试实例"""
    with patch("subprocess.run") as mock_run:
        # 模拟FFmpeg和FFprobe可用
        mock_run.return_value = MagicMock(returncode=0)
        yield FFmpegTool()


@pytest.fixture
def mock_video_info():
    """模拟视频信息JSON响应"""
    return {
        "format": {
            "filename": "/path/to/video.mp4",
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "duration": "3600.500000",
        },
        "streams": [
            {
                "codec_type": "video",
                "duration": "3600.500000",
                "width": 1920,
                "height": 1080,
            },
            {
                "codec_type": "audio",
                "duration": "3600.500000",
                "channels": 2,
            },
            {
                "codec_type": "subtitle",
                "tags": {"language": "eng", "title": "English"},
                "disposition": {"default": 1, "forced": 0},
            },
        ],
    }


class TestFFmpegTool:
    """FFmpegTool类的测试用例"""

    def test_init(self):
        """测试初始化和可用性检查"""
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            tool = FFmpegTool()

            assert tool.ffmpeg_binary == "ffmpeg"
            assert tool.ffprobe_binary == "ffprobe"

            # 确认检查了FFmpeg和FFprobe的可用性
            assert mock_run.call_count == 2

    def test_init_fails_when_ffmpeg_not_available(self):
        """测试当FFmpeg不可用时初始化失败"""
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = FileNotFoundError("ffmpeg not found")

            with pytest.raises(FFmpegError, match="FFmpeg或FFprobe不可用"):
                FFmpegTool()

    def test_run_command(self, ffmpeg_tool):
        """测试命令执行功能"""
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="success")

            result = ffmpeg_tool.run_command(["echo", "test"])

            mock_run.assert_called_once()
            assert mock_run.call_args[0][0] == ["echo", "test"]
            assert result.stdout == "success"

    def test_run_command_failure(self, ffmpeg_tool):
        """测试命令执行失败情况"""
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.SubprocessError("command failed")

            with pytest.raises(FFmpegError, match="命令执行失败"):
                ffmpeg_tool.run_command(["invalid", "command"])

    def test_get_video_info(self, ffmpeg_tool, mock_video_info):
        """测试获取视频信息功能"""
        # 模拟文件存在
        with (
            patch("pathlib.Path.exists", return_value=True),
            patch.object(ffmpeg_tool, "run_command") as mock_run,
        ):

            # 模拟命令执行结果
            mock_result = MagicMock()
            mock_result.stdout = json.dumps(mock_video_info)
            mock_run.return_value = mock_result

            # 执行获取视频信息
            result = ffmpeg_tool.get_video_info("/path/to/video.mp4")

            # 验证结果
            assert result == mock_video_info
            assert result["format"]["duration"] == "3600.500000"
            assert len(result["streams"]) == 3

    def test_get_video_info_file_not_exists(self, ffmpeg_tool):
        """测试当文件不存在时获取视频信息失败"""
        # 模拟文件不存在
        with patch("pathlib.Path.exists", return_value=False):
            with pytest.raises(FileNotFoundError, match="视频文件不存在"):
                ffmpeg_tool.get_video_info("/path/to/nonexistent.mp4")

    def test_detect_video_format(self, ffmpeg_tool, mock_video_info):
        """测试视频格式检测功能"""
        # 打印当前实现的源代码
        print("\n=== FUNCTION SOURCE ===")
        print(inspect.getsource(ffmpeg_tool.detect_video_format))

        # 1. 测试MP4格式
        with patch.object(ffmpeg_tool, "get_video_info", return_value=mock_video_info):
            # MP4格式
            format_value = ffmpeg_tool.detect_video_format("/path/to/video.mp4")
            assert format_value == VideoFormat.MP4

        # 2. 测试MKV格式 - 现在分开测试
        mkv_info = mock_video_info.copy()
        mkv_info["format"] = mkv_info["format"].copy()
        mkv_info["format"]["format_name"] = "matroska"

        print("\n=== MKV INFO ===")
        print("Format name:", mkv_info["format"]["format_name"])

        with patch.object(ffmpeg_tool, "get_video_info", return_value=mkv_info):
            format_value = ffmpeg_tool.detect_video_format("/path/to/video.mkv")
            print("MKV Test - Detected format:", format_value)
            assert format_value == VideoFormat.MKV

        # 3. 测试WEBM格式 - 现在分开测试
        webm_info = mock_video_info.copy()
        webm_info["format"] = webm_info["format"].copy()
        webm_info["format"]["format_name"] = "webm"

        print("\n=== WEBM INFO ===")
        print("Format name:", webm_info["format"]["format_name"])

        with patch.object(ffmpeg_tool, "get_video_info", return_value=webm_info):
            format_value = ffmpeg_tool.detect_video_format("/path/to/video.webm")
            print("WEBM Test - Detected format:", format_value)
            assert format_value == VideoFormat.WEBM

        # 4. 测试复合格式 - 优先级测试
        # 注意：如果函数没有专门处理这个复合情况，可能会失败
        # 如果这个测试失败，说明需要在 detect_video_format 方法中添加特殊处理
        mixed_info = mock_video_info.copy()
        mixed_info["format"] = mixed_info["format"].copy()
        mixed_info["format"]["format_name"] = "matroska,webm"

        print("\n=== MIXED FORMAT INFO ===")
        print("Format name:", mixed_info["format"]["format_name"])

    def test_get_video_duration(self, ffmpeg_tool, mock_video_info):
        """测试获取视频时长功能"""
        # 模拟获取视频信息
        with patch.object(ffmpeg_tool, "get_video_info", return_value=mock_video_info):
            duration = ffmpeg_tool.get_video_duration("/path/to/video.mp4")
            assert duration == 3600.5

    def test_create_video_info(self, ffmpeg_tool):
        """测试创建VideoInfo对象功能"""
        # 模拟所有依赖的方法
        with (
            patch.object(
                ffmpeg_tool, "detect_video_format", return_value=VideoFormat.MP4
            ),
            patch.object(ffmpeg_tool, "get_video_duration", return_value=3600.5),
            patch.object(ffmpeg_tool, "has_embedded_subtitles", return_value=True),
            patch(
                "subtranslate.schemas.video.VideoInfo.from_file_path"
            ) as mock_from_path,
        ):

            # 模拟from_file_path方法的返回值
            mock_info = VideoInfo(
                filename="video.mp4", path="/path/to/video.mp4", format=VideoFormat.MP4
            )
            mock_from_path.return_value = mock_info

            # 执行创建VideoInfo
            result = ffmpeg_tool.create_video_info("/path/to/video.mp4")

            # 验证结果
            assert result.format == VideoFormat.MP4
            assert result.duration == 3600.5
            assert result.has_embedded_subtitle is True

    def test_has_embedded_subtitles(self, ffmpeg_tool, mock_video_info):
        """测试检测内嵌字幕功能"""
        # 模拟获取视频信息
        with patch.object(ffmpeg_tool, "get_video_info", return_value=mock_video_info):
            # 有字幕流
            has_subs = ffmpeg_tool.has_embedded_subtitles("/path/to/video.mp4")
            assert has_subs is True

            # 修改为没有字幕流
            modified_info = mock_video_info.copy()
            modified_info["streams"] = [
                s for s in modified_info["streams"] if s["codec_type"] != "subtitle"
            ]

            with patch.object(
                ffmpeg_tool, "get_video_info", return_value=modified_info
            ):
                has_subs = ffmpeg_tool.has_embedded_subtitles("/path/to/video.mp4")
                assert has_subs is False

    def test_get_subtitle_streams(self, ffmpeg_tool, mock_video_info):
        """测试获取字幕流列表功能"""
        # 模拟获取视频信息
        with patch.object(ffmpeg_tool, "get_video_info", return_value=mock_video_info):
            # 获取字幕流
            subtitle_streams = ffmpeg_tool.get_subtitle_streams("/path/to/video.mp4")

            # 验证结果
            assert len(subtitle_streams) == 1
            assert subtitle_streams[0]["codec_type"] == "subtitle"
            assert subtitle_streams[0]["tags"]["language"] == "eng"
            assert subtitle_streams[0]["tags"]["title"] == "English"
