import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel,
  Snackbar,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  LANGUAGE_OPTIONS,
  TRANSLATION_STYLES,
  TRANSLATION_SERVICE_TYPES,
  DEFAULT_PROVIDERS,
} from '../shared';
import {
  getProviders as fetchProvidersFromApi,
  getProviderModels as fetchProviderModelsFromApi,
  getLocalModels,
  getOllamaConfig,
  updateProviderActiveStatus as updateProviderActiveStatusApi
} from '../services/api';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  setProviders,
  setCurrentProviderId,
  setCurrentModelId,
  updateProvider as updateProviderAction,
  setProviderActiveStatus,
  addProvider as addProviderAction,
  removeProvider as removeProviderAction,
  Provider,
  AIModel
} from '../store/providerSlice';
import CustomProviderDialog from '../components/CustomProviderDialog';
import LocalModelDialog from '../components/LocalModelDialog';
import OllamaDialog from '../components/OllamaDialog';
import ProviderList from '../components/ProviderList';
import ProviderDetail from '../components/ProviderDetail';

const Settings: React.FC = () => {
  const initialLoadCompleteRef = React.useRef(false);
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' | '' }>({
    message: '',
    type: '',
  });

  // 通用设置
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('zh');
  const [defaultStyle, setDefaultStyle] = useState('natural');
  const [translationServiceType, setTranslationServiceType] = useState('network_provider');
  const [darkMode, setDarkMode] = useState(true);

  // AI 服务设置
  const dispatch = useAppDispatch();
  const { 
    providers, 
    currentProviderId, 
    currentModelId 
  } = useAppSelector((state) => state.provider);

  // For API Key and Base URL input fields, we might need local state for controlled components / debouncing
  // These will be set based on the selected provider from Redux state.
  const [currentApiKeyInput, setCurrentApiKeyInput] = useState('');
  const [currentBaseUrlInput, setCurrentBaseUrlInput] = useState('');

  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [customProviderDialogOpen, setCustomProviderDialogOpen] = useState(false);
  const [customProviderToEdit, setCustomProviderToEdit] = useState<Provider | null>(null);

  // 本地模型设置
  const [localModels, setLocalModels] = useState<any[]>([]);
  const [localModelDialogOpen, setLocalModelDialogOpen] = useState(false);
  const [localModelToEdit, setLocalModelToEdit] = useState<any>(null);
  const [loadingLocalModels, setLoadingLocalModels] = useState(false);

  // Ollama设置
  const [ollamaConfig, setOllamaConfig] = useState<any>(null);
  const [ollamaDialogOpen, setOllamaDialogOpen] = useState(false);
  const [loadingOllamaConfig, setLoadingOllamaConfig] = useState(false);

  // Faster-Whisper 设置
  const [modelPath, setModelPath] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [device, setDevice] = useState('auto');
  const [computeType, setComputeType] = useState('auto');

  const handleModelParamsChange = useCallback((params: { temperature?: number; topP?: number; maxTokens?: number; messageLimitEnabled?: boolean; }) => {
    if (!currentProviderId || !currentModelId) return;

    const provider = providers.find(p => p.id === currentProviderId);
    if (!provider) return;

    const modelIndex = provider.models.findIndex(m => m.id === currentModelId);
    if (modelIndex === -1) return;

    const updatedModels = provider.models.map((model, index) => {
      if (index === modelIndex) {
        const newParams = { ...params };
        // 如果 maxTokens 存在并且是以 'k' 为单位传入的，则转换为实际 token 数量
        if (newParams.maxTokens !== undefined) {
          newParams.maxTokens = newParams.maxTokens * 1000;
        }
        return { ...model, ...newParams };
      }
      return model;
    });

    dispatch(updateProviderAction({ id: currentProviderId, models: updatedModels }));
    setStatusMessage({ message: '模型参数已更新', type: 'success' });
  }, [dispatch, providers, currentProviderId, currentModelId]);

  const fetchProviders = useCallback(async (preferredProviderId?: string) => {
    setLoadingProviders(true);
    try {
      const response = await fetchProvidersFromApi();
      if (response.success && response.data) {
        const fetchedApiProviders: any[] = response.data.providers || [];
        const mappedProviders: Provider[] = fetchedApiProviders.map((p: any) => ({
          id: p.id,
          name: p.name,
          apiKey: p.api_key || '',
          apiHost: p.base_url || '',
          models: (p.models || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            isDefault: m.is_default,
            description: m.description,
            provider_id: p.id,
            capabilities: m.capabilities,
            temperature: m.temperature,
            top_p: m.top_p,
            max_tokens: m.max_tokens,
            message_limit_enabled: m.message_limit_enabled,
          })),
          is_active: p.is_active !== undefined ? p.is_active : false,
          isSystem: DEFAULT_PROVIDERS.some(dp => dp.id === p.id),
          description: p.description || '',
          logo_url: p.logo_url || '',
          model_count: p.model_count || (p.models ? p.models.length : 0),
          is_configured: !!p.api_key,
        }));
        dispatch(setProviders(mappedProviders));

        let newSelectedProviderId = '';
        const currentSelectedProviderInList = currentProviderId && mappedProviders.some(p => p.id === currentProviderId);

        if (preferredProviderId && mappedProviders.some(p => p.id === preferredProviderId)) {
          newSelectedProviderId = preferredProviderId;
        } else if (currentSelectedProviderInList) {
          newSelectedProviderId = currentProviderId as string;
        } else if (response.data.current_provider) {
          const apiCurrent = response.data.current_provider;
          if (mappedProviders.some(p => p.id === apiCurrent)) {
            newSelectedProviderId = apiCurrent;
          }
        }

        if (!newSelectedProviderId && mappedProviders.length > 0) {
          const firstActive = mappedProviders.find(p => p.is_active);
          newSelectedProviderId = firstActive ? firstActive.id : mappedProviders[0].id;
        }
        
        dispatch(setCurrentProviderId(newSelectedProviderId || null));
      } else {
        setStatusMessage({ message: response.message || '获取提供商列表失败', type: 'error' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({ message: `获取提供商列表出错: ${errorMessage}`, type: 'error' });
      dispatch(setCurrentProviderId(null));
      dispatch(setCurrentModelId(null));
    } finally {
      setLoadingProviders(false);
    }
  }, [dispatch]);

  const fetchModels = useCallback(async (providerIdToFetchFor: string) => {
    if (!providerIdToFetchFor) return;
    setLoadingModels(true);
    try {
      const response = await fetchProviderModelsFromApi(providerIdToFetchFor);
      if (response.success && response.data && response.data.models) {
        const fetchedApiModels: any[] = response.data.models;
        const mappedApiModels: AIModel[] = fetchedApiModels.map((m: any) => ({
          id: m.id,
          name: m.name,
          isDefault: m.is_default,
          description: m.description,
          provider_id: providerIdToFetchFor,
          capabilities: m.capabilities,
          temperature: m.temperature,
          top_p: m.top_p,
          max_tokens: m.max_tokens,
          message_limit_enabled: m.message_limit_enabled,
        }));
        dispatch(updateProviderAction({ id: providerIdToFetchFor, models: mappedApiModels }));
        
        if (currentProviderId === providerIdToFetchFor) {
          const defaultModel = mappedApiModels.find(m => m.isDefault);
          dispatch(setCurrentModelId(defaultModel?.id || mappedApiModels[0]?.id || null));
        }
      } else {
        setStatusMessage({ message: response.message || `获取${providerIdToFetchFor}的模型列表失败`, type: 'error' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({ message: `获取模型列表出错: ${errorMessage}`, type: 'error' });
    } finally {
      setLoadingModels(false);
    }
  }, [dispatch, currentProviderId]);

  useEffect(() => {
    if (currentProviderId) {
      const provider = providers.find(p => p.id === currentProviderId);
      if (provider) {
        setCurrentApiKeyInput(provider.apiKey || '');
        setCurrentBaseUrlInput(provider.apiHost || '');
        if (!provider.models || provider.models.length === 0) {
          fetchModels(currentProviderId);
        }
      }
    } else {
      setCurrentApiKeyInput('');
      setCurrentBaseUrlInput('');
    }
  }, [currentProviderId, providers, fetchModels, dispatch]);

  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        if (window.electronAPI) {
          const settings = await window.electronAPI.getSettings();
          let preferredProviderOnInit: string | undefined = undefined;
          if (settings) {
            setModelPath(settings.modelPath || '');
            setConfigPath(settings.configPath || '');
            setDevice(settings.device || 'auto');
            setComputeType(settings.computeType || 'auto');
            if (settings.sourceLanguage) setSourceLanguage(settings.sourceLanguage);
            if (settings.targetLanguage) setTargetLanguage(settings.targetLanguage);
            if (settings.defaultStyle) setDefaultStyle(settings.defaultStyle);
            if (settings.translationServiceType) setTranslationServiceType(settings.translationServiceType);
            if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
            preferredProviderOnInit = settings.selectedProvider;
          }
          await fetchProviders(preferredProviderOnInit);
        }
      } catch (error: unknown) {
        console.error('加载设置时出错:', error instanceof Error ? error.message : String(error));
        await fetchProviders();
      } finally {
        initialLoadCompleteRef.current = true;
      }
    };
    loadInitialSettings();
    fetchLocalModels();
    fetchOllamaConfig();
  }, [dispatch, fetchProviders]);

  const handleToggleProviderActive = async (providerId: string, newActiveState: boolean) => {
    dispatch(setProviderActiveStatus({ id: providerId, is_active: newActiveState }));
    try {
      const response = await updateProviderActiveStatusApi(providerId, newActiveState);
      if (!response.success) {
        setStatusMessage({ message: response.message || '更新提供商状态失败 (API)', type: 'error' });
        dispatch(setProviderActiveStatus({ id: providerId, is_active: !newActiveState }));
      } else {
        setStatusMessage({ message: '提供商活跃状态已更新', type: 'success' });
      }
    } catch (error) {
      setStatusMessage({ message: error instanceof Error ? error.message : '更新提供商状态时出错', type: 'error' });
      dispatch(setProviderActiveStatus({ id: providerId, is_active: !newActiveState }));
    }
  };

  useEffect(() => {
    if (!initialLoadCompleteRef.current) return;
    const generalSettingsToSave = {
      modelPath, configPath, device, computeType,
      sourceLanguage, targetLanguage, defaultStyle, translationServiceType, darkMode,
      selectedProvider: currentProviderId,
      selectedModel: currentModelId,
    };
    if (window.electronAPI && window.electronAPI.saveSettings) {
      window.electronAPI.saveSettings(generalSettingsToSave)
        .then(() => console.log('General settings auto-saved successfully.'))
        .catch(err => console.error('Error auto-saving general settings:', err));
    }
  }, [
    modelPath, configPath, device, computeType, sourceLanguage, targetLanguage,
    defaultStyle, translationServiceType, darkMode, currentProviderId, currentModelId
  ]);

  const handleSave = async () => {
    try {
      if (window.electronAPI && window.electronAPI.saveSettings) {
        await window.electronAPI.saveSettings({
          modelPath, configPath, device, computeType,
          sourceLanguage, targetLanguage, defaultStyle, translationServiceType, darkMode,
          selectedProvider: currentProviderId,
          selectedModel: currentModelId
        });
      }
      if (currentProviderId) {
        const provider = providers.find(p => p.id === currentProviderId);
        if (provider && (currentApiKeyInput !== provider.apiKey || currentBaseUrlInput !== provider.apiHost)) {
          dispatch(updateProviderAction({
            id: currentProviderId,
            apiKey: currentApiKeyInput,
            apiHost: currentBaseUrlInput,
            is_configured: !!currentApiKeyInput
          }));
        }
      }
      setSaved(true);
      setStatusMessage({ message: '设置已保存', type: 'success' });
      setTimeout(() => setSaved(false), 3000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('保存设置时出错:', errorMessage);
      setStatusMessage({ message: `保存设置出错: ${errorMessage || '未知错误'}`, type: 'error' });
    }
  };

  const handleUpdateProviderDetails = () => {
    if (currentProviderId) {
      dispatch(updateProviderAction({
        id: currentProviderId,
        apiKey: currentApiKeyInput,
        apiHost: currentBaseUrlInput,
        is_configured: !!currentApiKeyInput
      }));
      setStatusMessage({message: 'Provider details updated successfully.', type: 'success'});
    }
  };

  const handleDeleteProvider = (providerId: string) => {
    if (window.confirm(`确定要删除提供商 ${providerId} 吗？此操作不可撤销。`)) {
      dispatch(removeProviderAction(providerId));
      setStatusMessage({ message: `提供商 ${providerId} 已删除`, type: 'success'});
    }
  };

  const handleBrowseModelPath = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.openDirectoryDialog({
          title: '选择Faster-Whisper模型目录',
          buttonLabel: '选择文件夹'
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setModelPath(result.filePaths[0]);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('选择目录出错:', errorMessage);
      }
    }
  };

  const handleBrowseConfigPath = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.openFileDialog({
          title: '选择Faster-Whisper配置文件',
          buttonLabel: '选择文件',
          filters: [
            { name: 'JSON配置文件', extensions: ['json'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setConfigPath(result.filePaths[0]);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('选择文件出错:', errorMessage);
      }
    }
  };

  const validateModel = async () => {
    if (!modelPath) {
      setStatusMessage({ message: '请先选择模型路径', type: 'error' });
      return;
    }

    if (window.electronAPI) {
      try {
        setStatusMessage({ message: '正在验证模型...', type: '' });
        const result = await window.electronAPI.validateModel(modelPath);

        if (result.valid) {
          setStatusMessage({
            message: `模型验证成功！检测到模型：${result.modelInfo?.name || '未知'}`,
            type: 'success'
          });
        } else {
          setStatusMessage({
            message: `模型验证失败：${result.message || '未知错误'}`,
            type: 'error'
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setStatusMessage({
          message: `验证出错：${errorMessage || '未知错误'}`,
          type: 'error'
        });
      }
    }
  };

  // 加载本地模型列表
  const fetchLocalModels = async () => {
    setLoadingLocalModels(true);
    try {
      const response = await getLocalModels();
      if (response.success && response.data) {
        setLocalModels(response.data.models || []);
      } else {
        setStatusMessage({
          message: response.message || '获取本地模型列表失败',
          type: 'error'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({
        message: `获取本地模型列表出错: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setLoadingLocalModels(false);
    }
  };

  // 加载Ollama配置
  const fetchOllamaConfig = async () => {
    setLoadingOllamaConfig(true);
    try {
      const response = await getOllamaConfig();
      if (response.success && response.data) {
        setOllamaConfig(response.data);
      } else {
        // 如果没有配置，设置默认值
        setOllamaConfig({
          base_url: 'http://localhost:11434',
          model: '',
          api_key: ''
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('获取Ollama配置出错:', errorMessage);
      // 设置默认值
      setOllamaConfig({
        base_url: 'http://localhost:11434',
        model: '',
        api_key: ''
      });
    } finally {
      setLoadingOllamaConfig(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        系统设置
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          设置已保存
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          AI 服务配置
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', height: 'auto', minHeight: 500 }}>
          <Box sx={{ mr: 2, width: '350px', flexShrink: 0 }}>
            <ProviderList
              providers={providers}
              selectedProvider={currentProviderId || ''}
              onSelectProvider={(id) => dispatch(setCurrentProviderId(id))}
              onToggleProviderActive={handleToggleProviderActive}
              onAddProvider={() => {
                setCustomProviderToEdit(null);
                setCustomProviderDialogOpen(true);
              }}
              onAddLocalModel={() => {
                setLocalModelToEdit(null);
                setLocalModelDialogOpen(true);
              }}
              onConfigureOllama={() => {
                setOllamaDialogOpen(true);
              }}
              onRefreshProviders={() => fetchProviders(currentProviderId || undefined)}
              loading={loadingProviders}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <ProviderDetail
              provider={providers.find(p => p.id === currentProviderId) || null}
              apiKeyInput={currentApiKeyInput}
              baseUrlInput={currentBaseUrlInput}
              onApiKeyInputChange={setCurrentApiKeyInput}
              onBaseUrlInputChange={setCurrentBaseUrlInput}
              onSaveProviderDetails={handleUpdateProviderDetails}
              selectedModelId={currentModelId || ''}
              onSelectModel={(id) => dispatch(setCurrentModelId(id))}
              onEditProvider={() => {
                const providerToEdit = providers.find(p => p.id === currentProviderId);
                if (providerToEdit && !providerToEdit.isSystem) {
                  setCustomProviderToEdit(providerToEdit);
                  setCustomProviderDialogOpen(true);
                } else if (providerToEdit?.isSystem) {
                  setStatusMessage({message: '系统预置提供商不可编辑', type: 'info'});
                } else {
                  setStatusMessage({message: '请先选择一个提供商进行编辑', type: 'info'});
                }
              }}
              onDeleteProvider={currentProviderId && !providers.find(p=>p.id === currentProviderId)?.isSystem ? () => handleDeleteProvider(currentProviderId) : undefined}
              onRefreshModels={() => currentProviderId && fetchModels(currentProviderId)}
              loadingModels={loadingModels}
              onModelParamsChange={handleModelParamsChange}
            />
          </Box>
        </Box>
      </Paper>

      <CustomProviderDialog
        open={customProviderDialogOpen}
        onClose={() => {
          setCustomProviderDialogOpen(false);
          setCustomProviderToEdit(null);
        }}
        onSave={(providerData, isEditing) => {
          if (isEditing && customProviderToEdit) {
            dispatch(updateProviderAction({ 
              ...providerData, 
              id: customProviderToEdit.id,
              is_configured: !!providerData.apiKey 
            }));
          } else {
            const newId = providerData.id || `custom-${Date.now()}`;
            const newProvider: Provider = {
              id: newId,
              name: providerData.name || '自定义提供商',
              apiKey: providerData.apiKey || '',
              apiHost: providerData.apiHost || '',
              models: (providerData.models || []).map(model => ({
                ...model,
                provider_id: newId
              })),
              is_active: providerData.is_active !== undefined ? providerData.is_active : true,
              isSystem: false,
              description: providerData.description || '',
              logo_url: providerData.logo_url || '',
              model_count: providerData.models ? providerData.models.length : 0,
              is_configured: !!providerData.apiKey
            } as Provider;
            dispatch(addProviderAction(newProvider));
          }
          setCustomProviderDialogOpen(false);
          setCustomProviderToEdit(null);
        }}
        editProvider={customProviderToEdit}
      />

      <LocalModelDialog open={localModelDialogOpen} onClose={() => setLocalModelDialogOpen(false)} onSave={() => { fetchLocalModels(); setLocalModelDialogOpen(false); }} editModel={localModelToEdit} />
      <OllamaDialog open={ollamaDialogOpen} onClose={() => setOllamaDialogOpen(false)} onSave={() => { fetchOllamaConfig(); setOllamaDialogOpen(false);}} initialConfig={ollamaConfig} />

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Faster-Whisper 设置
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <TextField fullWidth label="本地模型路径" variant="outlined" value={modelPath} onChange={(e) => setModelPath(e.target.value)} placeholder="选择或输入本地模型路径" sx={{ mr: 1 }} />
              <Button variant="contained" onClick={handleBrowseModelPath} sx={{ minWidth: '100px' }}>浏览...</Button>
            </Box>
            <Typography variant="caption" color="text.secondary">请选择包含模型文件的文件夹，或者输入已下载的模型文件路径</Typography>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <TextField
                fullWidth
                label="配置文件路径"
                variant="outlined"
                value={configPath}
                onChange={(e) => setConfigPath(e.target.value)}
                placeholder="选择Faster-Whisper配置文件"
                sx={{ mr: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleBrowseConfigPath}
                sx={{ minWidth: '100px' }}
              >
                浏览...
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              可选：选择从Faster-Whisper GUI导出的配置文件
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">设备选项</FormLabel>
              <RadioGroup
                row
                name="device"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              >
                <FormControlLabel value="auto" control={<Radio />} label="自动选择" />
                <FormControlLabel value="cuda" control={<Radio />} label="CUDA (NVIDIA GPU)" />
                <FormControlLabel value="cpu" control={<Radio />} label="CPU" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="compute-type-label">计算精度</InputLabel>
              <Select
                labelId="compute-type-label"
                label="计算精度"
                value={computeType}
                onChange={(e) => setComputeType(e.target.value)}
              >
                <MenuItem value="auto">自动选择</MenuItem>
                <MenuItem value="float16">float16 (GPU推荐)</MenuItem>
                <MenuItem value="float32">float32 (CPU推荐)</MenuItem>
                <MenuItem value="int8">int8 (低资源使用)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" color="primary" onClick={validateModel}>
                验证模型
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          翻译设置
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">翻译服务选择</FormLabel>
              <RadioGroup
                value={translationServiceType}
                onChange={(e) => setTranslationServiceType(e.target.value)}
                row
              >
                {TRANSLATION_SERVICE_TYPES.map((type) => (
                  <FormControlLabel
                    key={type.id}
                    value={type.id}
                    control={<Radio />}
                    label={type.name}
                  />
                ))}
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                {TRANSLATION_SERVICE_TYPES.find(t => t.id === translationServiceType)?.description}
              </Typography>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="source-lang-label">源语言</InputLabel>
              <Select
                labelId="source-lang-label"
                label="源语言"
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="target-lang-label">目标语言</InputLabel>
              <Select
                labelId="target-lang-label"
                label="目标语言"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="style-label">翻译风格</InputLabel>
              <Select
                labelId="style-label"
                label="翻译风格"
                value={defaultStyle}
                onChange={(e) => setDefaultStyle(e.target.value)}
              >
                {TRANSLATION_STYLES.map((style) => (
                  <MenuItem key={style.id} value={style.id}>
                    {style.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          应用设置
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
              }
              label="深色模式"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              缓存管理
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  if (window.electronAPI) {
                    setStatusMessage({ message: '正在清除缓存...', type: '' });
                    const result = await window.electronAPI.clearCache();

                    if (result.success) {
                      setStatusMessage({
                        message: `缓存清除成功！${result.message || ''}`,
                        type: 'success'
                      });
                    } else {
                      setStatusMessage({
                        message: `缓存清除失败：${result.error || '未知错误'}`,
                        type: 'error'
                      });
                    }
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  setStatusMessage({
                    message: `清除缓存出错：${errorMessage || '未知错误'}`,
                    type: 'error'
                  });
                }
              }}
            >
              清除临时缓存
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              清除所有临时文件和内存中的视频信息。如果遇到视频或字幕加载问题，可以尝试清除缓存。
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" color="primary" onClick={handleSave}>
          保存设置
        </Button>
      </Box>

      <Snackbar
        open={!!statusMessage.message}
        autoHideDuration={statusMessage.type === 'success' ? 5000 : null}
        onClose={() => setStatusMessage({ message: '', type: '' })}
      >
        <Alert
          severity={statusMessage.type || 'info'}
          onClose={() => setStatusMessage({ message: '', type: '' })}
        >
          {statusMessage.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;