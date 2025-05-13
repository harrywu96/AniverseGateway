import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertProps } from '@mui/material';

interface ErrorSnackbarProps {
  message: string | null;
  severity?: AlertProps['severity'];
  autoHideDuration?: number;
  onClose?: () => void;
}

/**
 * 错误提示组件
 * 用于显示错误、警告、成功等消息
 */
const ErrorSnackbar: React.FC<ErrorSnackbarProps> = ({
  message,
  severity = 'error',
  autoHideDuration = 6000,
  onClose
}) => {
  const [open, setOpen] = useState(false);

  // 当消息变化时，显示Snackbar
  useEffect(() => {
    if (message) {
      setOpen(true);
    }
  }, [message]);

  // 处理关闭事件
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
    
    // 如果提供了onClose回调，延迟调用，确保动画完成
    if (onClose) {
      setTimeout(onClose, 300);
    }
  };

  return (
    <Snackbar
      open={open && !!message}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ErrorSnackbar;
