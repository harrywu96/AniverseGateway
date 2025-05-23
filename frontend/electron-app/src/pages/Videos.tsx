import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Grid,
  Container,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
  Slide,
  Card,
  CardContent,
  useTheme,
  alpha,
  Tooltip,
  IconButton,
  Fab,
  Badge
} from '@mui/material';
import {
  Upload as UploadIcon,
  Search as SearchIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  PlayCircle as PlayCircleIcon,
  Folder as FolderIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { VideoInfo } from '@subtranslate/shared';
import VideoCard from '../components/ui/VideoCard';
import VideoSkeleton from '../components/ui/VideoSkeleton';
import ErrorSnackbar from '../components/ErrorSnackbar';

// 视图模式类型
type ViewMode = 'grid' | 'list';

// 排序选项类型
type SortOption = 'name' | 'date' | 'duration' | 'status';

// 筛选选项类型
interface FilterOptions {
  hasSubtitles: boolean | null;
  format: string;
  status: string;
}

const Videos: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { state, addVideo, selectVideo } = useAppContext();
  const { videos, selectedVideo } = state;

  // 界面状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FilterOptions>({
    hasSubtitles: null,
    format: '',
    status: ''
  });

  // Faster Whisper 相关状态
  const [whisperDialogOpen, setWhisperDialogOpen] = useState(false);
  const [processingVideo, setProcessingVideo] = useState<string | null>(null);

  // 检查后端视频
  const checkBackendVideos = useCallback(async () => {
    try {
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/videos`);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('后端存储的视频列表:', result);

      if (result.success) {
        setError(`后端存储的视频数量: ${result.data.length}`);
      } else {
        setError(`获取视频列表失败: ${result.message}`);
      }
    } catch (error) {
      console.error('检查后端视频列表错误:', error);
      setError(`检查后端视频列表错误: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  // 导入视频
  const handleImportVideo = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API不可用');
      }

      setLoading(true);
      const filePath = await window.electronAPI.selectVideo();
      
      if (filePath) {
        const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
        const tempVideo: VideoInfo = {
          id: Date.now().toString(),
          fileName: fileName,
          filePath: filePath,
          format: '',
          duration: 0,
          hasEmbeddedSubtitles: false,
          hasExternalSubtitles: false
        };

        console.log('正在将视频发送到后端进行解析:', filePath);
        const response = await window.electronAPI.uploadVideo(filePath);

        if (response.success && response.data) {
          console.log('视频解析成功:', response.data);
          const videoData = response.data;

          const processedVideo: VideoInfo = {
            id: videoData.id,
            fileName: videoData.filename || tempVideo.fileName,
            filePath: videoData.path || tempVideo.filePath,
            format: videoData.format || '',
            duration: videoData.duration || 0,
            hasEmbeddedSubtitles: videoData.has_embedded_subtitle || false,
            hasExternalSubtitles: videoData.external_subtitles?.length > 0 || false,
            subtitleTracks: videoData.subtitle_tracks?.map((track: any) => ({
              id: track.index.toString(),
              language: track.language || 'unknown',
              title: track.title || '',
              format: track.codec || 'unknown',
              isExternal: false,
              backendTrackId: track.id,
              backendIndex: track.index
            })) || []
          };

          selectVideo(processedVideo);
          addVideo(processedVideo);
        } else {
          console.warn('视频解析失败，使用基本信息:', response.error || response.message);
          selectVideo(tempVideo);
          addVideo(tempVideo);
          setError('视频解析部分失败，只显示基本信息');
        }
      }
    } catch (error) {
      console.error('导入视频错误:', error);
      setError(`导入视频失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [addVideo, selectVideo]);

  // 筛选和排序视频
  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(video =>
        video.fileName.toLowerCase().includes(query) ||
        video.format.toLowerCase().includes(query)
      );
    }

    // 高级筛选
    if (filters.hasSubtitles !== null) {
      result = result.filter(video => 
        filters.hasSubtitles 
          ? (video.hasEmbeddedSubtitles || video.hasExternalSubtitles)
          : (!video.hasEmbeddedSubtitles && !video.hasExternalSubtitles)
      );
    }

    if (filters.format) {
      result = result.filter(video => video.format === filters.format);
    }

    // 排序
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'date':
          comparison = parseInt(a.id) - parseInt(b.id); // 简单的时间戳比较
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'status':
          const aHasSubtitles = a.hasEmbeddedSubtitles || a.hasExternalSubtitles;
          const bHasSubtitles = b.hasEmbeddedSubtitles || b.hasExternalSubtitles;
          comparison = Number(aHasSubtitles) - Number(bHasSubtitles);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [videos, searchQuery, filters, sortBy, sortOrder]);

  // 获取可用格式
  const availableFormats = useMemo(() => {
    const formats = new Set(videos.map(v => v.format).filter(Boolean));
    return Array.from(formats);
  }, [videos]);

  // 统计信息
  const stats = useMemo(() => {
    const totalVideos = videos.length;
    const withSubtitles = videos.filter(v => v.hasEmbeddedSubtitles || v.hasExternalSubtitles).length;
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    return {
      totalVideos,
      withSubtitles,
      withoutSubtitles: totalVideos - withSubtitles,
      totalDuration,
      averageDuration: totalVideos > 0 ? totalDuration / totalVideos : 0
    };
  }, [videos]);

  // 处理视频操作
  const handleVideoPlay = useCallback((video: VideoInfo) => {
    navigate(`/videos/${video.id}`);
  }, [navigate]);

  const handleVideoEdit = useCallback((video: VideoInfo) => {
    navigate(`/videos/${video.id}`);
  }, [navigate]);

  const handleVideoTranslate = useCallback((video: VideoInfo) => {
    navigate(`/videos/${video.id}/translate`);
  }, [navigate]);

  const handleExtractSubtitles = useCallback((video: VideoInfo) => {
    setProcessingVideo(video.id);
    // 这里可以添加字幕提取逻辑
    setWhisperDialogOpen(true);
  }, []);

  // 格式化时长
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题和统计 */}
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1
                }}
              >
                视频管理
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                管理和处理您的视频内容
              </Typography>
              
              {/* 统计卡片 */}
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FolderIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="h6" component="div">
                          {stats.totalVideos}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          总视频数
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PlayCircleIcon color="success" fontSize="small" />
                      <Box>
                        <Typography variant="h6" component="div">
                          {stats.withSubtitles}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          有字幕
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ minWidth: 120 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <AnalyticsIcon color="info" fontSize="small" />
                      <Box>
                        <Typography variant="h6" component="div">
                          {formatDuration(stats.totalDuration)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          总时长
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>

            {/* 主要操作按钮 */}
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={checkBackendVideos}
                disabled={loading}
              >
                检查后端
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<UploadIcon />}
                onClick={handleImportVideo}
                disabled={loading}
                sx={{ 
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  boxShadow: theme.shadows[4],
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8]
                  }
                }}
              >
                导入视频
              </Button>
            </Stack>
          </Box>
        </Box>
      </Slide>

      {/* 搜索和筛选工具栏 */}
      <Fade in={true} timeout={500}>
        <Card 
          variant="outlined" 
          sx={{ 
            mb: 3, 
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            background: alpha(theme.palette.primary.main, 0.02)
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              {/* 搜索框 */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="搜索视频..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3
                    }
                  }}
                />
              </Grid>

              {/* 视图切换 */}
              <Grid item xs={12} md={2}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, value) => value && setViewMode(value)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="grid" aria-label="网格视图">
                    <Tooltip title="网格视图">
                      <ViewModuleIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="list" aria-label="列表视图">
                    <Tooltip title="列表视图">
                      <ViewListIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {/* 排序 */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>排序方式</InputLabel>
                  <Select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [sort, order] = e.target.value.split('-');
                      setSortBy(sort as SortOption);
                      setSortOrder(order as 'asc' | 'desc');
                    }}
                    label="排序方式"
                  >
                    <MenuItem value="date-desc">最新添加</MenuItem>
                    <MenuItem value="date-asc">最早添加</MenuItem>
                    <MenuItem value="name-asc">名称 A-Z</MenuItem>
                    <MenuItem value="name-desc">名称 Z-A</MenuItem>
                    <MenuItem value="duration-desc">时长最长</MenuItem>
                    <MenuItem value="duration-asc">时长最短</MenuItem>
                    <MenuItem value="status-desc">有字幕优先</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* 筛选 */}
              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label="全部"
                    variant={filters.hasSubtitles === null ? "filled" : "outlined"}
                    onClick={() => setFilters(prev => ({ ...prev, hasSubtitles: null }))}
                    color="default"
                    size="small"
                  />
                  <Chip
                    label="有字幕"
                    variant={filters.hasSubtitles === true ? "filled" : "outlined"}
                    onClick={() => setFilters(prev => ({ ...prev, hasSubtitles: true }))}
                    color="success"
                    size="small"
                  />
                  <Chip
                    label="无字幕"
                    variant={filters.hasSubtitles === false ? "filled" : "outlined"}
                    onClick={() => setFilters(prev => ({ ...prev, hasSubtitles: false }))}
                    color="warning"
                    size="small"
                  />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Fade>

      {/* 视频列表内容 */}
      <Box sx={{ minHeight: 400 }}>
        {loading ? (
          <Grid container spacing={3}>
            <VideoSkeleton variant={viewMode === 'grid' ? 'standard' : 'compact'} count={6} />
          </Grid>
        ) : videos.length === 0 ? (
          <Fade in={true}>
            <Card
              sx={{
                p: 8,
                textAlign: 'center',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                borderRadius: 4
              }}
            >
              <Box sx={{ mb: 3 }}>
                <FolderIcon sx={{ fontSize: 64, color: theme.palette.grey[400] }} />
              </Box>
              <Typography variant="h5" color="text.secondary" gutterBottom>
                暂无视频内容
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                点击"导入视频"按钮添加您的第一个视频，开始管理和处理您的视频内容
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<UploadIcon />}
                onClick={handleImportVideo}
                disabled={loading}
                sx={{ borderRadius: 3 }}
              >
                导入视频
              </Button>
            </Card>
          </Fade>
        ) : (
          <Fade in={true} timeout={800}>
            <Grid 
              container 
              spacing={viewMode === 'grid' ? 3 : 2}
              sx={{ mb: 4 }}
            >
              {filteredAndSortedVideos.map((video, index) => (
                <Grid 
                  item 
                  xs={12} 
                  sm={viewMode === 'grid' ? 6 : 12} 
                  md={viewMode === 'grid' ? 4 : 12} 
                  lg={viewMode === 'grid' ? 3 : 12}
                  key={video.id}
                >
                  <Slide 
                    direction="up" 
                    in={true} 
                    timeout={200 + index * 100}
                    mountOnEnter 
                    unmountOnExit
                  >
                    <Box>
                      <VideoCard
                        video={video}
                        variant={viewMode === 'grid' ? 'standard' : 'compact'}
                        selected={selectedVideo?.id === video.id}
                        loading={processingVideo === video.id}
                        onPlay={() => handleVideoPlay(video)}
                        onEdit={() => handleVideoEdit(video)}
                        onTranslate={() => handleVideoTranslate(video)}
                        onExtractSubtitles={() => handleExtractSubtitles(video)}
                      />
                    </Box>
                  </Slide>
                </Grid>
              ))}
            </Grid>
          </Fade>
        )}
      </Box>

      {/* 浮动操作按钮 */}
      {videos.length > 0 && (
        <Fade in={!loading}>
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000,
              boxShadow: theme.shadows[6],
              '&:hover': {
                transform: 'scale(1.1)',
                boxShadow: theme.shadows[12]
              }
            }}
            onClick={handleImportVideo}
          >
            <AddIcon />
          </Fab>
        </Fade>
      )}

      {/* 错误提示 */}
      <ErrorSnackbar
        message={error}
        severity="info"
        onClose={() => setError(null)}
      />
    </Container>
  );
};

export default Videos;