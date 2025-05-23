import React, { useState, useRef, memo } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Chip,
  Box,
  LinearProgress,
  Tooltip,
  Fade,
  Zoom,
  alpha,
  useTheme
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Subtitles as SubtitlesIcon,
  Translate as TranslateIcon,
  MoreVert as MoreVertIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { VideoInfo } from '@subtranslate/shared';

interface VideoCardProps {
  video: VideoInfo;
  onPlay?: () => void;
  onEdit?: () => void;
  onTranslate?: () => void;
  onExtractSubtitles?: () => void;
  loading?: boolean;
  selected?: boolean;
  variant?: 'standard' | 'compact' | 'featured';
}

// 获取视频状态信息
const getVideoStatus = (video: VideoInfo) => {
  if (video.hasEmbeddedSubtitles || video.hasExternalSubtitles) {
    return { 
      label: '已有字幕', 
      color: 'success' as const, 
      icon: <CheckIcon fontSize="small" /> 
    };
  }
  if (video.subtitleTracks && video.subtitleTracks.length > 0) {
    return { 
      label: '处理中', 
      color: 'warning' as const, 
      icon: <ScheduleIcon fontSize="small" /> 
    };
  }
  return { 
    label: '待处理', 
    color: 'default' as const, 
    icon: <ErrorIcon fontSize="small" /> 
  };
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化时长
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const VideoCard: React.FC<VideoCardProps> = memo(({
  video,
  onPlay,
  onEdit,
  onTranslate,
  onExtractSubtitles,
  loading = false,
  selected = false,
  variant = 'standard'
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = getVideoStatus(video);

  // 处理播放/暂停
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
    onPlay?.();
  };

  // 处理卡片点击
  const handleCardClick = () => {
    onEdit?.();
  };

  // 鼠标悬停处理
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPlaying(false);
  };

  // 根据变体返回不同的高度和布局
  const getCardHeight = () => {
    switch (variant) {
      case 'compact': return 200;
      case 'featured': return 320;
      default: return 280;
    }
  };

  const getMediaHeight = () => {
    switch (variant) {
      case 'compact': return 120;
      case 'featured': return 200;
      default: return 160;
    }
  };

  return (
    <Card
      sx={{
        height: getCardHeight(),
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        border: selected ? `2px solid ${theme.palette.primary.main}` : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? theme.shadows[8]
          : theme.shadows[2],
        '&:hover': {
          '& .video-overlay': {
            opacity: 1,
          },
          '& .video-thumbnail': {
            transform: 'scale(1.05)',
          }
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* 视频缩略图区域 */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          className="video-thumbnail"
          component="div"
          sx={{
            height: getMediaHeight(),
            backgroundColor: theme.palette.grey[900],
            backgroundImage: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
          }}
        >
          {/* 视频预览 - 未来可以添加真实的缩略图 */}
          <PlayIcon sx={{ fontSize: 48, color: alpha('#fff', 0.7) }} />
          
          {/* 时长标签 */}
          {video.duration > 0 && (
            <Chip
              icon={<TimeIcon fontSize="small" />}
              label={formatDuration(video.duration)}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: alpha('#000', 0.7),
                color: '#fff',
                '& .MuiChip-icon': {
                  color: '#fff'
                }
              }}
            />
          )}

          {/* 状态徽章 */}
          <Chip
            icon={status.icon}
            label={status.label}
            color={status.color}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: alpha(theme.palette[status.color].main, 0.9),
              color: '#fff'
            }}
          />
        </CardMedia>

        {/* 悬停覆盖层 */}
        <Fade in={isHovered}>
          <Box
            className="video-overlay"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: alpha('#000', 0.5),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.3s ease'
            }}
          >
            <Zoom in={isHovered}>
              <IconButton
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.9),
                  color: '#fff',
                  width: 64,
                  height: 64,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                    transform: 'scale(1.1)'
                  }
                }}
                onClick={handlePlayPause}
              >
                {isPlaying ? <PauseIcon fontSize="large" /> : <PlayIcon fontSize="large" />}
              </IconButton>
            </Zoom>
          </Box>
        </Fade>

        {/* 加载进度条 */}
        {loading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
        )}
      </Box>

      {/* 卡片内容 */}
      <CardContent sx={{ flexGrow: 1, p: variant === 'compact' ? 1 : 2 }}>
        <Tooltip title={video.fileName} placement="top">
          <Typography
            variant={variant === 'featured' ? 'h6' : 'subtitle1'}
            component="h3"
            sx={{
              fontWeight: 600,
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2
            }}
          >
            {video.fileName}
          </Typography>
        </Tooltip>

        {variant !== 'compact' && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              格式: {video.format || '未知'}
            </Typography>
            {video.subtitleTracks && video.subtitleTracks.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                字幕轨道: {video.subtitleTracks.length}
              </Typography>
            )}
          </Box>
        )}

        {/* 特色变体的额外信息 */}
        {variant === 'featured' && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {video.hasEmbeddedSubtitles && (
                <Chip 
                  label="内嵌字幕" 
                  size="small" 
                  variant="outlined" 
                  color="primary"
                />
              )}
              {video.hasExternalSubtitles && (
                <Chip 
                  label="外部字幕" 
                  size="small" 
                  variant="outlined" 
                  color="secondary"
                />
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* 操作按钮 */}
      <CardActions 
        sx={{ 
          px: variant === 'compact' ? 1 : 2, 
          py: 1,
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="查看详情">
            <IconButton 
              size="small" 
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              <PlayIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="提取字幕">
            <IconButton 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onExtractSubtitles?.();
              }}
            >
              <SubtitlesIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="翻译字幕">
            <IconButton 
              size="small" 
              color="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onTranslate?.();
              }}
            >
              <TranslateIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <IconButton size="small">
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  );
});

VideoCard.displayName = 'VideoCard';

export default VideoCard; 