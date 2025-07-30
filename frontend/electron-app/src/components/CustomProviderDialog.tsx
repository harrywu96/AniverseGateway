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
  Chip,
  Fade,
  Grow,
  Zoom,
  keyframes,
  Paper,
  Avatar,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  CloudQueue as CloudIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import { testProvider } from '../services/api';
import { Provider as AIProvider, AIModel } from '../store/providerSlice';

// 现代化深色主题
const modernTheme = {
  primary: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    main: '#667eea',
    glow: '0 0 20px rgba(102, 126, 234, 0.6)',
  },
  secondary: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    main: '#f093fb',
    glow: '0 0 20px rgba(240, 147, 251, 0.6)',
  },
  accent: {
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    main: '#4facfe',
    glow: '0 0 20px rgba(79, 172, 254, 0.6)',
  },
  success: {
    gradient: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
    glow: '0 0 20px rgba(76, 175, 80, 0.6)',
  },
  error: {
    gradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
    glow: '0 0 20px rgba(244, 67, 54, 0.6)',
  },
  surface: {
    dark: 'linear-gradient(135deg, #1e1e2f 0%, #2d1b69 100%)',
    card: 'rgba(255, 255, 255, 0.05)',
    cardHover: 'rgba(255, 255, 255, 0.08)',
  }
};

// 动画关键帧
const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const pulseSuccess = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.8), 0 0 30px rgba(76, 175, 80, 0.6);
  }
`;

const rotateIcon = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// 格式类型选项
const FORMAT_TYPES = [
  { value: 'openai', label: 'OpenAI 兼容', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic 兼容', icon: '🧠' },
  { value: 'custom', label: '自定义格式', icon: '⚙️' },
];

// 模型能力选项
const CAPABILITIES = [
  { value: 'chat', label: '聊天', icon: '💬' },
  { value: 'completion', label: '文本补全', icon: '📝' },
  { value: 'vision', label: '视觉', icon: '👁️' },
  { value: 'embedding', label: '嵌入', icon: '🔗' },
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
        setName(editProvider.name || '');
        setApiKey('');
        setBaseUrl(editProvider.apiHost || '');
        setFormatType('openai');
        
        if (editProvider.models && editProvider.models.length > 0) {
          const loadedModels = editProvider.models.map(model => ({
            id: model.id,
            name: model.name,
            contextWindow: (model as any).context_window || 4096,
            capabilities: Array.isArray(model.capabilities) ? model.capabilities : ['chat'],
          }));
          setModels(loadedModels);
        } else {
          setModels([]);
        }
      } else {
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
    // 验证必填字段
    if (!name || !baseUrl) {
      setError('提供商名称和基础URL不能为空');
      return;
    }

    // 在新建模式下，API Key 是必需的
    if (!editProvider && !apiKey) {
      setError('API密钥不能为空');
      return;
    }

    if (models.length === 0) {
      setError('至少需要添加一个模型');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const defaultModel = models[0].id;

      const modelData = models.map(model => ({
        id: model.id,
        name: model.name,
        context_window: model.contextWindow,
        capabilities: model.capabilities,
      }));

      // 在编辑模式下，如果 API Key 为空，则保持原有的 API Key
      const finalApiKey = editProvider && !apiKey ? editProvider.apiKey : apiKey;

      const providerData: Partial<AIProvider> = {
        name,
        apiKey: finalApiKey,
        apiHost: baseUrl,
        id: editProvider?.id,
        is_active: true,
        isSystem: false,
        models: modelData.map(model => ({
          ...model,
          provider_id: editProvider?.id || '',
          isDefault: model.id === defaultModel
        })),
      };

      onSave(providerData, !!editProvider);
      onClose();
    } catch (error) {
      console.error('保存自定义提供商出错:', error);
      setError(error instanceof Error ? error.message : '保存时出错');
    } finally {
      setLoading(false);
    }
  };

  // 简化模型项组件
  const ModelItem = ({ model }: { model: CustomModel }) => {
    return (
      <ListItem
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          mb: 1,
          bgcolor: 'background.paper'
        }}
      >
        <ListItemText
          primary={model.name}
          secondary={
            <React.Fragment>
              ID: {model.id}
              <br />
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                <Chip
                  label={`${model.contextWindow.toLocaleString()} tokens`}
                  size="small"
                />
                {model.capabilities.map((cap) => (
                  <Chip
                    key={cap}
                    label={CAPABILITIES.find(c => c.value === cap)?.label || cap}
                    size="small"
                    color="primary"
                  />
                ))}
              </Box>
            </React.Fragment>
          }
        />
        <ListItemSecondaryAction>
          <IconButton
            edge="end"
            onClick={() => handleDeleteModel(model.id)}
          >
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  // 简化测试结果组件
  const TestResultDisplay = () => {
    if (!testResult) return null;

    return (
      <Alert severity={testResult.success ? "success" : "error"} sx={{ mb: 2 }}>
        <Typography variant="subtitle1">
          {testResult.message}
        </Typography>

        {testResult.models_tested && testResult.models_tested.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              测试详情：
            </Typography>
            {testResult.models_tested.map((modelTest, index) => (
              <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
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
              </Box>
            ))}
          </Box>
        )}
      </Alert>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editProvider ? `编辑提供商: ${editProvider.name}` : '添加自定义提供商'}</DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TestResultDisplay />

        {/* 基本信息步骤 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>基本信息</Typography>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gap: 2 }}>
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
              placeholder={editProvider ? "留空以保持原有密钥不变" : "输入您的API密钥"}
              required={!editProvider}
              helperText={editProvider ? "编辑模式下可留空以保持原有密钥" : ""}
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
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ mr: 1 }}>{type.icon}</Typography>
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 测试连接部分 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              {models.length > 0 && (
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>选择测试模型</InputLabel>
                  <Select
                    value={testModel}
                    onChange={(e) => setTestModel(e.target.value)}
                    label="选择测试模型"
                    disabled={loading}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      '& .MuiSelect-select': { color: '#ddd' },
                      '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
                    }}
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
                startIcon={loading ? <CircularProgress size={20} /> : <SpeedIcon />}
              >
                {loading ? '测试中...' : '测试连接'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* 模型配置步骤 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>模型配置</Typography>
        <Box sx={{ mb: 3 }}>
          
          <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="模型ID"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="例如: gpt-4-custom"
                size="small"
              />
              <TextField
                label="模型名称"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="例如: GPT-4 自定义"
                size="small"
              />
            </Box>
            
            <TextField
              label="上下文窗口大小"
              type="number"
              value={contextWindow}
              onChange={(e) => setContextWindow(parseInt(e.target.value))}
              size="small"
            />
            
            <FormControl size="small" fullWidth>
              <InputLabel>模型能力</InputLabel>
              <Select
                multiple
                value={selectedCapabilities}
                onChange={(e) => setSelectedCapabilities(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
                label="模型能力"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={CAPABILITIES.find(c => c.value === value)?.label}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {CAPABILITIES.map((capability) => (
                  <MenuItem key={capability.value} value={capability.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ mr: 1 }}>{capability.icon}</Typography>
                      {capability.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddModel}
              disabled={!modelId || !modelName}
            >
              添加模型
            </Button>
          </Box>

          {/* 已添加的模型列表 */}
          {models.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                已添加的模型 ({models.length})
              </Typography>
              <List sx={{ p: 0 }}>
                {models.map((model) => (
                  <ModelItem key={model.id} model={model} />
                ))}
              </List>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !name || !baseUrl || models.length === 0 || (!editProvider && !apiKey)}
        >
          {loading ? <CircularProgress size={24} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomProviderDialog;
