import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Snackbar,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  PlayArrow as PlayIcon,
  Subtitles as SubtitlesIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { VideoInfo } from '@subtranslate/shared';

// 定义TabPanel组件
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ width: '100%' }}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Videos: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{message: string; details?: string} | null>(null);

  // 使用全局状态
  const { state, addVideo, selectVideo } = useAppContext();
  const { videos, selectedVideo } = state;

  // Faster Whisper 相关状态
  const [whisperSettings, setWhisperSettings] = useState<{
    configPath: string;
    modelPath: string;
  }>({ configPath: '', modelPath: '' });
  const [openWhisperDialog, setOpenWhisperDialog] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState('');
  const [transcribeTaskId, setTranscribeTaskId] = useState('');
  const [processingWhisper, setProcessingWhisper] = useState(false);
  const [outputPath, setOutputPath] = useState('');
  const [previewContent, setPreviewContent] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // 检查Electron API是否可用
  useEffect(() => {
    if (!window.electronAPI) {
      setError({ message: 'Electron API不可用，可能不在Electron环境中运行。' });
    }
  }, []);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.getSettings();
          if (settings) {
            setWhisperSettings({
              configPath: settings.fasterWhisperConfigPath || '',
              modelPath: settings.modelPath || ''
            });
          }
        } catch (error) {
          console.error('加载设置失败:', error);
        }
      }
    };

    loadSettings();
  }, []);

  // 清理WebSocket连接
  useEffect(() => {
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [wsConnection]);

  const handleCloseError = () => {
    setError(null);
  };

  // 检查后端存储的视频列表
  const checkBackendVideos = async () => {
    try {
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/videos`);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('后端存储的视频列表:', result);

      if (result.success) {
        alert(`后端存储的视频数量: ${result.data.length}\n\n` +
              result.data.map((v: any) => `ID: ${v.id}, 文件名: ${v.filename}`).join('\n'));
      } else {
        alert(`获取视频列表失败: ${result.message}`);
      }
    } catch (error) {
      console.error('检查后端视频列表错误:', error);
      alert(`检查后端视频列表错误: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSelectVideo = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API不可用');
      }

      // 设置加载状态
      setLoading(true);

      // 选择视频文件
      const filePath = await window.electronAPI.selectVideo();
      if (filePath) {
        // 创建临时视频对象
        const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
        const tempVid: VideoInfo = {
          id: Date.now().toString(),
          fileName: fileName,
          filePath: filePath,
          format: '',
          duration: 0,
          hasEmbeddedSubtitles: false,
          hasExternalSubtitles: false
        };

        // 调用后端上传视频并解析视频信息
        console.log('正在将视频发送到后端进行解析:', filePath);
        const response = await window.electronAPI.uploadVideo(filePath);

        if (response.success && response.data) {
          console.log('视频解析成功:', response.data);

          // 使用后端返回的数据更新视频信息
          const videoData = response.data;

          // 重要: 保存后端返回的视频ID，这对于后续的API调用至关重要
          console.log('后端返回的视频ID:', videoData.id);

          // 将后端数据转换为前端需要的格式
          const vid: VideoInfo = {
            id: videoData.id, // 必须使用后端返回的ID，而不是前端生成的
            fileName: videoData.filename || tempVid.fileName,
            filePath: videoData.path || tempVid.filePath,
            format: videoData.format || '',
            duration: videoData.duration || 0,
            hasEmbeddedSubtitles: videoData.has_embedded_subtitle || false,
            hasExternalSubtitles: videoData.external_subtitles?.length > 0 || false,
            subtitleTracks: videoData.subtitle_tracks?.map(track => ({
              id: track.index.toString(),
              language: track.language || 'unknown',
              title: track.title || '',
              format: track.codec || 'unknown',
              isExternal: false,
            })) || []
          };

          // 使用全局状态的方法
          selectVideo(vid);
          addVideo(vid);
        } else {
          // 如果解析失败，使用临时对象
          console.warn('视频解析失败，使用基本信息:', response.error || response.message);
          selectVideo(tempVid);
          addVideo(tempVid);

          // 显示警告但不阻止继续
          setError({
            message: '视频解析部分失败，只显示基本信息',
            details: response.error || response.message || '未知错误'
          });
        }
      }
    } catch (error) {
      console.error('选择视频错误:', error);
      setError({
        message: '选择视频失败',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWhisperDialog = () => {
    if (!selectedVideo) {
      setError({ message: '请先选择视频文件' });
      return;
    }

    // 重置状态
    setWhisperStatus('');
    setWhisperProgress(0);
    setOpenWhisperDialog(true);
    setSelectedTab(0); // 默认显示配置标签
  };

  const handleCloseWhisperDialog = () => {
    setOpenWhisperDialog(false);
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleSelectConfigFile = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API不可用');
      }

      const result = await window.electronAPI.openFileDialog({
        title: '选择Faster Whisper配置文件',
        defaultPath: whisperSettings.configPath || undefined,
        filters: [
          { name: 'JSON文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setWhisperSettings({
          ...whisperSettings,
          configPath: filePath
        });

        // 加载配置文件获取参数信息
        try {
          const configParams = await window.electronAPI.getFasterWhisperParams(filePath);

          if (configParams.success) {
            // 显示配置文件信息
            setWhisperStatus(`已加载配置: ${filePath}\n模型: ${configParams.parameters?.model_path || '未指定'}`);
          } else {
            setError({
              message: '加载配置参数失败',
              details: configParams.message || '未知错误'
            });
          }
        } catch (error) {
          console.error('获取配置参数错误:', error);
          setError({
            message: '获取配置参数失败',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      console.error('选择配置文件错误:', error);
      setError({
        message: '选择配置文件失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API不可用');
      }

      const result = await window.electronAPI.openDirectoryDialog({
        title: '选择输出目录',
        defaultPath: outputPath || undefined
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setOutputPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('选择输出目录错误:', error);
      setError({
        message: '选择输出目录失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const startTranscription = async () => {
    if (!selectedVideo || !selectedVideo.filePath) {
      setError({ message: '请先选择视频文件' });
      return;
    }

    try {
      setProcessingWhisper(true);
      setWhisperProgress(0);
      setWhisperStatus('准备中...');
      setTranscribeTaskId('');
      setPreviewContent([]);

      // 使用faster-whisper配置进行转写
      if (!window.electronAPI) {
        throw new Error('Electron API不可用');
      }

      const response = await window.electronAPI.transcribeWithGUIConfig({
        videoPath: selectedVideo.filePath,
        configPath: whisperSettings.configPath || undefined,
        outputDir: outputPath || undefined
      });

      if (response.success && response.data && response.data.task_id) {
        setTranscribeTaskId(response.data.task_id);
        setWhisperStatus('处理中...');

        // 建立WebSocket连接监听进度
        const apiPort = '8000'; // 如果API端口不是固定的，需要从配置获取
        const ws = new WebSocket(`ws://localhost:${apiPort}/api/speech-to-text/ws/${response.data.task_id}`);

        ws.onopen = () => {
          console.log('WebSocket 连接已建立');
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.progress !== undefined) {
            setWhisperProgress(data.progress * 100);
          }

          if (data.message) {
            setWhisperStatus(data.message);
          }

          if (data.status === 'completed') {
            setWhisperProgress(100);
            setWhisperStatus('转写完成');
            loadTranscriptionResult(response.data.task_id);
          } else if (data.status === 'failed') {
            setWhisperStatus(`转写失败: ${data.message || '未知错误'}`);
            setError({ message: '转写失败', details: data.message });
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket 错误:', event);
          setError({ message: 'WebSocket 连接错误' });
        };

        ws.onclose = () => {
          console.log('WebSocket 连接已关闭');
        };

        setWsConnection(ws);
      } else {
        setWhisperStatus('转写失败');
        setError({
          message: '提交转写任务失败',
          details: response.message || '未知错误'
        });
      }
    } catch (error) {
      console.error('转写错误:', error);
      setWhisperStatus('转写错误');
      setError({
        message: '转写过程中出错',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setProcessingWhisper(false);
    }
  };

  const loadTranscriptionResult = async (taskId: string) => {
    try {
      // 使用任务ID获取转写结果
      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/speech-to-text/task/${taskId}`);

      if (!response.ok) {
        throw new Error(`获取结果失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data && result.data.result) {
        // 解析SRT文件内容进行预览
        const segments = result.data.result.segments || [];
        const previewLines = segments.map((segment: any, index: number) => {
          const startTime = formatTimestamp(segment.start);
          const endTime = formatTimestamp(segment.end);
          return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
        });

        setPreviewContent(previewLines);
        setSelectedTab(1); // 切换到结果标签
      } else {
        setError({ message: '无法获取转写结果', details: result.message });
      }
    } catch (error) {
      console.error('获取转写结果错误:', error);
      setError({
        message: '获取转写结果失败',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 格式化时间戳为SRT格式 (HH:MM:SS,mmm)
  const formatTimestamp = (seconds: number): string => {
    const date = new Date(0);
    date.setSeconds(seconds);

    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(Math.floor(seconds % 60)).padStart(2, '0');

    // 获取毫秒部分
    const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');

    return `${hours}:${minutes}:${secs},${ms}`;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          视频管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="info"
            onClick={checkBackendVideos}
            disabled={loading}
          >
            检查后端视频
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
            onClick={handleSelectVideo}
            disabled={loading}
          >
            {loading ? '正在处理...' : '导入视频'}
          </Button>
        </Box>
      </Box>

      {videos.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无视频
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            点击"导入视频"按钮添加您的第一个视频
          </Typography>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleSelectVideo}
            disabled={loading}
          >
            导入视频
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {videos.map((video) => (
            <Grid item xs={12} sm={6} md={4} key={video.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="div"
                  sx={{
                    height: 0,
                    paddingTop: '56.25%', // 16:9
                    backgroundColor: 'grey.900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" noWrap>
                    {video.fileName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    格式: {video.format}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    字幕轨道: {video.subtitleTracks?.length || 0}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate(`/videos/${video.id}`)}
                  >
                    查看详情
                  </Button>
                  <Button size="small" color="primary">
                    开始翻译
                  </Button>
                  <Button
                    size="small"
                    startIcon={<SubtitlesIcon />}
                    onClick={() => handleOpenWhisperDialog()}
                    color="secondary"
                  >
                    转写字幕
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Faster Whisper 转写对话框 */}
      <Dialog
        open={openWhisperDialog}
        onClose={handleCloseWhisperDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              视频转写 - {selectedVideo?.fileName}
            </Typography>
            <IconButton onClick={handleCloseWhisperDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Tabs value={selectedTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab label="配置" />
            <Tab label="结果" disabled={previewContent.length === 0} />
          </Tabs>

          <TabPanel value={selectedTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Faster-Whisper 配置文件"
                    variant="outlined"
                    value={whisperSettings.configPath}
                    onChange={(e) => setWhisperSettings(prev => ({ ...prev, configPath: e.target.value }))}
                    placeholder="选择配置文件"
                    sx={{ mr: 1 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSelectConfigFile}
                    sx={{ minWidth: '100px' }}
                  >
                    浏览...
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  选择从Faster-Whisper GUI导出的配置文件进行转写
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <TextField
                    fullWidth
                    label="输出目录 (可选)"
                    variant="outlined"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="选择输出目录"
                    sx={{ mr: 1 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSelectOutputDir}
                    sx={{ minWidth: '100px' }}
                  >
                    浏览...
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  不指定则使用临时目录
                </Typography>
              </Grid>

              {whisperProgress > 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" gutterBottom>
                    {whisperStatus || '处理中...'}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={whisperProgress}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
                    {Math.round(whisperProgress)}%
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={selectedTab} index={1}>
            {previewContent.length > 0 ? (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  转写结果预览
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: 400,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {previewContent.slice(0, 20).map((line, index) => (
                    <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                      {line}
                    </Typography>
                  ))}
                  {previewContent.length > 20 && (
                    <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', fontStyle: 'italic' }}>
                      显示了前20条记录，共 {previewContent.length} 条
                    </Typography>
                  )}
                </Paper>
              </Box>
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
                暂无转写结果
              </Typography>
            )}
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button
            variant="outlined"
            onClick={handleCloseWhisperDialog}
          >
            关闭
          </Button>

          {transcribeTaskId && whisperProgress === 100 && (
            <Button
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={() => {
                // 这里可以添加下载字幕文件的逻辑
                console.log('下载字幕文件');
              }}
            >
              下载字幕
            </Button>
          )}

          <Button
            variant="contained"
            color="primary"
            startIcon={processingWhisper ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
            onClick={startTranscription}
            disabled={processingWhisper || !selectedVideo}
          >
            {processingWhisper ? '处理中...' : '开始转写'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 错误提示 */}
      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          <AlertTitle>错误</AlertTitle>
          {error?.message}
          {error?.details && (
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
              {error.details}
            </Typography>
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Videos;