import { createTheme, ThemeOptions } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// 定义核心色彩调色板
const colors = {
  // 主要品牌色 - 电影级紫蓝渐变
  primary: {
    50: '#f3f4ff',
    100: '#e8eaff',
    200: '#d4d8ff',
    300: '#b6bcff',
    400: '#9196ff',
    500: '#667eea', // 主色
    600: '#5a6fd8',
    700: '#4c5bc4',
    800: '#3d479f',
    900: '#2d3677',
    main: '#667eea',
    light: '#9196ff',
    dark: '#4c5bc4',
  },
  
  // 次要强调色 - 琥珀渐变
  secondary: {
    50: '#fff5f5',
    100: '#ffe3e6',
    200: '#ffbcc4',
    300: '#ff8a9b',
    400: '#ff5b7a',
    500: '#f5576c', // 次要色
    600: '#e73c4e',
    700: '#d12a3c',
    800: '#b01e2e',
    900: '#8b1520',
    main: '#f5576c',
    light: '#ff8a9b',
    dark: '#d12a3c',
  },
  
  // 成功色
  success: {
    50: '#f0fdff',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    main: '#14b8a6',
  },
  
  // 警告色
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    main: '#f59e0b',
  },
  
  // 错误色
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    main: '#ef4444',
  },
  
  // 中性色系
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  }
};

// 深色主题扩展
const darkColors = {
  background: {
    default: '#0f1419',  // 从 '#0a0e1a' 调整为更温暖的深蓝灰色
    paper: '#1e2632',    // 从 '#1a2333' 调整为更浅的蓝灰色
    elevated: '#2a3441', // 从 '#242d3f' 调整为更浅的层次
  },
  surface: {
    1: alpha('#dddddd', 0.05),
    2: alpha('#dddddd', 0.08),
    3: alpha('#dddddd', 0.11),
    4: alpha('#dddddd', 0.12),
    5: alpha('#dddddd', 0.14),
  }
};

// 浅色主题扩展
const lightColors = {
  background: {
    default: '#fafbfc',
    paper: '#dddddd',
    elevated: '#f8fafc',
  },
  surface: {
    1: alpha('#000000', 0.02),
    2: alpha('#000000', 0.04),
    3: alpha('#000000', 0.06),
    4: alpha('#000000', 0.08),
    5: alpha('#000000', 0.10),
  }
};

// 共享的主题选项
const sharedThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      fontWeight: 500,
    }
  },
  
  shape: {
    borderRadius: 8,
  },
  
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 1px 2px rgba(0, 0, 0, 0.1)',
    '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 4px 6px rgba(0, 0, 0, 0.1)',
    '0px 4px 6px rgba(0, 0, 0, 0.05), 0px 10px 15px rgba(0, 0, 0, 0.1)',
    '0px 10px 15px rgba(0, 0, 0, 0.05), 0px 20px 25px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15)',
    '0px 25px 50px rgba(0, 0, 0, 0.2)',
    '0px 25px 50px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px rgba(0, 0, 0, 0.3)',
    '0px 25px 50px rgba(0, 0, 0, 0.35)',
    '0px 25px 50px rgba(0, 0, 0, 0.4)',
    '0px 25px 50px rgba(0, 0, 0, 0.45)',
    '0px 25px 50px rgba(0, 0, 0, 0.5)',
    '0px 25px 50px rgba(0, 0, 0, 0.55)',
    '0px 25px 50px rgba(0, 0, 0, 0.6)',
    '0px 25px 50px rgba(0, 0, 0, 0.65)',
    '0px 25px 50px rgba(0, 0, 0, 0.7)',
    '0px 25px 50px rgba(0, 0, 0, 0.75)',
    '0px 25px 50px rgba(0, 0, 0, 0.8)',
    '0px 25px 50px rgba(0, 0, 0, 0.85)',
    '0px 25px 50px rgba(0, 0, 0, 0.9)',
    '0px 25px 50px rgba(0, 0, 0, 0.95)',
    '0px 25px 50px rgba(0, 0, 0, 1)',
    '0px 25px 50px rgba(0, 0, 0, 1)',
  ],
};

// 浅色主题
export const lightTheme = createTheme({
  ...sharedThemeOptions,
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    grey: colors.grey,
    background: lightColors.background,
    text: {
      primary: colors.grey[900],
      secondary: colors.grey[700],
    },
    divider: colors.grey[200],
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: colors.grey[100],
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.grey[300],
            borderRadius: 4,
          },
        },
        // 全局限制过大的 borderRadius
        '*': {
          '&[style*="border-radius: 48px"], &[style*="borderRadius: 48px"]': {
            borderRadius: '8px !important',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 10px 15px rgba(0, 0, 0, 0.05), 0px 20px 25px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.05), 0px 10px 15px rgba(0, 0, 0, 0.1)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          '& .MuiSlider-thumb': {
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.2)',
            },
          },
        },
      },
    },
  },
});

// 深色主题
export const darkTheme = createTheme({
  ...sharedThemeOptions,
  palette: {
    mode: 'dark',
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    grey: colors.grey,
    background: darkColors.background,
    text: {
      primary: '#dddddd',
      secondary: colors.grey[400],
    },
    divider: alpha('#dddddd', 0.12),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: darkColors.background.paper,
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.grey[600],
            borderRadius: 4,
          },
        },
        // 全局限制过大的 borderRadius
        '*': {
          '&[style*="border-radius: 48px"], &[style*="borderRadius: 48px"]': {
            borderRadius: '8px !important',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: darkColors.background.paper,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 10px 15px rgba(0, 0, 0, 0.15), 0px 20px 25px rgba(0, 0, 0, 0.25)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.15), 0px 10px 15px rgba(0, 0, 0, 0.25)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: darkColors.background.paper,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          '& .MuiSlider-thumb': {
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.2)',
            },
          },
        },
      },
    },
  },
});

// 默认导出浅色主题
export default lightTheme;

// 主题切换钩子
export const getTheme = (mode: 'light' | 'dark') => {
  return mode === 'dark' ? darkTheme : lightTheme;
}; 