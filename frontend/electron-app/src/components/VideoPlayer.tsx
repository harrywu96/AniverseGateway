import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { 
  Box, 
  Slider, 
  IconButton, 
  Typography, 
  Paper, 
  Fade,
  Tooltip,
  useTheme,
  alpha,
  Stack,
  Chip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  VolumeDown as VolumeDownIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  FastRewind as FastRewindIcon,
  FastForward as FastForwardIcon,
  Settings as SettingsIcon,
  ClosedCaption as SubtitlesIcon
} from '@mui/icons-material';
import { throttle } from '../utils/performanceUtils';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  className?: string;
  showSubtitles?: boolean;
  onSubtitleToggle?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  onTimeUpdate,
  autoPlay = false,
  muted = false,
  poster,
  className,
  showSubtitles = false,
  onSubtitleToggle
}) => {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 播放器状态
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);
  const [seeking, setSeeking] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 控制栏显示/隐藏的计时器
  const controlsTimeoutRef = useRef<number>();

  // 重置控制栏隐藏计时器
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playing]);

  // 加载视频元数据
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
      console.log('视频元数据加载成功:', { duration: video.duration });
    };

    const handleLoadStart = () => {
      setLoading(true);
      setError(null);
    };

    const handleError = (e: Event) => {
      console.error('视频加载错误:', e);
      setError(video.error?.message || '视频加载失败');
      setLoading(false);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        setBuffered(bufferedPercent);
      }
    };

    const handleCanPlay = () => {
      setLoading(false);
    };

    const handleWaiting = () => {
      setLoading(true);
    };

    const handleCanPlayThrough = () => {
      setLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('error', handleError);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    // 处理视频路径
    if (src) {
      console.log('加载视频:', src);
      try {
        if (src.startsWith('file://')) {
          let formattedSrc = src;
          if (src.match(/^file:\/\/[A-Za-z]:/)) {
            formattedSrc = src.replace(/^file:\/\/([A-Za-z]:)/, 'file:///$1');
          }
          console.log('格式化后的视频URL:', formattedSrc);
          video.src = formattedSrc;
        } else {
          if (!src.includes('://')) {
            const fileUrl = `file:///${src.replace(/\\/g, '/')}`;
            console.log('转换为URL:', fileUrl);
            video.src = fileUrl;
          } else {
            video.src = src;
          }
        }
      } catch (error) {
        console.error('处理视频URL错误:', error);
        video.src = src;
      }
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('error', handleError);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [src]);

  // 全屏状态监听
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 创建节流版本的时间更新处理函数
  const throttledTimeUpdate = useCallback(
    throttle((time: number) => {
      setCurrentTime(time);
      onTimeUpdate && onTimeUpdate(time);
    }, 100),
    [onTimeUpdate]
  );

  // 监听视频时间更新
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!seeking) {
        throttledTimeUpdate(video.currentTime);
      }
    };

    const handlePlay = () => {
      setPlaying(true);
      resetControlsTimeout();
    };

    const handlePause = () => {
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [seeking, throttledTimeUpdate, resetControlsTimeout]);

  // 鼠标移动处理
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // 播放/暂停切换
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
    } else {
      video.play();
    }
  }, [playing]);

  // 进度条拖动
  const handleSeek = useCallback((_event: Event, newValue: number | number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const seekTime = typeof newValue === 'number' ? newValue : newValue[0];
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, []);

  // 开始拖动
  const handleSeekStart = useCallback(() => {
    setSeeking(true);
  }, []);

  // 结束拖动
  const handleSeekEnd = useCallback(() => {
    setSeeking(false);
    const video = videoRef.current;
    if (video && onTimeUpdate) {
      onTimeUpdate(video.currentTime);
    }
  }, [onTimeUpdate]);

  // 音量调节
  const handleVolumeChange = useCallback((_event: Event, newValue: number | number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = typeof newValue === 'number' ? newValue : newValue[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // 静音切换
  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // 快退
  const handleRewind = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 10);
  }, []);

  // 快进
  const handleFastForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
  }, []);

  // 全屏切换
  const handleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, [isFullscreen]);

  // 格式化时间
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // 获取音量图标
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeOffIcon />;
    if (volume < 0.5) return <VolumeDownIcon />;
    return <VolumeUpIcon />;
  };

  return (
    <Box 
      ref={containerRef}
      className={className}
      sx={{ 
        width: '100%', 
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: 2,
        overflow: 'hidden',
        aspectRatio: '16/9',
        '&:fullscreen': {
          borderRadius: 0,
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (playing && !seeking) {
          setShowControls(false);
        }
      }}
    >
      {/* 视频元素 */}
      <video
        ref={videoRef}
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block',
          objectFit: 'contain'
        }}
        onClick={handlePlayPause}
        autoPlay={autoPlay}
        muted={muted}
        poster={poster}
        playsInline
      />

      {/* 加载指示器 */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ddd',
            zIndex: 2
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.3)',
              borderTop: '3px solid #ddd',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          />
        </Box>
      )}

      {/* 错误显示 */}
      {error && (
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
            color: '#ddd',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 2,
            textAlign: 'center',
            zIndex: 3
          }}
        >
          <Typography variant="body1">
            {error}
          </Typography>
        </Box>
      )}

      {/* 播放按钮覆盖层 */}
      {!playing && !loading && !error && (
        <Fade in={!playing}>
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
              backgroundColor: alpha('#000', 0.3),
              cursor: 'pointer',
              zIndex: 2
            }}
            onClick={handlePlayPause}
          >
            <IconButton
              sx={{
                width: 80,
                height: 80,
                backgroundColor: alpha(theme.palette.primary.main, 0.9),
                color: '#ddd',
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              <PlayIcon sx={{ fontSize: 48 }} />
            </IconButton>
          </Box>
        </Fade>
      )}

      {/* 控制栏 */}
      <Fade in={showControls}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: `linear-gradient(transparent, ${alpha('#000', 0.8)})`,
            padding: 2,
            paddingTop: 4,
            zIndex: 4
          }}
        >
          {/* 进度条区域 */}
          <Box sx={{ mb: 2 }}>
            {/* 缓冲进度背景 */}
            <Box
              sx={{
                position: 'relative',
                height: 6,
                borderRadius: 3,
                backgroundColor: alpha('#ddd', 0.2),
                overflow: 'hidden'
              }}
            >
              {/* 缓冲进度 */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${buffered}%`,
                  backgroundColor: alpha('#ddd', 0.4),
                  transition: 'width 0.3s ease'
                }}
              />
              
              {/* 播放进度滑块 */}
              <Slider
                value={currentTime}
                max={duration || 100}
                onChange={handleSeek}
                onMouseDown={handleSeekStart}
                onMouseUp={handleSeekEnd}
                sx={{
                  position: 'absolute',
                  top: -3,
                  left: 0,
                  right: 0,
                  color: theme.palette.primary.main,
                  height: 6,
                  '& .MuiSlider-track': {
                    backgroundColor: theme.palette.primary.main,
                    border: 'none',
                    height: 6
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'transparent',
                    height: 6
                  },
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    backgroundColor: '#ddd',
                    '&:hover': {
                      boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`
                    },
                    '&.Mui-active': {
                      boxShadow: `0 0 0 14px ${alpha(theme.palette.primary.main, 0.16)}`
                    }
                  }
                }}
              />
            </Box>
          </Box>

          {/* 控制按钮区域 */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* 左侧控制组 */}
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* 播放/暂停 */}
              <Tooltip title={playing ? '暂停' : '播放'}>
                <IconButton 
                  onClick={handlePlayPause}
                  sx={{ color: '#ddd' }}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
              </Tooltip>

              {/* 快退 */}
              <Tooltip title="快退 10 秒">
                <IconButton 
                  onClick={handleRewind}
                  sx={{ color: '#ddd' }}
                >
                  <FastRewindIcon />
                </IconButton>
              </Tooltip>

              {/* 快进 */}
              <Tooltip title="快进 10 秒">
                <IconButton 
                  onClick={handleFastForward}
                  sx={{ color: '#ddd' }}
                >
                  <FastForwardIcon />
                </IconButton>
              </Tooltip>

              {/* 音量控制 */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Tooltip title={isMuted ? '取消静音' : '静音'}>
                  <IconButton 
                    onClick={handleMuteToggle}
                    sx={{ color: '#ddd' }}
                  >
                    {getVolumeIcon()}
                  </IconButton>
                </Tooltip>

                <Slider
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  min={0}
                  max={1}
                  step={0.01}
                  sx={{
                    width: 80,
                    color: '#ddd',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12
                    }
                  }}
                />
              </Stack>

              {/* 时间显示 */}
              <Typography variant="body2" sx={{ color: '#ddd', ml: 2 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Typography>
            </Stack>

            {/* 右侧控制组 */}
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* 字幕切换 */}
              {onSubtitleToggle && (
                <Tooltip title="切换字幕">
                  <IconButton 
                    onClick={onSubtitleToggle}
                    sx={{ 
                      color: showSubtitles ? theme.palette.primary.main : '#ddd'
                    }}
                  >
                    <SubtitlesIcon />
                  </IconButton>
                </Tooltip>
              )}

              {/* 设置 */}
              <Tooltip title="设置">
                <IconButton sx={{ color: '#ddd' }}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>

              {/* 全屏 */}
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                <IconButton 
                  onClick={handleFullscreen}
                  sx={{ color: '#ddd' }}
                >
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      </Fade>
    </Box>
  );
};

export default memo(VideoPlayer);
