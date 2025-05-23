import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  alpha,
  useTheme,
  Chip,
  LinearProgress,
  Stack
} from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'error';
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  progress?: number;
  onClick?: () => void;
  loading?: boolean;
}

/**
 * 现代化统计卡片组件
 * 用于显示关键指标和数据
 */
const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  variant = 'primary',
  trend,
  progress,
  onClick,
  loading = false
}) => {
  const theme = useTheme();

  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          main: theme.palette.success.main,
          background: alpha(theme.palette.success.main, 0.1),
          border: alpha(theme.palette.success.main, 0.2)
        };
      case 'warning':
        return {
          main: theme.palette.warning.main,
          background: alpha(theme.palette.warning.main, 0.1),
          border: alpha(theme.palette.warning.main, 0.2)
        };
      case 'info':
        return {
          main: theme.palette.info.main,
          background: alpha(theme.palette.info.main, 0.1),
          border: alpha(theme.palette.info.main, 0.2)
        };
      case 'error':
        return {
          main: theme.palette.error.main,
          background: alpha(theme.palette.error.main, 0.1),
          border: alpha(theme.palette.error.main, 0.2)
        };
      default:
        return {
          main: theme.palette.primary.main,
          background: alpha(theme.palette.primary.main, 0.1),
          border: alpha(theme.palette.primary.main, 0.2)
        };
    }
  };

  const colors = getVariantColors();

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: `1px solid ${colors.border}`,
        background: colors.background,
        position: 'relative',
        overflow: 'hidden',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
          '& .stats-icon': {
            transform: 'scale(1.1)'
          }
        } : {},
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${colors.main}, ${alpha(colors.main, 0.7)})`,
        }
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          {Icon && (
            <Box
              className="stats-icon"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 3,
                backgroundColor: alpha(colors.main, 0.1),
                color: colors.main,
                transition: 'transform 0.2s ease'
              }}
            >
              <Icon fontSize="medium" />
            </Box>
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 0.5,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.75rem'
              }}
            >
              {title}
            </Typography>

            <Typography 
              variant="h4" 
              component="div"
              sx={{ 
                fontWeight: 700,
                mb: description ? 0.5 : 1,
                background: loading ? 'transparent' : `linear-gradient(135deg, ${colors.main}, ${alpha(colors.main, 0.8)})`,
                backgroundClip: loading ? 'unset' : 'text',
                WebkitBackgroundClip: loading ? 'unset' : 'text',
                WebkitTextFillColor: loading ? 'inherit' : 'transparent',
                animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 }
                }
              }}
            >
              {loading ? '...' : value}
            </Typography>

            {description && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {description}
              </Typography>
            )}

            {/* 趋势指示器 */}
            {trend && (
              <Chip
                label={`${trend.isPositive ? '+' : ''}${trend.value} ${trend.label}`}
                size="small"
                color={trend.isPositive ? 'success' : 'error'}
                variant="outlined"
                sx={{ 
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}
              />
            )}

            {/* 进度条 */}
            {progress !== undefined && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: alpha(colors.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: colors.main,
                      borderRadius: 3
                    }
                  }}
                />
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  {Math.round(progress)}% 完成
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default StatsCard; 