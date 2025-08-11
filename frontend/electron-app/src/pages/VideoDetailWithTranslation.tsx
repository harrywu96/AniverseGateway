import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { useTranslation } from '../hooks/useTranslation';
import { useVideoDetail } from '../hooks/useVideoDetail';
import {
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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

  Edit as EditIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useAppContext } from '../context/AppContext';
import TranslationHeader from '../components/translation/TranslationHeader';
import TranslationConfigPanel from '../components/translation/TranslationConfigPanel';
import TranslationProgressPanel from '../components/translation/TranslationProgressPanel';
import TranslationResultsPanel from '../components/translation/TranslationResultsPanel';
import { VideoInfo } from '@aniversegateway/shared';
import { TranslationRequest, TranslationResult } from '../services/translationService';
import VideoPlayer, { VideoPlayerRef } from '../components/VideoPlayer';
import ErrorSnackbar from '../components/ErrorSnackbar';
import TranslationResultEditor from '../components/TranslationResultEditor';
import TranslationTestPanel from '../components/TranslationTestPanel';
import { createModernCardStyles, createModernPaperStyles, createModernFormStyles, createModernAlertStyles, createModernDialogStyles, createModernButtonStyles, createModernContainerStyles, createElegantAreaStyles } from '../utils/modernStyles';
import { UnifiedSubtitleItem } from '@aniversegateway/shared/src/types/subtitle';
import { timeUtils } from '../utils/timeUtils';

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


const VideoDetailWithTranslation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  // 使用自定义hooks管理状态
  const videoDetail = useVideoDetail({
    videoId: id,
    autoLoad: true
  });

  // 翻译配置状态
  const [sourceLanguage, setSourceLanguage] = useState('zh');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [activeStep, setActiveStep] = useState(0);

  // 使用翻译hook
  const translation = useTranslation({
    videoId: id,
    targetLanguage,
    onTranslationComplete: (results) => {
      console.log('翻译完成，共', results.length, '条结果');
      setActiveStep(2);
      // 转换为字幕格式
      const subtitles = convertToSubtitles(results);
      setSubtitlesForPlayer(subtitles);
    },
    onTranslationError: (error) => {
      console.error('翻译失败:', error);
    }
  });

  // UI状态
  const [currentTime, setCurrentTime] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedCount, setEditedCount] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitlesForPlayer, setSubtitlesForPlayer] = useState<UnifiedSubtitleItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');

  // VideoPlayer引用
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // 从Redux获取提供商数据
  const providers = useAppSelector(state => state.provider.providers);
  const activeProviders = providers.filter(p => p.is_active && p.is_configured);

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

  // 当视频加载完成时，自动选择第一个字幕轨道
  useEffect(() => {
    if (videoDetail.video && videoDetail.hasSubtitleTracks && !videoDetail.selectedTrackId) {
      const firstTrack = videoDetail.video.subtitleTracks?.[0];
      if (firstTrack) {
        videoDetail.selectTrack(firstTrack.id);
      }
    }
  }, [videoDetail.video, videoDetail.hasSubtitleTracks, videoDetail.selectedTrackId]);

  // 当视频和目标语言都设置后，尝试加载保存的翻译结果
  useEffect(() => {
    if (videoDetail.video && targetLanguage && translation.status === 'idle') {
      translation.loadTranslation(videoDetail.video.id, targetLanguage);
    }
  }, [videoDetail.video, targetLanguage, translation.status]);

  // 转换翻译结果为字幕格式
  const convertToSubtitles = useCallback((results: TranslationResult[]): UnifiedSubtitleItem[] => {
    return results.map((result, index) => ({
      id: `subtitle-${index}`,
      index: index + 1,
      startTime: result.startTime,
      endTime: result.endTime,
      startTimeStr: timeUtils.secondsToSrt(result.startTime),
      endTimeStr: timeUtils.secondsToSrt(result.endTime),
      originalText: result.original,
      translatedText: result.translated,
      confidence: result.confidence,
      edited: false // 默认为未编辑
    }));
  }, []);

  // 使用videoDetail hook的数据
  const trackOptions = videoDetail.trackOptions;
  const selectedTrack = videoDetail.selectedTrack;

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
  const isConfigComplete = useMemo<boolean>(() => {
    return Boolean(sourceLanguage && targetLanguage && videoDetail.selectedTrackId && selectedProvider && selectedModel);
  }, [sourceLanguage, targetLanguage, videoDetail.selectedTrackId, selectedProvider, selectedModel]);

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
    if (!videoDetail.video || !selectedTrack || !isConfigComplete || !selectedProvider || !selectedModel) {
      console.error('配置不完整，无法开始翻译');
      return;
    }

    setActiveStep(1);

    // 构建翻译请求
    const requestData: TranslationRequest = {
      video_id: videoDetail.video.id,
      track_index: parseInt(selectedTrack.id),
      source_language: sourceLanguage,
      target_language: targetLanguage,
      style: 'natural',
      provider_config: {
        id: selectedProvider.id,
        apiKey: selectedProvider.apiKey,
        apiHost: selectedProvider.apiHost,
      },
      model_id: selectedModel.id,
      chunk_size: 30,
      context_window: 3,
      context_preservation: true,
      preserve_formatting: true,
    };

    console.log('开始翻译，请求数据:', requestData);
    await translation.startTranslation(requestData);
  }, [videoDetail.video, selectedTrack, isConfigComplete, sourceLanguage, targetLanguage, selectedProvider, selectedModel, translation]);

  // 停止翻译
  const stopTranslation = useCallback(async () => {
    await translation.stopTranslation();
  }, [translation]);

  // 保存翻译结果
  const saveTranslation = useCallback(async () => {
    if (!videoDetail.video || !translation.results.length) {
      console.error('没有翻译结果可保存');
      return;
    }

    try {
      await translation.saveTranslation(
        videoDetail.video.id,
        translation.results,
        targetLanguage,
        `${videoDetail.video.fileName}_${targetLanguage}`
      );
      setActiveStep(3);
      console.log('翻译文件保存成功！');
    } catch (error) {
      console.error('保存失败:', error);
    }
  }, [videoDetail.video, translation, targetLanguage]);

  // 处理时间跳转
  const handleTimeJump = useCallback((time: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time);
    }
  }, []);

  // 删除翻译结果
  const deleteTranslationResults = useCallback(async (): Promise<boolean> => {
    if (!videoDetail.video || !targetLanguage) return false;

    const success = await translation.deleteTranslation(videoDetail.video.id, targetLanguage);
    if (success) {
      setActiveStep(1);
      setSubtitlesForPlayer([]);
      // 清空localStorage中的编辑数据
      const storageKey = `edited_subtitles_${videoDetail.video.id}`;
      localStorage.removeItem(storageKey);
    }
    return success;
  }, [videoDetail.video, targetLanguage, translation]);

  // 处理编辑状态变化
  const handleEditStateChange = useCallback((hasChanges: boolean, editedCount: number) => {
    setHasUnsavedChanges(hasChanges);
    setEditedCount(editedCount);
  }, []);

  // 处理编辑结果保存
  const handleEditedResultsSave = useCallback(async (editedResults: any[]) => {
    if (!videoDetail.video) {
      console.error('视频信息不存在');
      return;
    }

    try {
      await translation.saveTranslation(
        videoDetail.video.id,
        editedResults,
        targetLanguage,
        `${videoDetail.video.fileName}_${targetLanguage}_edited`,
        true // edited = true
      );

      setHasUnsavedChanges(false);
      setEditedCount(editedResults.filter(r => r.edited).length);

      // 更新字幕显示
      const subtitles = convertToSubtitles(editedResults);
      setSubtitlesForPlayer(subtitles);

      console.log('编辑结果保存成功！');
    } catch (error) {
      console.error('保存失败:', error);
    }
  }, [videoDetail.video, targetLanguage, translation, convertToSubtitles]);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // 导出编辑后的字幕
  const exportEditedSubtitles = useCallback((resultsToExport: any[]) => {
    if (!videoDetail.video || !resultsToExport.length) {
      console.error('没有可导出的字幕数据');
      return;
    }

    try {
      // 生成SRT格式内容
      const srtContent = resultsToExport
        .map((result, index) => {
          const startTime = timeUtils.secondsToSrt(result.startTime);
          const endTime = timeUtils.secondsToSrt(result.endTime);
          return `${index + 1}\n${startTime} --> ${endTime}\n${result.translated}\n`;
        })
        .join('\n');

      // 创建下载链接
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoDetail.video.fileName}_${targetLanguage}_edited.srt`;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('字幕文件导出成功！');
    } catch (err) {
      console.error('导出失败:', err);
    }
  }, [videoDetail.video, targetLanguage]);

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

  // 虚拟列表状态
  const [displayedResults, setDisplayedResults] = useState<any[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);

  // 初始化显示的结果
  useEffect(() => {
    console.log('虚拟列表初始化，translation.results长度:', translation.results.length);
    if (translation.results.length > 0) {
      const initialResults = translation.results.slice(0, Math.min(15, translation.results.length));
      console.log('设置初始显示结果，数量:', initialResults.length, '第一条:', initialResults[0]);
      setDisplayedResults(initialResults);
      setLoadedCount(Math.min(15, translation.results.length));
    } else {
      setDisplayedResults([]);
      setLoadedCount(0);
    }
  }, [translation.results]);

  // 调试displayedResults
  useEffect(() => {
    console.log('displayedResults状态更新:', {
      length: displayedResults.length,
      firstItem: displayedResults[0],
      loadedCount
    });
  }, [displayedResults, loadedCount]);



  if (videoDetail.isLoading && !videoDetail.video) {
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

  if (!videoDetail.video) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <ErrorIcon sx={{ fontSize: 64, color: theme.palette.error.main, mb: 2 }} />
          <Typography variant="h6" color="error">
            {videoDetail.error || translation.error || '未找到视频信息'}
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
              <TranslationHeader fileName={videoDetail.video.fileName} onBack={handleBack} />
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

      <Grid container spacing={3}>
        {/* 左侧：视频播放器 */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ mb: 3 }}>
            <VideoPlayer
              ref={videoPlayerRef}
              src={videoDetail.video.filePath}
              onTimeUpdate={setCurrentTime}
              poster=""
              autoPlay={false}
              muted={false}
              showSubtitles={showSubtitles}
              subtitles={subtitlesForPlayer}
              showMultiTrack={true}
              onSubtitleClick={(subtitle) => {
                console.log('字幕点击:', subtitle);
              }}
            />
          </Card>

          {/* 翻译结果编辑器 */}
          {translation.hasResults && (
            <Box>
                {/* 翻译结果抽离为面板组件 */}
                <TranslationResultsPanel
                  results={translation.results}
                  currentTime={currentTime}
                  videoId={videoDetail.video.id}
                  readOnly={!isEditMode}
                  showPreview={!isEditMode}
                  onTimeJump={handleTimeJump}
                  onEditStateChange={handleEditStateChange}
                  onSave={handleEditedResultsSave}
                  onDelete={deleteTranslationResults}
                  isEditMode={isEditMode}
                  onToggleEditMode={toggleEditMode}
                  hasUnsavedChanges={hasUnsavedChanges}
                  editedCount={editedCount}
                  onExport={exportEditedSubtitles}
                />
              </Box>
          )}
        </Grid>

        {/* 右侧：翻译配置和进度 */}
        <Grid item xs={12} lg={6}>
          {/* 测试翻译面板 */}
          {/* <Box sx={{ mb: 3 }}> */}
            {/* <TranslationTestPanel onTestResults={handleTestResults} /> */}
          {/* </Box> */}

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
                          {/* 步骤0：配置翻译（抽离组件） */}
                          {index === 0 && (
                            <TranslationConfigPanel
                                sourceLanguage={sourceLanguage}
                                targetLanguage={targetLanguage}
                                onSourceChange={setSourceLanguage}
                                onTargetChange={setTargetLanguage}
                                languageOptions={SUPPORTED_LANGUAGES}
                                trackOptions={trackOptions}
                                selectedTrackId={videoDetail.selectedTrackId}
                                onTrackChange={videoDetail.selectTrack}
                                providers={activeProviders}
                                selectedProviderId={selectedProviderId}
                                onProviderChange={setSelectedProviderId}
                                selectedModelId={selectedModelId}
                                onModelChange={setSelectedModelId}
                                isConfigComplete={isConfigComplete}
                                onStart={startTranslation}
                              />
                          )}

                          {/* 步骤1：执行翻译 */}
                          {index === 1 && (
                            <Box>
                              <TranslationProgressPanel
                                isTranslating={translation.isTranslating}
                                progress={translation.progress}
                                onStop={stopTranslation}
                              />

                              {translation.isCompleted && (
                                <Alert
                                  severity="success"
                                  sx={{
                                    ...createModernAlertStyles(theme, 'success'),
                                    mb: 2
                                  }}
                                >
                                  <AlertTitle sx={{ fontWeight: 600 }}>翻译完成</AlertTitle>
                                  成功翻译了 {translation.results.length} 条字幕
                                </Alert>
                              )}

                              {translation.hasError && (
                                <Alert
                                  severity="error"
                                  sx={{
                                    ...createModernAlertStyles(theme, 'error'),
                                    mb: 2
                                  }}
                                >
                                  <AlertTitle sx={{ fontWeight: 600 }}>翻译失败</AlertTitle>
                                  {translation.error}
                                </Alert>
                              )}
                            </Box>
                          )}

                          {/* 步骤2：预览结果 */}
                          {index === 2 && translation.results.length > 0 && (
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
                                  disabled={translation.isLoading}
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
                                      translation.results.map((result, index) =>
                                        `${index + 1}\n${formatTime(result.startTime)} --> ${formatTime(result.endTime)}\n${result.translated}\n`
                                      ).join('\n')
                                    ], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${videoDetail.video?.fileName || 'video'}_${targetLanguage}.srt`;
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
                                    translation.resetTranslation();
                                    setSubtitlesForPlayer([]);
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
              {activeProviders.length === 0 ? (
                <MenuItem value="" disabled>
                  无激活的提供商，请到设置中添加
                </MenuItem>
              ) : (
                activeProviders.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </MenuItem>
                ))
              )}
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
      {translation.status === 'idle' && (
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
      )}

      {/* 错误提示 */}
      <ErrorSnackbar
        message={translation.error || videoDetail.error}
        severity={translation.error?.includes('成功') ? 'success' : 'error'}
        onClose={() => {
          translation.clearError();
          videoDetail.clearError();
        }}
      />
    </Container>
  );
};

export default VideoDetailWithTranslation;
