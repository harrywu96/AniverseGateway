import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { getOllamaConfig, saveOllamaConfig, testProvider } from '../services/api';

interface OllamaDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  initialConfig?: any;
}

const OllamaDialog: React.FC<OllamaDialogProps> = ({
  open,
  onClose,
  onSave,
  initialConfig = {}
}) => {
  // 状态管理
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [customModelName, setCustomModelName] = useState('');
  const [serviceAvailable, setServiceAvailable] = useState(false);

  // 当对话框打开时，加载配置
  useEffect(() => {
    if (open) {
      if (initialConfig && Object.keys(initialConfig).length > 0) {
        setBaseUrl(initialConfig.base_url || 'http://localhost:11434');
        setSelectedModel(initialConfig.model || '');
        setApiKey(initialConfig.api_key || '');
      } else {
        // 如果没有初始配置，尝试从后端获取
        fetchOllamaConfig();
      }
      // 无论如何，都尝试获取模型列表
      fetchOllamaModels();
    }
  }, [open, initialConfig]);

  // 获取Ollama配置
  const fetchOllamaConfig = async () => {
    try {
      setLoading(true);
      const response = await getOllamaConfig();
      if (response.success && response.data) {
        setBaseUrl(response.data.base_url || 'http://localhost:11434');
        setSelectedModel(response.data.model || '');
        setApiKey(response.data.api_key || '');
      }
    } catch (error: any) {
      console.error('获取Ollama配置失败:', error);
      // 不显示错误，使用默认值
    } finally {
      setLoading(false);
    }
  };

  // 获取Ollama模型列表
  const fetchOllamaModels = async () => {
    try {
      setModelLoading(true);
      setError('');

      // 首先检查Ollama服务是否可用
      try {
        // 简单的服务可用性检查
        const checkResponse = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
          // 设置较短的超时时间，以便快速检测服务是否可用
          signal: AbortSignal.timeout(3000)
        });

        if (!checkResponse.ok) {
          throw new Error(`服务返回错误: ${checkResponse.status}`);
        }

        // 如果服务可用，获取模型列表
        const data = await checkResponse.json();

        if (data && data.models) {
          // 直接从Ollama API获取模型列表
          const modelList = data.models.map((model: any) => ({
            id: model.name,
            name: model.name
          }));

          setModels(modelList);

          // 如果没有选择模型且有可用模型，选择第一个
          if (!selectedModel && modelList.length > 0) {
            setSelectedModel(modelList[0].id);
          }

          // 清除错误信息
          setError('');
          // 更新服务可用性状态
          setServiceAvailable(true);
          return;
        }
      } catch (checkError: any) {
        // 如果服务不可用，显示错误信息
        console.error('Ollama服务检查失败:', checkError);
        setError(`本地Ollama服务未启动或无法访问: ${checkError.message || '未知错误'}。请确保Ollama服务已启动并可访问。`);

        // 更新服务可用性状态
        setServiceAvailable(false);

        // 尝试通过后端API获取模型列表
        try {
          // 使用新实现的API端点
          const apiPort = '8000';
          const url = `http://localhost:${apiPort}/api/models`;
          const response = await fetch(url);

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.models) {
              const modelList = result.data.models.map((model: any) => ({
                id: model.id || model.name,
                name: model.name
              }));

              setModels(modelList);

              // 如果没有选择模型且有可用模型，选择第一个
              if (!selectedModel && modelList.length > 0) {
                setSelectedModel(modelList[0].id);
              }

              // 更新错误信息，但仍然保持服务不可用状态
              setError('已从后端获取模型列表，但Ollama服务仍然不可访问。请确保Ollama服务已启动。');
              return;
            }
          }
        } catch (apiError) {
          console.error('通过后端API获取模型列表失败:', apiError);
          // 继续使用默认模型列表
        }

        // 使用默认模型列表
        setModels([
          { id: 'llama3', name: 'Llama 3' },
          { id: 'llama2', name: 'Llama 2' },
          { id: 'mistral', name: 'Mistral' },
          { id: 'gemma', name: 'Gemma' }
        ]);
        return;
      }

      // 如果直接获取失败，尝试通过后端API获取
      const response = await testProvider('ollama', apiKey, baseUrl);
      if (response.success && response.data && response.data.models_tested) {
        // 从测试结果中提取模型列表
        const modelList = response.data.models_tested
          .filter((model: any) => model.success)
          .map((model: any) => ({
            id: model.model_id,
            name: model.model_id // 使用模型ID作为名称
          }));
        setModels(modelList);

        // 如果没有选择模型且有可用模型，选择第一个
        if (!selectedModel && modelList.length > 0) {
          setSelectedModel(modelList[0].id);
        }

        // 清除错误信息
        setError('');
        // 更新服务可用性状态
        setServiceAvailable(true);
      } else {
        // 如果测试失败，显示错误信息
        if (response.message) {
          setError(`获取模型列表失败: ${response.message}`);
        }

        // 更新服务可用性状态
        setServiceAvailable(false);

        // 使用默认模型列表
        setModels([
          { id: 'llama3', name: 'Llama 3' },
          { id: 'llama2', name: 'Llama 2' },
          { id: 'mistral', name: 'Mistral' },
          { id: 'gemma', name: 'Gemma' }
        ]);
      }
    } catch (error: any) {
      console.error('获取Ollama模型列表失败:', error);
      setError(`获取模型列表失败: ${error.message || '未知错误'}`);

      // 更新服务可用性状态
      setServiceAvailable(false);

      // 使用默认模型列表
      setModels([
        { id: 'llama3', name: 'Llama 3' },
        { id: 'llama2', name: 'Llama 2' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'gemma', name: 'Gemma' }
      ]);
    } finally {
      setModelLoading(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl) {
      setError('服务地址不能为空');
      return;
    }

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      const response = await testProvider('ollama', apiKey, baseUrl, selectedModel);

      if (response.success && response.data) {
        setTestResult(response.data);
        // 如果测试成功，更新模型列表
        fetchOllamaModels();
        // 更新服务可用性状态
        setServiceAvailable(true);
      } else {
        setError(response.message || '测试连接失败');
        // 更新服务可用性状态
        setServiceAvailable(false);
      }
    } catch (error: any) {
      setError(`测试连接出错: ${error.message || '未知错误'}`);
      // 更新服务可用性状态
      setServiceAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  // 添加自定义模型
  const handleAddCustomModel = () => {
    if (!customModelName.trim()) {
      setError('模型名称不能为空');
      return;
    }

    // 检查是否已存在相同名称的模型
    const exists = models.some(model => model.id === customModelName.trim());
    if (exists) {
      setError(`模型 "${customModelName.trim()}" 已存在`);
      return;
    }

    // 添加新模型到列表
    const newModel = {
      id: customModelName.trim(),
      name: customModelName.trim()
    };

    setModels([...models, newModel]);

    // 选择新添加的模型
    setSelectedModel(newModel.id);

    // 清空输入框
    setCustomModelName('');

    // 清除错误信息
    setError('');
  };

  // 保存配置
  const handleSave = async () => {
    if (!baseUrl || !selectedModel) {
      setError('服务地址和模型不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const config = {
        base_url: baseUrl,
        model: selectedModel,
        api_key: apiKey
      };

      const response = await saveOllamaConfig(config);

      if (response.success) {
        onSave();
        onClose();
      } else {
        setError(response.message || '保存Ollama配置失败');
      }
    } catch (error: any) {
      setError(`保存出错: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>配置Ollama服务</DialogTitle>
      <DialogContent>
        {/* 错误和成功提示 */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {testResult && <Alert severity="success" sx={{ mb: 2 }}>连接测试成功！Ollama服务可用。</Alert>}

        {/* 服务配置部分 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>服务配置</Typography>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            margin="normal"
            label="服务地址"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如: http://localhost:11434"
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="API密钥（可选）"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
          />
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={loading || !baseUrl}
            >
              {loading ? <CircularProgress size={24} /> : '测试连接'}
            </Button>
          </Box>
        </Box>

        {/* 模型选择部分 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>模型选择</Typography>
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="model-select-label">选择模型</InputLabel>
            <Select
              labelId="model-select-label"
              value={selectedModel}
              label="选择模型"
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={modelLoading || models.length === 0}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 自定义模型输入 */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            <TextField
              label="添加自定义模型"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="输入模型名称"
              size="small"
              sx={{ flexGrow: 1, mr: 1 }}
              disabled={!serviceAvailable}
            />
            <Button
              variant="outlined"
              onClick={handleAddCustomModel}
              disabled={!serviceAvailable || !customModelName.trim()}
              size="small"
            >
              添加
            </Button>
          </Box>

          {/* 服务状态提示 */}
          {!serviceAvailable && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Ollama服务未启动或无法访问。请确保Ollama服务已启动并可访问，然后点击"测试连接"按钮重试。
            </Alert>
          )}

          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            注意：Ollama模型需要预先在本地安装并启动Ollama服务。
            请访问 <Link href="https://ollama.ai" target="_blank" rel="noopener noreferrer">Ollama官网</Link> 了解更多信息。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !baseUrl || !selectedModel}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OllamaDialog;
