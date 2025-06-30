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
      const defaultModel = models[0].id;

      const modelData = models.map(model => ({
        id: model.id,
        name: model.name,
        context_window: model.contextWindow,
        capabilities: model.capabilities,
      }));

      const providerData: Partial<AIProvider> = {
        name,
        apiKey,
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

  // 现代化模型项组件
  const ModelItem = ({ model }: { model: CustomModel }) => {
    return (
      <Grow in timeout={300}>
        <Paper
          elevation={2}
          sx={{
            mb: 1.5,
            borderRadius: 2,
            background: modernTheme.surface.card,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <ListItem
            sx={{ p: 2 }}
          >
            <Avatar
              sx={{
                background: modernTheme.accent.gradient,
                mr: 2,
                width: 40,
                height: 40,
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              <AIIcon />
            </Avatar>
            <ListItemText
              primary={
                <Typography
                  variant="subtitle1"
                  sx={{
                    color: '#ddd',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                  }}
                >
                  {model.name}
                </Typography>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: '0.8rem',
                      mb: 0.5,
                    }}
                  >
                    ID: {model.id}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${model.contextWindow.toLocaleString()} tokens`}
                      size="small"
                      sx={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#ddd',
                        fontSize: '0.7rem',
                        height: 20,
                      }}
                    />
                    {model.capabilities.map((cap) => (
                      <Chip
                        key={cap}
                        label={CAPABILITIES.find(c => c.value === cap)?.label || cap}
                        size="small"
                        sx={{
                          background: modernTheme.primary.gradient,
                          color: '#ddd',
                          fontSize: '0.7rem',
                          height: 20,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => handleDeleteModel(model.id)}
                sx={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ddd',
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </Paper>
      </Grow>
    );
  };

  // 现代化测试结果组件
  const TestResultDisplay = () => {
    if (!testResult) return null;

    return (
      <Fade in timeout={500}>
        <Paper
          sx={{
            mb: 2,
            borderRadius: 2,
            background: testResult.success 
              ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(69, 160, 73, 0.15) 100%)'
              : 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(211, 47, 47, 0.15) 100%)',
            border: testResult.success 
              ? '1px solid rgba(76, 175, 80, 0.3)'
              : '1px solid rgba(244, 67, 54, 0.3)',
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            {testResult.success ? (
              <CheckIcon sx={{ color: '#4CAF50', mr: 1 }} />
            ) : (
              <ErrorIcon sx={{ color: '#f44336', mr: 1 }} />
            )}
            <Typography
              variant="subtitle1"
              sx={{
                color: '#ddd',
                fontWeight: 600,
              }}
            >
              {testResult.message}
            </Typography>
          </Box>

          {testResult.models_tested && testResult.models_tested.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#ddd', mb: 1 }}>
                测试详情：
              </Typography>
              {testResult.models_tested.map((modelTest, index) => (
                <Paper
                  key={index}
                  sx={{
                    mb: 1,
                    p: 1.5,
                    background: modelTest.success 
                      ? 'rgba(76, 175, 80, 0.1)' 
                      : 'rgba(244, 67, 54, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#ddd', mb: 0.5 }}>
                    <strong>模型：</strong> {modelTest.model_id || '未指定'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ddd', mb: 0.5 }}>
                    <strong>状态：</strong> {modelTest.success ? '成功' : '失败'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ddd', mb: 0.5 }}>
                    <strong>响应时间：</strong> {modelTest.response_time.toFixed(2)} 秒
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ddd' }}>
                    <strong>消息：</strong> {modelTest.message}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Fade>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          background: modernTheme.surface.dark,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          color: '#ddd',
          maxHeight: '90vh',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 80% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)',
            pointerEvents: 'none',
          }
        }
      }}
    >
      {/* 现代化标题 */}
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          p: 3,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon 
            sx={{ 
              mr: 2, 
              color: modernTheme.primary.main,
              fontSize: 28,
              filter: 'drop-shadow(0 0 8px rgba(102, 126, 234, 0.6))',
            }} 
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: modernTheme.primary.gradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {editProvider ? `编辑提供商: ${editProvider.name}` : '添加自定义提供商'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
        {error && (
          <Fade in timeout={300}>
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                color: '#ddd',
                '& .MuiAlert-icon': { color: '#f44336' },
              }}
            >
              {error}
            </Alert>
          </Fade>
        )}

        <TestResultDisplay />

        {/* 基本信息步骤 */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: modernTheme.surface.card,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              color: '#ddd',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CloudIcon sx={{ mr: 1, color: modernTheme.primary.main }} />
            基本信息
          </Typography>
          
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              fullWidth
              label="提供商名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: modernTheme.primary.main },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiInputBase-input': { color: '#ddd' },
              }}
            />
            
            <TextField
              fullWidth
              label="API密钥"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: modernTheme.primary.main },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiInputBase-input': { color: '#ddd' },
              }}
            />
            
            <TextField
              fullWidth
              label="API基础URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如: https://api.example.com/v1"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: modernTheme.primary.main },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiInputBase-input': { color: '#ddd' },
              }}
            />
            
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>API格式类型</InputLabel>
              <Select
                value={formatType}
                onChange={(e) => setFormatType(e.target.value)}
                label="API格式类型"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: modernTheme.primary.main },
                  '& .MuiSelect-select': { color: '#ddd' },
                  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      background: modernTheme.surface.dark,
                      border: '1px solid rgba(255,255,255,0.1)',
                      '& .MuiMenuItem-root': {
                        color: '#ddd',
                        '&:hover': { background: 'rgba(255,255,255,0.1)' },
                      }
                    }
                  }
                }}
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
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#ddd',
                  background: 'rgba(255,255,255,0.05)',
                  '&:hover': {
                    background: modernTheme.accent.gradient,
                    borderColor: 'transparent',
                    boxShadow: modernTheme.accent.glow,
                  }
                }}
              >
                {loading ? '测试中...' : '测试连接'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* 模型配置步骤 */}
        <Paper
          sx={{
            p: 3,
            background: modernTheme.surface.card,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              color: '#ddd',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <AIIcon sx={{ mr: 1, color: modernTheme.accent.main }} />
            模型配置
          </Typography>
          
          <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="模型ID"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="例如: gpt-4-custom"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: modernTheme.accent.main },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiInputBase-input': { color: '#ddd' },
                }}
              />
              <TextField
                label="模型名称"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="例如: GPT-4 自定义"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: modernTheme.accent.main },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiInputBase-input': { color: '#ddd' },
                }}
              />
            </Box>
            
            <TextField
              label="上下文窗口大小"
              type="number"
              value={contextWindow}
              onChange={(e) => setContextWindow(parseInt(e.target.value))}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: modernTheme.accent.main },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiInputBase-input': { color: '#ddd' },
              }}
            />
            
            <FormControl size="small">
              <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>模型能力</InputLabel>
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
                        sx={{
                          background: modernTheme.primary.gradient,
                          color: '#ddd',
                          fontSize: '0.7rem',
                          height: 20,
                        }}
                      />
                    ))}
                  </Box>
                )}
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '& .MuiSelect-select': { color: '#ddd' },
                  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
                }}
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
              sx={{
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#ddd',
                background: 'rgba(255,255,255,0.05)',
                '&:hover': {
                  background: modernTheme.primary.gradient,
                  borderColor: 'transparent',
                  boxShadow: modernTheme.primary.glow,
                },
                '&:disabled': {
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.3)',
                }
              }}
            >
              添加模型
            </Button>
          </Box>

          {/* 已添加的模型列表 */}
          {models.length > 0 && (
            <Box>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  mb: 2, 
                  color: '#ddd',
                  fontWeight: 600,
                }}
              >
                已添加的模型 ({models.length})
              </Typography>
              <List sx={{ p: 0 }}>
                {models.map((model) => (
                  <ModelItem key={model.id} model={model} />
                ))}
              </List>
            </Box>
          )}
        </Paper>
      </DialogContent>

      {/* 现代化操作按钮 */}
      <DialogActions 
        sx={{ 
          p: 3, 
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          gap: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Button 
          onClick={onClose}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            '&:hover': {
              background: 'rgba(255,255,255,0.1)',
            }
          }}
        >
          取消
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !name || !apiKey || !baseUrl || models.length === 0}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
          sx={{
            background: modernTheme.primary.gradient,
            boxShadow: modernTheme.primary.glow,
            fontWeight: 600,
            px: 3,
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: `${modernTheme.primary.glow}, 0 6px 20px rgba(0,0,0,0.3)`,
            },
            '&:disabled': {
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            }
          }}
        >
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomProviderDialog;
