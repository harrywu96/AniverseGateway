import { Theme, alpha } from '@mui/material/styles';

/**
 * 现代化样式工具集
 * 提供统一的样式生成器，确保整个应用的视觉一致性
 */

export interface ModernCardVariant {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  info: string;
  error: string;
  default: string;
}

/**
 * 创建现代化卡片样式
 * @param theme - MUI主题对象
 * @param variant - 卡片变体类型
 * @param intensity - 效果强度 (0.5-2.0)
 */
export const createModernCardStyles = (
  theme: Theme, 
  variant: keyof ModernCardVariant = 'default',
  intensity: number = 1.0
) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          main: theme.palette.primary.main,
          secondary: theme.palette.primary.light
        };
      case 'secondary':
        return {
          main: theme.palette.secondary.main,
          secondary: theme.palette.secondary.light
        };
      case 'success':
        return {
          main: theme.palette.success.main,
          secondary: theme.palette.success.light
        };
      case 'warning':
        return {
          main: theme.palette.warning.main,
          secondary: theme.palette.warning.light
        };
      case 'info':
        return {
          main: theme.palette.info.main,
          secondary: theme.palette.info.light
        };
      case 'error':
        return {
          main: theme.palette.error.main,
          secondary: theme.palette.error.light
        };
      default:
        return {
          main: theme.palette.primary.main,
          secondary: theme.palette.secondary.main
        };
    }
  };

  const colors = getVariantColors();
  const baseAlpha = 0.08 * intensity;
  const hoverAlpha = 0.12 * intensity;
  const borderAlpha = 0.15 * intensity;

  return {
    background: `linear-gradient(135deg, ${alpha(colors.main, baseAlpha)}, ${alpha(colors.secondary, baseAlpha * 0.5)})`,
    border: `1px solid ${alpha(colors.main, borderAlpha)}`,
    borderRadius: 2,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg, ${colors.main}, ${alpha(colors.main, 0.7)})`,
      opacity: 0.8
    },
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 12px 40px ${alpha(colors.main, 0.15 * intensity)}`,
      background: `linear-gradient(135deg, ${alpha(colors.main, hoverAlpha)}, ${alpha(colors.secondary, hoverAlpha * 0.6)})`,
      borderColor: alpha(colors.main, borderAlpha * 1.2)
    }
  };
};

/**
 * 创建渐变背景样式
 * @param theme - MUI主题对象
 * @param direction - 渐变方向
 * @param colors - 颜色数组
 * @param opacity - 透明度
 */
export const createGradientBackground = (
  theme: Theme,
  direction: string = '135deg',
  colors: string[] = [theme.palette.primary.main, theme.palette.secondary.main],
  opacity: number = 0.05
) => ({
  background: `linear-gradient(${direction}, ${colors.map(color => alpha(color, opacity)).join(', ')})`
});

/**
 * 创建玻璃态效果样式
 * @param theme - MUI主题对象
 * @param blur - 模糊程度
 * @param opacity - 背景透明度
 */
export const createGlassmorphismStyles = (
  theme: Theme,
  blur: number = 10,
  opacity: number = 0.1
) => ({
  background: alpha(theme.palette.background.paper, opacity),
  backdropFilter: `blur(${blur}px)`,
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  borderRadius: 2
});

/**
 * 创建现代化按钮样式
 * @param theme - MUI主题对象
 * @param variant - 按钮变体
 */
export const createModernButtonStyles = (
  theme: Theme,
  variant: 'primary' | 'secondary' | 'outlined' = 'primary'
) => {
  const baseStyles = {
    borderRadius: 3,
    textTransform: 'none' as const,
    fontWeight: 600,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-1px)'
    }
  };

  switch (variant) {
    case 'primary':
      return {
        ...baseStyles,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
        '&:hover': {
          ...baseStyles['&:hover'],
          boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`
        }
      };
    case 'secondary':
      return {
        ...baseStyles,
        background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
        '&:hover': {
          ...baseStyles['&:hover'],
          boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.4)}`
        }
      };
    case 'outlined':
      return {
        ...baseStyles,
        border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        background: alpha(theme.palette.primary.main, 0.05),
        '&:hover': {
          ...baseStyles['&:hover'],
          borderColor: theme.palette.primary.main,
          background: alpha(theme.palette.primary.main, 0.1),
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
        }
      };
    default:
      return baseStyles;
  }
};

/**
 * 创建统计卡片样式
 * @param theme - MUI主题对象
 * @param color - 主题色
 */
export const createStatsCardStyles = (
  theme: Theme,
  color: string = theme.palette.primary.main
) => ({
  background: `linear-gradient(135deg, ${alpha(color, 0.1)}, ${alpha(color, 0.05)})`,
  border: `1px solid ${alpha(color, 0.2)}`,
  borderRadius: 2,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.7)})`
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 40px ${alpha(color, 0.15)}`,
    background: `linear-gradient(135deg, ${alpha(color, 0.15)}, ${alpha(color, 0.08)})`,
    '& .stats-icon': {
      transform: 'scale(1.1)'
    }
  }
});

/**
 * 创建现代化Paper样式
 * @param theme - MUI主题对象
 * @param elevation - 阴影层级
 */
export const createModernPaperStyles = (
  theme: Theme,
  elevation: number = 1
) => {
  // 使用主题色混合的更自然的基础色
  const isLight = theme.palette.mode === 'light';
  const baseColor = isLight ? theme.palette.background.paper : '#2d3748'; // 更浅的蓝灰色
  
  return {
    background: `linear-gradient(135deg, ${alpha(baseColor, 0.9)}, ${alpha(baseColor, 0.95)})`,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
    borderRadius: 3,
    boxShadow: theme.shadows[elevation]
  };
};

/**
 * 创建动画配置
 */
export const modernAnimations = {
  // 标准过渡时间
  duration: {
    short: '0.2s',
    standard: '0.3s',
    long: '0.5s'
  },
  // 缓动函数
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
  },
  // 常用变换
  transforms: {
    hover: 'translateY(-2px)',
    press: 'translateY(0px) scale(0.98)',
    float: 'translateY(-4px)'
  }
};

/**
 * 响应式断点工具
 */
export const createResponsiveStyles = (theme: Theme) => ({
  mobile: theme.breakpoints.down('sm'),
  tablet: theme.breakpoints.between('sm', 'md'),
  desktop: theme.breakpoints.up('md')
});

/**
 * 创建现代化表单组件样式
 * @param theme - MUI主题对象
 * @param variant - 表单变体类型
 */
export const createModernFormStyles = (
  theme: Theme,
  variant: keyof ModernCardVariant = 'primary'
) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          main: theme.palette.primary.main,
          light: theme.palette.primary.light
        };
      case 'secondary':
        return {
          main: theme.palette.secondary.main,
          light: theme.palette.secondary.light
        };
      case 'success':
        return {
          main: theme.palette.success.main,
          light: theme.palette.success.light
        };
      case 'info':
        return {
          main: theme.palette.info.main,
          light: theme.palette.info.light
        };
      default:
        return {
          main: theme.palette.primary.main,
          light: theme.palette.primary.light
        };
    }
  };

  const colors = getVariantColors();

  return {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: alpha(theme.palette.background.paper, 0.8),
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(colors.main, 0.3),
        borderWidth: 1
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(colors.main, 0.5)
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: colors.main,
        borderWidth: 2,
        boxShadow: `0 0 0 3px ${alpha(colors.main, 0.1)}`
      }
    },
    '& .MuiInputLabel-root': {
      fontWeight: 500,
      '&.Mui-focused': {
        color: colors.main
      }
    },
    '& .MuiSelect-select': {
      backgroundColor: 'transparent'
    },
    '& .MuiMenuItem-root': {
      borderRadius: 1,
      margin: '2px 4px',
      '&:hover': {
        backgroundColor: alpha(colors.main, 0.08)
      },
      '&.Mui-selected': {
        backgroundColor: alpha(colors.main, 0.12),
        '&:hover': {
          backgroundColor: alpha(colors.main, 0.16)
        }
      }
    }
  };
};

/**
 * 创建现代化对话框样式
 * @param theme - MUI主题对象
 */
export const createModernDialogStyles = (theme: Theme) => {
  // 使用更自然的配色
  const isLight = theme.palette.mode === 'light';
  const baseColor = isLight ? theme.palette.background.paper : '#2d3748';
  
  return {
    '& .MuiDialog-paper': {
      borderRadius: 2,
      background: `linear-gradient(135deg, ${alpha(baseColor, 0.95)}, ${alpha(baseColor, 0.98)})`,
      backdropFilter: 'blur(20px)',
      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
      boxShadow: `0 24px 48px ${alpha(theme.palette.common.black, 0.15)}`
    },
    '& .MuiDialogTitle-root': {
      fontWeight: 600,
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.04)})`,
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
    },
    '& .MuiDialogContent-root': {
      background: `linear-gradient(135deg, ${alpha(baseColor, 0.8)}, ${alpha(baseColor, 0.9)})`,
      '& .MuiTextField-root': {
        ...createModernFormStyles(theme, 'primary')
      }
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(2, 3),
      background: `linear-gradient(135deg, ${alpha(baseColor, 0.9)}, ${alpha(baseColor, 0.95)})`,
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      '& .MuiButton-root': {
        borderRadius: 2,
        fontWeight: 600,
        textTransform: 'none' as const
      }
    }
  };
};

/**
 * 创建现代化Alert组件样式
 * @param theme - MUI主题对象
 * @param severity - Alert严重程度
 */
export const createModernAlertStyles = (
  theme: Theme,
  severity: 'success' | 'info' | 'warning' | 'error' = 'info'
) => {
  const getSeverityColors = () => {
    switch (severity) {
      case 'success':
        return {
          main: theme.palette.success.main,
          light: theme.palette.success.light,
          dark: theme.palette.success.dark
        };
      case 'warning':
        return {
          main: theme.palette.warning.main,
          light: theme.palette.warning.light,
          dark: theme.palette.warning.dark
        };
      case 'error':
        return {
          main: theme.palette.error.main,
          light: theme.palette.error.light,
          dark: theme.palette.error.dark
        };
      default:
        return {
          main: theme.palette.info.main,
          light: theme.palette.info.light,
          dark: theme.palette.info.dark
        };
    }
  };

  const colors = getSeverityColors();

  return {
    borderRadius: 3,
    background: `linear-gradient(135deg, ${alpha(colors.main, 0.1)}, ${alpha(colors.main, 0.05)})`,
    border: `1px solid ${alpha(colors.main, 0.2)}`,
    backdropFilter: 'blur(10px)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg, ${colors.main}, ${colors.dark})`
    },
    '& .MuiAlert-icon': {
      color: colors.main
    },
    '& .MuiAlert-message': {
      fontWeight: 500,
      '& .MuiAlertTitle-root': {
        fontWeight: 600,
        color: colors.dark
      }
    },
    '& .MuiAlert-action': {
      '& .MuiIconButton-root': {
        color: colors.main,
        '&:hover': {
          backgroundColor: alpha(colors.main, 0.1)
        }
      }
    }
  };
};

/**
 * 创建现代化容器层次样式
 * @param theme - MUI主题对象
 * @param level - 层次级别 (1-5)
 * @param variant - 颜色变体
 */
export const createModernContainerStyles = (
  theme: Theme,
  level: number = 1,
  variant: keyof ModernCardVariant = 'default'
) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return theme.palette.primary.main;
      case 'secondary':
        return theme.palette.secondary.main;
      case 'success':
        return theme.palette.success.main;
      case 'info':
        return theme.palette.info.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      default:
        // 使用更自然的基础色，与主题色搭配
        const isLight = theme.palette.mode === 'light';
        return isLight ? '#dddddd' : '#2d3748';
    }
  };

  const color = getVariantColors();
  const baseOpacity = Math.max(0.02, 0.1 - (level - 1) * 0.02);
  const borderOpacity = Math.max(0.05, 0.2 - (level - 1) * 0.03);

  return {
    borderRadius: 2,
    background: variant === 'default' 
      ? `linear-gradient(135deg, ${alpha(color, 0.88 + level * 0.04)}, ${alpha(color, 0.92 + level * 0.02)})`
      : `linear-gradient(135deg, ${alpha(color, baseOpacity)}, ${alpha(color, baseOpacity * 0.5)})`,
    border: `1px solid ${alpha(variant === 'default' ? theme.palette.divider : color, borderOpacity)}`,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };
};

/**
 * 创建优雅的区域样式 - 专门为四个问题区域设计
 * @param theme - MUI主题对象
 * @param variant - 区域类型
 */
export const createElegantAreaStyles = (
  theme: Theme,
  variant: 'info-panel' | 'settings-panel' | 'subtitle-editor' | 'translation-flow' = 'info-panel'
) => {
  const isLight = theme.palette.mode === 'light';
  
  const getAreaColors = () => {
    switch (variant) {
      case 'info-panel':
        // 视频信息面板 - 使用主色调的柔和版本
        return {
          primary: isLight ? '#f8fafc' : '#334155',
          secondary: isLight ? '#f1f5f9' : '#2d3748',
          accent: theme.palette.primary.main
        };
      case 'settings-panel':
        // 设置面板 - 使用中性色
        return {
          primary: isLight ? '#f9fafb' : '#374151',
          secondary: isLight ? '#f3f4f6' : '#2d3748',
          accent: theme.palette.grey[500]
        };
      case 'subtitle-editor':
        // 字幕编辑器 - 使用次要色调
        return {
          primary: isLight ? '#fef7ff' : '#3b3154',
          secondary: isLight ? '#f3e8ff' : '#2d3748',
          accent: theme.palette.secondary.main
        };
      case 'translation-flow':
        // 翻译流程 - 使用信息色调
        return {
          primary: isLight ? '#f0f9ff' : '#1e3a5f',
          secondary: isLight ? '#e0f2fe' : '#2d3748',
          accent: theme.palette.info.main
        };
      default:
        return {
          primary: isLight ? '#dddddd' : '#2d3748',
          secondary: isLight ? '#f8fafc' : '#334155',
          accent: theme.palette.primary.main
        };
    }
  };

  const colors = getAreaColors();

  return {
    background: `linear-gradient(135deg, ${alpha(colors.primary, 0.9)}, ${alpha(colors.secondary, 0.85)})`,
    border: `1px solid ${alpha(colors.accent, 0.15)}`,
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      background: `linear-gradient(90deg, ${colors.accent}, ${alpha(colors.accent, 0.6)})`,
      opacity: 0.8
    },
    '&:hover': {
      background: `linear-gradient(135deg, ${alpha(colors.primary, 0.95)}, ${alpha(colors.secondary, 0.9)})`,
      borderColor: alpha(colors.accent, 0.25)
    }
  };
}; 