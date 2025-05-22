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
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { testProvider } from '../services/api';
import { Provider as AIProvider, AIModel } from '../store/providerSlice';

// 格式类型选项
const FORMAT_TYPES = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic 兼容' },
  { value: 'custom', label: '自定义格式' },
];

// 模型能力选项
const CAPABILITIES = [
  { value: 'chat', label: '聊天' },
  { value: 'completion', label: '文本补全' },
  { value: 'vision', label: '视觉' },
  { value: 'embedding', label: '嵌入' },
];

interface CustomProviderDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (providerData: Partial<AIProvider>, isEditing: boolean) => void;
  editProvider?: AIProvider | null;
}

interface CustomModel {
  id: string;
  name: string;
  contextWindow: number;
  capabilities: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  models_tested?: Array<{
    model_id: string;
    success: boolean;
    message: string;
    response_time: number;
    response_data?: any;
  }>;
}

const CustomProviderDialog: React.FC<CustomProviderDialogProps> = ({ open, onClose, onSave, editProvider }) => {
  // 基本信息
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [formatType, setFormatType] = useState('openai');

  // 当编辑提供商时，加载提供商信息
  useEffect(() => {
    if (open) {
      if (editProvider) {
        // 设置提供商基本信息
        setName(editProvider.name || '');
        
        // API密钥通常不会从后端返回，所以这里保持空白
        // 如果需要编辑已保存的API密钥，需要从安全存储中获取
        setApiKey('');
        
        // 设置API基础URL (apiHost)
        setBaseUrl(editProvider.apiHost || '');
        
        // 设置格式类型，这需要根据实际存储位置来获取
        // 因为Provider接口没有formatType字段，可能需要从其他地方获取或默认为'openai'
        setFormatType('openai'); // 默认值，实际应根据存储位置获取
        
        // 如果提供商有模型，加载模型
        if (editProvider.models && editProvider.models.length > 0) {
          const loadedModels = editProvider.models.map(model => ({
            id: model.id,
            name: model.name,
            // 处理不同字段名的兼容性问题
            contextWindow: (model as any).context_window || 4096,
            // 确保capabilities是数组
            capabilities: Array.isArray(model.capabilities) ? model.capabilities : ['chat'],
          }));
          setModels(loadedModels);
        } else {
          // 如果没有模型，设置为空数组
          setModels([]);
        }
      } else {
        // 如果是新建提供商或对话框刚打开，重置所有表单字段
        setName('');
        setApiKey('');
        setBaseUrl('');
        setFormatType('openai');
        setModels([]);
        setModelId('');
        setModelName('');
        setContextWindow(4096);
        setSelectedCapabilities(['chat']);
        setError('');
        setTestResult(null);
        setTestModel('');
      }
    }
  }, [open, editProvider]);

  // 模型信息
  const [models, setModels] = useState<CustomModel[]>([]);
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [contextWindow, setContextWindow] = useState(4096);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(['chat']);

  // 状态
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [testModel, setTestModel] = useState<string>('');

  // 添加模型
  const handleAddModel = () => {
    if (!modelId || !modelName) {
      setError('模型ID和名称不能为空');
      return;
    }

    // 检查ID是否已存在
    if (models.some(m => m.id === modelId)) {
      setError('模型ID已存在');
      return;
    }

    const newModel: CustomModel = {
      id: modelId,
      name: modelName,
      contextWindow,
      capabilities: selectedCapabilities,
    };

    setModels([...models, newModel]);

    // 清空表单
    setModelId('');
    setModelName('');
    setContextWindow(4096);
    setSelectedCapabilities(['chat']);
    setError('');
  };

  // 删除模型
  const handleDeleteModel = (id: string) => {
    setModels(models.filter(model => model.id !== id));
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!apiKey || !baseUrl) {
      setError('API密钥和基础URL不能为空');
      return;
    }

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      // 如果有选择模型进行测试，则使用选择的模型
      const modelToTest = testModel || (models.length > 0 ? models[0].id : undefined);

      const response = await testProvider(
        'custom',
        apiKey,
        baseUrl,
        modelToTest,
        formatType
      );

      if (response.success && response.data) {
        setTestResult(response.data);
      } else {
        setError(response.message || '测试失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '测试连接时出错');
    } finally {
      setLoading(false);
    }
  };

  // 保存提供商
  const handleSave = async () => {
    if (!name || !apiKey || !baseUrl) {
      setError('提供商名称、API密钥和基础URL不能为空');
      return;
    }

    if (models.length === 0) {
      setError('至少需要添加一个模型');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 使用第一个模型作为默认模型
      const defaultModel = models[0].id;

      // 准备模型数据
      const modelData = models.map(model => ({
        id: model.id,
        name: model.name,
        context_window: model.contextWindow,
        capabilities: model.capabilities,
      }));

      // 构建要传递给父组件的提供商数据
      const providerData: Partial<AIProvider> = {
        name,
        apiKey,
        apiHost: baseUrl,
        // 当创建新提供商时，id 将由后端生成
        // 当编辑现有提供商时，使用现有的 id
        id: editProvider?.id,
        // 假设新的/编辑的提供商默认是激活的
        is_active: true,
        // 对于自定义提供商，isSystem 应为 false
        isSystem: false,
        // 将模型数据添加到提供商数据中
        models: modelData.map(model => ({
          ...model,
          // 如果是编辑现有提供商，使用其 id 作为 provider_id
          provider_id: editProvider?.id || '',
          // 将第一个模型设为默认
          isDefault: model.id === defaultModel
        })),
      };

      // 调用父组件的 onSave 回调，传递提供商数据和编辑状态
      onSave(providerData, !!editProvider);
      
      // 关闭对话框
      onClose();
    } catch (error) {
      console.error('保存自定义提供商出错:', error);
      setError(error instanceof Error ? error.message : '保存时出错');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editProvider ? `编辑提供商: ${editProvider.name}` : '添加自定义提供商'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {testResult && (
          <Box sx={{ mb: 2 }}>
            <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 1 }}>
              {testResult.message}
            </Alert>

            {testResult.models_tested && testResult.models_tested.length > 0 && (
              <Box sx={{ mt: 1, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle2" gutterBottom>测试详情：</Typography>
                {testResult.models_tested.map((modelTest, index) => (
                  <Box key={index} sx={{ mb: 1, p: 1, bgcolor: modelTest.success ? 'rgba(0, 200, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)', borderRadius: 1 }}>
                    <Typography variant="body2">
                      <strong>模型：</strong> {modelTest.model_id || '未指定'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>状态：</strong> {modelTest.success ? '成功' : '失败'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>响应时间：</strong> {modelTest.response_time.toFixed(2)} 秒
                    </Typography>
                    <Typography variant="body2">
                      <strong>消息：</strong> {modelTest.message}
                    </Typography>
                    {modelTest.response_data && (
                      <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-word' }}>
                        <strong>响应数据：</strong>
                        <Box component="span" sx={{ display: 'block', maxHeight: '100px', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.8rem', bgcolor: 'rgba(0,0,0,0.03)', p: 1, borderRadius: 1, mt: 0.5 }}>
                          {typeof modelTest.response_data === 'string'
                            ? modelTest.response_data
                            : JSON.stringify(modelTest.response_data, null, 2)}
                        </Box>
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          基本信息
        </Typography>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            margin="normal"
            label="提供商名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="API密钥"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="API基础URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如: https://api.example.com/v1"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>API格式类型</InputLabel>
            <Select
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
              label="API格式类型"
            >
              {FORMAT_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            {models.length > 0 && (
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>选择测试模型</InputLabel>
                <Select
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  label="选择测试模型"
                  disabled={loading}
                >
                  <MenuItem value="">不指定模型</MenuItem>
                  {models.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={loading || !apiKey || !baseUrl}
            >
              {loading ? <CircularProgress size={24} /> : '测试连接'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          模型配置
        </Typography>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label="模型ID"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="例如: gpt-4-custom"
          />
          <TextField
            fullWidth
            margin="normal"
            label="模型名称"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="例如: GPT-4 自定义"
          />
          <TextField
            fullWidth
            margin="normal"
            label="上下文窗口大小"
            type="number"
            value={contextWindow}
            onChange={(e) => setContextWindow(parseInt(e.target.value))}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>模型能力</InputLabel>
            <Select
              multiple
              value={selectedCapabilities}
              onChange={(e) => setSelectedCapabilities(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
              label="模型能力"
            >
              {CAPABILITIES.map((capability) => (
                <MenuItem key={capability.value} value={capability.value}>
                  {capability.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddModel}
              disabled={!modelId || !modelName}
            >
              添加模型
            </Button>
          </Box>
        </Box>

        {models.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              已添加的模型
            </Typography>
            <List>
              {models.map((model) => (
                <ListItem key={model.id}>
                  <ListItemText
                    primary={`${model.name} (${model.id})`}
                    secondary={`上下文窗口: ${model.contextWindow}, 能力: ${model.capabilities.join(', ')}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleDeleteModel(model.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !name || !apiKey || !baseUrl || models.length === 0}
        >
          {loading ? <CircularProgress size={24} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomProviderDialog;
