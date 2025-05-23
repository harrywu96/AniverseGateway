import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Container,
  useTheme,
  alpha,
  Fade,
  Slide,
  Card,
  CardContent,
  Stack,
  Divider
} from '@mui/material';
import {
  Settings as SettingsIcon,
  SmartToy as AIIcon,
  Translate as TranslateIcon,
  Palette as AppearanceIcon,
  Storage as StorageIcon,
  Speed as PerformanceIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  FolderOpen as FolderIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
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
import ConfigSection from '../components/ui/ConfigSection';
import { store, persistor } from '../store';

// Tab面板组件
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

const Settings: React.FC = () => {
  const theme = useTheme();
  const initialLoadCompleteRef = React.useRef(false);
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' | '' }>({
    message: '',
    type: '',
  });
  const [tabValue, setTabValue] = useState(0);

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
      const existingProvidersInStore = store.getState().provider.providers;
      const currentProviderIdFromStore = store.getState().provider.currentProviderId;

      if (response && response.success && response.data) {
        const mappedProvidersFromApi: Provider[] = (response.data.providers || []).map((p: any) => ({
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

        let effectiveProviders: Provider[];
        let newSelectedProviderId = '';

        if (existingProvidersInStore.length === 0) {
          dispatch(setProviders(mappedProvidersFromApi));
          effectiveProviders = mappedProvidersFromApi;
          console.log('Provider store empty, initialized from API/main process.');
        } else {
          effectiveProviders = existingProvidersInStore;
          console.log('Providers loaded from Redux store (redux-persist). API data not used to setProviders.');
        }
        const apiCurrentProvider = response.data.current_provider;

        if (preferredProviderId && effectiveProviders.some(p => p.id === preferredProviderId)) {
          newSelectedProviderId = preferredProviderId;
        } else if (apiCurrentProvider && effectiveProviders.some(p => p.id === apiCurrentProvider)) {
          newSelectedProviderId = apiCurrentProvider;
        } else if (currentProviderIdFromStore && effectiveProviders.some(p => p.id === currentProviderIdFromStore)) {
          newSelectedProviderId = currentProviderIdFromStore;
        }

        if (!newSelectedProviderId && effectiveProviders.length > 0) {
          const firstActive = effectiveProviders.find(p => p.is_active);
          newSelectedProviderId = firstActive ? firstActive.id : effectiveProviders[0].id;
        }
        
        dispatch(setCurrentProviderId(newSelectedProviderId || null));

      } else {
        const apiMessage = response ? response.message : '获取提供商列表的API调用失败';
        setStatusMessage({ message: `${apiMessage}，尝试使用本地缓存数据`, type: 'warning' });
        
        if (existingProvidersInStore.length > 0) {
          let newSelectedProviderId = '';
          if (preferredProviderId && existingProvidersInStore.some(p => p.id === preferredProviderId)) {
            newSelectedProviderId = preferredProviderId;
          } else if (currentProviderIdFromStore && existingProvidersInStore.some(p => p.id === currentProviderIdFromStore)) {
            newSelectedProviderId = currentProviderIdFromStore;
          }
          if (!newSelectedProviderId && existingProvidersInStore.length > 0) {
            const firstActive = existingProvidersInStore.find(p => p.is_active);
            newSelectedProviderId = firstActive ? firstActive.id : existingProvidersInStore[0].id;
          }
          dispatch(setCurrentProviderId(newSelectedProviderId || null));
          console.log('API fetch failed, but providers restored from redux-persist.');
        } else {
          setStatusMessage({ message: `${apiMessage}，且无本地缓存`, type: 'error' });
          dispatch(setCurrentProviderId(null));
          dispatch(setCurrentModelId(null));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({ message: `获取提供商列表出错: ${errorMessage}`, type: 'error' });
      const existingProvidersOnCatch = store.getState().provider.providers;
      const currentProviderIdOnCatch = store.getState().provider.currentProviderId;
      if (existingProvidersOnCatch.length > 0) {
        let newSelectedProviderId = '';
          if (currentProviderIdOnCatch && existingProvidersOnCatch.some(p => p.id === currentProviderIdOnCatch)) {
            newSelectedProviderId = currentProviderIdOnCatch;
          }
          if (!newSelectedProviderId && existingProvidersOnCatch.length > 0) {
            const firstActive = existingProvidersOnCatch.find(p => p.is_active);
            newSelectedProviderId = firstActive ? firstActive.id : existingProvidersOnCatch[0].id;
          }
        dispatch(setCurrentProviderId(newSelectedProviderId || null));
        console.log('Exception during API fetch, but providers restored from redux-persist.');
      } else {
        dispatch(setCurrentProviderId(null));
        dispatch(setCurrentModelId(null));
      }
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
    persistor.persist();
    setStatusMessage({ message: '提供商活跃状态已更新', type: 'success' });
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
    dispatch(removeProviderAction(providerId));
    persistor.persist();
    setStatusMessage({ message: `提供商 ${providerId} 已删除`, type: 'success'});
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
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题 */}
      <Slide direction="down" in={true} mountOnEnter unmountOnExit>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 3,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main
              }}
            >
              <SettingsIcon fontSize="medium" />
            </Box>
            <Box>
              <Typography 
                variant="h3" 
                component="h1"
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                系统设置
              </Typography>
              <Typography variant="h6" color="text.secondary">
                配置AI模型、翻译参数和应用偏好
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Slide>

      {/* 保存状态提示 */}
      {saved && (
        <Fade in={true}>
          <Alert 
            severity="success" 
            sx={{ 
              mb: 3,
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              backgroundColor: alpha(theme.palette.success.main, 0.1)
            }}
            icon={<CheckCircleIcon />}
          >
            设置已成功保存
          </Alert>
        </Fade>
      )}

      {/* 设置标签页 */}
      <Card 
        sx={{ 
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          background: alpha(theme.palette.primary.main, 0.02)
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none'
              }
            }}
          >
            <Tab 
              icon={<AIIcon />} 
              label="AI服务" 
              iconPosition="start"
              {...a11yProps(0)} 
            />
            <Tab 
              icon={<PerformanceIcon />} 
              label="Faster-Whisper" 
              iconPosition="start"
              {...a11yProps(1)} 
            />
            <Tab 
              icon={<TranslateIcon />} 
              label="翻译设置" 
              iconPosition="start"
              {...a11yProps(2)} 
            />
            <Tab 
              icon={<AppearanceIcon />} 
              label="应用设置" 
              iconPosition="start"
              {...a11yProps(3)} 
            />
          </Tabs>
        </Box>

        {/* AI服务配置 */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <ConfigSection
              title="AI服务配置"
              description="配置和管理AI翻译模型"
              icon={AIIcon}
              variant="outlined"
            >
              <Box 
                sx={{ 
                  display: 'flex', 
                  gap: 3,
                  flexDirection: { xs: 'column', lg: 'row' },
                  minHeight: 'auto'
                }}
              >
                {/* 左侧：提供商列表 */}
                <Card
                  variant="outlined"
                  sx={{
                    width: { xs: '100%', lg: '380px' },
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(103, 58, 183, 0.03) 0%, rgba(63, 81, 181, 0.03) 100%)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.25),
                      boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, rgba(103, 58, 183, 0.08) 0%, rgba(63, 81, 181, 0.05) 100%)',
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      px: 3,
                      py: 2
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #673ab7 0%, #3f51b5 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1rem'
                      }}
                    >
                      AI服务提供商
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'text.secondary',
                        display: 'block',
                        mt: 0.5
                      }}
                    >
                      选择您的专业AI翻译服务
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p: 0 }}>
                    <ProviderList
                      providers={providers}
                      selectedProvider={currentProviderId || ''}
                      onSelectProvider={(id) => dispatch(setCurrentProviderId(id))}
                      onToggleProviderActive={async (providerId: string, newActiveState: boolean) => {
                        dispatch(setProviderActiveStatus({ id: providerId, is_active: newActiveState }));
                        persistor.persist();
                        setStatusMessage({ message: '提供商活跃状态已更新', type: 'success' });
                      }}
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
                </Card>

                {/* 右侧：提供商详情 */}
                <Card
                  variant="outlined"
                  sx={{
                    flex: 1,
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                      boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.08)}`,
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      px: 3,
                      py: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600,
                          color: 'text.primary',
                          fontSize: '1rem'
                        }}
                      >
                        服务配置详情
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'text.secondary',
                          display: 'block',
                          mt: 0.5
                        }}
                      >
                        配置您的专业AI翻译参数
                      </Typography>
                    </Box>
                    
                    <Box
                      sx={{
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%)',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 8px rgba(255, 107, 107, 0.3)'
                      }}
                    >
                      Pro
                    </Box>
                  </Box>
                  
                  <Box sx={{ p: 3 }}>
                    <ProviderDetail
                      provider={providers.find(p => p.id === currentProviderId) || null}
                      apiKeyInput={currentApiKeyInput}
                      baseUrlInput={currentBaseUrlInput}
                      onApiKeyInputChange={setCurrentApiKeyInput}
                      onBaseUrlInputChange={setCurrentBaseUrlInput}
                      onSaveProviderDetails={() => {
                        if (currentProviderId) {
                          dispatch(updateProviderAction({
                            id: currentProviderId,
                            apiKey: currentApiKeyInput,
                            apiHost: currentBaseUrlInput,
                            is_configured: !!currentApiKeyInput
                          }));
                          setStatusMessage({message: 'Provider details updated successfully.', type: 'success'});
                        }
                      }}
                      selectedModelId={currentModelId || ''}
                      onSelectModel={(id) => dispatch(setCurrentModelId(id))}
                      onEditProvider={() => {
                        const providerToEdit = providers.find(p => p.id === currentProviderId);
                        if (providerToEdit && !providerToEdit.isSystem) {
                          setCustomProviderToEdit(providerToEdit);
                          setCustomProviderDialogOpen(true);
                        }
                      }}
                      onDeleteProvider={currentProviderId && !providers.find(p=>p.id === currentProviderId)?.isSystem ? () => {
                        dispatch(removeProviderAction(currentProviderId));
                        persistor.persist();
                        setStatusMessage({ message: `提供商 ${currentProviderId} 已删除`, type: 'success'});
                      } : undefined}
                      onRefreshModels={() => currentProviderId && fetchModels(currentProviderId)}
                      loadingModels={loadingModels}
                      onModelParamsChange={handleModelParamsChange}
                    />
                  </Box>
                </Card>
              </Box>
            </ConfigSection>
          </Box>
        </TabPanel>

        {/* Faster-Whisper设置 */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <ConfigSection
              title="Faster-Whisper 设置"
              description="配置本地语音识别模型"
              icon={PerformanceIcon}
              variant="outlined"
            >
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <TextField 
                      fullWidth 
                      label="本地模型路径" 
                      variant="outlined" 
                      value={modelPath} 
                      onChange={(e) => setModelPath(e.target.value)} 
                      placeholder="选择或输入本地模型路径" 
                      sx={{ mr: 1 }} 
                    />
                    <Button 
                      variant="contained" 
                      startIcon={<FolderIcon />}
                      onClick={async () => {
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
                      }}
                      sx={{ minWidth: '120px', height: '56px' }}
                    >
                      浏览
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    请选择包含模型文件的文件夹，或者输入已下载的模型文件路径
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend" sx={{ mb: 2 }}>设备选项</FormLabel>
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
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    startIcon={<CheckCircleIcon />}
                    onClick={async () => {
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
                    }}
                    sx={{ px: 4 }}
                  >
                    验证模型
                  </Button>
                </Grid>
              </Grid>
            </ConfigSection>
          </Box>
        </TabPanel>

        {/* 翻译设置 */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Stack spacing={4}>
              <ConfigSection
                title="翻译服务选择"
                description="选择翻译服务类型"
                icon={TranslateIcon}
                variant="default"
              >
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
              </ConfigSection>

              <ConfigSection
                title="语言配置"
                description="设置源语言和目标语言"
                variant="outlined"
              >
                <Grid container spacing={3}>
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
              </ConfigSection>
            </Stack>
          </Box>
        </TabPanel>

        {/* 应用设置 */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Stack spacing={4}>
              <ConfigSection
                title="外观设置"
                description="自定义应用外观和主题"
                icon={AppearanceIcon}
                variant="outlined"
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={darkMode}
                      onChange={(e) => setDarkMode(e.target.checked)}
                    />
                  }
                  label="深色模式"
                />
              </ConfigSection>

              <ConfigSection
                title="存储管理"
                description="管理应用缓存和数据"
                icon={StorageIcon}
                variant="outlined"
              >
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    缓存管理
                  </Typography>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<DeleteIcon />}
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
                    sx={{ px: 4 }}
                  >
                    清除临时缓存
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    清除所有临时文件和内存中的视频信息。如果遇到视频或字幕加载问题，可以尝试清除缓存。
                  </Typography>
                </Box>
              </ConfigSection>
            </Stack>
          </Box>
        </TabPanel>
      </Card>

      {/* 保存按钮 */}
      <Fade in={true} timeout={1000}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Button 
            variant="contained" 
            size="large"
            color="primary" 
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 3,
              fontSize: '1.1rem',
              fontWeight: 600,
              boxShadow: theme.shadows[4],
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[8]
              }
            }}
          >
            保存设置
          </Button>
        </Box>
      </Fade>

      {/* 对话框组件 */}
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

      <LocalModelDialog 
        open={localModelDialogOpen} 
        onClose={() => setLocalModelDialogOpen(false)} 
        onSave={() => { 
          setLocalModelDialogOpen(false); 
        }} 
        editModel={localModelToEdit} 
      />
      
      <OllamaDialog 
        open={ollamaDialogOpen} 
        onClose={() => setOllamaDialogOpen(false)} 
        onSave={() => { 
          setOllamaDialogOpen(false);
        }} 
        initialConfig={ollamaConfig} 
      />

      {/* 状态提示 */}
      <Snackbar
        open={!!statusMessage.message}
        autoHideDuration={statusMessage.type === 'success' ? 5000 : null}
        onClose={() => setStatusMessage({ message: '', type: '' })}
      >
        <Alert
          severity={statusMessage.type || 'info'}
          onClose={() => setStatusMessage({ message: '', type: '' })}
          sx={{
            border: `1px solid ${alpha(theme.palette[statusMessage.type || 'info'].main, 0.2)}`,
            backgroundColor: alpha(theme.palette[statusMessage.type || 'info'].main, 0.1)
          }}
        >
          {statusMessage.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Settings;