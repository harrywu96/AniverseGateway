import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import {
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Paper,
  Chip,
  Stack,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Alert,
  AlertTitle,
  Fade,
  Slide,
  Zoom,
  Container,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Translate as TranslateIcon,
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Language as LanguageIcon,
  Upload as UploadIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import { useAppContext } from '../context/AppContext';
import { VideoInfo } from '@subtranslate/shared';
import VideoPlayer from '../components/VideoPlayer';
import ErrorSnackbar from '../components/ErrorSnackbar';
import { createModernCardStyles, createModernPaperStyles, createModernFormStyles, createModernAlertStyles, createModernDialogStyles, createModernButtonStyles, createModernContainerStyles, createElegantAreaStyles } from '../utils/modernStyles';

// 翻译步骤枚举
const TRANSLATION_STEPS = [
  { key: 'setup', label: '配置翻译', description: '选择源语言和目标语言' },
  { key: 'process', label: '执行翻译', description: '调用AI模型进行翻译' },
  { key: 'review', label: '预览结果', description: '查看和编辑翻译结果' },
  { key: 'save', label: '保存文件', description: '保存翻译后的字幕文件' }
];

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

// 翻译状态枚举
enum TranslationStatus {
  IDLE = 'idle',
  CONFIGURING = 'configuring',
  TRANSLATING = 'translating',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

interface TranslationProgress {
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
}

interface TranslationResult {
  original: string;
  translated: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

const VideoDetailWithTranslation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { state } = useAppContext();
  
  // 主要状态
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  
  // 翻译配置状态
  const [sourceLanguage, setSourceLanguage] = useState('zh');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [translationModel, setTranslationModel] = useState('gpt-4');
  
  // 翻译执行状态
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>(TranslationStatus.IDLE);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>({
    current: 0,
    total: 0,
    percentage: 0
  });
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  
  // 设置对话框状态
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  
  // 从Redux获取提供商数据
  const providers = useAppSelector(state => state.provider.providers);
  const activeProviders = providers.filter(p => p.is_active && p.is_configured);

  // WebSocket连接引用
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 初始化提供商选择
  useEffect(() => {
    if (activeProviders.length > 0 && !selectedProviderId) {
      const firstProvider = activeProviders[0];
      setSelectedProviderId(firstProvider.id);
      if (firstProvider.models && firstProvider.models.length > 0) {
        setSelectedModelId(firstProvider.models[0].id);
      }
    }
  }, [activeProviders, selectedProviderId]);

  // 加载视频信息
  useEffect(() => {
    const loadVideo = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // 从全局状态查找视频
        const foundVideo = state.videos.find(v => v.id === id);
        if (foundVideo) {
          setVideo(foundVideo);
          
          // 默认选择第一个字幕轨道
          if (foundVideo.subtitleTracks && foundVideo.subtitleTracks.length > 0) {
            setSelectedTrackId(foundVideo.subtitleTracks[0].id);
          }
        } else {
          // 尝试从后端获取
          const apiPort = '8000';
          const response = await fetch(`http://localhost:${apiPort}/api/videos/${id}`);
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const videoData = {
                id: result.data.id,
                fileName: result.data.filename,
                filePath: result.data.path,
                format: result.data.format || '',
                duration: result.data.duration || 0,
                hasEmbeddedSubtitles: result.data.has_embedded_subtitle || false,
                hasExternalSubtitles: result.data.external_subtitles?.length > 0 || false,
                subtitleTracks: (result.data.subtitle_tracks || []).map((track: any) => ({
                  id: track.index.toString(),
                  language: track.language || 'unknown',
                  title: track.title || '',
                  format: track.codec || 'unknown',
                  isExternal: false,
                  backendTrackId: track.id,
                  backendIndex: track.index
                }))
              };
              
              setVideo(videoData);
              if (videoData.subtitleTracks.length > 0) {
                setSelectedTrackId(videoData.subtitleTracks[0].id);
              }
            }
          } else {
            throw new Error('视频未找到');
          }
        }
      } catch (err) {
        console.error('加载视频失败:', err);
        setError(`加载视频失败: ${err instanceof Error ? err.message : '未知错误'}`);
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [id, state.videos]);

  // 可用字幕轨道选项
  const trackOptions = useMemo(() => {
    if (!video?.subtitleTracks) return [];
    return video.subtitleTracks.map(track => ({
      value: track.id,
      label: `${track.language || '未知语言'} - ${track.title || track.format}`,
      track: track
    }));
  }, [video?.subtitleTracks]);

  // 当前字幕轨道
  const selectedTrack = useMemo(() => {
    return video?.subtitleTracks?.find(track => track.id === selectedTrackId) || null;
  }, [video?.subtitleTracks, selectedTrackId]);

  // 当前选中的提供商和模型
  const selectedProvider = useMemo(() => {
    return activeProviders.find(p => p.id === selectedProviderId) || null;
  }, [activeProviders, selectedProviderId]);

  const availableModels = useMemo(() => {
    return selectedProvider?.models || [];
  }, [selectedProvider]);

  const selectedModel = useMemo(() => {
    return availableModels.find(m => m.id === selectedModelId) || null;
  }, [availableModels, selectedModelId]);

  // 翻译配置是否完整
  const isConfigComplete = useMemo(() => {
    return sourceLanguage && targetLanguage && selectedTrackId && selectedProvider && selectedModel;
  }, [sourceLanguage, targetLanguage, selectedTrackId, selectedProvider, selectedModel]);

  // 处理返回
  const handleBack = useCallback(() => {
    navigate(`/videos/${id}`);
  }, [navigate, id]);

  // 处理步骤变更
  const handleStepChange = useCallback((step: number) => {
    if (step <= activeStep + 1) {
      setActiveStep(step);
    }
  }, [activeStep]);

  // 开始翻译
  const startTranslation = useCallback(async () => {
    if (!video || !selectedTrack || !isConfigComplete || !selectedProvider || !selectedModel) {
      setError('配置不完整，无法开始翻译');
      return;
    }

    try {
      setTranslationStatus(TranslationStatus.TRANSLATING);
      setActiveStep(1);
      setError(null);
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 导入新的API函数
      const { translateVideoSubtitle } = await import('../services/api');

      // 构建提供商配置
      const providerConfig = {
        id: selectedProvider.id,
        apiKey: selectedProvider.apiKey,
        apiHost: selectedProvider.apiHost,
      };

      // 调用新的翻译API
      const result = await translateVideoSubtitle({
        video_id: video.id,
        track_index: parseInt(selectedTrack.id),
        source_language: sourceLanguage,
        target_language: targetLanguage,
        style: 'natural', // 可以根据需要调整
        provider_config: providerConfig,
        model_id: selectedModel.id,
        chunk_size: 30,
        context_window: 3,
        context_preservation: true,
        preserve_formatting: true,
      });
      
      if (!result.success) {
        throw new Error(result.message || '翻译请求失败');
      }

      const taskId = result.data.task_id;

      // 建立WebSocket连接监听进度
      const apiPort = '8000';
      const ws = new WebSocket(`ws://localhost:${apiPort}/api/translate/ws/${taskId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('翻译WebSocket连接已建立');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setTranslationProgress({
            current: data.current || 0,
            total: data.total || 0,
            percentage: data.percentage || 0,
            currentItem: data.currentItem,
            estimatedTimeRemaining: data.estimatedTime
          });
        } else if (data.type === 'completed') {
          setTranslationStatus(TranslationStatus.COMPLETED);
          setTranslationResults(data.results || []);
          setActiveStep(2);
          console.log('翻译完成，共', data.results?.length || 0, '条结果');
        } else if (data.type === 'error') {
          setTranslationStatus(TranslationStatus.ERROR);
          setError(`翻译失败: ${data.message || '未知错误'}`);
        }
      };

      ws.onerror = (event) => {
        console.error('翻译WebSocket错误:', event);
        setTranslationStatus(TranslationStatus.ERROR);
        setError('WebSocket连接错误');
      };

      ws.onclose = () => {
        console.log('翻译WebSocket连接已关闭');
        wsRef.current = null;
      };

    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        setTranslationStatus(TranslationStatus.CANCELLED);
      } else {
        setTranslationStatus(TranslationStatus.ERROR);
        setError(`翻译失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }
  }, [video, selectedTrack, isConfigComplete, sourceLanguage, targetLanguage, selectedProvider, selectedModel]);

  // 停止翻译
  const stopTranslation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setTranslationStatus(TranslationStatus.CANCELLED);
  }, []);

  // 保存翻译结果
  const saveTranslation = useCallback(async () => {
    if (!video || !translationResults.length) {
      setError('没有翻译结果可保存');
      return;
    }

    try {
      setLoading(true);
      const apiPort = '8000';
      
      const response = await fetch(`http://localhost:${apiPort}/api/translation/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          results: translationResults,
          targetLanguage,
          fileName: `${video.fileName}_${targetLanguage}`
        })
      });

      if (!response.ok) {
        throw new Error(`保存失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setActiveStep(3);
        setError('翻译文件保存成功！');
      } else {
        throw new Error(result.message || '保存失败');
      }
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [video, translationResults, targetLanguage]);

  // 格式化时间
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }, []);

  // 格式化预计剩余时间
  const formatEstimatedTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}秒`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)}分钟`;
    } else {
      return `${Math.ceil(seconds / 3600)}小时`;
    }
  }, []);

  // 清理连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (loading && !video) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            正在加载视频信息...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!video) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <ErrorIcon sx={{ fontSize: 64, color: theme.palette.error.main, mb: 2 }} />
          <Typography variant="h6" color="error">
            {error || '未找到视频信息'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ mt: 2 }}
          >
            返回视频详情
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 顶部导航 */}
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Tooltip title="返回视频详情">
              <IconButton 
                onClick={handleBack}
                sx={{ 
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }}>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{ 
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                <TranslateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                字幕翻译
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {video.fileName}
              </Typography>
            </Box>
            <Tooltip title="翻译设置">
              <IconButton 
                onClick={() => setSettingsOpen(true)}
                sx={{ 
                  backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.secondary.main, 0.2)
                  }
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Slide>

      <Grid container spacing={3}>
        {/* 左侧：视频播放器 */}
        <Grid item xs={12} lg={6}>
          <Fade in={true} timeout={600}>
            <Card sx={{ mb: 3 }}>
              <VideoPlayer
                src={video.filePath}
                onTimeUpdate={setCurrentTime}
                poster=""
                autoPlay={false}
                muted={false}
              />
            </Card>
          </Fade>

          {/* 翻译结果预览 */}
          {translationResults.length > 0 && (
            <Fade in={true} timeout={800}>
              <Card>
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PreviewIcon color="primary" />
                      <Typography variant="h6">翻译结果预览</Typography>
                      <Chip 
                        label={`${translationResults.length} 条`} 
                        size="small" 
                        color="primary" 
                      />
                    </Stack>
                  }
                />
                <CardContent>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {translationResults.slice(0, 10).map((result, index) => (
                      <Paper 
                        key={index} 
                        variant="outlined" 
                        sx={{ p: 2, mb: 2 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(result.startTime)} → {formatTime(result.endTime)}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ mb: 1, opacity: 0.7 }}>
                            原文: {result.original}
                          </Typography>
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                            译文: {result.translated}
                          </Typography>
                          {result.confidence && (
                            <Chip 
                              label={`可信度: ${Math.round(result.confidence * 100)}%`}
                              size="small"
                              color={result.confidence > 0.8 ? 'success' : result.confidence > 0.6 ? 'warning' : 'error'}
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                      </Paper>
                    ))}
                    {translationResults.length > 10 && (
                      <Typography variant="body2" sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                        还有 {translationResults.length - 10} 条结果未显示...
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          )}
        </Grid>

        {/* 右侧：翻译配置和进度 */}
        <Grid item xs={12} lg={6}>
          <Fade in={true} timeout={1000}>
            <Card
              sx={{
                ...createModernCardStyles(theme, 'primary', 1.2),
                ...createElegantAreaStyles(theme, 'translation-flow'),
                overflow: 'hidden'
              }}
            >
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.info.main, 0.15),
                        color: theme.palette.info.main
                      }}
                    >
                      <LanguageIcon />
                    </Box>
                    <Typography 
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      翻译流程
                    </Typography>
                  </Stack>
                }
                sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)}, ${alpha(theme.palette.info.main, 0.04)})`,
                  borderBottom: `1px solid ${alpha(theme.palette.info.main, 0.15)}`
                }}
              />
              <CardContent sx={{ p: 3 }}>
                <Stepper 
                  activeStep={activeStep} 
                  orientation="vertical"
                  sx={{
                    '& .MuiStepLabel-root': {
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        '& .MuiStepLabel-label': {
                          color: theme.palette.info.main
                        }
                      }
                    },
                    '& .MuiStepConnector-line': {
                      borderColor: alpha(theme.palette.info.main, 0.25)
                    },
                    '& .MuiStepIcon-root': {
                      color: alpha(theme.palette.info.main, 0.4),
                      '&.Mui-active': {
                        color: theme.palette.info.main
                      },
                      '&.Mui-completed': {
                        color: theme.palette.success.main
                      }
                    }
                  }}
                >
                  {TRANSLATION_STEPS.map((step, index) => (
                    <Step key={step.key}>
                      <StepLabel
                        optional={
                          <Typography 
                            variant="caption"
                            sx={{ 
                              color: 'text.secondary',
                              fontStyle: 'italic'
                            }}
                          >
                            {step.description}
                          </Typography>
                        }
                        onClick={() => handleStepChange(index)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            fontWeight: 600,
                            color: activeStep === index ? theme.palette.info.main : 'text.primary'
                          }}
                        >
                          {step.label}
                        </Typography>
                      </StepLabel>
                      <StepContent>
                        <Box
                          sx={{
                            ...createModernContainerStyles(theme, 3, 'info'),
                            p: 2,
                            mb: 2
                          }}
                        >
                          {/* 步骤0：配置翻译 */}
                          {index === 0 && (
                            <Box>
                              <Grid container spacing={2}>
                                <Grid item xs={12}>
                                  <FormControl fullWidth sx={{ ...createModernFormStyles(theme, 'info') }}>
                                    <InputLabel>字幕轨道</InputLabel>
                                    <Select
                                      value={selectedTrackId}
                                      onChange={(e) => setSelectedTrackId(e.target.value)}
                                      label="字幕轨道"
                                      sx={{
                                        borderRadius: 2,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: alpha(theme.palette.info.main, 0.3)
                                        }
                                      }}
                                    >
                                      {trackOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                          {option.label}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                
                                <Grid item xs={6}>
                                  <FormControl fullWidth sx={{ ...createModernFormStyles(theme, 'info') }}>
                                    <InputLabel>源语言</InputLabel>
                                    <Select
                                      value={sourceLanguage}
                                      onChange={(e) => setSourceLanguage(e.target.value)}
                                      label="源语言"
                                      sx={{ borderRadius: 2 }}
                                    >
                                      {SUPPORTED_LANGUAGES.map((lang) => (
                                        <MenuItem key={lang.code} value={lang.code}>
                                          {lang.flag} {lang.name}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                
                                <Grid item xs={6}>
                                  <FormControl fullWidth sx={{ ...createModernFormStyles(theme, 'info') }}>
                                    <InputLabel>目标语言</InputLabel>
                                    <Select
                                      value={targetLanguage}
                                      onChange={(e) => setTargetLanguage(e.target.value)}
                                      label="目标语言"
                                      sx={{ borderRadius: 2 }}
                                    >
                                      {SUPPORTED_LANGUAGES.map((lang) => (
                                        <MenuItem key={lang.code} value={lang.code}>
                                          {lang.flag} {lang.name}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                
                                <Grid item xs={12}>
                                  <FormControl fullWidth sx={{ ...createModernFormStyles(theme, 'info') }}>
                                    <InputLabel>翻译模型</InputLabel>
                                    <Select
                                      value={translationModel}
                                      onChange={(e) => setTranslationModel(e.target.value)}
                                      label="翻译模型"
                                      sx={{ borderRadius: 2 }}
                                    >
                                      <MenuItem value="gpt-4">GPT-4 (推荐)</MenuItem>
                                      <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                                      <MenuItem value="claude-3">Claude-3</MenuItem>
                                      <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                              </Grid>
                              
                              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                                <Button
                                  variant="contained"
                                  startIcon={<PlayIcon />}
                                  onClick={startTranslation}
                                  disabled={!isConfigComplete || translationStatus === TranslationStatus.TRANSLATING}
                                  sx={{ 
                                    ...createModernButtonStyles(theme, 'primary'),
                                    flex: 1,
                                    py: 1.2
                                  }}
                                >
                                  开始翻译
                                </Button>
                              </Box>
                            </Box>
                          )}

                          {/* 步骤1：执行翻译 */}
                          {index === 1 && (
                            <Box>
                              {translationStatus === TranslationStatus.TRANSLATING && (
                                <Box
                                  sx={{
                                    ...createModernContainerStyles(theme, 2, 'info'),
                                    p: 2
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <CircularProgress size={24} sx={{ mr: 2, color: theme.palette.info.main }} />
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                      正在翻译中...
                                    </Typography>
                                  </Box>
                                  
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={translationProgress.percentage} 
                                    sx={{ 
                                      mb: 2, 
                                      height: 8, 
                                      borderRadius: 2,
                                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor: theme.palette.info.main
                                      }
                                    }}
                                  />
                                  
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                      进度: {translationProgress.current} / {translationProgress.total}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                      {Math.round(translationProgress.percentage)}%
                                    </Typography>
                                  </Box>
                                  
                                  {translationProgress.currentItem && (
                                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                      当前处理: {translationProgress.currentItem}
                                    </Typography>
                                  )}
                                  
                                  {translationProgress.estimatedTimeRemaining && (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                      预计剩余时间: {formatEstimatedTime(translationProgress.estimatedTimeRemaining)}
                                    </Typography>
                                  )}
                                  
                                  <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<StopIcon />}
                                    onClick={stopTranslation}
                                    sx={{ 
                                      ...createModernButtonStyles(theme, 'outlined'),
                                      mt: 2,
                                      borderColor: alpha(theme.palette.error.main, 0.3),
                                      color: theme.palette.error.main,
                                      '&:hover': {
                                        borderColor: theme.palette.error.main,
                                        backgroundColor: alpha(theme.palette.error.main, 0.05)
                                      }
                                    }}
                                  >
                                    停止翻译
                                  </Button>
                                </Box>
                              )}
                              
                              {translationStatus === TranslationStatus.COMPLETED && (
                                <Alert 
                                  severity="success" 
                                  sx={{ 
                                    ...createModernAlertStyles(theme, 'success'),
                                    mb: 2
                                  }}
                                >
                                  <AlertTitle sx={{ fontWeight: 600 }}>翻译完成</AlertTitle>
                                  成功翻译了 {translationResults.length} 条字幕
                                </Alert>
                              )}
                              
                              {translationStatus === TranslationStatus.ERROR && (
                                <Alert 
                                  severity="error" 
                                  sx={{ 
                                    ...createModernAlertStyles(theme, 'error'),
                                    mb: 2
                                  }}
                                >
                                  <AlertTitle sx={{ fontWeight: 600 }}>翻译失败</AlertTitle>
                                  {error}
                                </Alert>
                              )}
                            </Box>
                          )}

                          {/* 步骤2：预览结果 */}
                          {index === 2 && translationResults.length > 0 && (
                            <Box>
                              <Alert 
                                severity="info" 
                                sx={{ 
                                  ...createModernAlertStyles(theme, 'info'),
                                  mb: 2
                                }}
                              >
                                <AlertTitle sx={{ fontWeight: 600 }}>预览完成</AlertTitle>
                                请查看左侧的翻译结果预览，确认无误后可以保存文件
                              </Alert>
                              
                              <Stack direction="row" spacing={2}>
                                <Button
                                  variant="contained"
                                  startIcon={<SaveIcon />}
                                  onClick={saveTranslation}
                                  disabled={loading}
                                  sx={{
                                    ...createModernButtonStyles(theme, 'primary'),
                                    background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                                  }}
                                >
                                  保存翻译文件
                                </Button>
                                <Button
                                  variant="outlined"
                                  startIcon={<DownloadIcon />}
                                  onClick={() => {
                                    // 触发下载
                                    const blob = new Blob([
                                      translationResults.map((result, index) => 
                                        `${index + 1}\n${formatTime(result.startTime)} --> ${formatTime(result.endTime)}\n${result.translated}\n`
                                      ).join('\n')
                                    ], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${video.fileName}_${targetLanguage}.srt`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  sx={{ 
                                    ...createModernButtonStyles(theme, 'outlined')
                                  }}
                                >
                                  下载字幕文件
                                </Button>
                              </Stack>
                            </Box>
                          )}

                          {/* 步骤3：保存文件 */}
                          {index === 3 && (
                            <Box>
                              <Alert 
                                severity="success" 
                                sx={{ 
                                  ...createModernAlertStyles(theme, 'success'),
                                  mb: 2
                                }}
                              >
                                <AlertTitle sx={{ fontWeight: 600 }}>翻译任务完成</AlertTitle>
                                翻译文件已成功保存到服务器
                              </Alert>
                              
                              <Stack direction="row" spacing={2}>
                                <Button
                                  variant="outlined"
                                  startIcon={<RefreshIcon />}
                                  onClick={() => {
                                    setActiveStep(0);
                                    setTranslationStatus(TranslationStatus.IDLE);
                                    setTranslationResults([]);
                                    setTranslationProgress({ current: 0, total: 0, percentage: 0 });
                                  }}
                                  sx={{ 
                                    ...createModernButtonStyles(theme, 'outlined')
                                  }}
                                >
                                  重新翻译
                                </Button>
                                <Button
                                  variant="contained"
                                  startIcon={<ArrowBackIcon />}
                                  onClick={handleBack}
                                  sx={{
                                    ...createModernButtonStyles(theme, 'primary')
                                  }}
                                >
                                  返回视频详情
                                </Button>
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* 翻译设置对话框 */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          ...createModernDialogStyles(theme)
        }}
      >
        <DialogTitle>翻译设置</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>AI提供商</InputLabel>
            <Select
              value={selectedProviderId}
              onChange={(e) => {
                setSelectedProviderId(e.target.value);
                setSelectedModelId(''); // 重置模型选择
              }}
              label="AI提供商"
            >
              {activeProviders.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  {provider.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" disabled={!selectedProvider}>
            <InputLabel>翻译模型</InputLabel>
            <Select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              label="翻译模型"
            >
              {availableModels.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            取消
          </Button>
          <Button 
            onClick={() => setSettingsOpen(false)}
            variant="contained"
            sx={{
              ...createModernButtonStyles(theme, 'primary')
            }}
          >
            保存设置
          </Button>
        </DialogActions>
      </Dialog>

      {/* 浮动操作按钮 */}
      {translationStatus === TranslationStatus.IDLE && (
        <Zoom in={true}>
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000
            }}
            onClick={startTranslation}
            disabled={!isConfigComplete}
          >
            <PlayIcon />
          </Fab>
        </Zoom>
      )}

      {/* 错误提示 */}
      <ErrorSnackbar
        message={error}
        severity={error?.includes('成功') ? 'success' : 'error'}
        onClose={() => setError(null)}
      />
    </Container>
  );
};

export default VideoDetailWithTranslation;
