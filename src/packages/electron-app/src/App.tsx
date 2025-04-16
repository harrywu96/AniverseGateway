import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import Home from './pages/Home';
import Videos from './pages/Videos';
import Settings from './pages/Settings';

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [backendReady, setBackendReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查后端状态
    const checkBackendStatus = async () => {
      try {
        const isRunning = await window.electronAPI.checkBackendStatus();
        if (isRunning) {
          setBackendReady(true);
          setLoading(false);
        } else {
          // 等待后端启动消息
          const removeListener = window.electronAPI.onBackendStarted(() => {
            setBackendReady(true);
            setLoading(false);
          });

          // 如果30秒后仍未启动，显示错误
          const timeout = setTimeout(() => {
            if (!backendReady) {
              setError('后端服务启动超时，请重启应用');
              setLoading(false);
            }
          }, 30000);

          return () => {
            clearTimeout(timeout);
            removeListener();
          };
        }
      } catch (err) {
        setError('检查后端状态时出错: ' + (err as Error).message);
        setLoading(false);
      }
    };

    checkBackendStatus();

    // 监听后端停止事件 - 添加安全检查
    const removeStoppedListener = window.electronAPI && window.electronAPI.onBackendStopped ? 
      window.electronAPI.onBackendStopped((data) => {
        setBackendReady(false);
        setError(`后端服务已停止，退出码: ${data}。请重启应用。`);
      }) : () => {};

    return () => {
      removeStoppedListener();
    };
  }, [backendReady]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Box sx={{ mt: 2 }}>正在启动后端服务...</Box>
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
          gap: 2,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Box color="error.main" sx={{ typography: 'h6' }}>
          出错了
        </Box>
        <Box>{error}</Box>
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
