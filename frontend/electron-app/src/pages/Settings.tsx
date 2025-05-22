import React, { useState, useEffect } from 'react';
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
  AIProvider,
  AIModel
} from '../shared';
import { getProviders, getProviderModels, getLocalModels, getOllamaConfig, updateProviderActiveStatus } from '../services/api';
import CustomProviderDialog from '../components/CustomProviderDialog';
import LocalModelDialog from '../components/LocalModelDialog';
import OllamaDialog from '../components/OllamaDialog';
import ProviderList from '../components/ProviderList';
import ProviderDetail from '../components/ProviderDetail';

const Settings: React.FC = () => {
  const initialLoadCompleteRef = React.useRef(false);
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | '' }>({
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
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [customProviderDialogOpen, setCustomProviderDialogOpen] = useState(false);
  const [customProviderToEdit, setCustomProviderToEdit] = useState<any>(null);

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

  // 加载提供商列表
  const fetchProviders = async (preferredProviderId?: string) => {
    setLoadingProviders(true);
    try {
      const response = await getProviders();
      console.log('Response from getProviders API:', JSON.stringify(response, null, 2));
      if (response.success && response.data) {
        const allProviders = response.data.providers || [];
        setProviders(allProviders); // 更新提供商列表状态

        let newSelectedProviderId = '';
        const currentSelectedStillExists = selectedProvider && allProviders.some(p => p.id === selectedProvider);

        if (preferredProviderId && allProviders.some(p => p.id === preferredProviderId)) {
            newSelectedProviderId = preferredProviderId;
        } else if (currentSelectedStillExists) {
            newSelectedProviderId = selectedProvider;
        } else if (response.data.current_provider) {
            const currentProviderFromAPI = response.data.current_provider;
            let potentialMatchId = currentProviderFromAPI;
            if (currentProviderFromAPI === 'custom') {
                const activeCustom = allProviders.find(p => p.id.startsWith('custom-') && p.is_active);
                if (activeCustom) {
                    potentialMatchId = activeCustom.id;
                } else {
                    const firstCustom = allProviders.find(p => p.id.startsWith('custom-'));
                    if (firstCustom) potentialMatchId = firstCustom.id;
                }
            }
            if (allProviders.some(p => p.id === potentialMatchId)) {
                newSelectedProviderId = potentialMatchId;
            }
        }

        if (!newSelectedProviderId && allProviders.length > 0) {
            const firstActive = allProviders.find(p => p.is_active);
            if (firstActive) {
                newSelectedProviderId = firstActive.id;
            } else {
                newSelectedProviderId = allProviders[0].id;
            }
        } else if (!newSelectedProviderId && allProviders.length === 0) {
            newSelectedProviderId = '';
        }
        
        if (!newSelectedProviderId && allProviders.some(p => p.id === 'siliconflow')) {
            newSelectedProviderId = 'siliconflow';
        }

        setSelectedProvider(newSelectedProviderId);
        if (newSelectedProviderId) {
            fetchModels(newSelectedProviderId); 
        } else {
            setModels([]); 
            setSelectedModel('');
        }

      } else {
        setStatusMessage({
          message: response.message || '获取提供商列表失败',
          type: 'error'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({
        message: `获取提供商列表出错: ${errorMessage}`,
        type: 'error'
      });
      setProviders([]);
      setSelectedProvider('');
      setModels([]);
      setSelectedModel('');
    } finally {
      setLoadingProviders(false);
    }
  };

  // 加载模型列表
  const fetchModels = async (providerId: string) => {
    if (!providerId) return;

    setLoadingModels(true);
    try {
      const response = await getProviderModels(providerId);
      if (response.success && response.data) {
        setModels(response.data.models);
        // 如果有模型且当前未选择模型，选择第一个
        if (response.data.models.length > 0 && !selectedModel) {
          const defaultModel = response.data.models.find(m => m.is_default);
          setSelectedModel(defaultModel?.id || response.data.models[0].id);
        }
      } else {
        setStatusMessage({
          message: response.message || `获取${providerId}的模型列表失败`,
          type: 'error'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({
        message: `获取模型列表出错: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setLoadingModels(false);
    }
  };

  // 当选择提供商变化时加载相应的模型
  useEffect(() => {
    if (selectedProvider) {
      fetchModels(selectedProvider);
      // 获取提供商的配置信息
      const provider = providers.find(p => p.id === selectedProvider);
      if (provider) {
        // 清空之前的模型选择
        setSelectedModel('');
      }
    }
  }, [selectedProvider]);

  // 加载保存的设置
  useEffect(() => {
    const loadInitialSettings = async () => {
      setLoadingProviders(true);
      try {
        // 如果在Electron环境中
        if (window.electronAPI) {
          const settings = await window.electronAPI.getSettings();
          let preferredProviderOnInit = undefined;
          if (settings) {
            // 设置模型路径和配置
            setModelPath(settings.modelPath || '');
            setConfigPath(settings.configPath || '');
            setDevice(settings.device || 'auto');
            setComputeType(settings.computeType || 'auto');

            // 设置其他配置参数
            if (settings.sourceLanguage) setSourceLanguage(settings.sourceLanguage);
            if (settings.targetLanguage) setTargetLanguage(settings.targetLanguage);
            if (settings.defaultStyle) setDefaultStyle(settings.defaultStyle);
            if (settings.translationServiceType) setTranslationServiceType(settings.translationServiceType);
            if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
            if (settings.apiKey) setApiKey(settings.apiKey);
            if (settings.baseUrl) setBaseUrl(settings.baseUrl);
            // Don't set selectedProvider and selectedModel directly here from settings
            // Instead, pass settings.selectedProvider to fetchProviders
            preferredProviderOnInit = settings.selectedProvider;
            // selectedModel will be handled by fetchModels called by fetchProviders or selectedProvider useEffect
          }

          // 加载提供商列表, 传入从设置中加载的首选提供商（如果存在）
          await fetchProviders(preferredProviderOnInit);
          // selectedModel 应该在 fetchProviders -> fetchModels 链条中被设置，或者在 selectedProvider 的 useEffect 中设置
          // 如果 settings.selectedModel 存在且对应于 preferredProviderOnInit，可以考虑在 fetchModels 后恢复它
          // 但这会使逻辑复杂化，当前依赖 fetchModels 的默认模型选择逻辑
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('加载设置时出错:', errorMessage);
        // 即使加载设置出错，也尝试获取提供商列表
        await fetchProviders();
      } finally {
        setLoadingProviders(false);
        initialLoadCompleteRef.current = true; // 标记初始加载完成
      }
    };

    loadInitialSettings();

    // 加载本地模型和Ollama配置
    fetchLocalModels();
    fetchOllamaConfig();
  }, []);

  // BEGIN: Logic for item 8 - handleToggleProviderActive function
  const handleToggleProviderActive = async (providerId: string, newActiveState: boolean) => {
    setLoadingProviders(true); // Use loadingProviders to indicate operation in progress
    try {
      const response = await updateProviderActiveStatus(providerId, newActiveState);
      if (response.success) {
        setProviders(prevProviders =>
          prevProviders.map(p =>
            p.id === providerId ? { ...p, is_active: newActiveState } : p
          )
        );
        setStatusMessage({ message: '提供商活跃状态已更新', type: 'success' });

        if (selectedProvider === providerId && !newActiveState) {
          const nextActiveProvider = providers.find(p => p.id !== providerId && p.is_active);
          if (nextActiveProvider) {
            setSelectedProvider(nextActiveProvider.id);
          } else {
            const firstProvider = providers.find(p => p.id !== providerId);
            if (firstProvider) {
              setSelectedProvider(firstProvider.id);
            } else {
              setSelectedProvider('');
            }
          }
        }
      } else {
        setStatusMessage({ message: response.message || '更新提供商状态失败', type: 'error' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新提供商状态时出错';
      setStatusMessage({ message: errorMessage, type: 'error' });
    } finally {
      setLoadingProviders(false);
    }
  };
  // END: Logic for item 8

  useEffect(() => {
    if (!initialLoadCompleteRef.current) {
      return; 
    }
    // 只有当 selectedProvider 有实际值时才触发保存，避免空选择触发
    if (selectedProvider) { 
      console.log(`Settings changed, preparing to auto-save. Provider: ${selectedProvider}, Model: ${selectedModel}`);
      const settingsToSave = {
        modelPath, configPath, device, computeType,
        sourceLanguage, targetLanguage, defaultStyle, translationServiceType, darkMode,
        apiKey, 
        baseUrl,
        selectedProvider, selectedModel,
      };
      if (window.electronAPI) {
        window.electronAPI.saveSettings(settingsToSave)
          .then(() => console.log('Settings auto-saved successfully.'))
          .catch(err => console.error('Error auto-saving settings:', err));
      }
    }
  }, [
    selectedProvider, selectedModel, modelPath, configPath, device, computeType,
    sourceLanguage, targetLanguage, defaultStyle, translationServiceType, darkMode,
    apiKey, baseUrl,
  ]);

  const handleSave = async () => {
    try {
      // 如果在Electron环境中
      if (window.electronAPI) {
        await window.electronAPI.saveSettings({
          modelPath,
          configPath,
          device,
          computeType,
          sourceLanguage,
          targetLanguage,
          defaultStyle,
          translationServiceType,
          darkMode,
          apiKey,
          baseUrl,
          selectedProvider,
          selectedModel
        });
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
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
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

        <Box sx={{ display: 'flex', height: 500 }}>
          {/* 提供商列表 */}
          <Box sx={{ mr: 2 }}>
            <ProviderList
              providers={providers}
              selectedProvider={selectedProvider}
              onSelectProvider={setSelectedProvider}
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
              onRefreshProviders={() => fetchProviders(selectedProvider)}
              loading={loadingProviders}
            />
          </Box>

          {/* 提供商详情 */}
          <ProviderDetail
            provider={providers.find(p => p.id === selectedProvider) || null}
            models={models}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            onUpdateProvider={() => {
              fetchProviders();
              fetchModels(selectedProvider);
            }}
            onEditProvider={() => {
              // 打开编辑对话框，传入当前提供商信息
              setCustomProviderToEdit(null);
              setCustomProviderDialogOpen(true);
            }}
            onRefreshModels={() => fetchModels(selectedProvider)}
            loadingModels={loadingModels}
            onDeleteProvider={() => {
              // 删除提供商后，刷新提供商列表并选择第一个提供商
              fetchProviders();
              // 重置选中的提供商和模型
              setSelectedProvider('');
              setSelectedModel('');
              setModels([]);
              setStatusMessage({
                message: '删除提供商成功',
                type: 'success'
              });
            }}
          />
        </Box>
      </Paper>

      {/* 自定义提供商对话框 */}
      <CustomProviderDialog
        open={customProviderDialogOpen}
        onClose={() => {
          setCustomProviderDialogOpen(false);
          setCustomProviderToEdit(null);
        }}
        onSave={(newlyActivatedProviderId) => {
          fetchProviders(newlyActivatedProviderId);
          setCustomProviderDialogOpen(false);
          setCustomProviderToEdit(null);
        }}
        editProvider={customProviderToEdit || (selectedProvider === 'custom' ? providers.find(p => p.id === 'custom') : undefined)}
      />

      {/* 本地模型对话框 */}
      <LocalModelDialog
        open={localModelDialogOpen}
        onClose={() => {
          setLocalModelDialogOpen(false);
          setLocalModelToEdit(null);
        }}
        onSave={() => {
          fetchLocalModels();
          setLocalModelDialogOpen(false);
          setLocalModelToEdit(null);
        }}
        editModel={localModelToEdit}
      />

      {/* Ollama配置对话框 */}
      <OllamaDialog
        open={ollamaDialogOpen}
        onClose={() => {
          setOllamaDialogOpen(false);
        }}
        onSave={() => {
          fetchOllamaConfig();
          setOllamaDialogOpen(false);
        }}
        initialConfig={ollamaConfig}
      />

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Faster-Whisper 设置
        </Typography>
        <Divider sx={{ mb: 3 }} />

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
                onClick={handleBrowseModelPath}
                sx={{ minWidth: '100px' }}
              >
                浏览...
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              请选择包含模型文件的文件夹，或者输入已下载的模型文件路径
            </Typography>
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