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
  Slider,
  FormControlLabel,
  Switch,
  InputAdornment,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { Provider as AIProvider, AIModel } from '../store/providerSlice';
import { testProvider, updateProvider, getProviderModels, deleteCustomModel, getProviderDetails, deleteCustomProvider } from '../services/api';
import { maskApiKey } from '../utils/apiUtils';

interface ProviderDetailProps {
  provider: AIProvider | null;
  onSelectModel: (modelId: string) => void;
  loadingModels: boolean;
  onDeleteProvider?: () => void;
  apiKeyInput: string;
  baseUrlInput: string;
  onApiKeyInputChange: (value: string) => void;
  onBaseUrlInputChange: (value: string) => void;
  onSaveProviderDetails: () => void;
  selectedModelId: string;
  onModelParamsChange: (params: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    messageLimitEnabled?: boolean;
  }) => void;
  onEditProvider?: () => void;
  onRefreshModels?: () => void;
}

const ProviderDetail: React.FC<ProviderDetailProps> = ({
  provider,
  onSelectModel,
  loadingModels,
  onDeleteProvider,
  apiKeyInput,
  baseUrlInput,
  onApiKeyInputChange,
  onBaseUrlInputChange,
  onSaveProviderDetails,
  selectedModelId,
  onModelParamsChange,
  onEditProvider,
  onRefreshModels,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AIModel | null>(null);
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      // All data needed for saving (apiKeyInput, baseUrlInput, model selections, model params)
      // should be up-to-date in Settings.tsx local state or Redux store via their respective onChange handlers.
      // Settings.tsx's onSaveProviderDetails callback will be responsible for gathering this data and dispatching the update.
      onSaveProviderDetails(); // Call the callback passed from Settings.tsx
      setIsEditing(false); // Can remain, or be controlled by Settings.tsx if needed
    } catch (error) {
      // Error handling for the onSaveProviderDetails call itself, if it can throw & not handled by parent
      console.error('调用 onSaveProviderDetails 失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!provider) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      let testProviderId = provider.id;
      let testBaseUrl: string | undefined = undefined; // Allow string for baseUrlInput
      let testModel = selectedModelId;

      if (provider.id === 'custom' || provider.id.startsWith('custom-')) {
        testBaseUrl = baseUrlInput;
      }

      // 检查API密钥是否是掌码形式
      // 如果是掌码形式（全是*号或者包含•符号），则不发送密钥
      const isMaskedKey = apiKeyInput && apiKeyInput.trim() && (/^\*+$/.test(apiKeyInput) || apiKeyInput.includes('•'));
      const keyToSend = isMaskedKey ? '' : apiKeyInput;

      // 确保有指定模型进行测试
      if (!testModel && (provider?.models || []).length > 0) {
        // 如果没有选择模型，使用第一个模型
        testModel = (provider?.models || [])[0].id;
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
    if (!modelToDelete || !provider) return;

    try {
      // const deleteProviderId = provider.id.startsWith('custom-') ? 'custom' : provider.id;
      // await deleteCustomModel(deleteProviderId, modelToDelete.id); // API call removed
      
      // Notify parent (Settings.tsx) to handle model deletion from Redux store.
      // This requires a new prop, e.g., onDeleteModel(modelId: string)
      // For now, this action will be handled by Settings.tsx after it receives the intent.
      // Potentially, onSaveProviderDetails could be reused if it can detect model list changes,
      // or a more specific callback like props.onDeleteModelCallback(modelToDelete.id) should be called.
      console.log(`请求删除模型: ${modelToDelete.id}`);
      // props.onDeleteModelCallback(modelToDelete.id); // Example if new prop was added

      setDeleteModelDialogOpen(false);
      setModelToDelete(null);
    } catch (error) {
      console.error('删除模型处理失败:', error); // Updated error message
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
    if (!provider) return; // Simplified check, specific custom logic handled by Settings.tsx if any

    setIsDeleting(true);
    try {
      // const providerId = provider.id;
      // await deleteCustomProvider(providerId); // API call removed

      if (onDeleteProvider) {
        onDeleteProvider(); // Call the callback passed from Settings.tsx
      }
      setDeleteProviderDialogOpen(false); // UI state, can remain
    } catch (error) {
      // Error handling for the onDeleteProvider call itself, if it can throw
      console.error('调用 onDeleteProvider 失败:', error);
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
            <>
              {provider.id.startsWith('custom-') && onEditProvider && (
                <Tooltip title="编辑提供商">
                  <IconButton size="small" onClick={onEditProvider} sx={{ mr: 1 }}>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="编辑配置">
                <IconButton size="small" onClick={() => setIsEditing(true)}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </>
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
            value={apiKeyInput}
            onChange={(e) => onApiKeyInputChange(e.target.value)}
            disabled={!isEditing}
            placeholder={isEditing ? '' : '••••••••••••••••••••••••••'}
          />

          {(provider.id === 'custom' || provider.id.startsWith('custom-')) && (
            <TextField
              fullWidth
              margin="normal"
              label="API 基础URL"
              value={baseUrlInput}
              onChange={(e) => onBaseUrlInputChange(e.target.value)}
              disabled={!isEditing}
              placeholder={isEditing ? '' : 'https://api.example.com/v1'}
            />
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={isTesting || (!apiKeyInput && !isEditing)}
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
          {onRefreshModels && (
            <Tooltip title="刷新模型列表">
              <IconButton size="small" onClick={onRefreshModels} disabled={loadingModels}>
                {loadingModels ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <FormControl fullWidth margin="normal">
          <InputLabel id="model-select-label">选择模型</InputLabel>
          <Select
            labelId="model-select-label"
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            label="选择模型"
            disabled={!isEditing || loadingModels}
          >
            {(provider?.models || []).map((model) => (
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
          {(provider?.models || []).map((model) => (
            <ListItem
              key={model.id}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                bgcolor: model.id === selectedModelId ? 'action.selected' : 'transparent',
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
                      • 上下文: {((model as any).context_window || (model as any).contextWindow || 0).toLocaleString()}
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

        {/* 高级模型设置部分 */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>
          高级模型设置
        </Typography>

        {/* 消息长度限制开关 */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={(provider.models.find(m => m.id === selectedModelId) as any)?.message_limit_enabled || false}
                onChange={(e) => onModelParamsChange({ messageLimitEnabled: e.target.checked })}
                disabled={!isEditing}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography>启用消息长度限制</Typography>
                <Tooltip title="启用后，可以限制发送给模型的消息长度。这有助于控制API调用的成本和响应时间。禁用后，将使用模型的默认最大长度。">
                  <HelpOutlineIcon fontSize="small" sx={{ ml: 1 }} />
                </Tooltip>
              </Box>
            }
          />

          {/* Conditional TextField for maxTokens based on selected model's messageLimitEnabled */}
          {((provider?.models?.find(m => m.id === selectedModelId) as any)?.message_limit_enabled) && (
            <TextField
              fullWidth
              margin="normal"
              label="上下文窗口大小 (tokens)"
              type="number"
              value={((provider?.models?.find(m => m.id === selectedModelId) as any)?.max_tokens || 0)} // Direct token value
              onChange={(e) => {
                const newMaxTokensInK = parseInt(e.target.value, 10) / 1000;
                // Also update the main max_tokens value if this TextField is the source of truth for it.
                // The slider uses k, this uses raw tokens. Ensure consistency or decide primary input.
                // For now, let's assume this updates the same maxTokens value (in k) as the slider.
                onModelParamsChange({ maxTokens: newMaxTokensInK });
              }}
              disabled={!isEditing}
              InputProps={{
                endAdornment: <InputAdornment position="end">tokens</InputAdornment>,
              }}
            />
          )}
        </Box>

        {/* 温度滑块 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>温度</Typography>
            <Tooltip title="控制生成文本的随机性。较低的值（如0.2）使输出更确定和集中，适合需要准确性的任务。较高的值（如0.8）使输出更多样化和创造性，适合头脑风暴或创意写作。推荐范围：0.0-1.0">
              <HelpOutlineIcon fontSize="small" sx={{ ml: 1 }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>0.0</Typography>
            <Slider
              value={(provider.models.find(m => m.id === selectedModelId) as any)?.temperature || 0.7}
              onChange={(_, newValue) => onModelParamsChange({ temperature: newValue as number })}
              min={0}
              max={2}
              step={0.1}
              disabled={!isEditing}
              valueLabelDisplay="auto"
              sx={{ mx: 2 }}
            />
            <Typography variant="body2" sx={{ ml: 1 }}>2.0</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            当前值: {((provider.models.find(m => m.id === selectedModelId) as any)?.temperature || 0).toFixed(1)}
          </Typography>
        </Box>

        {/* Top-P滑块 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>Top-P</Typography>
            <Tooltip title="控制生成文本的多样性。模型只考虑累积概率达到top_p值的词汇。较低的值（如0.1）使输出更确定，较高的值（如0.9）使输出更多样化。通常与温度一起使用，但建议主要调整其中一个参数。推荐范围：0.1-1.0">
              <HelpOutlineIcon fontSize="small" sx={{ ml: 1 }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>0.0</Typography>
            <Slider
              value={(provider.models.find(m => m.id === selectedModelId) as any)?.top_p || 0.9}
              onChange={(_, newValue) => onModelParamsChange({ topP: newValue as number })}
              min={0}
              max={1}
              step={0.05}
              disabled={!isEditing}
              valueLabelDisplay="auto"
              sx={{ mx: 2 }}
            />
            <Typography variant="body2" sx={{ ml: 1 }}>1.0</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            当前值: {((provider.models.find(m => m.id === selectedModelId) as any)?.top_p || 0).toFixed(2)}
          </Typography>
        </Box>

        {/* 最大上下文Token数滑块 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>上下文长度</Typography>
            <Tooltip title="控制模型可以处理的最大token数量。较大的值允许模型处理更长的文本，但会增加API调用的成本和响应时间。根据您的模型和需求选择适当的值。">
              <HelpOutlineIcon fontSize="small" sx={{ ml: 1 }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>0</Typography>
            <Slider
              value={((provider.models.find(m => m.id === selectedModelId) as any)?.max_tokens || 4000) / 1000}
              onChange={(_, newValue) => onModelParamsChange({ maxTokens: newValue as number })}
              min={0}
              max={20}
              step={1}
              disabled={!isEditing || !((provider.models.find(m => m.id === selectedModelId) as any)?.message_limit_enabled)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}k`}
              sx={{ mx: 2 }}
            />
            <Typography variant="body2" sx={{ ml: 1 }}>20k</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            当前值: {(((provider.models.find(m => m.id === selectedModelId) as any)?.max_tokens || 0) / 1000)}k tokens
          </Typography>
        </Box>
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
