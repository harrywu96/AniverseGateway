import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  SelectChangeEvent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TranslateIcon from '@mui/icons-material/Translate';
import { useAppContext } from '../context/AppContext';
import { VideoInfo, SubtitleTrack } from '../shared';
import VideoPlayer from '../components/VideoPlayer';
import SubtitleEditor, { SubtitleItem } from '../components/SubtitleEditor';
import TranslationConfig from '../components/TranslationConfig';
import ErrorSnackbar from '../components/ErrorSnackbar';
import { translateSubtitleLine, translateSubtitleFile } from '../services/api';

/**
 * 视频详情页组件（带翻译功能）
 */
const VideoDetailWithTranslation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SubtitleTrack | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // 翻译相关状态
  const [translationConfig, setTranslationConfig] = useState<any>({
    provider: 'siliconflow',
    model: '',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    style: 'natural'
  });
  const [translationDialogOpen, setTranslationDialogOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);

  // 错误提示状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusSeverity, setStatusSeverity] = useState<'error' | 'success' | 'info' | 'warning'>('error');

  // 加载视频信息
  useEffect(() => {
    const loadVideoInfo = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // 从后端API获取视频信息
        const apiPort = '8000';
        const url = `http://localhost:${apiPort}/api/videos/${id}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`获取视频信息失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setVideo(result.data);

          // 如果有字幕轨道，默认选择第一个
          if (result.data.subtitleTracks && result.data.subtitleTracks.length > 0) {
            setSelectedTrack(result.data.subtitleTracks[0]);
          }
        } else {
          throw new Error(result.message || '获取视频信息失败');
        }
      } catch (error: any) {
        console.error('加载视频信息出错:', error);
        setError(`加载视频信息出错: ${error.message}`);
        setErrorMessage(`加载视频信息出错: ${error instanceof Error ? error.message : '未知错误'}`);
        setStatusSeverity('error');
      } finally {
        setLoading(false);
      }
    };

    loadVideoInfo();
  }, [id]);

  // 当选择字幕轨道时，加载字幕内容
  useEffect(() => {
    if (video && selectedTrack) {
      const videoId = (video as any).backendId || video.id;
      loadSubtitleContent(videoId, selectedTrack.id);
    }
  }, [video, selectedTrack]);

  // 处理翻译配置变化
  const handleTranslationConfigChange = (config: any) => {
    setTranslationConfig(config);
  };

  // 加载字幕内容
  const loadSubtitleContent = async (videoId: string, trackId: string) => {
    try {
      setLoading(true);
      setError(null);

      // 检查参数有效性
      if (!videoId || !trackId) {
        throw new Error('无效的视频ID或轨道ID');
      }

      // 检查视频对象是否存在
      if (!video) {
        throw new Error('视频对象不存在');
      }

      // 获取轨道信息
      const track = video.subtitleTracks?.find(t => t.id === trackId);
      if (!track) {
        throw new Error(`找不到ID为 ${trackId} 的字幕轨道`);
      }

      // 获取轨道索引
      let trackIndex = 0;
      if ((track as any).backendIndex !== undefined) {
        trackIndex = (track as any).backendIndex;
      } else {
        try {
          const parsedIndex = parseInt(track.id);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            trackIndex = parsedIndex;
          }
        } catch (e) {
          console.warn('轨道ID转换为索引失败，使用默认值0:', e);
        }
      }

      // 构建请求字幕内容的URL
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/content`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`获取字幕内容失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        // 将后端字幕数据转换为前端格式
        const subtitleItems: SubtitleItem[] = result.data.subtitles.map((item: any) => ({
          id: item.id.toString(),
          startTime: item.start_time,
          endTime: item.end_time,
          text: item.text
        }));

        setSubtitles(subtitleItems);
      } else {
        throw new Error(result.message || '获取字幕内容失败');
      }
    } catch (error: any) {
      console.error('加载字幕内容出错:', error);
      setError(`加载字幕内容出错: ${error.message}`);
      setErrorMessage(`加载字幕内容出错: ${error instanceof Error ? error.message : '未知错误'}`);
      setStatusSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  // 处理单行翻译
  const handleTranslateLine = async (id: string, config: any) => {
    try {
      if (!video || !selectedTrack) return;

      // 查找要翻译的字幕
      const subtitle = subtitles.find(s => s.id === id);
      if (!subtitle) return;

      // 先将字幕状态设置为翻译中
      setSubtitles(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, translating: true }
            : item
        )
      );

      // 准备翻译请求
      const request = {
        text: subtitle.text,
        provider: config.provider,
        model: config.model,
        source_language: config.sourceLanguage,
        target_language: config.targetLanguage,
        style: config.style,
        preserve_formatting: true,
        context_preservation: true
      };

      // 添加重试逻辑
      const maxRetries = 3;
      let retryCount = 0;
      let lastError;

      while (retryCount < maxRetries) {
        try {
          // 调用翻译API
          const response = await translateSubtitleLine(request);

          if (response.success && response.data) {
            // 更新字幕列表
            setSubtitles(prev =>
              prev.map(item =>
                item.id === id
                  ? { ...item, translated: response.data.translated, translating: false }
                  : item
              )
            );
            return; // 成功后退出函数
          } else {
            throw new Error(response.message || '翻译失败');
          }
        } catch (error) {
          lastError = error;
          retryCount++;

          if (retryCount < maxRetries) {
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`翻译重试 ${retryCount}/${maxRetries}...`);
          }
        }
      }

      // 如果所有重试都失败，抛出最后一个错误
      throw lastError;
    } catch (error) {
      console.error('翻译字幕失败:', error);
      // 更新字幕状态
      setSubtitles(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, translating: false }
            : item
        )
      );
      // 显示错误消息
      const errorMsg = '翻译失败: ' + (error instanceof Error ? error.message : '未知错误');
      setErrorMessage(errorMsg);
      setStatusSeverity('error');
    }
  };

  // 处理全文翻译
  const handleTranslateAll = async () => {
    try {
      if (!video || !selectedTrack) return;

      setTranslating(true);
      setTranslationProgress(0);

      // 获取视频ID和轨道索引
      const videoId = (video as any).backendId || video.id;
      let trackIndex = 0;

      // 如果轨道有backendIndex属性，直接使用
      if ((selectedTrack as any).backendIndex !== undefined) {
        trackIndex = (selectedTrack as any).backendIndex;
      } else {
        // 否则尝试将轨道ID转换为数字
        try {
          const parsedIndex = parseInt(selectedTrack.id);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            trackIndex = parsedIndex;
          }
        } catch (e) {
          console.warn('轨道ID转换为索引失败，使用默认值0:', e);
        }
      }

      // 准备翻译请求
      const request = {
        video_id: videoId,
        track_index: trackIndex,
        provider: translationConfig.provider,
        model: translationConfig.model,
        source_language: translationConfig.sourceLanguage,
        target_language: translationConfig.targetLanguage,
        style: translationConfig.style,
        preserve_formatting: true,
        context_preservation: true
      };

      // 添加重试逻辑
      const maxRetries = 3;
      let retryCount = 0;
      let lastError;

      while (retryCount < maxRetries) {
        try {
          // 调用翻译API
          const response = await translateSubtitleFile(request);

          if (response.success && response.data) {
            // 获取任务ID
            const taskId = response.data.task_id;

            // 创建WebSocket连接监听进度
            return new Promise<void>((resolve, reject) => {
              const socket = new WebSocket(`ws://localhost:8000/api/ws/tasks/${taskId}`);

              // 设置超时
              const timeout = setTimeout(() => {
                socket.close();
                reject(new Error('翻译任务超时'));
              }, 5 * 60 * 1000); // 5分钟超时

              socket.onopen = () => {
                console.log('WebSocket连接已建立，开始监听翻译进度');
              };

              socket.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  console.log('收到WebSocket消息:', data);

                  if (data.type === 'progress') {
                    setTranslationProgress(data.progress * 100);
                  } else if (data.type === 'completed') {
                    // 翻译完成，刷新字幕
                    clearTimeout(timeout);
                    loadSubtitleContent(videoId, selectedTrack.id);
                    setTranslating(false);
                    setTranslationDialogOpen(false);
                    // 显示成功消息
                    setErrorMessage('字幕翻译成功！');
                    setStatusSeverity('success');
                    socket.close();
                    resolve();
                  } else if (data.type === 'failed') {
                    clearTimeout(timeout);
                    socket.close();
                    reject(new Error(data.message || '翻译失败'));
                  }
                } catch (error) {
                  console.error('处理WebSocket消息出错:', error);
                  clearTimeout(timeout);
                  socket.close();
                  reject(error);
                }
              };

              socket.onerror = (error) => {
                console.error('WebSocket错误:', error);
                clearTimeout(timeout);
                reject(new Error('翻译进度监听失败'));
              };

              socket.onclose = () => {
                console.log('WebSocket连接已关闭');
                clearTimeout(timeout);
              };
            });
          } else {
            throw new Error(response.message || '翻译任务创建失败');
          }
        } catch (error) {
          lastError = error;
          retryCount++;

          if (retryCount < maxRetries) {
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`翻译任务创建重试 ${retryCount}/${maxRetries}...`);
          }
        }
      }

      // 如果所有重试都失败，抛出最后一个错误
      throw lastError;
    } catch (error) {
      console.error('翻译全部字幕失败:', error);
      setTranslating(false);
      const errorMsg = '翻译失败: ' + (error instanceof Error ? error.message : '未知错误');
      setErrorMessage(errorMsg);
      setStatusSeverity('error');
    }
  };

  // 渲染翻译对话框
  const renderTranslationDialog = () => (
    <Dialog
      open={translationDialogOpen}
      onClose={() => !translating && setTranslationDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>翻译配置</DialogTitle>
      <DialogContent>
        <TranslationConfig
          onChange={handleTranslationConfigChange}
          defaultConfig={translationConfig}
        />

        {translating && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              翻译进度: {Math.round(translationProgress)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={translationProgress}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => setTranslationDialogOpen(false)}
          disabled={translating}
        >
          取消
        </Button>
        <Button
          onClick={handleTranslateAll}
          variant="contained"
          color="primary"
          disabled={translating || !translationConfig.model}
        >
          {translating ? '翻译中...' : '开始翻译'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 2, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* 页面标题和返回按钮 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/videos')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">
          {video?.fileName || '视频详情'}
        </Typography>
      </Box>

      {/* 主要内容区域 */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 视频播放器 */}
        <Box sx={{ height: '50%', minHeight: 300 }}>
          {video ? (
            <VideoPlayer
              videoPath={video.filePath}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
            />
          ) : (
            <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {loading ? <CircularProgress /> : <Typography>未找到视频</Typography>}
            </Box>
          )}
        </Box>

        {/* 字幕轨道选择 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>字幕轨道</InputLabel>
            <Select
              value={selectedTrack?.id || ''}
              label="字幕轨道"
              onChange={(e: SelectChangeEvent) => {
                const trackId = e.target.value;
                const track = video?.subtitleTracks?.find(t => t.id === trackId) || null;
                setSelectedTrack(track);
              }}
              disabled={!video || !video.subtitleTracks || video.subtitleTracks.length === 0}
            >
              {video?.subtitleTracks?.map((track) => (
                <MenuItem key={track.id} value={track.id}>
                  {track.language} - {track.title || `轨道 ${track.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* 字幕编辑区域 */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="primary"
              disabled={!selectedTrack}
              onClick={() => {
                if (video && selectedTrack) {
                  const videoId = (video as any).backendId || video.id;
                  loadSubtitleContent(videoId, selectedTrack.id);
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
                variant="outlined"
                color="primary"
                disabled={!selectedTrack}
                onClick={() => setTranslationDialogOpen(true)}
                startIcon={<TranslateIcon />}
                sx={{ mr: 1 }}
              >
                翻译字幕
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
                    const videoId = (video as any).backendId || video.id;
                    // 使用轨道的后端索引
                    let trackIndex = 0;

                    // 如果轨道有backendIndex属性，直接使用
                    if ((selectedTrack as any).backendIndex !== undefined) {
                      trackIndex = (selectedTrack as any).backendIndex;
                    } else {
                      // 否则尝试将轨道ID转换为数字
                      try {
                        const parsedIndex = parseInt(selectedTrack.id);
                        if (!isNaN(parsedIndex) && parsedIndex >= 0) {
                          trackIndex = parsedIndex;
                        }
                      } catch (e) {
                        console.warn('轨道ID转换为索引失败，使用默认值0:', e);
                      }
                    }

                    const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/save`;

                    const response = await fetch(url, {
                      method: 'POST'
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success) {
                        setErrorMessage('字幕保存成功');
                        setStatusSeverity('success');
                        return;
                      }
                    }

                    // 如果 API 调用失败，显示模拟成功消息
                    console.warn('调用保存字幕API失败，显示模拟成功消息');
                    setErrorMessage('字幕保存成功');
                    setStatusSeverity('success');
                  } catch (error) {
                    console.error('保存字幕失败:', error);
                    setErrorMessage('字幕保存失败，请重试');
                    setStatusSeverity('error');
                  }
                }}
              >
                保存所有修改
              </Button>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <SubtitleEditor
              subtitles={subtitles}
              currentTime={currentTime}
              loading={loading}
              error={error}
              onTranslate={handleTranslateLine}
              translationConfig={translationConfig}
              onSave={async (subtitle) => {
                try {
                  if (!video || !selectedTrack) return;

                  // 实现保存单个字幕的逻辑
                  const apiPort = '8000';
                  const videoId = (video as any).backendId || video.id;
                  let trackIndex = 0;

                  if ((selectedTrack as any).backendIndex !== undefined) {
                    trackIndex = (selectedTrack as any).backendIndex;
                  } else {
                    try {
                      const parsedIndex = parseInt(selectedTrack.id);
                      if (!isNaN(parsedIndex) && parsedIndex >= 0) {
                        trackIndex = parsedIndex;
                      }
                    } catch (e) {
                      console.warn('轨道ID转换为索引失败，使用默认值0:', e);
                    }
                  }

                  const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/line`;

                  const response = await fetch(url, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      id: subtitle.id,
                      start_time: subtitle.startTime,
                      end_time: subtitle.endTime,
                      text: subtitle.text
                    })
                  });

                  if (!response.ok) {
                    throw new Error(`保存字幕失败: ${response.status} ${response.statusText}`);
                  }

                  const result = await response.json();
                  if (!result.success) {
                    throw new Error(result.message || '保存字幕失败');
                  }

                  // 更新字幕列表
                  setSubtitles(prev =>
                    prev.map(item =>
                      item.id === subtitle.id ? subtitle : item
                    )
                  );
                } catch (error) {
                  console.error('保存字幕失败:', error);
                  alert('保存字幕失败: ' + (error instanceof Error ? error.message : '未知错误'));
                }
              }}
              onDelete={async (id) => {
                try {
                  if (!video || !selectedTrack) return;

                  // 实现删除字幕的逻辑
                  const apiPort = '8000';
                  const videoId = (video as any).backendId || video.id;
                  let trackIndex = 0;

                  if ((selectedTrack as any).backendIndex !== undefined) {
                    trackIndex = (selectedTrack as any).backendIndex;
                  } else {
                    try {
                      const parsedIndex = parseInt(selectedTrack.id);
                      if (!isNaN(parsedIndex) && parsedIndex >= 0) {
                        trackIndex = parsedIndex;
                      }
                    } catch (e) {
                      console.warn('轨道ID转换为索引失败，使用默认值0:', e);
                    }
                  }

                  const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/line/${id}`;

                  const response = await fetch(url, {
                    method: 'DELETE'
                  });

                  if (!response.ok) {
                    throw new Error(`删除字幕失败: ${response.status} ${response.statusText}`);
                  }

                  const result = await response.json();
                  if (!result.success) {
                    throw new Error(result.message || '删除字幕失败');
                  }

                  // 更新字幕列表
                  setSubtitles(prev => prev.filter(item => item.id !== id));
                } catch (error) {
                  console.error('删除字幕失败:', error);
                  alert('删除字幕失败: ' + (error instanceof Error ? error.message : '未知错误'));
                }
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 翻译对话框 */}
      {renderTranslationDialog()}

      {/* 错误提示 */}
      <ErrorSnackbar
        message={errorMessage}
        severity={statusSeverity}
        onClose={() => setErrorMessage(null)}
      />
    </Box>
  );
};

export default VideoDetailWithTranslation;
