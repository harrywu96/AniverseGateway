import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Divider,
  alpha,
  useTheme,
  Fade,
  CircularProgress,
  Alert
} from '@mui/material';

interface ConfigSectionProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<any>;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  success?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * 现代化配置区域组件
 * 用于设置页面的配置分组
 */
const ConfigSection: React.FC<ConfigSectionProps> = ({
  title,
  description,
  icon: Icon,
  children,
  loading = false,
  error,
  success,
  variant = 'default',
  collapsible = false,
  defaultExpanded = true
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const getCardVariant = () => {
    switch (variant) {
      case 'outlined':
        return {
          variant: 'outlined' as const,
          sx: {
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            backgroundColor: 'transparent'
          }
        };
      case 'elevated':
        return {
          variant: 'elevation' as const,
          sx: {
            boxShadow: theme.shadows[4],
            backgroundColor: theme.palette.background.paper
          }
        };
      default:
        return {
          variant: 'outlined' as const,
          sx: {
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.02)
          }
        };
    }
  };

  const cardProps = getCardVariant();

  return (
    <Card
      {...cardProps}
      sx={{
        ...cardProps.sx,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: theme.shadows[6],
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardHeader
        avatar={Icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main
            }}
          >
            <Icon fontSize="small" />
          </Box>
        )}
        title={
          <Typography 
            variant="h6" 
            component="h3"
            sx={{ 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            {title}
            {loading && (
              <CircularProgress size={16} />
            )}
          </Typography>
        }
        subheader={description && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            {description}
          </Typography>
        )}
        action={collapsible && (
          <Box
            sx={{
              cursor: 'pointer',
              padding: 1,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: alpha(theme.palette.action.hover, 0.04)
              }
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Typography variant="body2" color="primary">
              {expanded ? '收起' : '展开'}
            </Typography>
          </Box>
        )}
        sx={{ pb: 1 }}
      />

      {/* 状态提示 */}
      {(error || success) && (
        <Box sx={{ px: 2, pb: 1 }}>
          {error && (
            <Alert severity="error" variant="filled" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" variant="filled" sx={{ mb: 1 }}>
              {success}
            </Alert>
          )}
        </Box>
      )}

      <Divider sx={{ opacity: 0.6 }} />

      {/* 内容区域 */}
      <Fade in={!collapsible || expanded} timeout={300}>
        <CardContent
          sx={{
            pt: 3,
            pb: 3,
            position: 'relative',
            ...(loading && {
              opacity: 0.6,
              pointerEvents: 'none'
            })
          }}
        >
          {children}

          {/* 加载覆盖层 */}
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                zIndex: 1
              }}
            >
              <CircularProgress size={32} />
            </Box>
          )}
        </CardContent>
      </Fade>
    </Card>
  );
};

export default ConfigSection; 