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
    // 妫€鏌ュ悗绔姸鎬?
    const checkBackendStatus = async () => {
      try {
        const isRunning = await window.electronAPI.checkBackendStatus();
        if (isRunning) {
          setBackendReady(true);
          setLoading(false);
        } else {
          // 绛夊緟鍚庣鍚姩娑堟伅
          const removeListener = window.electronAPI.onBackendStarted(() => {
            setBackendReady(true);
            setLoading(false);
          });

          // 濡傛灉30绉掑悗浠嶆湭鍚姩锛屾樉绀洪敊璇?
          const timeout = setTimeout(() => {
            if (!backendReady) {
              setError('鍚庣鏈嶅姟鍚姩瓒呮椂锛岃閲嶅惎搴旂敤');
              setLoading(false);
            }
          }, 30000);

          return () => {
            clearTimeout(timeout);
            removeListener();
          };
        }
      } catch (err) {
        setError('妫€鏌ュ悗绔姸鎬佹椂鍑洪敊: ' + (err as Error).message);
        setLoading(false);
      }
    };

    checkBackendStatus();

        // 鐩戝惉鍚庣鍋滄浜嬩欢 - 娣诲姞瀹夊叏妫€鏌?
    const removeStoppedListener = window.electronAPI && window.electronAPI.onBackendStopped ? 
      window.electronAPI.onBackendStopped((data) => {
        setBackendReady(false);
        setError(鍚庣鏈嶅姟宸插仠姝紝閫€鍑虹爜: \銆傝閲嶅惎搴旂敤銆俙);
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
        <Box sx={{ mt: 2 }}>姝ｅ湪鍚姩鍚庣鏈嶅姟...</Box>
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
          鍑洪敊浜?
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
