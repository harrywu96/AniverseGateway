import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Button,
  Divider,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Fade,
  Zoom,
  Grow,
  keyframes,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  CloudQueue as CloudIcon,
  Computer as ServerIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { getCustomProviders, activateCustomProvider, deleteCustomProvider } from '../services/api';

// 现代化深色主题
const modernTheme = {
  primary: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    main: '#667eea',
    glow: '0 0 20px rgba(102, 126, 234, 0.6)',
  },
  secondary: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    main: '#f093fb',
    glow: '0 0 20px rgba(240, 147, 251, 0.6)',
  },
  accent: {
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    main: '#4facfe',
    glow: '0 0 20px rgba(79, 172, 254, 0.6)',
  },
  surface: {
    dark: 'linear-gradient(135deg, #1e1e2f 0%, #2d1b69 100%)',
    card: 'rgba(255, 255, 255, 0.05)',
    cardHover: 'rgba(255, 255, 255, 0.08)',
  }
};

// 动画关键帧
const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const floatAnimation = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-4px);
  }
`;

const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px rgba(102, 126, 234, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.8), 0 0 30px rgba(102, 126, 234, 0.6);
  }
`;

interface CustomProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  format_type: string;
  model_count: number;
  is_active: boolean;
}

interface CustomProviderListProps {
  onAddProvider: () => void;
  onEditProvider: (provider: CustomProvider) => void;
  onSelectProvider: (providerId: string) => void;
  onRefresh: () => void;
}

const CustomProviderList: React.FC<CustomProviderListProps> = ({
  onAddProvider,
  onEditProvider,
  onSelectProvider,
  onRefresh,
}) => {
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<CustomProvider | null>(null);
  const [error, setError] = useState('');
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  // 加载自定义提供商列表
  const fetchProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getCustomProviders();
      if (response.success && response.data) {
        setProviders(response.data.providers);
        setActiveProvider(response.data.active_provider);
      } else {
        setError(response.message || '获取自定义提供商列表失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取自定义提供商列表出错');
      console.error('获取自定义提供商列表出错:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchProviders();
  }, []);

  // 激活提供商
  const handleActivate = async (providerId: string) => {
    try {
      const response = await activateCustomProvider(providerId);
      if (response.success) {
        setActiveProvider(providerId);
        onSelectProvider(providerId);
        fetchProviders();
      } else {
        setError(response.message || '激活提供商失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '激活提供商出错');
      console.error('激活提供商出错:', error);
    }
  };

  // 删除提供商
  const handleDelete = async () => {
    if (!providerToDelete) return;
    
    try {
      const response = await deleteCustomProvider(providerToDelete.id);
      if (response.success) {
        fetchProviders();
        onRefresh();
        setDeleteDialogOpen(false);
        setProviderToDelete(null);
      } else {
        setError(response.message || '删除提供商失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除提供商出错');
      console.error('删除提供商出错:', error);
    }
  };

  // 打开删除对话框
  const openDeleteDialog = (provider: CustomProvider, event: React.MouseEvent) => {
    event.stopPropagation();
    setProviderToDelete(provider);
    setDeleteDialogOpen(true);
  };

  // 编辑提供商
  const handleEdit = (provider: CustomProvider, event: React.MouseEvent) => {
    event.stopPropagation();
    onEditProvider(provider);
  };

  // 获取提供商头像
  const getProviderAvatar = (provider: CustomProvider) => {
    const initials = provider.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    const isActive = provider.is_active;
    const isHovered = hoveredProvider === provider.id;
    
    return (
      <Avatar
        sx={{
          background: isActive ? modernTheme.primary.gradient : modernTheme.accent.gradient,
          width: 48,
          height: 48,
          border: '2px solid rgba(255,255,255,0.2)',
          transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          animation: isActive ? `${pulseGlow} 3s ease-in-out infinite` : 'none',
          transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
          boxShadow: isActive 
            ? modernTheme.primary.glow 
            : isHovered 
              ? modernTheme.accent.glow 
              : '0 4px 12px rgba(0,0,0,0.3)',
          fontWeight: 700,
          fontSize: '0.9rem',
          color: 'white',
        }}
      >
        {initials}
      </Avatar>
    );
  };

  // 现代化提供商项目组件
  const ProviderItem = ({ provider }: { provider: CustomProvider }) => {
    const isActive = provider.is_active;
    const isHovered = hoveredProvider === provider.id;

    return (
      <Grow in timeout={300}>
        <Paper
          elevation={isActive ? 16 : isHovered ? 8 : 2}
          sx={{
            mb: 2,
            borderRadius: 3,
            background: isActive 
              ? `linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)`
              : isHovered 
                ? modernTheme.surface.cardHover
                : modernTheme.surface.card,
            backdropFilter: 'blur(10px)',
            border: isActive 
              ? '2px solid rgba(102, 126, 234, 0.3)' 
              : '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
            boxShadow: isActive 
              ? `${modernTheme.primary.glow}, 0 8px 32px rgba(0,0,0,0.3)` 
              : isHovered 
                ? '0 12px 40px rgba(0,0,0,0.2)'
                : '0 4px 16px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isHovered 
                ? 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                : 'transparent',
              transition: 'all 0.3s ease',
            },
            '&::after': isActive ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              animation: `${shimmer} 2s infinite`,
            } : {},
          }}
        >
          <ListItem
            onClick={() => handleActivate(provider.id)}
            onMouseEnter={() => setHoveredProvider(provider.id)}
            onMouseLeave={() => setHoveredProvider(null)}
            sx={{
              p: 2.5,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <ListItemAvatar sx={{ mr: 2 }}>
              {getProviderAvatar(provider)}
            </ListItemAvatar>
            
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      mr: 1,
                    }}
                  >
                    {provider.name}
                  </Typography>
                  {isActive && (
                    <Zoom in={isActive} timeout={300}>
                      <Chip
                        label="活跃"
                        size="small"
                        icon={<CheckIcon />}
                        sx={{
                          background: modernTheme.primary.gradient,
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 24,
                          boxShadow: modernTheme.primary.glow,
                          '& .MuiChip-icon': { color: 'white' },
                        }}
                      />
                    </Zoom>
                  )}
                </Box>
              }
              secondary={
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ServerIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', mr: 0.5 }} />
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {provider.base_url}
                    </Typography>
                  </Box>
                  {provider.model_count > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CloudIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', mr: 0.5 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: '0.8rem',
                        }}
                      >
                        {provider.model_count} 个模型
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
            />
            
            <ListItemSecondaryAction>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="编辑提供商" arrow>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => handleEdit(provider, e)}
                    sx={{
                      background: 'rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: modernTheme.accent.gradient,
                        transform: 'scale(1.1)',
                        boxShadow: modernTheme.accent.glow,
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="删除提供商" arrow>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => openDeleteDialog(provider, e)}
                    sx={{
                      background: 'rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: modernTheme.secondary.gradient,
                        transform: 'scale(1.1)',
                        boxShadow: modernTheme.secondary.glow,
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </ListItemSecondaryAction>
          </ListItem>
        </Paper>
      </Grow>
    );
  };

  return (
    <Paper 
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        background: modernTheme.surface.dark,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }
      }}
    >
      {/* 现代化头部 */}
      <Box 
        sx={{ 
          p: 3, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CloudIcon 
            sx={{ 
              mr: 2, 
              color: modernTheme.primary.main, 
              fontSize: 28,
              filter: 'drop-shadow(0 0 8px rgba(102, 126, 234, 0.6))',
            }} 
          />
          <Typography 
            variant="h6"
            sx={{
              color: 'white',
              fontWeight: 700,
              background: modernTheme.primary.gradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            自定义提供商
          </Typography>
        </Box>
        <Tooltip title="刷新提供商列表" arrow>
          <IconButton 
            size="small" 
            onClick={fetchProviders} 
            disabled={loading}
            sx={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: modernTheme.primary.gradient,
                transform: 'scale(1.1) rotate(180deg)',
                boxShadow: modernTheme.primary.glow,
              }
            }}
          >
            {loading ? (
              <CircularProgress 
                size={20} 
                sx={{ color: 'white' }} 
              />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* 提供商列表 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, position: 'relative', zIndex: 1 }}>
        {providers.length === 0 ? (
          <Fade in timeout={500}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                p: 4,
              }}
            >
              <ServerIcon 
                sx={{ 
                  fontSize: 64, 
                  color: 'rgba(255,255,255,0.3)', 
                  mb: 2,
                  animation: `${floatAnimation} 3s ease-in-out infinite`,
                }} 
              />
              <Typography
                variant="h6"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  mb: 1,
                  fontWeight: 600,
                }}
              >
                没有自定义提供商
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.9rem',
                }}
              >
                点击下方按钮添加新的提供商
              </Typography>
            </Box>
          </Fade>
        ) : (
          <List sx={{ p: 0 }}>
            {providers.map((provider) => (
              <ProviderItem key={provider.id} provider={provider} />
            ))}
          </List>
        )}
      </Box>
      
      {/* 现代化底部 */}
      <Box 
        sx={{ 
          p: 2,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddProvider}
          disabled={loading}
          sx={{
            borderColor: 'rgba(255,255,255,0.3)',
            color: 'white',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            py: 1.5,
            fontWeight: 600,
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            '&:hover': {
              background: modernTheme.primary.gradient,
              borderColor: 'transparent',
              transform: 'translateY(-2px)',
              boxShadow: modernTheme.primary.glow,
            },
            '&:disabled': {
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            }
          }}
        >
          添加提供商
        </Button>
      </Box>

      {/* 现代化删除确认对话框 */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            background: modernTheme.surface.dark,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: 'white',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, rgba(245, 87, 108, 0.15) 0%, rgba(240, 147, 251, 0.15) 100%)',
            color: 'white',
            fontWeight: 700,
          }}
        >
          删除提供商
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <DialogContentText sx={{ color: 'rgba(255,255,255,0.8)' }}>
            确定要删除提供商 "{providerToDelete?.name}" 吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                background: 'rgba(255,255,255,0.1)',
              }
            }}
          >
            取消
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained"
            sx={{
              background: modernTheme.secondary.gradient,
              boxShadow: modernTheme.secondary.glow,
              '&:hover': {
                transform: 'scale(1.05)',
              }
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CustomProviderList;
