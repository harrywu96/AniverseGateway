import React from 'react';
import { Box, Typography, LinearProgress, Button } from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import { alpha, useTheme } from '@mui/material/styles';
import { TranslationProgress } from '../../services/translationService';

interface Props {
  isTranslating: boolean;
  progress: TranslationProgress;
  onStop: () => void;
}

const TranslationProgressPanel: React.FC<Props> = ({ isTranslating, progress, onStop }) => {
  const theme = useTheme();
  if (!isTranslating) return null;
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography fontWeight={600}>正在翻译中...</Typography>
        <Typography color="text.secondary">{Math.round(progress.percentage)}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={progress.percentage} sx={{ height: 8, borderRadius: 2, mb: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">进度: {progress.current} / {progress.total}</Typography>
        {progress.currentItem && <Typography variant="body2">当前处理: {progress.currentItem}</Typography>}
      </Box>
      {progress.estimatedTimeRemaining && (
        <Typography variant="body2" color="text.secondary">预计剩余时间: {Math.round(progress.estimatedTimeRemaining)}s</Typography>
      )}
      <Button variant="outlined" color="error" startIcon={<StopIcon />} onClick={onStop} sx={{ mt: 2 }}>停止翻译</Button>
    </Box>
  );
};

export default TranslationProgressPanel;

