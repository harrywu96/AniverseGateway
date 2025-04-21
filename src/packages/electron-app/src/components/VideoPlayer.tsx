import React, { useState, useRef, useEffect } from 'react';
import { Box, Slider, IconButton, Typography, Paper } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onTimeUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(false);

  // 加载视频元数据
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 处理元数据加载
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      console.log('视频元数据加载成功:', { duration: video.duration });
    };

    // 处理加载错误
    const handleError = (e: Event) => {
      console.error('视频加载错误:', e);
      console.error('视频元素错误代码:', video.error?.code);
      console.error('视频元素错误消息:', video.error?.message);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    // 在Electron中加载本地文件需要特殊处理
    if (src) {
      console.log('加载视频:', src);

      // 处理视频路径
      try {
        // 尝试使用标准格式的file://URL
        if (src.startsWith('file://')) {
          // 确保路径格式正确，应该是 file:///C:/path/to/video.mp4
          let formattedSrc = src;

          // 如果是Windows路径但缺少正确的斜杠数量
          if (src.match(/^file:\/\/[A-Za-z]:/)) {
            // 添加缺失的斜杠，应该是 file:///C:/path 而不是 file://C:/path
            formattedSrc = src.replace(/^file:\/\/([A-Za-z]:)/, 'file:///$1');
          }

          console.log('格式化后的视频URL:', formattedSrc);
          video.src = formattedSrc;
        } else {
          // 如果是其他URL或直接是本地路径，尝试转换为URL
          if (!src.includes('://')) {
            // 如果是绝对路径但没有协议前缀，添加file://前缀
            const fileUrl = `file:///${src.replace(/\\/g, '/')}`;
            console.log('转换为URL:', fileUrl);
            video.src = fileUrl;
          } else {
            // 其他URL直接使用
            video.src = src;
          }
        }
      } catch (error) {
        console.error('处理视频URL错误:', error);
        // 出错时直接使用原始路径
        video.src = src;
      }
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  // 监听视频时间更新
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!seeking) {
        setCurrentTime(video.currentTime);
        onTimeUpdate && onTimeUpdate(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [seeking, onTimeUpdate]);

  // 播放/暂停切换
  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
    } else {
      video.play();
    }
    setPlaying(!playing);
  };

  // 进度条拖动
  const handleSeek = (_event: Event, newValue: number | number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const seekTime = typeof newValue === 'number' ? newValue : newValue[0];
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
    onTimeUpdate && onTimeUpdate(seekTime);
  };

  // 开始拖动
  const handleSeekStart = () => {
    setSeeking(true);
  };

  // 结束拖动
  const handleSeekEnd = () => {
    setSeeking(false);
  };

  // 音量调节
  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = typeof newValue === 'number' ? newValue : newValue[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  // 静音切换
  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !muted;
    setMuted(!muted);
  };

  // 全屏
  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    }
  };

  // 格式化时间为 MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* 视频元素 */}
      <Box sx={{ position: 'relative', width: '100%', bgcolor: 'black' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', display: 'block' }}
          onClick={handlePlayPause}
          controls={false}
          preload="metadata"
          playsInline
        />
        {/* 加载错误显示 */}
        {videoRef.current?.error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 2,
              textAlign: 'center'
            }}
          >
            <Typography variant="body1">
              视频加载失败: {videoRef.current.error.message || '未知错误'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 控制栏 */}
      <Paper sx={{ p: 1, mt: 1 }}>
        {/* 进度条 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ mr: 1, minWidth: '40px' }}>
            {formatTime(currentTime)}
          </Typography>
          <Slider
            value={currentTime}
            max={duration || 100}
            onChange={handleSeek}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            aria-label="视频进度"
            size="small"
            sx={{ mx: 1 }}
          />
          <Typography variant="caption" sx={{ ml: 1, minWidth: '40px' }}>
            {formatTime(duration)}
          </Typography>
        </Box>

        {/* 控制按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={handlePlayPause} size="small">
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <IconButton onClick={handleMuteToggle} size="small">
              {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
            <Slider
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="音量"
              min={0}
              max={1}
              step={0.01}
              size="small"
              sx={{ width: 80, mx: 1 }}
            />
          </Box>
          <IconButton onClick={handleFullscreen} size="small">
            <FullscreenIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default VideoPlayer;
