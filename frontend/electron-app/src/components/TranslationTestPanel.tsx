import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Alert,
  AlertTitle,
  Stack,
  Chip,
  Paper,
  LinearProgress,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  BugReport as TestIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';

interface TranslationResult {
  index: number;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  original: string;
  translated: string;
  confidence?: number;
}

interface TranslationTestPanelProps {
  onTestResults?: (results: TranslationResult[]) => void;
}

const TranslationTestPanel: React.FC<TranslationTestPanelProps> = ({ onTestResults }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subtitleCount, setSubtitleCount] = useState(10);
  
  const wsRef = useRef<WebSocket | null>(null);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // 启动模拟翻译测试
  const startMockTranslation = async () => {
    try {
      setIsLoading(true);
      setStatus('running');
      setError(null);
      setResults([]);
      setProgress(0);

      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/test/mock-translation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: 'test-video-id',
          track_index: 0,
          source_language: 'en',
          target_language: 'zh',
          subtitle_count: subtitleCount
        })
      });

      if (!response.ok) {
        throw new Error(`测试请求失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '测试请求失败');
      }

      const taskId = result.data.task_id;

      // 建立WebSocket连接监听进度
      const ws = new WebSocket(`ws://localhost:${apiPort}/api/test/ws/${taskId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('测试WebSocket连接已建立');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('测试WebSocket收到消息:', data);

        if (data.type === 'progress') {
          setProgress(data.percentage || 0);
        } else if (data.type === 'completed') {
          console.log('测试翻译完成:', {
            resultsLength: data.results?.length || 0,
            firstResult: data.results?.[0]
          });

          setStatus('completed');
          setResults(data.results || []);
          setProgress(100);
          
          // 通知父组件
          if (onTestResults && data.results) {
            onTestResults(data.results);
          }
        } else if (data.type === 'error') {
          setStatus('error');
          setError(`测试失败: ${data.message || '未知错误'}`);
        }
      };

      ws.onerror = (event) => {
        console.error('测试WebSocket错误:', event);
        setStatus('error');
        setError('WebSocket连接错误');
      };

      ws.onclose = () => {
        console.log('测试WebSocket连接已关闭');
        wsRef.current = null;
        setIsLoading(false);
      };

    } catch (err) {
      setStatus('error');
      setError(`测试失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setIsLoading(false);
    }
  };

  // 获取示例结果
  const getSampleResults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiPort = '8000';
      const response = await fetch(`http://localhost:${apiPort}/api/test/sample-results`);

      if (!response.ok) {
        throw new Error(`获取示例结果失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data.results) {
        setResults(result.data.results);
        setStatus('completed');
        
        // 通知父组件
        if (onTestResults) {
          onTestResults(result.data.results);
        }
      } else {
        throw new Error(result.message || '获取示例结果失败');
      }

    } catch (err) {
      setError(`获取示例结果失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 重置测试
  const resetTest = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setStatus('idle');
    setResults([]);
    setProgress(0);
    setError(null);
    setIsLoading(false);
  };

  return (
    <Card sx={{ mb: 3, border: '2px dashed #1976d2' }}>
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <TestIcon color="primary" />
            <Typography variant="h6" color="primary">
              翻译功能测试面板
            </Typography>
          </Stack>
        }
        sx={{ backgroundColor: 'rgba(25, 118, 210, 0.05)' }}
      />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          使用此面板快速测试翻译预览功能，无需等待完整的翻译过程
        </Typography>

        {/* 控制面板 */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>字幕条数</InputLabel>
            <Select
              value={subtitleCount}
              onChange={(e) => setSubtitleCount(Number(e.target.value))}
              label="字幕条数"
              disabled={isLoading}
            >
              <MenuItem value={5}>5条</MenuItem>
              <MenuItem value={10}>10条</MenuItem>
              <MenuItem value={20}>20条</MenuItem>
              <MenuItem value={50}>50条</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={startMockTranslation}
            disabled={isLoading || status === 'running'}
          >
            模拟翻译过程
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={getSampleResults}
            disabled={isLoading}
          >
            直接获取示例结果
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetTest}
            disabled={isLoading}
          >
            重置
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* 状态显示 */}
        {status === 'running' && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">
                正在模拟翻译过程... {Math.round(progress)}%
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {status === 'completed' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <AlertTitle>测试完成</AlertTitle>
            成功生成了 {results.length} 条模拟翻译结果
          </Alert>
        )}

        {status === 'error' && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>测试失败</AlertTitle>
            {error}
          </Alert>
        )}

        {/* 结果预览 */}
        {results.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              测试结果预览 (前3条):
            </Typography>
            {results.slice(0, 3).map((result, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1 }}>
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
                      color={result.confidence > 0.8 ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
            {results.length > 3 && (
              <Typography variant="caption" color="text.secondary">
                ... 还有 {results.length - 3} 条结果
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TranslationTestPanel;
