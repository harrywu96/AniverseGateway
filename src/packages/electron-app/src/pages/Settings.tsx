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
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { LANGUAGE_OPTIONS, TRANSLATION_STYLES, AIProvider, AIModel } from '@subtranslate/shared';
import { getProviders, getProviderModels } from '../services/api';
import CustomProviderDialog from '../components/CustomProviderDialog';
import ProviderList from '../components/ProviderList';
import ProviderDetail from '../components/ProviderDetail';

const Settings: React.FC = () => {
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });

  // 通用设置
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('zh');
  const [defaultStyle, setDefaultStyle] = useState('natural');
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

  // Faster-Whisper 设置
  const [modelPath, setModelPath] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [device, setDevice] = useState('auto');
  const [computeType, setComputeType] = useState('auto');

  // 加载提供商列表
  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await getProviders();
      if (response.success && response.data) {
        // 只显示硬基流动和自定义提供商
        const allProviders = response.data.providers;
        // 现在我们不需要过滤，因为后端已经只返回了硬基流动和自定义提供商
        setProviders(allProviders);

        // 如果有当前提供商，选中它
        if (response.data.current_provider && !selectedProvider) {
          const currentProvider = response.data.current_provider;
          // 如果是自定义提供商，需要找到对应的custom-{id}
          if (currentProvider === 'custom') {
            // 尝试找到激活的自定义提供商
            const activeCustomProvider = allProviders.find(p => p.id.startsWith('custom-') && p.is_active);
            if (activeCustomProvider) {
              setSelectedProvider(activeCustomProvider.id);
              fetchModels(activeCustomProvider.id);
            } else {
              // 如果没有激活的自定义提供商，选择第一个自定义提供商
              const firstCustomProvider = allProviders.find(p => p.id.startsWith('custom-'));
              if (firstCustomProvider) {
                setSelectedProvider(firstCustomProvider.id);
                fetchModels(firstCustomProvider.id);
              } else {
                // 如果没有自定义提供商，选择硬基流动
                const siliconflow = allProviders.find(p => p.id === 'siliconflow');
                if (siliconflow) {
                  setSelectedProvider('siliconflow');
                  fetchModels('siliconflow');
                }
              }
            }
          } else if (currentProvider === 'siliconflow') {
            // 如果当前提供商是硬基流动，直接选中
            setSelectedProvider('siliconflow');
            fetchModels('siliconflow');
          } else {
            // 如果是其他提供商，默认选择硬基流动
            const siliconflow = allProviders.find(p => p.id === 'siliconflow');
            if (siliconflow) {
              setSelectedProvider('siliconflow');
              fetchModels('siliconflow');
            }
          }
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
    const loadSettings = async () => {
      try {
        // 如果在Electron环境中
        if (window.electronAPI) {
          const settings = await window.electronAPI.getSettings();
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
            if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
            if (settings.apiKey) setApiKey(settings.apiKey);
            if (settings.baseUrl) setBaseUrl(settings.baseUrl);
            if (settings.selectedProvider) setSelectedProvider(settings.selectedProvider);
            if (settings.selectedModel) setSelectedModel(settings.selectedModel);
          }

          // 加载提供商列表
          await fetchProviders();
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('加载设置时出错:', errorMessage);
      }
    };

    loadSettings();
  }, []);

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
              onAddProvider={() => {
                setCustomProviderToEdit(null);
                setCustomProviderDialogOpen(true);
              }}
              onRefreshProviders={fetchProviders}
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
        onSave={() => {
          fetchProviders();
          setCustomProviderDialogOpen(false);
          setCustomProviderToEdit(null);
        }}
        editProvider={customProviderToEdit || (selectedProvider === 'custom' ? providers.find(p => p.id === 'custom') : undefined)}
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