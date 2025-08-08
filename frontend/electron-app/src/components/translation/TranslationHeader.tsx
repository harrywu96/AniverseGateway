import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TranslationHeaderProps {
  fileName: string;
  onBack: () => void;
}

const TranslationHeader: React.FC<TranslationHeaderProps> = ({ fileName, onBack }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Box>
        <Typography variant="h6" color="text.secondary">{fileName}</Typography>
      </Box>
      <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack}>返回视频详情</Button>
    </Box>
  );
};

export default TranslationHeader;

