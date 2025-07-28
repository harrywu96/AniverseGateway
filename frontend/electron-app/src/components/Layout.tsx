import React, { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Avatar,
  Chip,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  VideoLibrary as VideoIcon,
  Settings as SettingsIcon,
  Translate as TranslateIcon,
  PlayCircle as PlayIcon,
} from '@mui/icons-material';
import { unifiedAnimations } from '../utils/modernStyles';

// 抽屉宽度
const drawerWidth = 280;

// 简化的导航项
const navItems = [
  {
    name: '首页',
    path: '/',
    icon: <HomeIcon />,
    description: '概览与统计'
  },
  {
    name: '视频管理',
    path: '/videos',
    icon: <VideoIcon />,
    description: '视频库管理'
  },
  {
    name: '设置',
    path: '/settings',
    icon: <SettingsIcon />,
    description: '系统配置'
  },
];

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  // 简化的Logo区域组件
  const LogoSection = () => (
    <Box
      sx={{
        background: theme.palette.primary.main,
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            background: alpha(theme.palette.common.white, 0.2),
            border: `2px solid ${alpha(theme.palette.common.white, 0.3)}`,
            mb: 1,
            mx: 'auto',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.05)',
              background: alpha(theme.palette.common.white, 0.3),
            }
          }}
        >
          <TranslateIcon sx={{ color: theme.palette.common.white, fontSize: 28 }} />
        </Avatar>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.common.white,
            fontWeight: 600,
            fontSize: '1.1rem',
          }}
        >
          SubTranslate
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.common.white, 0.8),
            fontSize: '0.75rem',
            display: 'block',
            mt: 0.5,
          }}
        >
          AI 字幕翻译
        </Typography>
      </Box>
    </Box>
  );

  // 简化的导航项组件
  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isSelected = location.pathname === item.path;
    const isHovered = hoveredItem === item.path;

    return (
      <ListItem sx={{ px: 2, py: 0.5 }}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: 2,
            background: isSelected
              ? alpha(theme.palette.primary.main, 0.15)
              : isHovered
                ? alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
            // 使用统一的动画配置
            transition: `all ${unifiedAnimations.duration.quick} ${unifiedAnimations.easing.standard}`,
            border: `1px solid ${isSelected
              ? alpha(theme.palette.primary.main, 0.3)
              : alpha(theme.palette.divider, 0.1)}`,
            // 添加微妙的悬停效果
            transform: isHovered ? unifiedAnimations.transforms.subtle : 'translateY(0)',
          }}
        >
          <ListItemButton
            onClick={() => handleNavigation(item.path)}
            onMouseEnter={() => setHoveredItem(item.path)}
            onMouseLeave={() => setHoveredItem(null)}
            sx={{
              borderRadius: 2,
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
                color: isSelected
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
                    color: isSelected
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.95rem',
                    transition: 'color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }
                }}
                secondaryTypographyProps={{
                  sx: {
                    color: theme.palette.text.secondary,
                    fontSize: '0.75rem',
                    transition: 'color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }
                }}
              />
            </Box>
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
        background: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        position: 'relative',
      }}
    >
      <LogoSection />

      <Box sx={{ px: 2, py: 3 }}>
        <Typography
          variant="overline"
          sx={{
            color: theme.palette.text.secondary,
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
          background: `linear-gradient(0deg, ${alpha(theme.palette.background.default, 0.8)} 0%, transparent 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.disabled,
            fontSize: '0.65rem',
          }}
        >
          Powered by Harrywu
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: theme.palette.background.default }}>
      {/* 简化的AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[1],
          color: theme.palette.text.primary,
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
              background: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              // 使用统一的动画配置
              transition: `all ${unifiedAnimations.duration.quick} ${unifiedAnimations.easing.standard}`,
              '&:hover': {
                transform: unifiedAnimations.transforms.iconHover,
                background: theme.palette.primary.dark,
              },
              '&:active': {
                transform: unifiedAnimations.transforms.iconPress,
              }
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <PlayIcon
              sx={{
                mr: 2,
                color: theme.palette.primary.main,
                fontSize: 28,
              }}
            />
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  fontSize: '1.25rem',
                }}
              >
                智能视频字幕翻译系统
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  display: 'block',
                  lineHeight: 1,
                }}
              >
                Professional Subtitle Translation Platform
              </Typography>
            </Box>
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
          background: theme.palette.background.default,
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

  
      </Box>
    </Box>
  );
};

export default Layout;