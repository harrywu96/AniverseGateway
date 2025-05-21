import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { AIProvider, AIModel } from '../shared';
import { testProvider, updateProvider, getProviderModels, deleteCustomModel, getProviderDetails, deleteCustomProvider } from '../services/api';
import { maskApiKey } from '../utils/apiUtils';

interface ProviderDetailProps {
  provider: AIProvider | null;
  models: AIModel[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onUpdateProvider: () => void;
  onEditProvider: () => void;
  onRefreshModels: () => void;
  loadingModels: boolean;
  onDeleteProvider?: () => void; // 删除提供商后的回调函数
}

const ProviderDetail: React.FC<ProviderDetailProps> = ({
  provider,
  models,
  selectedModel,
  onSelectModel,
  onUpdateProvider,
  onEditProvider,
  onRefreshModels,
  loadingModels,
  onDeleteProvider,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AIModel | null>(null);
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 当提供商变化时，获取提供商详细信息并更新表单
  useEffect(() => {
    if (provider) {
      // 清空当前表单状态，防止显示上一个提供商的信息
      setApiKey('');
      setBaseUrl('');

      // 获取提供商详细信息
      const fetchProviderDetails = async () => {
        try {
          console.log(`获取提供商详细信息: ${provider.id}`);
          const response = await getProviderDetails(provider.id);
          console.log('获取提供商详细信息响应:', response);

          if (response.success && response.data) {
            // 设置API基础URL
            if (response.data.base_url) {
              console.log(`设置API基础URL: ${response.data.base_url}`);
              setBaseUrl(response.data.base_url);
            }

            // 设置API密钥，即使是掩码形式的
            if (response.data.api_key) {
              console.log(`设置API密钥: ${response.data.api_key}`);
              // 如果是掩码形式的，直接设置
              // 如果是真实API密钥，可以使用maskApiKey函数进行掩码
              setApiKey(response.data.api_key);
            }
          }
        } catch (error) {
          console.error('获取提供商详细信息失败:', error);
        }
      };

      // 如果是自定义提供商，立即获取详细信息
      if (provider.id === 'custom' || provider.id.startsWith('custom-')) {
        fetchProviderDetails();
      }
      // 对于其他提供商，也获取详细信息
      else {
        fetchProviderDetails();
      }
    }
  }, [provider]);

  if (!provider) {
    return (
      <Paper sx={{ flexGrow: 1, p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="subtitle1" color="text.secondary">
          请选择一个提供商
        </Typography>
      </Paper>
    );
  }

  const handleSave = async () => {
    if (!provider) return;

    setIsSaving(true);
    try {
      // 处理自定义提供商的ID
      let saveProviderId = provider.id;
      let saveBaseUrl = undefined;

      // 如果是自定义提供商，需要将ID转换为'custom'
      if (provider.id === 'custom' || provider.id.startsWith('custom-')) {
        // 如果是custom-开头，保留原始ID但传递baseUrl
        saveBaseUrl = baseUrl;
      }

      // 检查API密钥是否是掩码形式
      // 如果是掩码形式（全是*号或者包含•符号），则不发送密钥
      const isMaskedKey = apiKey && apiKey.trim() && (/^\*+$/.test(apiKey) || apiKey.includes('•'));
      const keyToSend = isMaskedKey ? '' : apiKey;

      console.log(`保存提供商配置: ${saveProviderId}`);
      console.log(`API密钥是否掩码: ${isMaskedKey}, 发送的密钥长度: ${keyToSend.length}`);
      console.log(`基础URL: ${saveBaseUrl}`);
      console.log(`选中模型: ${selectedModel}`);

      // 更新提供商配置
      await updateProvider(
        saveProviderId,
        keyToSend, // 如果是掩码形式，则传空字符串，表示不修改
        selectedModel,
        saveBaseUrl
      );

      setIsEditing(false);
      onUpdateProvider();
    } catch (error) {
      console.error('保存提供商配置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!provider) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // 处理自定义提供商的ID
      let testProviderId = provider.id;
      let testBaseUrl = undefined;
      let testModel = selectedModel;

      // 如果是自定义提供商，设置测试基础URL
      if (provider.id === 'custom' || provider.id.startsWith('custom-')) {
        testBaseUrl = baseUrl;
      }

      // 检查API密钥是否是掌码形式
      // 如果是掌码形式（全是*号或者包含•符号），则不发送密钥
      const isMaskedKey = apiKey && apiKey.trim() && (/^\*+$/.test(apiKey) || apiKey.includes('•'));
      const keyToSend = isMaskedKey ? '' : apiKey;

      // 确保有指定模型进行测试
      if (!testModel && models.length > 0) {
        // 如果没有选择模型，使用第一个模型
        testModel = models[0].id;
        console.log(`没有选择模型，使用第一个模型进行测试: ${testModel}`);
      }

      console.log(`测试提供商连接: ${testProviderId}`);
      console.log(`API密钥是否掌码: ${isMaskedKey}, 发送的密钥长度: ${keyToSend.length}`);
      console.log(`基础URL: ${testBaseUrl}`);
      console.log(`测试模型: ${testModel}`);

      const response = await testProvider(
        testProviderId,
        keyToSend,
        testBaseUrl,
        testModel
      );

      if (response.success && response.data) {
        setTestResult({
          success: response.data.success,
          message: response.data.message,
        });
      } else {
        setTestResult({
          success: false,
          message: response.message || '测试失败',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '测试连接时出错',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;

    try {
      // 处理自定义提供商的ID
      let deleteProviderId = provider.id;

      // 如果是自定义提供商，需要将ID转换为'custom'
      if (provider.id.startsWith('custom-')) {
        deleteProviderId = 'custom';
      }

      await deleteCustomModel(deleteProviderId, modelToDelete.id);
      onRefreshModels();
      setDeleteModelDialogOpen(false);
      setModelToDelete(null);
    } catch (error) {
      console.error('删除模型失败:', error);
    }
  };

  const openDeleteModelDialog = (model: AIModel) => {
    setModelToDelete(model);
    setDeleteModelDialogOpen(true);
  };

  // 打开删除提供商对话框
  const openDeleteProviderDialog = () => {
    setDeleteProviderDialogOpen(true);
  };

  // 删除提供商
  const handleDeleteProvider = async () => {
    if (!provider || !provider.id.startsWith('custom-')) return;

    setIsDeleting(true);
    try {
      // 提取真正的提供商ID（去除'custom-'前缀）
      const providerId = provider.id;

      console.log(`删除提供商: ${providerId}`);
      const response = await deleteCustomProvider(providerId);

      if (response.success) {
        // 关闭对话框
        setDeleteProviderDialogOpen(false);
        // 通知父组件刷新提供商列表
        if (onDeleteProvider) {
          onDeleteProvider();
        }
      } else {
        console.error('删除提供商失败:', response.message);
      }
    } catch (error) {
      console.error('删除提供商出错:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{provider.name}</Typography>
        <Box>
          {provider.id.startsWith('custom-') && (
            <Tooltip title="删除提供商">
              <IconButton size="small" onClick={openDeleteProviderDialog} sx={{ mr: 1 }} color="error">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
          {provider.id === 'custom' && (
            <Tooltip title="编辑提供商">
              <IconButton size="small" onClick={onEditProvider} sx={{ mr: 1 }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          )}
          {isEditing ? (
            <>
              <Tooltip title="保存">
                <span>
                  <IconButton size="small" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <CircularProgress size={20} /> : <CheckIcon />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="取消">
                <IconButton size="small" onClick={() => setIsEditing(false)}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Tooltip title="编辑配置">
              <IconButton size="small" onClick={() => setIsEditing(true)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Divider />

      <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setTestResult(null)}
          >
            {testResult.message}
          </Alert>
        )}

        <Typography variant="subtitle1" gutterBottom>
          基本配置
        </Typography>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            margin="normal"
            label="API 密钥"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!isEditing}
            placeholder={isEditing ? '' : '••••••••••••••••••••••••••'}
          />

          {(provider.id === 'custom' || provider.id.startsWith('custom-')) && (
            <TextField
              fullWidth
              margin="normal"
              label="API 基础URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={!isEditing}
              placeholder={isEditing ? '' : 'https://api.example.com/v1'}
            />
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={isTesting || (!apiKey && !isEditing)}
            >
              {isTesting ? <CircularProgress size={24} /> : '测试连接'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">
            模型列表
          </Typography>
          <Tooltip title="刷新模型列表">
            <span>
              <IconButton size="small" onClick={onRefreshModels} disabled={loadingModels}>
                {loadingModels ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <FormControl fullWidth margin="normal">
          <InputLabel id="model-select-label">选择模型</InputLabel>
          <Select
            labelId="model-select-label"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            label="选择模型"
            disabled={!isEditing || loadingModels}
          >
            {models.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name}
                {(model as any).is_default && (
                  <Chip
                    label="默认"
                    size="small"
                    color="primary"
                    sx={{ ml: 1, height: 20 }}
                  />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <List sx={{ mt: 2 }}>
          {models.map((model) => (
            <ListItem
              key={model.id}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                bgcolor: model.id === selectedModel ? 'action.selected' : 'transparent',
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {model.name}
                    {(model as any).is_default && (
                      <Chip
                        label="默认"
                        size="small"
                        color="primary"
                        sx={{ ml: 1, height: 20 }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box component="span">
                    <Typography variant="caption" component="span">
                      ID: {model.id}
                    </Typography>
                    <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                      • 上下文: {((model as any).context_window || model.contextWindow || 0).toLocaleString()}
                    </Typography>
                    {model.capabilities && model.capabilities.length > 0 && (
                      <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                        • 能力: {model.capabilities.join(', ')}
                      </Typography>
                    )}
                  </Box>
                }
              />
              {(provider.id === 'custom' || provider.id.startsWith('custom-')) && (
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => openDeleteModelDialog(model)}
                    disabled={!isEditing}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      </Box>

      {/* 删除模型确认对话框 */}
      <Dialog open={deleteModelDialogOpen} onClose={() => setDeleteModelDialogOpen(false)}>
        <DialogTitle>删除模型</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除模型 "{modelToDelete?.name}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteModelDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteModel} color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除提供商确认对话框 */}
      <Dialog open={deleteProviderDialogOpen} onClose={() => setDeleteProviderDialogOpen(false)}>
        <DialogTitle>删除提供商</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除提供商 "{provider.name}" 吗？此操作无法撤销，并且会删除所有相关的模型和配置。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProviderDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleDeleteProvider}
            color="error"
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={24} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProviderDetail;
