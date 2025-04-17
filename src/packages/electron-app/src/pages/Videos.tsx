import React, { useState } from 'react';
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
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { VideoInfo } from '@subtranslate/shared';

const Videos: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [error, setError] = useState<{message: string; details?: string} | null>(null);

  const handleCloseError = () => {
    setError(null);
  };

  const handleSelectVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 调用Electron方法选择视频文件
      const filePath = await window.electronAPI.selectVideo();
      
      if (!filePath) {
        setLoading(false);
        return;
      }

      // 上传视频到后端
      const result = await window.electronAPI.uploadVideo(filePath);
      console.log('result', result);
      
      if (result.success && result.data) {
        // 添加视频到列表
        setVideos((prevVideos) => [result.data, ...prevVideos]);
      } else {
        console.error('上传视频失败:', result.error);
        // 显示错误提示
        setError({
          message: result.error || '上传视频失败',
          details: result.details
        });
      }
    } catch (error) {
      console.error('处理视频时出错:', error);
      // 显示错误提示
      setError({
        message: '处理视频时出错',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          视频管理
        </Typography>
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
                  <Button size="small">查看详情</Button>
                  <Button size="small" color="primary">
                    开始翻译
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

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