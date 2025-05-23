import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  Box,
  Typography,
  Button,
  Grid,
  Stack,
  Container,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Fade,
  Slide,
  Zoom
} from '@mui/material';
import {
  VideoLibrary as VideoLibraryIcon,
  Upload as UploadIcon,
  Translate as TranslateIcon,
  Settings as SettingsIcon,
  PlayCircle as PlayCircleIcon,
  Subtitles as SubtitlesIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
  Language as LanguageIcon,
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import HeroSection from '../components/ui/HeroSection';
import StatsCard from '../components/ui/StatsCard';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { state } = useAppContext();
  const { videos } = state;

  // 功能特性列表
  const features = [
    {
      icon: TranslateIcon,
      title: 'AI智能翻译',
      description: '支持多种AI模型，提供高质量的字幕翻译服务'
    },
    {
      icon: SubtitlesIcon,
      title: '字幕提取',
      description: '自动提取视频中的内嵌字幕，支持多种格式'
    },
    {
      icon: LanguageIcon,
      title: '多语言支持',
      description: '支持50+种语言的翻译，满足全球化需求'
    },
    {
      icon: SpeedIcon,
      title: '批量处理',
      description: '高效批量处理多个视频文件，节省时间'
    },
    {
      icon: CloudIcon,
      title: '云端同步',
      description: '项目云端同步，随时随地访问你的翻译任务'
    },
    {
      icon: AnalyticsIcon,
      title: '详细统计',
      description: '翻译质量分析和项目进度统计'
    }
  ];

  // 快速操作列表
  const quickActions = [
    {
      icon: UploadIcon,
      title: '导入新视频',
      description: '开始新的翻译项目',
      color: 'primary' as const,
      action: () => navigate('/videos')
    },
    {
      icon: VideoLibraryIcon,
      title: '视频库',
      description: '管理已有视频',
      color: 'secondary' as const,
      action: () => navigate('/videos')
    },
    {
      icon: SettingsIcon,
      title: '系统设置',
      description: '配置AI模型和翻译参数',
      color: 'info' as const,
      action: () => navigate('/settings')
    }
  ];

  // 统计数据
  const stats = useMemo(() => {
    const totalVideos = videos.length;
    const withSubtitles = videos.filter(v => v.hasEmbeddedSubtitles || v.hasExternalSubtitles).length;
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    
    return {
      totalVideos,
      withSubtitles,
      totalDuration,
      completionRate: totalVideos > 0 ? Math.round((withSubtitles / totalVideos) * 100) : 0
    };
  }, [videos]);

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Hero区域 */}
      <HeroSection
        title="欢迎使用 SubTranslate"
        subtitle="智能视频字幕翻译系统"
        description="SubTranslate 是一款强大的视频字幕翻译工具，支持多种 AI 模型和语言，为您提供高质量的字幕翻译体验。"
        primaryAction={{
          label: '开始翻译',
          onClick: () => navigate('/videos'),
          icon: UploadIcon
        }}
        secondaryAction={{
          label: '查看视频库',
          onClick: () => navigate('/videos'),
          icon: VideoLibraryIcon,
          variant: 'outlined'
        }}
        backgroundVariant="gradient"
        size="large"
      />

      {/* 统计概览 */}
      <Slide direction="up" in={true} timeout={800}>
        <Box sx={{ mt: 6, mb: 6 }}>
          <Typography 
            variant="h4" 
            component="h2" 
            sx={{ 
              mb: 3,
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            项目概览
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Zoom in={true} timeout={600}>
                <Box>
                  <StatsCard
                    title="总视频数"
                    value={stats.totalVideos}
                    description="已导入的视频文件"
                    icon={VideoLibraryIcon}
                    variant="primary"
                    onClick={() => navigate('/videos')}
                  />
                </Box>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in={true} timeout={700}>
                <Box>
                  <StatsCard
                    title="已处理"
                    value={stats.withSubtitles}
                    description="包含字幕的视频"
                    icon={SubtitlesIcon}
                    variant="success"
                    progress={stats.completionRate}
                  />
                </Box>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in={true} timeout={800}>
                <Box>
                  <StatsCard
                    title="总时长"
                    value={formatDuration(stats.totalDuration)}
                    description="视频内容总长度"
                    icon={AccessTimeIcon}
                    variant="info"
                  />
                </Box>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in={true} timeout={900}>
                <Box>
                  <StatsCard
                    title="完成率"
                    value={`${stats.completionRate}%`}
                    description="项目完成进度"
                    icon={TrendingUpIcon}
                    variant="warning"
                    trend={{
                      value: 12,
                      label: '本周',
                      isPositive: true
                    }}
                  />
                </Box>
              </Zoom>
            </Grid>
          </Grid>
        </Box>
      </Slide>

      <Grid container spacing={6}>
        {/* 快速操作 */}
        <Grid item xs={12} lg={6}>
          <Fade in={true} timeout={1000}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.02)})`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main
                    }}
                  >
                    <SpeedIcon fontSize="medium" />
                  </Box>
                  <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
                    快速操作
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  {quickActions.map((action, index) => (
                    <Grid item xs={12} key={action.title}>
                      <Slide direction="right" in={true} timeout={300 + index * 100}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: `1px solid ${alpha(theme.palette[action.color].main, 0.2)}`,
                            '&:hover': {
                              transform: 'translateX(8px)',
                              boxShadow: theme.shadows[4],
                              backgroundColor: alpha(theme.palette[action.color].main, 0.05)
                            }
                          }}
                          onClick={action.action}
                        >
                          <CardContent sx={{ p: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 40,
                                  height: 40,
                                  borderRadius: 2,
                                  backgroundColor: alpha(theme.palette[action.color].main, 0.1),
                                  color: theme.palette[action.color].main
                                }}
                              >
                                <action.icon fontSize="small" />
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {action.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {action.description}
                                </Typography>
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Slide>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* 功能特性 */}
        <Grid item xs={12} lg={6}>
          <Fade in={true} timeout={1200}>
            <Card 
              sx={{ 
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)}, ${alpha(theme.palette.primary.main, 0.02)})`,
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                      color: theme.palette.secondary.main
                    }}
                  >
                    <CheckCircleIcon fontSize="medium" />
                  </Box>
                  <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
                    核心功能
                  </Typography>
                </Stack>

                <List sx={{ p: 0 }}>
                  {features.map((feature, index) => (
                    <Slide direction="left" in={true} timeout={300 + index * 100} key={feature.title}>
                      <ListItem 
                        sx={{ 
                          px: 0, 
                          py: 1.5,
                          borderRadius: 2,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.action.hover, 0.04)
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 48 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 36,
                              height: 36,
                              borderRadius: 2,
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main
                            }}
                          >
                            <feature.icon fontSize="small" />
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {feature.title}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {feature.description}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Slide>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* 底部行动召唤 */}
      <Fade in={true} timeout={1400}>
        <Box 
          sx={{ 
            mt: 8, 
            p: 6,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
            borderRadius: 4,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Typography 
            variant="h4" 
            component="h3" 
            sx={{ 
              mb: 2,
              fontWeight: 600,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            准备开始您的翻译之旅？
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            立即导入您的第一个视频文件，体验AI驱动的智能字幕翻译服务。
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<UploadIcon />}
              onClick={() => navigate('/videos')}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 3,
                fontSize: '1.1rem',
                fontWeight: 600,
                boxShadow: theme.shadows[4],
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[8]
                }
              }}
            >
              立即开始
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/settings')}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 3,
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              配置设置
            </Button>
          </Stack>
        </Box>
      </Fade>
    </Container>
  );
};

export default Home;
