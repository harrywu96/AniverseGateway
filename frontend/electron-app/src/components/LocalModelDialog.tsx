import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { testLocalModel, saveLocalModel } from '../services/api';

interface LocalModelDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editModel?: any;
}

const LocalModelDialog: React.FC<LocalModelDialogProps> = ({
  open,
  onClose,
  onSave,
  editModel
}) => {
  // 状态管理
  const [name, setName] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [serviceUrl, setServiceUrl] = useState('http://localhost:8080');
  const [modelType, setModelType] = useState('gguf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // 当编辑模型时，加载模型信息
  useEffect(() => {
    if (open && editModel) {
      setName(editModel.name || '');
      setModelPath(editModel.model_path || '');
      setServiceUrl(editModel.base_url || 'http://localhost:8080');
      setModelType(editModel.model_type || 'gguf');
    } else if (open) {
      // 如果是新建模型，重置表单
      setName('');
      setModelPath('');
      setServiceUrl('http://localhost:8080');
      setModelType('gguf');
      setError('');
      setTestResult(null);
    }
  }, [open, editModel]);

  // 选择模型文件
  const handleSelectModelFile = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.openFileDialog({
          title: '选择模型文件',
          buttonLabel: '选择文件',
          filters: [
            { name: 'GGUF模型文件', extensions: ['gguf'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setModelPath(result.filePaths[0]);
        }
      } catch (error: any) {
        setError(`选择文件出错: ${error.message || '未知错误'}`);
      }
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!serviceUrl) {
      setError('服务地址不能为空');
      return;
    }

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      const response = await testLocalModel(serviceUrl, name);

      if (response.success && response.data) {
        setTestResult(response.data);
      } else {
        setError(response.message || '测试连接失败');
      }
    } catch (error: any) {
      setError(`测试连接出错: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 保存模型
  const handleSave = async () => {
    if (!name || !serviceUrl) {
      setError('模型名称和服务地址不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const modelConfig = {
        name,
        model_path: modelPath,
        base_url: serviceUrl,
        model_type: modelType,
        id: editModel?.id
      };

      const response = await saveLocalModel(modelConfig);

      if (response.success) {
        onSave();
        onClose();
      } else {
        setError(response.message || '保存模型配置失败');
      }
    } catch (error: any) {
      setError(`保存出错: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editModel ? `编辑本地模型: ${editModel.name}` : '添加本地模型'}</DialogTitle>
      <DialogContent>
        {/* 错误和成功提示 */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {testResult && <Alert severity="success" sx={{ mb: 2 }}>连接测试成功！模型可用。</Alert>}

        {/* 表单内容 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>基本信息</Typography>
        <Box sx={{ mb: 3 }}>
          {/* 模型名称输入框 */}
          <TextField
            fullWidth
            margin="normal"
            label="模型名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* 模型类型选择 */}
          <FormControl fullWidth margin="normal">
            <InputLabel>模型类型</InputLabel>
            <Select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              label="模型类型"
            >
              <MenuItem value="gguf">GGUF</MenuItem>
              <MenuItem value="ggml">GGML</MenuItem>
              <MenuItem value="other">其他</MenuItem>
            </Select>
          </FormControl>

          {/* 模型路径选择 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="模型文件路径"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              sx={{ mr: 1 }}
            />
            <Button variant="outlined" onClick={handleSelectModelFile} sx={{ mt: 2, height: 56 }}>
              浏览...
            </Button>
          </Box>

          {/* 服务地址输入框 */}
          <TextField
            fullWidth
            margin="normal"
            label="服务地址"
            value={serviceUrl}
            onChange={(e) => setServiceUrl(e.target.value)}
            placeholder="例如: http://localhost:8080"
            required
          />

          {/* 测试连接按钮 */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={loading || !serviceUrl}
            >
              {loading ? <CircularProgress size={24} /> : '测试连接'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !name || !serviceUrl}
        >
          {loading ? <CircularProgress size={24} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocalModelDialog;
