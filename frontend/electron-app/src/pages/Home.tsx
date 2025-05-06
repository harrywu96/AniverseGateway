import React from 'react';
import { Box, Typography, Button, Paper, Grid, Stack } from '@mui/material';
import { VideoLibrary as VideoIcon, Upload as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            欢迎使用 SubTranslate
          </Typography>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            智能视频字幕翻译系统
          </Typography>
          <Typography variant="body1" sx={{ mt: 2, maxWidth: 800, mx: 'auto' }}>
            SubTranslate 是一款强大的视频字幕翻译工具，支持多种 AI 模型和语言，为您提供高质量的字幕翻译体验。
          </Typography>
        </Box>

        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                }
              }}
            >
              <VideoIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
              <Typography variant="h5" gutterBottom>浏览视频</Typography>
              <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                查看已导入的视频和翻译任务
              </Typography>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<VideoIcon />}
                onClick={() => navigate('/videos')}
                sx={{ mt: 'auto' }}
              >
                视频库
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                }
              }}
            >
              <UploadIcon sx={{ fontSize: 60, mb: 2, color: 'secondary.main' }} />
              <Typography variant="h5" gutterBottom>添加新视频</Typography>
              <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                导入新视频并开始翻译任务
              </Typography>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large" 
                startIcon={<UploadIcon />}
                onClick={() => navigate('/videos')}
                sx={{ mt: 'auto' }}
              >
                导入视频
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Home;
