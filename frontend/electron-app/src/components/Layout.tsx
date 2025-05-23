import React, { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Avatar,
  Chip,
  Fade,
  Slide,
  useTheme,
  alpha,
  Zoom,
  Grow,
  keyframes,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  VideoLibrary as VideoIcon,
  Settings as SettingsIcon,
  Translate as TranslateIcon,
  PlayCircle as PlayIcon,
} from '@mui/icons-material';

// 现代化深色主题
const modernTheme = {
  primary: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    main: '#667eea',
    dark: '#764ba2',
    glow: '0 0 20px rgba(102, 126, 234, 0.6)',
  },
  secondary: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    main: '#f093fb',
    dark: '#f5576c',
    glow: '0 0 20px rgba(240, 147, 251, 0.6)',
  },
  accent: {
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    main: '#4facfe',
    dark: '#00f2fe',
    glow: '0 0 20px rgba(79, 172, 254, 0.6)',
  },
  surface: {
    dark: 'linear-gradient(135deg, #1e1e2f 0%, #2d1b69 100%)',
    darker: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 100%)',
    glass: 'rgba(255, 255, 255, 0.05)',
    glassLight: 'rgba(255, 255, 255, 0.1)',
  }
};

// 动画关键帧
const rippleEffect = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px rgba(102, 126, 234, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.8), 0 0 30px rgba(102, 126, 234, 0.6);
  }
`;

const floatingParticles = keyframes`
  0% {
    transform: translateY(0px);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-10px);
    opacity: 1;
  }
  100% {
    transform: translateY(0px);
    opacity: 0.7;
  }
`;

// 抽屉宽度
const drawerWidth = 280;

// 现代化导航项
const navItems = [
  { 
    name: '首页', 
    path: '/', 
    icon: <HomeIcon />, 
    gradient: modernTheme.primary.gradient,
    glow: modernTheme.primary.glow,
    description: '概览与统计'
  },
  { 
    name: '视频管理', 
    path: '/videos', 
    icon: <VideoIcon />, 
    gradient: modernTheme.secondary.gradient,
    glow: modernTheme.secondary.glow,
    description: '视频库管理'
  },
  { 
    name: '设置', 
    path: '/settings', 
    icon: <SettingsIcon />, 
    gradient: modernTheme.accent.gradient,
    glow: modernTheme.accent.glow,
    description: '系统配置'
  },
];

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [ripplePosition, setRipplePosition] = useState<{ x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  // 现代化Logo区域组件
  const LogoSection = () => (
    <Box
      sx={{
        background: modernTheme.primary.gradient,
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
          zIndex: 1,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          animation: `${floatingParticles} 4s ease-in-out infinite`,
          zIndex: 0,
        }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            border: '2px solid rgba(255,255,255,0.3)',
            mb: 1,
            mx: 'auto',
            transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            animation: `${glowPulse} 3s ease-in-out infinite`,
            '&:hover': {
              transform: 'scale(1.15) rotateY(180deg)',
              background: 'rgba(255,255,255,0.3)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 10px rgba(255,255,255,0.1)',
            }
          }}
        >
          <TranslateIcon sx={{ color: 'white', fontSize: 28 }} />
        </Avatar>
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            fontWeight: 700,
            fontSize: '1.1rem',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            letterSpacing: '0.5px',
          }}
        >
          SubTranslate
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.75rem',
            display: 'block',
            mt: 0.5,
          }}
        >
          AI 字幕翻译专家
        </Typography>
      </Box>
    </Box>
  );

  // 增强的导航项组件
  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isSelected = location.pathname === item.path;
    const isHovered = hoveredItem === item.path;

    const handleMouseEnter = (event: React.MouseEvent) => {
      setHoveredItem(item.path);
      const rect = event.currentTarget.getBoundingClientRect();
      setRipplePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    return (
      <ListItem sx={{ px: 2, py: 0.5 }}>
        <Paper
          elevation={isSelected || isHovered ? 12 : 0}
          sx={{
            width: '100%',
            borderRadius: 3,
            background: isSelected 
              ? item.gradient 
              : isHovered 
                ? 'rgba(255,255,255,0.08)'
                : 'transparent',
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transform: isHovered 
              ? 'translateX(12px) scale(1.03) rotateX(2deg)' 
              : 'translateX(0) scale(1) rotateX(0deg)',
            border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: isSelected 
              ? `${item.glow}, 0 8px 32px rgba(0,0,0,0.3)` 
              : isHovered 
                ? '0 12px 40px rgba(0,0,0,0.2)'
                : 'none',
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
            ...(ripplePosition && isHovered && {
              '&::after': {
                content: '""',
                position: 'absolute',
                left: ripplePosition.x - 20,
                top: ripplePosition.y - 20,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.3)',
                animation: `${rippleEffect} 0.6s ease-out`,
                pointerEvents: 'none',
              }
            }),
          }}
        >
          <ListItemButton
            onClick={() => handleNavigation(item.path)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => {
              setHoveredItem(null);
              setRipplePosition(null);
            }}
            sx={{
              borderRadius: 3,
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: 'transparent',
              }
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 48,
                color: isSelected ? 'white' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                transform: isHovered 
                  ? 'scale(1.3) rotate(10deg) translateZ(0)' 
                  : 'scale(1) rotate(0deg) translateZ(0)',
                filter: isHovered 
                  ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))'
                  : 'none',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <Box sx={{ flex: 1 }}>
              <ListItemText
                primary={item.name}
                secondary={item.description}
                primaryTypographyProps={{
                  sx: {
                    color: isSelected ? 'white' : 'rgba(255,255,255,0.9)',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                  }
                }}
                secondaryTypographyProps={{
                  sx: {
                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                    fontSize: '0.75rem',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                  }
                }}
              />
            </Box>
            {isSelected && (
              <Zoom in={isSelected} timeout={300}>
                <Chip
                  size="small"
                  label="●"
                  sx={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    minWidth: 8,
                    height: 8,
                    '& .MuiChip-label': { px: 0.5 },
                    animation: `${glowPulse} 2s ease-in-out infinite`,
                  }}
                />
              </Zoom>
            )}
          </ListItemButton>
        </Paper>
      </ListItem>
    );
  };

  // 抽屉内容
  const drawer = (
    <Box
      sx={{
        height: '100%',
        background: modernTheme.surface.darker,
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
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
      <LogoSection />
      
      <Box sx={{ px: 2, py: 3 }}>
        <Typography
          variant="overline"
          sx={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '1px',
            px: 2,
            pb: 1,
            display: 'block',
          }}
        >
          主要功能
        </Typography>
        
        <List sx={{ p: 0 }}>
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </List>
      </Box>

      {/* 底部装饰 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '0.65rem',
          }}
        >
          Powered by AI Technology
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: modernTheme.surface.dark }}>
      {/* 深色主题AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: 'rgba(30, 30, 47, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
          color: 'white',
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton
            color="inherit"
            aria-label="打开菜单"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              background: modernTheme.primary.gradient,
              color: 'white',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.1) rotate(90deg)',
                boxShadow: modernTheme.primary.glow,
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <PlayIcon 
              sx={{ 
                mr: 2, 
                color: modernTheme.primary.main,
                fontSize: 28,
                filter: 'drop-shadow(0 0 8px rgba(102, 126, 234, 0.6))',
              }} 
            />
            <Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  background: modernTheme.primary.gradient,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '1.25rem',
                }}
              >
                智能视频字幕翻译系统
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.75rem',
                  display: 'block',
                  lineHeight: 1,
                }}
              >
                Professional Subtitle Translation Platform
              </Typography>
            </Box>
          </Box>

          {/* 状态指示器 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="在线"
              size="small"
              sx={{
                background: modernTheme.accent.gradient,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.7rem',
                boxShadow: modernTheme.accent.glow,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* 导航抽屉 */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="导航菜单"
      >
        {/* 移动端抽屉 */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              border: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* 桌面端固定抽屉 */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              border: 'none',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* 深色主内容区域 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: modernTheme.surface.dark,
          position: 'relative',
          overflow: 'auto',
        }}
      >
        <Toolbar sx={{ minHeight: 72 }} />
        
        <Fade in timeout={600}>
          <Box
            sx={{
              p: 3,
              maxWidth: '1400px',
              mx: 'auto',
              minHeight: 'calc(100vh - 72px)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {children}
          </Box>
        </Fade>

        {/* 深色主题背景装饰 */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, rgba(79, 172, 254, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(150px, -150px)',
            zIndex: 0,
            animation: `${floatingParticles} 6s ease-in-out infinite`,
          }}
        />
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(240, 147, 251, 0.08) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(-50%, 100px)',
            zIndex: 0,
            animation: `${floatingParticles} 8s ease-in-out infinite reverse`,
          }}
        />
      </Box>
    </Box>
  );
};

export default Layout;