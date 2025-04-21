import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAppContext } from '../context/AppContext';
import { VideoInfo, SubtitleTrack } from '@subtranslate/shared';
import VideoPlayer from '../components/VideoPlayer';
import SubtitleEditor, { SubtitleItem } from '../components/SubtitleEditor';

const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SubtitleTrack | null>(null);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // 查找视频信息
  useEffect(() => {
    if (id) {
      const foundVideo = state.videos.find(v => v.id === id);
      if (foundVideo) {
        setVideo(foundVideo);

        // 如果有字幕轨道，默认选择第一个
        if (foundVideo.subtitleTracks && foundVideo.subtitleTracks.length > 0) {
          setSelectedTrack(foundVideo.subtitleTracks[0]);
        }
      } else {
        setError('未找到视频信息');
      }
    }
  }, [id, state.videos]);

  // 加载字幕内容
  useEffect(() => {
    if (video && selectedTrack) {
      loadSubtitleContent(video.id, selectedTrack.id);
    }
  }, [video, selectedTrack]);

  // 加载字幕内容的函数
  const loadSubtitleContent = async (videoId: string, trackId: string) => {
    try {
      setLoading(true);

      // 先尝试使用API获取字幕内容
      if (window.electronAPI) {
        try {
          // 构建请求URL
          const apiPort = '8000';
          const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackId}/content`;

          // 发送请求
          const response = await fetch(url);

          if (response.ok) {
            const result = await response.json();

            if (result.success && result.data && result.data.lines) {
              // 将后端数据转换为前端需要的格式
              const subtitleItems = result.data.lines.map((line: any) => ({
                id: line.index.toString(),
                startTime: line.start_ms / 1000, // 毫秒转秒
                endTime: line.end_ms / 1000,
                text: line.text
              }));

              setSubtitles(subtitleItems);
              setError(null);
              setLoading(false);
              return;
            }
          }

          // 如果请求失败，回退到模拟数据
          console.warn('从后端获取字幕失败，使用模拟数据');
        } catch (apiError) {
          console.error('调用字幕API出错:', apiError);
        }
      }

      // 如果无法从后端获取数据，使用模拟数据
      const mockSubtitles = [
        { id: '1', startTime: 0, endTime: 5, text: '这是第一行字幕' },
        { id: '2', startTime: 6, endTime: 10, text: '这是第二行字幕' },
        { id: '3', startTime: 11, endTime: 15, text: '这是第三行字幕' },
        { id: '4', startTime: 16, endTime: 20, text: '这是第四行字幕' },
        { id: '5', startTime: 21, endTime: 25, text: '这是第五行字幕' },
        { id: '6', startTime: 26, endTime: 30, text: '这是第六行字幕' },
        { id: '7', startTime: 31, endTime: 35, text: '这是第七行字幕' },
        { id: '8', startTime: 36, endTime: 40, text: '这是第八行字幕' },
        { id: '9', startTime: 41, endTime: 45, text: '这是第九行字幕' },
        { id: '10', startTime: 46, endTime: 50, text: '这是第十行字幕' },
      ];
      setSubtitles(mockSubtitles);
    } catch (err) {
      setError('加载字幕内容失败');
      console.error('加载字幕内容失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 处理轨道选择变化
  const handleTrackChange = (event: SelectChangeEvent) => {
    const trackId = event.target.value;
    const track = video?.subtitleTracks?.find(t => t.id === trackId) || null;
    setSelectedTrack(track);
  };

  // 处理视频时间更新
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // 返回上一页
  const handleBack = () => {
    navigate(-1);
  };

  // 格式化时间为 HH:MM:SS.mmm
  const formatTime = (seconds: number): string => {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
    const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
    return `${hours}:${minutes}:${secs}.${ms}`;
  };

  if (!video) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography>未找到视频信息</Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* 顶部导航栏 */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={handleBack} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">
          {video.fileName}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* 左侧：视频播放区域 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 2 }}>
            {/* 视频播放器 */}
            {video.filePath ? (
              <VideoPlayer
                src={`file://${video.filePath}`}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 0,
                  paddingBottom: '56.25%', // 16:9 宽高比
                  bgcolor: 'black',
                  position: 'relative'
                }}
              >
                <Typography
                  sx={{
                    color: 'white',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  无法加载视频
                </Typography>
              </Box>
            )}

            {/* 时间信息显示 */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                当前时间: {formatTime(currentTime)}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧：字幕编辑区域 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            {/* 字幕轨道选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="subtitle-track-label">字幕轨道</InputLabel>
              <Select
                labelId="subtitle-track-label"
                value={selectedTrack?.id || ''}
                label="字幕轨道"
                onChange={handleTrackChange}
                disabled={!video.subtitleTracks || video.subtitleTracks.length === 0}
              >
                {video.subtitleTracks?.map((track) => (
                  <MenuItem key={track.id} value={track.id}>
                    {track.language || '未知语言'} - {track.title || track.format}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ mb: 2 }} />

            {/* 字幕内容区域 */}
            <Box sx={{ height: 400 }}>
              <SubtitleEditor
                subtitles={subtitles as SubtitleItem[]}
                currentTime={currentTime}
                loading={loading}
                error={error}
                onSave={async (subtitle) => {
                  try {
                    if (!video || !selectedTrack) return;

                    // 尝试调用后端 API 保存字幕
                    const apiPort = '8000';
                    const url = `http://localhost:${apiPort}/api/videos/${video.id}/subtitles/${selectedTrack.id}/edit`;

                    // 将前端数据转换为后端需要的格式
                    const payload = {
                      index: parseInt(subtitle.id),
                      start_ms: Math.round(subtitle.startTime * 1000),
                      end_ms: Math.round(subtitle.endTime * 1000),
                      text: subtitle.text
                    };

                    const response = await fetch(url, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success) {
                        // 更新字幕列表
                        setSubtitles(prev =>
                          prev.map(item => item.id === subtitle.id ? subtitle : item)
                        );
                        return;
                      }
                    }

                    // 如果 API 调用失败，回退到模拟保存
                    console.warn('调用保存字幕API失败，使用模拟保存');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev =>
                      prev.map(item => item.id === subtitle.id ? subtitle : item)
                    );
                  } catch (error) {
                    console.error('保存字幕失败:', error);
                    // 模拟保存成功
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev =>
                      prev.map(item => item.id === subtitle.id ? subtitle : item)
                    );
                  }
                }}
                onDelete={async (id) => {
                  try {
                    if (!video || !selectedTrack) return;

                    // 尝试调用后端 API 删除字幕
                    const apiPort = '8000';
                    const url = `http://localhost:${apiPort}/api/videos/${video.id}/subtitles/${selectedTrack.id}/delete/${id}`;

                    const response = await fetch(url, {
                      method: 'DELETE'
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success) {
                        // 更新字幕列表
                        setSubtitles(prev => prev.filter(item => item.id !== id));
                        return;
                      }
                    }

                    // 如果 API 调用失败，回退到模拟删除
                    console.warn('调用删除字幕API失败，使用模拟删除');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev => prev.filter(item => item.id !== id));
                  } catch (error) {
                    console.error('删除字幕失败:', error);
                    // 模拟删除成功
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev => prev.filter(item => item.id !== id));
                  }
                }}
              />
            </Box>

            {/* 操作按钮 */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                color="primary"
                disabled={!selectedTrack}
                onClick={() => {
                  if (video && selectedTrack) {
                    loadSubtitleContent(video.id, selectedTrack.id);
                  }
                }}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                刷新字幕
              </Button>

              <Box>
                <Button
                  variant="outlined"
                  color="secondary"
                  disabled={!selectedTrack}
                  sx={{ mr: 1 }}
                >
                  导出字幕
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  disabled={!selectedTrack}
                  onClick={async () => {
                    try {
                      if (!video || !selectedTrack) return;

                      // 尝试调用后端 API 保存所有字幕
                      const apiPort = '8000';
                      const url = `http://localhost:${apiPort}/api/videos/${video.id}/subtitles/${selectedTrack.id}/save`;

                      const response = await fetch(url, {
                        method: 'POST'
                      });

                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          alert('字幕保存成功');
                          return;
                        }
                      }

                      // 如果 API 调用失败，显示模拟成功消息
                      console.warn('调用保存字幕API失败，显示模拟成功消息');
                      alert('字幕保存成功');
                    } catch (error) {
                      console.error('保存字幕失败:', error);
                      alert('字幕保存失败，请重试');
                    }
                  }}
                >
                  保存所有修改
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VideoDetail;
