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
  Stop as StopIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useAppContext } from '../context/AppContext';
import { VideoInfo } from '@aniversegateway/shared';
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

  
  // 翻译执行状态
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>(TranslationStatus.IDLE);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>({
    current: 0,
    total: 0,
    percentage: 0
  });
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedCount, setEditedCount] = useState(0);

  // VideoPlayer引用
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // 字幕显示状态
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitlesForPlayer, setSubtitlesForPlayer] = useState<UnifiedSubtitleItem[]>([]);

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

  // 当前任务ID状态
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

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
          const response = await fetch(`http://localhost:${apiPort}/api/videos/${id}?include_subtitles=true`);
          
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

  // 加载保存的翻译结果
  const loadSavedTranslation = useCallback(async () => {
    if (!video || !targetLanguage) {
      console.log('加载翻译结果跳过:', { video: !!video, targetLanguage });
      return;
    }

    console.log('尝试加载保存的翻译结果:', { videoId: video.id, targetLanguage });

    try {
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/translate/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          targetLanguage: targetLanguage
        })
      });

      console.log('加载翻译结果响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('加载翻译结果响应:', result);

        if (result.success && result.data?.results) {
          // 检查是否为真实翻译结果（通过isRealTranslation字段判断）
          const isRealTranslation = result.data.isRealTranslation !== false; // 默认为true，除非明确标记为false

          if (isRealTranslation) {
            console.log('成功加载保存的真实翻译结果:', result.data.results.length, '条');
            setTranslationResults(result.data.results);
            setTranslationStatus(TranslationStatus.COMPLETED);
            setActiveStep(2);

            // 转换为字幕格式
            const subtitles = convertToSubtitles(result.data.results);
            setSubtitlesForPlayer(subtitles);
          } else {
            console.log('跳过模拟翻译结果，等待真实翻译');
          }
        } else {
          console.log('没有找到保存的翻译结果');
        }
      } else {
        console.log('加载翻译结果请求失败:', response.status);
      }
    } catch (error) {
      console.log('加载翻译结果出错:', error);
    }
  }, [video, targetLanguage, convertToSubtitles]);

  // 当视频和目标语言都设置后，尝试加载保存的翻译结果
  useEffect(() => {
    if (video && targetLanguage && translationStatus === TranslationStatus.IDLE) {
      loadSavedTranslation();
    }
  }, [video, targetLanguage, translationStatus, loadSavedTranslation]);

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
      const requestData = {
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
      };

      console.log('准备发送的翻译请求数据:', requestData);
      const result = await translateVideoSubtitle(requestData);
      
      if (!result.success) {
        throw new Error(result.message || '翻译请求失败');
      }

      const taskId = result.data.task_id;

      // 设置当前任务ID
      setCurrentTaskId(taskId);

      // 建立WebSocket连接监听进度
      const apiPort = '8000';
      const ws = new WebSocket(`ws://localhost:${apiPort}/api/translate/ws/${taskId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('翻译WebSocket连接已建立');
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket收到消息:', data);

        if (data.type === 'progress') {
          setTranslationProgress({
            current: data.current || 0,
            total: data.total || 0,
            percentage: data.percentage || 0,
            currentItem: data.currentItem,
            estimatedTimeRemaining: data.estimatedTime
          });
        } else if (data.type === 'completed') {
          console.log('翻译完成消息详情:', {
            type: data.type,
            message: data.message,
            results: data.results,
            resultsLength: data.results?.length || 0,
            resultsType: typeof data.results,
            firstResult: data.results?.[0]
          });

          // 真实翻译完成，先清空历史数据，再设置新的翻译结果
          await clearPreviousTranslationData();

          setTranslationStatus(TranslationStatus.COMPLETED);
          setTranslationResults(data.results || []);
          // 转换为字幕格式
          if (data.results && Array.isArray(data.results)) {
            const subtitles = convertToSubtitles(data.results);
            setSubtitlesForPlayer(subtitles);
            // 保存新的翻译结果
            saveTranslationResults(data.results, false, true); // isRealTranslation = true
          }
          setActiveStep(2);
          // 清空当前任务ID
          setCurrentTaskId(null);
          console.log('设置翻译结果，共', data.results?.length || 0, '条结果');
        } else if (data.type === 'error') {
          setTranslationStatus(TranslationStatus.ERROR);
          setError(`翻译失败: ${data.message || '未知错误'}`);
          // 清空当前任务ID
          setCurrentTaskId(null);
        } else if (data.type === 'cancelled') {
          console.log('收到后端取消确认:', data.message);
          setTranslationStatus(TranslationStatus.CANCELLED);
          setCurrentTaskId(null);
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
      // 清空当前任务ID
      setCurrentTaskId(null);

      if (abortControllerRef.current?.signal.aborted) {
        setTranslationStatus(TranslationStatus.CANCELLED);
      } else {
        setTranslationStatus(TranslationStatus.ERROR);
        setError(`翻译失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }
  }, [video, selectedTrack, isConfigComplete, sourceLanguage, targetLanguage, selectedProvider, selectedModel]);

  // 停止翻译
  const stopTranslation = useCallback(async () => {
    try {
      // 如果有当前任务ID，调用后端取消API
      if (currentTaskId) {
        const apiPort = '8000';
        console.log('发送取消请求到后端，任务ID:', currentTaskId);

        const response = await fetch(`http://localhost:${apiPort}/api/translate/cancel/${currentTaskId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log('取消请求成功:', result);
        } else {
          console.error('取消请求失败:', response.status);
        }
      }
    } catch (error) {
      console.error('发送取消请求失败:', error);
    }

    // 执行前端清理逻辑
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    // 清空当前任务ID
    setCurrentTaskId(null);

    // 设置翻译状态为已取消
    setTranslationStatus(TranslationStatus.CANCELLED);
  }, [currentTaskId]);

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

  // 处理时间跳转
  const handleTimeJump = useCallback((time: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time);
    }
  }, []);

  // 清空之前的翻译数据
  const clearPreviousTranslationData = useCallback(async () => {
    if (!video || !targetLanguage) return;

    try {
      // 清空服务器端数据
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/translate/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          targetLanguage: targetLanguage
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('服务器端历史翻译数据已清空');
        }
      }

      // 清空localStorage中的编辑数据
      const storageKey = `edited_subtitles_${video.id}`;
      localStorage.removeItem(storageKey);
      console.log('localStorage中的编辑数据已清空');

    } catch (error) {
      console.error('清空历史翻译数据失败:', error);
    }
  }, [video, targetLanguage]);

  // 删除翻译结果
  const deleteTranslationResults = useCallback(async (): Promise<boolean> => {
    if (!video || !targetLanguage) return false;

    try {
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/translate/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          targetLanguage: targetLanguage
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('翻译结果已删除');

          // 清空前端状态
          setTranslationResults([]);
          setTranslationStatus(TranslationStatus.IDLE);
          setActiveStep(1);
          setSubtitlesForPlayer([]);

          // 清空localStorage中的编辑数据
          const storageKey = `edited_subtitles_${video.id}`;
          localStorage.removeItem(storageKey);

          setError('翻译结果已删除');

          // 3秒后清除消息
          setTimeout(() => {
            setError(null);
          }, 3000);

          return true;
        } else {
          throw new Error(result.message || '删除失败');
        }
      } else {
        throw new Error(`删除请求失败: ${response.status}`);
      }
    } catch (error) {
      console.error('删除翻译结果失败:', error);
      setError(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }, [video, targetLanguage]);

  // 保存翻译结果
  const saveTranslationResults = useCallback(async (results: TranslationResult[], edited: boolean = false, isRealTranslation: boolean = true) => {
    if (!video || !targetLanguage || !results.length) {
      console.log('保存翻译结果跳过:', { video: !!video, targetLanguage, resultsLength: results.length });
      return;
    }

    // 如果是模拟翻译，不保存到服务器
    if (!isRealTranslation) {
      console.log('模拟翻译结果不保存到服务器，避免污染真实翻译数据');
      return;
    }

    try {
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/translate/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          results: results,
          targetLanguage: targetLanguage,
          fileName: video.fileName || 'unknown',
          edited: edited,
          isRealTranslation: isRealTranslation
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('真实翻译结果保存成功:', result.data);
        } else {
          console.error('翻译结果保存失败:', result.message);
        }
      } else {
        console.error('翻译结果保存请求失败:', response.status);
      }
    } catch (error) {
      console.error('保存翻译结果出错:', error);
    }
  }, [video, targetLanguage]);

  // 处理测试翻译结果
  const handleTestResults = useCallback((results: any[]) => {
    console.log('收到测试翻译结果:', results);

    // 检查是否已有真实的翻译结果，如果有则不覆盖
    if (translationResults.length > 0 && translationStatus === TranslationStatus.COMPLETED) {
      console.log('已存在真实翻译结果，跳过模拟翻译结果覆盖');
      return;
    }

    setTranslationResults(results);
    setTranslationStatus(TranslationStatus.COMPLETED);
    setActiveStep(2);

    // 转换为字幕格式
    const subtitles = convertToSubtitles(results);
    setSubtitlesForPlayer(subtitles);

    // 模拟翻译结果不保存到服务器，避免污染真实翻译数据
    console.log('模拟翻译结果仅用于测试，不保存到服务器');
  }, [convertToSubtitles, translationResults.length, translationStatus]);





  // 处理编辑状态变化
  const handleEditStateChange = useCallback((hasChanges: boolean, editedCount: number) => {
    setHasUnsavedChanges(hasChanges);
    setEditedCount(editedCount);
  }, []);

  // 处理编辑结果保存
  const handleEditedResultsSave = useCallback(async (editedResults: any[]) => {
    if (!video) {
      setError('视频信息不存在');
      return;
    }

    try {
      setLoading(true);
      const apiPort = '8000';

      const response = await fetch(`http://localhost:${apiPort}/api/translate/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          results: editedResults,
          targetLanguage,
          fileName: `${video.fileName}_${targetLanguage}_edited`,
          edited: true
        })
      });

      if (!response.ok) {
        throw new Error(`保存失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // 更新翻译结果
        setTranslationResults(editedResults);
        setHasUnsavedChanges(false);
        setEditedCount(editedResults.filter(r => r.edited).length);

        // 更新字幕显示
        const subtitles = convertToSubtitles(editedResults);
        setSubtitlesForPlayer(subtitles);

        setError('编辑结果保存成功！');

        // 3秒后清除成功消息
        setTimeout(() => {
          setError(null);
        }, 3000);
      } else {
        throw new Error(result.message || '保存失败');
      }
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [video, targetLanguage]);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // 导出编辑后的字幕
  const exportEditedSubtitles = useCallback((resultsToExport: any[]) => {
    if (!video || !resultsToExport.length) {
      setError('没有可导出的字幕数据');
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
      link.download = `${video.fileName}_${targetLanguage}_edited.srt`;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setError('字幕文件导出成功！');
    } catch (err) {
      setError(`导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [video, targetLanguage]);

  // 处理编辑结果保存（扩展版本，支持导出）
  const handleEditedResultsSaveAndExport = useCallback(async (editedResults: any[], shouldExport: boolean = false) => {
    // 先保存到服务器
    await handleEditedResultsSave(editedResults);

    // 如果需要导出，则导出文件
    if (shouldExport) {
      exportEditedSubtitles(editedResults);
    }
  }, [handleEditedResultsSave, exportEditedSubtitles]);

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
  const [loadedCount, setLoadedCount] = useState(15);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 初始化显示的结果
  useEffect(() => {
    console.log('虚拟列表初始化，translationResults长度:', translationResults.length);
    if (translationResults.length > 0) {
      const initialResults = translationResults.slice(0, Math.min(15, translationResults.length));
      console.log('设置初始显示结果，数量:', initialResults.length, '第一条:', initialResults[0]);
      setDisplayedResults(initialResults);
      setLoadedCount(Math.min(15, translationResults.length));
    } else {
      setDisplayedResults([]);
      setLoadedCount(0);
    }
  }, [translationResults]);

  // 调试displayedResults
  useEffect(() => {
    console.log('displayedResults状态更新:', {
      length: displayedResults.length,
      firstItem: displayedResults[0],
      loadedCount
    });
  }, [displayedResults, loadedCount]);

  // 处理滚动事件，实现虚拟列表
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // 检查是否滚动到底部（留一些缓冲区）
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      // 如果还有更多数据可以加载
      if (loadedCount < translationResults.length) {
        const nextCount = Math.min(loadedCount + 15, translationResults.length);
        setDisplayedResults(translationResults.slice(0, nextCount));
        setLoadedCount(nextCount);
        console.log(`虚拟列表加载更多: ${loadedCount} -> ${nextCount} / ${translationResults.length}`);
      }
    }
  }, [loadedCount, translationResults]);

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

      <Grid container spacing={3}>
        {/* 左侧：视频播放器 */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ mb: 3 }}>
            <VideoPlayer
              ref={videoPlayerRef}
              src={video.filePath}
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
          {translationResults.length > 0 && (
            <Box>
                {/* 编辑模式切换按钮 */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* 导出按钮 */}
                    <Tooltip title="导出编辑后的字幕文件">
                      <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportEditedSubtitles(translationResults)}
                        size="small"
                        disabled={translationResults.length === 0}
                      >
                        导出字幕
                      </Button>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {hasUnsavedChanges && (
                      <Chip
                        label={`${editedCount} 条未保存`}
                        color="warning"
                        size="small"
                        variant="filled"
                      />
                    )}

                    <Tooltip title={isEditMode ? '切换到预览模式' : '切换到编辑模式'}>
                      <Button
                        variant={isEditMode ? 'contained' : 'outlined'}
                        color="primary"
                        startIcon={isEditMode ? <VisibilityIcon /> : <EditIcon />}
                        onClick={toggleEditMode}
                        size="small"
                      >
                        {isEditMode ? '预览模式' : '编辑模式'}
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>

                {/* 翻译结果编辑器组件 */}
                <TranslationResultEditor
                  results={translationResults}
                  currentTime={currentTime}
                  videoId={video.id}
                  readOnly={!isEditMode}
                  showPreview={!isEditMode}
                  maxHeight={500}
                  onTimeJump={handleTimeJump}
                  onEditStateChange={handleEditStateChange}
                  onSave={handleEditedResultsSave}
                  onDelete={deleteTranslationResults}
                />
              </Box>
          )}
        </Grid>

        {/* 右侧：翻译配置和进度 */}
        <Grid item xs={12} lg={6}>
          {/* 测试翻译面板 */}
          <Box sx={{ mb: 3 }}>
            <TranslationTestPanel onTestResults={handleTestResults} />
          </Box>

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

                                {/* 显示当前选中的提供商和模型 */}
                                <Grid item xs={12}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 2,
                                      backgroundColor: alpha(theme.palette.info.main, 0.05),
                                      borderColor: alpha(theme.palette.info.main, 0.2)
                                    }}
                                  >
                                    <Typography variant="subtitle2" color="info.main" gutterBottom>
                                      当前翻译配置
                                    </Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                      <Chip
                                        label={selectedProvider ? `提供商: ${selectedProvider.name}` : '未选择提供商'}
                                        color={selectedProvider ? 'success' : 'default'}
                                        size="small"
                                      />
                                      <Chip
                                        label={selectedModel ? `模型: ${selectedModel.name}` : '未选择模型'}
                                        color={selectedModel ? 'success' : 'default'}
                                        size="small"
                                      />
                                    </Stack>
                                    {(!selectedProvider || !selectedModel) && (
                                      <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                                        请点击右上角设置按钮配置AI提供商和模型
                                      </Typography>
                                    )}
                                  </Paper>
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
        message={error}
        severity={error?.includes('成功') ? 'success' : 'error'}
        onClose={() => setError(null)}
      />
    </Container>
  );
};

export default VideoDetailWithTranslation;
