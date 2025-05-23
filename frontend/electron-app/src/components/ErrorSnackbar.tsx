import React from 'react';
import {
  Snackbar,
  Alert,
  AlertColor
} from '@mui/material';

interface ErrorSnackbarProps {
  message: string | null;
  severity?: AlertColor;
  onClose: () => void;
  autoHideDuration?: number;
}

/**
 * 错误提示组件
 * 用于显示错误、警告、成功等消息
 */
const ErrorSnackbar: React.FC<ErrorSnackbarProps> = ({
  message,
  severity = 'error',
  onClose,
  autoHideDuration = 6000
}) => {
  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ErrorSnackbar;
