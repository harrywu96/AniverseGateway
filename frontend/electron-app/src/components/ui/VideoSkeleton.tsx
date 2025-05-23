import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Skeleton,
  Box,
  useTheme
} from '@mui/material';

interface VideoSkeletonProps {
  variant?: 'standard' | 'compact' | 'featured';
  count?: number;
}

const VideoSkeletonCard: React.FC<{ variant: 'standard' | 'compact' | 'featured' }> = ({ variant }) => {
  const theme = useTheme();

  const getCardHeight = () => {
    switch (variant) {
      case 'compact': return 200;
      case 'featured': return 320;
      default: return 280;
    }
  };

  const getMediaHeight = () => {
    switch (variant) {
      case 'compact': return 120;
      case 'featured': return 200;
      default: return 160;
    }
  };

  return (
    <Card
      sx={{
        height: getCardHeight(),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 缩略图骨架 */}
      <Skeleton
        variant="rectangular"
        height={getMediaHeight()}
        animation="wave"
        sx={{
          backgroundColor: theme.palette.mode === 'dark' 
            ? theme.palette.grey[800] 
            : theme.palette.grey[300]
        }}
      />

      {/* 内容骨架 */}
      <CardContent sx={{ flexGrow: 1, p: variant === 'compact' ? 1 : 2 }}>
        {/* 标题骨架 */}
        <Skeleton
          variant="text"
          height={variant === 'featured' ? 32 : 28}
          width="85%"
          animation="wave"
          sx={{ mb: 1 }}
        />

        {/* 描述信息骨架 */}
        {variant !== 'compact' && (
          <Box sx={{ mb: 1 }}>
            <Skeleton
              variant="text"
              height={20}
              width="60%"
              animation="wave"
              sx={{ mb: 0.5 }}
            />
            <Skeleton
              variant="text"
              height={20}
              width="45%"
              animation="wave"
            />
          </Box>
        )}

        {/* 特色变体的额外骨架 */}
        {variant === 'featured' && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              <Skeleton
                variant="rounded"
                width={80}
                height={24}
                animation="wave"
              />
              <Skeleton
                variant="rounded"
                width={70}
                height={24}
                animation="wave"
              />
            </Box>
          </Box>
        )}
      </CardContent>

      {/* 操作按钮骨架 */}
      <CardActions 
        sx={{ 
          px: variant === 'compact' ? 1 : 2, 
          py: 1,
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Skeleton variant="circular" width={32} height={32} animation="wave" />
          <Skeleton variant="circular" width={32} height={32} animation="wave" />
          <Skeleton variant="circular" width={32} height={32} animation="wave" />
        </Box>
        <Skeleton variant="circular" width={32} height={32} animation="wave" />
      </CardActions>
    </Card>
  );
};

const VideoSkeleton: React.FC<VideoSkeletonProps> = ({ 
  variant = 'standard', 
  count = 6 
}) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <VideoSkeletonCard key={index} variant={variant} />
      ))}
    </>
  );
};

export default VideoSkeleton; 