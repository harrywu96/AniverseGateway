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
  Chip,
  TextField,
  Switch,
  FormControlLabel
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
import { UnifiedSubtitleItem, SubtitleStyle } from '@subtranslate/shared';
import { timeUtils } from '../utils/timeUtils';
import { subtitleDataUtils } from '../utils/subtitleDataUtils';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  autoPlay?: boolean;
  muted?: boolean;
  poster?: string;
  className?: string;
  showSubtitles?: boolean;
  onSubtitleToggle?: () => void;
  // 新增字幕相关属性
  subtitles?: UnifiedSubtitleItem[];
  subtitleStyle?: SubtitleStyle;
  onSubtitleClick?: (subtitle: UnifiedSubtitleItem) => void;
  onSubtitleEdit?: (subtitle: UnifiedSubtitleItem) => void;
  showMultiTrack?: boolean;
  onMultiTrackToggle?: () => void;
  videoId?: string; // 用于持久化存储
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  onTimeUpdate,
  autoPlay = false,
  muted = false,
  poster,
  className,
  showSubtitles = false,
  onSubtitleToggle,
  subtitles = [],
  subtitleStyle,
  onSubtitleClick,
  onSubtitleEdit,
  showMultiTrack = false,
  onMultiTrackToggle,
  videoId
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

  // 字幕相关状态
  const [currentSubtitles, setCurrentSubtitles] = useState<UnifiedSubtitleItem[]>([]);
  const [editingSubtitle, setEditingSubtitle] = useState<UnifiedSubtitleItem | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editedSubtitles, setEditedSubtitles] = useState<Map<string, UnifiedSubtitleItem>>(new Map());

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

  // 字幕相关工具函数
  // 根据当前时间获取活跃字幕
  const getCurrentSubtitles = useCallback((time: number): UnifiedSubtitleItem[] => {
    if (!subtitles || subtitles.length === 0) return [];

    return subtitles.filter(subtitle =>
      time >= subtitle.startTime && time <= subtitle.endTime
    );
  }, [subtitles]);

  // 保存编辑的字幕到本地存储
  const saveEditedSubtitle = useCallback((subtitle: UnifiedSubtitleItem) => {
    if (!videoId) return;

    try {
      // 使用函数式更新避免依赖editedSubtitles
      setEditedSubtitles(prevEditedSubtitles => {
        const newEditedSubtitles = new Map(prevEditedSubtitles);
        newEditedSubtitles.set(subtitle.id, { ...subtitle, edited: true });
        return newEditedSubtitles;
      });

      // 持久化到localStorage
      const storageKey = `edited_subtitles_${videoId}`;
      const existingData = localStorage.getItem(storageKey);
      const editedData = existingData ? JSON.parse(existingData) : {};
      editedData[subtitle.id] = subtitle;
      localStorage.setItem(storageKey, JSON.stringify(editedData));

      console.log('字幕编辑已保存:', subtitle.id);
    } catch (error) {
      console.error('保存字幕编辑失败:', error);
    }
  }, [videoId]);

  // 加载已编辑的字幕
  const loadEditedSubtitles = useCallback(() => {
    if (!videoId) return;

    try {
      const storageKey = `edited_subtitles_${videoId}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const editedData = JSON.parse(savedData);
        const editedMap = new Map();
        Object.entries(editedData).forEach(([id, subtitle]) => {
          editedMap.set(id, subtitle as UnifiedSubtitleItem);
        });
        setEditedSubtitles(editedMap);
        console.log('已加载编辑的字幕:', editedMap.size, '条');
      }
    } catch (error) {
      console.error('加载字幕编辑失败:', error);
    }
  }, [videoId]);

  // 获取合并后的字幕（原始+编辑）
  const getMergedSubtitles = useCallback((): UnifiedSubtitleItem[] => {
    if (!subtitles) return [];

    return subtitles.map(subtitle => {
      const edited = editedSubtitles.get(subtitle.id);
      return edited || subtitle;
    });
  }, [subtitles, editedSubtitles]);

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

      // 更新当前活跃字幕
      if (showSubtitles && subtitles.length > 0) {
        const activeSubtitles = subtitles.filter(subtitle =>
          time >= subtitle.startTime && time <= subtitle.endTime
        );
        setCurrentSubtitles(activeSubtitles);
      } else {
        setCurrentSubtitles([]);
      }
    }, 100),
    [onTimeUpdate, showSubtitles, subtitles]
  );

  // 加载已编辑的字幕
  useEffect(() => {
    loadEditedSubtitles();
  }, [loadEditedSubtitles]);

  // 当字幕显示状态变化时，立即更新当前字幕
  useEffect(() => {
    if (!showSubtitles) {
      setCurrentSubtitles([]);
    } else if (subtitles.length > 0) {
      // 只在字幕显示状态改变时更新，时间变化由throttledTimeUpdate处理
      const activeSubtitles = subtitles.filter(subtitle =>
        currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
      );
      setCurrentSubtitles(activeSubtitles);
    }
  }, [showSubtitles]); // 只依赖showSubtitles

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
    // 只在拖动时更新状态，不更新视频时间
    setCurrentTime(seekTime);
  }, []);

  // 开始拖动
  const handleSeekStart = useCallback(() => {
    setSeeking(true);
  }, []);

  // 结束拖动
  const handleSeekEnd = useCallback((_event: Event | React.SyntheticEvent, value: number | number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const seekTime = typeof value === 'number' ? value : value[0];
    // 拖动结束时才更新视频时间
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
    setSeeking(false);

    if (onTimeUpdate) {
      onTimeUpdate(seekTime);
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

  // 字幕编辑处理函数
  // 处理字幕点击 - 区分翻译前后的行为
  const handleSubtitleClick = useCallback((subtitle: UnifiedSubtitleItem, isTranslated: boolean = false) => {
    if (!isTranslated) {
      // 翻译前的字幕：跳转到对应视频帧
      const video = videoRef.current;
      if (video) {
        video.currentTime = subtitle.startTime;
        setCurrentTime(subtitle.startTime);
        onTimeUpdate?.(subtitle.startTime);
      }
      // 触发外部回调
      onSubtitleClick?.(subtitle);
      return;
    }

    // 翻译后的字幕：触发编辑
    if (editingSubtitle && editingSubtitle.id !== subtitle.id) {
      // 如果正在编辑其他字幕，先保存
      handleSubtitleSave();
    }

    setEditingSubtitle(subtitle);
    const mergedSubtitles = getMergedSubtitles();
    const currentSubtitle = mergedSubtitles.find(s => s.id === subtitle.id) || subtitle;
    setEditingText(currentSubtitle.translatedText || '');

    // 触发外部回调
    onSubtitleClick?.(subtitle);
  }, [editingSubtitle, getMergedSubtitles, onSubtitleClick, onTimeUpdate]);

  // 保存字幕编辑
  const handleSubtitleSave = useCallback(() => {
    if (!editingSubtitle) return;

    const updatedSubtitle = { ...editingSubtitle };
    if (showMultiTrack) {
      updatedSubtitle.translatedText = editingText;
    } else {
      updatedSubtitle.originalText = editingText;
    }

    saveEditedSubtitle(updatedSubtitle);
    onSubtitleEdit?.(updatedSubtitle);

    setEditingSubtitle(null);
    setEditingText('');
  }, [editingSubtitle, editingText, showMultiTrack, saveEditedSubtitle, onSubtitleEdit]);

  // 取消编辑
  const handleSubtitleCancel = useCallback(() => {
    setEditingSubtitle(null);
    setEditingText('');
  }, []);

  // 处理文本输入
  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingText(event.target.value);
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubtitleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleSubtitleCancel();
    }
  }, [handleSubtitleSave, handleSubtitleCancel]);

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

      {/* 字幕覆盖层 */}
      {showSubtitles && currentSubtitles.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '80px', // 在控制栏上方
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            maxWidth: '90%',
            textAlign: 'center',
            pointerEvents: 'auto'
          }}
        >
          {currentSubtitles.map((subtitle) => {
            const mergedSubtitles = getMergedSubtitles();
            const currentSubtitle = mergedSubtitles.find(s => s.id === subtitle.id) || subtitle;
            const isEditing = editingSubtitle?.id === subtitle.id;

            return (
              <Box key={subtitle.id} sx={{ mb: 1 }}>
                {isEditing ? (
                  // 编辑模式
                  <TextField
                    value={editingText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSubtitleSave}
                    autoFocus
                    multiline
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: alpha(theme.palette.background.paper, 0.9),
                        color: theme.palette.text.primary,
                        fontSize: subtitleStyle?.fontSize || '18px',
                        fontFamily: subtitleStyle?.fontFamily || 'inherit',
                        textAlign: 'center',
                        '& fieldset': {
                          borderColor: theme.palette.primary.main,
                        },
                      },
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        padding: '8px 12px',
                      }
                    }}
                  />
                ) : (
                  // 显示模式
                  <Paper
                    sx={{
                      backgroundColor: subtitleStyle?.backgroundColor || alpha('#000', 0.7),
                      color: subtitleStyle?.color || '#fff',
                      fontSize: subtitleStyle?.fontSize || '18px',
                      fontFamily: subtitleStyle?.fontFamily || 'inherit',
                      padding: subtitleStyle?.padding || '8px 16px',
                      borderRadius: subtitleStyle?.borderRadius || '4px',
                      border: subtitleStyle?.border || 'none',
                      textShadow: subtitleStyle?.textShadow || '1px 1px 2px rgba(0,0,0,0.8)',
                      opacity: subtitleStyle?.opacity || 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {showMultiTrack && currentSubtitle.translatedText ? (
                      // 多轨模式：分别处理译文和原文的点击
                      <>
                        {/* 译文 - 点击编辑 */}
                        <Typography
                          variant="body1"
                          onClick={() => handleSubtitleClick(subtitle, true)}
                          sx={{
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            lineHeight: 1.4,
                            margin: 0,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: alpha('#fff', 0.1),
                              borderRadius: '2px',
                              padding: '2px 4px',
                              margin: '-2px -4px',
                            }
                          }}
                        >
                          {currentSubtitle.translatedText}
                        </Typography>

                        {/* 原文 - 点击跳转 */}
                        <Typography
                          variant="body2"
                          onClick={() => handleSubtitleClick(subtitle, false)}
                          sx={{
                            fontSize: '14px',
                            color: alpha(subtitleStyle?.color || '#fff', 0.8),
                            marginTop: '4px',
                            fontStyle: 'italic',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: alpha('#fff', 0.1),
                              borderRadius: '2px',
                              padding: '2px 4px',
                              margin: '-2px -4px',
                            }
                          }}
                        >
                          {currentSubtitle.originalText}
                        </Typography>
                      </>
                    ) : (
                      // 单轨模式：原文点击跳转
                      <Typography
                        variant="body1"
                        onClick={() => handleSubtitleClick(subtitle, false)}
                        sx={{
                          fontSize: 'inherit',
                          fontFamily: 'inherit',
                          color: 'inherit',
                          lineHeight: 1.4,
                          margin: 0,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: alpha('#fff', 0.1),
                            borderRadius: '2px',
                            padding: '2px 4px',
                            margin: '-2px -4px',
                          }
                        }}
                      >
                        {currentSubtitle.originalText}
                      </Typography>
                    )}
                  </Paper>
                )}
              </Box>
            );
          })}
        </Box>
      )}

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
            {/* 进度条容器 - 给thumb留出足够空间 */}
            <Box
              sx={{
                position: 'relative',
                height: 20, // 增加高度以容纳thumb
                display: 'flex',
                alignItems: 'center',
                px: 1 // 给thumb在边缘时留出空间
              }}
            >
              {/* 播放进度滑块 */}
              <Slider
                value={currentTime}
                max={duration || 100}
                onChange={handleSeek}
                onChangeStart={handleSeekStart}
                onChangeCommitted={handleSeekEnd}
                sx={{
                  width: '100%',
                  height: 20,
                  padding: '10px 0 !important', // 强制覆盖默认padding
                  color: theme.palette.primary.main,
                  '& .MuiSlider-root': {
                    padding: '10px 0 !important'
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: theme.palette.primary.main,
                    border: 'none',
                    height: 6,
                    borderRadius: 3
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: alpha('#ddd', 0.2),
                    height: 6,
                    borderRadius: 3,
                    opacity: 1
                  },
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    backgroundColor: '#fff',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'width 0.15s ease-in-out, height 0.15s ease-in-out, margin-top 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                    '&::before': {
                      display: 'none' // 移除默认的伪元素
                    },
                    '&:hover': {
                      width: 18, // 16 * 1.125 = 18px
                      height: 18,
                      marginTop: -1, // 向上补偿1px
                      boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`
                    },
                    '&.Mui-active': {
                      width: 18, // 16 * 1.125 = 18px
                      height: 18,
                      marginTop: -1, // 向上补偿1px
                      boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 0 14px ${alpha(theme.palette.primary.main, 0.16)}`
                    },
                    '&.Mui-focusVisible': {
                      boxShadow: `0 2px 4px rgba(0,0,0,0.2), 0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`
                    }
                  }
                }}
              />

              {/* 缓冲进度覆盖层 */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 8, // 与slider轨道对齐
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: alpha('#ddd', 0.4),
                  width: `${buffered}%`,
                  maxWidth: 'calc(100% - 16px)',
                  transition: 'width 0.3s ease',
                  pointerEvents: 'none',
                  zIndex: 1
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

              {/* 多轨字幕切换 */}
              {onMultiTrackToggle && showSubtitles && (
                <Tooltip title={showMultiTrack ? '切换到单轨模式' : '切换到多轨模式'}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showMultiTrack}
                        onChange={onMultiTrackToggle}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: theme.palette.primary.main,
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ddd', fontSize: '12px' }}>
                        多轨
                      </Typography>
                    }
                    sx={{
                      margin: 0,
                      '& .MuiFormControlLabel-label': {
                        marginLeft: '4px'
                      }
                    }}
                  />
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
