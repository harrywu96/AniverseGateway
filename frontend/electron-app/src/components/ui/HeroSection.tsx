import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Container,
  useTheme,
  alpha,
  Fade,
  Slide
} from '@mui/material';

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<any>;
    variant?: 'contained' | 'outlined';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<any>;
    variant?: 'contained' | 'outlined';
  };
  backgroundVariant?: 'gradient' | 'simple' | 'particles';
  size?: 'small' | 'medium' | 'large';
  children?: React.ReactNode;
}

/**
 * 现代化Hero区域组件
 * 用于页面顶部的引人注目的介绍区域
 */
const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  backgroundVariant = 'gradient',
  size = 'medium',
  children
}) => {
  const theme = useTheme();

  const getPadding = () => {
    switch (size) {
      case 'small': return { py: 6, px: 3 };
      case 'large': return { py: 12, px: 3 };
      default: return { py: 8, px: 3 };
    }
  };

  const getBackgroundStyle = () => {
    switch (backgroundVariant) {
      case 'simple':
        return {
          background: alpha(theme.palette.primary.main, 0.05)
        };
      case 'particles':
        return {
          background: `
            radial-gradient(circle at 20% 80%, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${alpha(theme.palette.secondary.main, 0.15)} 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%)
          `,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                ${alpha(theme.palette.primary.main, 0.03)} 2px,
                ${alpha(theme.palette.primary.main, 0.03)} 4px
              )
            `,
            pointerEvents: 'none'
          }
        };
      default:
        return {
          background: `linear-gradient(135deg, 
            ${alpha(theme.palette.primary.main, 0.1)} 0%, 
            ${alpha(theme.palette.secondary.main, 0.05)} 50%,
            ${alpha(theme.palette.primary.main, 0.08)} 100%
          )`
        };
    }
  };

  return (
    <Box
      sx={{
        ...getBackgroundStyle(),
        ...getPadding(),
        position: 'relative',
        overflow: 'hidden',
        borderRadius: { xs: 0, sm: 4 },
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
      }}
    >
      <Container maxWidth="lg">
        <Stack 
          spacing={4} 
          alignItems="center" 
          textAlign="center"
          sx={{ position: 'relative', zIndex: 1 }}
        >
          {/* 标题区域 */}
          <Slide direction="down" in={true} timeout={600}>
            <Stack spacing={2} alignItems="center">
              <Typography 
                variant={size === 'large' ? 'h2' : size === 'small' ? 'h4' : 'h3'}
                component="h1"
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  maxWidth: 800,
                  lineHeight: 1.2
                }}
              >
                {title}
              </Typography>

              {subtitle && (
                <Typography 
                  variant={size === 'large' ? 'h5' : 'h6'}
                  color="text.secondary"
                  sx={{ 
                    fontWeight: 500,
                    maxWidth: 600
                  }}
                >
                  {subtitle}
                </Typography>
              )}

              {description && (
                <Typography 
                  variant="body1"
                  color="text.secondary"
                  sx={{ 
                    maxWidth: 700,
                    lineHeight: 1.7,
                    fontSize: '1.1rem'
                  }}
                >
                  {description}
                </Typography>
              )}
            </Stack>
          </Slide>

          {/* 操作按钮区域 */}
          {(primaryAction || secondaryAction) && (
            <Fade in={true} timeout={800}>
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                spacing={2}
                alignItems="center"
              >
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant || 'contained'}
                    size="large"
                    startIcon={primaryAction.icon ? <primaryAction.icon /> : undefined}
                    onClick={primaryAction.onClick}
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
                    {primaryAction.label}
                  </Button>
                )}

                {secondaryAction && (
                  <Button
                    variant={secondaryAction.variant || 'outlined'}
                    size="large"
                    startIcon={secondaryAction.icon ? <secondaryAction.icon /> : undefined}
                    onClick={secondaryAction.onClick}
                    sx={{
                      px: 4,
                      py: 1.5,
                      borderRadius: 3,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      '&:hover': {
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
              </Stack>
            </Fade>
          )}

          {/* 自定义内容区域 */}
          {children && (
            <Fade in={true} timeout={1000}>
              <Box sx={{ width: '100%', mt: 4 }}>
                {children}
              </Box>
            </Fade>
          )}
        </Stack>
      </Container>

      {/* 装饰性背景元素 */}
      {backgroundVariant === 'gradient' && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
              animation: 'float 6s ease-in-out infinite',
              '@keyframes float': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-20px)' }
              }
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.1)}, transparent)`,
              animation: 'float 8s ease-in-out infinite reverse',
            }}
          />
        </>
      )}
    </Box>
  );
};

export default HeroSection; 