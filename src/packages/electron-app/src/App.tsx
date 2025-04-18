import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Paper, 
  Button, 
  Alert, 
  LinearProgress, 
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText 
} from '@mui/material';
import { 
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Timelapse as TimelapseIcon
} from '@mui/icons-material';
import Layout from './components/Layout';
import Home from './pages/Home';
import Videos from './pages/Videos';
import Settings from './pages/Settings';

// 启动步骤组件
interface StartupStepProps {
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
}

const StartupStep: React.FC<StartupStepProps> = ({ label, status, message }) => {
  let statusIcon;
  let statusColor;

  switch (status) {
    case 'pending':
      statusIcon = <TimelapseIcon color="disabled" />;
      statusColor = 'text.secondary';
      break;
    case 'loading':
      statusIcon = <CircularProgress size={20} />;
      statusColor = 'primary.main';
      break;
    case 'success':
      statusIcon = <CheckIcon color="success" />;
      statusColor = 'success.main';
      break;
    case 'error':
      statusIcon = <ErrorIcon color="error" />;
      statusColor = 'error.main';
      break;
  }

  return (
    <ListItem>
      <ListItemIcon>{statusIcon}</ListItemIcon>
      <ListItemText 
        primary={<Typography color={statusColor}>{label}</Typography>} 
        secondary={message} 
      />
    </ListItem>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [backendReady, setBackendReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // 启动步骤状态
  const [startupSteps, setStartupSteps] = useState<{
    python: 'pending' | 'loading' | 'success' | 'error';
    api: 'pending' | 'loading' | 'success' | 'error';
    healthCheck: 'pending' | 'loading' | 'success' | 'error';
  }>({
    python: 'loading',
    api: 'pending',
    healthCheck: 'pending'
  });

  useEffect(() => {
    // 更新经过的时间
    const timer = setInterval(() => {
      if (loading) {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, startTime]);

  // 检查后端状态并设置相应的启动步骤状态
  useEffect(() => {
    // 检查后端状态
    const checkBackendStatus = async () => {
      try {
        // 设置Python进程启动状态
        setStartupSteps(prev => ({ ...prev, python: 'loading' }));
        
        const isRunning = await window.electronAPI.checkBackendStatus();
        if (isRunning) {
          // 后端已启动
          setStartupSteps(prev => ({ 
            ...prev, 
            python: 'success',
            api: 'success',
            healthCheck: 'success'
          }));
          setBackendReady(true);
          setLoading(false);
        } else {
          // 等待后端启动消息 - Python进程启动成功
          const removeListener = window.electronAPI.onBackendStarted(() => {
            setStartupSteps(prev => ({ 
              ...prev, 
              python: 'success',
              api: 'success',
              healthCheck: 'success'
            }));
            setBackendReady(true);
            setLoading(false);
          });

          // 如果20秒后API服务仍未启动，设置API启动中
          const apiTimeout = setTimeout(() => {
            if (!backendReady) {
              setStartupSteps(prev => ({ 
                ...prev, 
                python: 'success',
                api: 'loading'
              }));
            }
          }, 5000);

          // 如果30秒后仍未启动，显示错误，但继续等待
          const healthCheckTimeout = setTimeout(() => {
            if (!backendReady) {
              setStartupSteps(prev => ({ 
                ...prev, 
                api: 'success',
                healthCheck: 'loading'
              }));
            }
          }, 15000);

          // 最终超时
          const finalTimeout = setTimeout(() => {
            if (!backendReady) {
              setStartupSteps(prev => ({ 
                ...prev, 
                healthCheck: 'error'
              }));
              setError('后端服务启动超时，请重试或重启应用');
              setLoading(false);
            }
          }, 30000);

          return () => {
            clearTimeout(apiTimeout);
            clearTimeout(healthCheckTimeout);
            clearTimeout(finalTimeout);
            removeListener();
          };
        }
      } catch (err) {
        setStartupSteps(prev => ({ 
          ...prev, 
          python: 'error'
        }));
        setError('检查后端状态时出错: ' + (err as Error).message);
        setLoading(false);
      }
    };

    checkBackendStatus();

    // 监听后端停止事件 - 添加安全检查
    const removeStoppedListener = window.electronAPI && window.electronAPI.onBackendStopped ? 
      window.electronAPI.onBackendStopped((data) => {
        setBackendReady(false);
        setError(`后端服务已停止，退出码: ${data.code}。请重启应用。`);
      }) : () => {};

    return () => {
      removeStoppedListener();
    };
  }, [backendReady, retryCount]);

  // 处理重试
  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    setStartTime(Date.now());
    setElapsedTime(0);
    setRetryCount(prev => prev + 1);
    
    // 重置启动步骤
    setStartupSteps({
      python: 'loading',
      api: 'pending',
      healthCheck: 'pending'
    });

    try {
      // 尝试重启后端服务
      if (window.electronAPI.restartBackend) {
        await window.electronAPI.restartBackend();
      } else {
        // 如果不支持重启，则简单刷新页面
        window.location.reload();
      }
    } catch (err) {
      setError('重启后端服务失败: ' + (err as Error).message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          p: 3,
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            width: '100%', 
            maxWidth: 500,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="h5" gutterBottom>
            正在启动服务
          </Typography>
          
          <Box sx={{ width: '100%', mt: 1, mb: 3 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min((elapsedTime / 30) * 100, 100)} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            已耗时: {elapsedTime} 秒
          </Typography>
          
          <Divider sx={{ width: '100%', my: 2 }} />
          
          <List sx={{ width: '100%' }}>
            <StartupStep 
              label="启动Python进程" 
              status={startupSteps.python} 
              message={startupSteps.python === 'loading' ? '正在启动...' : undefined}
            />
            <StartupStep 
              label="初始化API服务" 
              status={startupSteps.api}
              message={startupSteps.api === 'loading' ? '正在初始化...' : undefined}
            />
            <StartupStep 
              label="健康检查" 
              status={startupSteps.healthCheck}
              message={startupSteps.healthCheck === 'loading' ? '正在检查服务可用性...' : undefined}
            />
          </List>
          
          {elapsedTime > 20 && (
            <Alert severity="info" sx={{ mt: 3, width: '100%' }}>
              <Typography variant="body2">
                服务启动可能需要较长时间，请耐心等待。如果长时间无响应，请尝试重启应用。
              </Typography>
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          p: 3,
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            width: '100%', 
            maxWidth: 500,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
          
          <Typography variant="h5" color="error" gutterBottom>
            出错了
          </Typography>
          
          <Typography textAlign="center" sx={{ mb: 1 }}>
            {error}
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2">
                如果您已经启动了后端服务，可以尝试刷新页面重新检测。
              </Typography>
            </Box>
          </Alert>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleRetry}
            size="large"
          >
            重试
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default App; 
