import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  SelectChangeEvent,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material';
import { LANGUAGE_OPTIONS, TRANSLATION_STYLES } from '../shared';
import { useActiveProviders } from '../hooks/useActiveProviders';

interface TranslationConfigProps {
  onChange: (config: any) => void;
  defaultConfig?: any;
}

const TranslationConfig: React.FC<TranslationConfigProps> = ({
  onChange,
  defaultConfig = {}
}) => {
  // 使用自定义Hook获取活跃的提供商数据
  const {
    activeProviders,
    configuredProviders,
    providerOptions,
    getModelOptions,
    isProviderConfigured,
    activeCount,
    configuredCount
  } = useActiveProviders({
    onlyActive: true,
    onlyConfigured: true,
    sortByName: true,
    sortByActive: true
  });

  // 本地状态
  const [selectedProvider, setSelectedProvider] = useState(defaultConfig.provider || '');
  const [selectedModel, setSelectedModel] = useState(defaultConfig.model || '');
  const [sourceLanguage, setSourceLanguage] = useState(defaultConfig.sourceLanguage || 'en');
  const [targetLanguage, setTargetLanguage] = useState(defaultConfig.targetLanguage || 'zh');
  const [style, setStyle] = useState(defaultConfig.style || 'natural');
  const [error, setError] = useState('');

  // 使用useMemo缓存模型选项
  const modelOptions = useMemo(() => {
    return getModelOptions(selectedProvider);
  }, [selectedProvider, getModelOptions]);

  // 检查提供商可用性并自动选择
  useEffect(() => {
    if (configuredProviders.length === 0) {
      setError('没有可用的已配置翻译提供商。请在设置中配置提供商API密钥。');
      setSelectedProvider('');
      setSelectedModel('');
      return;
    }

    setError(''); // 清除错误信息

    // 如果没有选择提供商或当前选择的提供商不可用，自动选择第一个可用的
    if (!selectedProvider || !configuredProviders.some(p => p.id === selectedProvider)) {
      const firstProvider = configuredProviders[0];
      if (firstProvider) {
        setSelectedProvider(firstProvider.id);
      }
    }
  }, [configuredProviders, selectedProvider]);

  // 当提供商变化时，自动选择默认模型
  useEffect(() => {
    if (selectedProvider && modelOptions.length > 0) {
      // 如果当前选择的模型不在新的模型列表中，选择默认模型或第一个模型
      if (!modelOptions.some(m => m.value === selectedModel)) {
        const defaultModel = modelOptions.find(m => m.isDefault);
        const modelToSelect = defaultModel || modelOptions[0];
        if (modelToSelect) {
          setSelectedModel(modelToSelect.value);
        }
      }
    } else if (selectedProvider && modelOptions.length === 0) {
      setSelectedModel('');
    }
  }, [selectedProvider, modelOptions, selectedModel]);

  // 当配置变化时，通知父组件
  useEffect(() => {
    onChange({
      provider: selectedProvider,
      model: selectedModel,
      sourceLanguage,
      targetLanguage,
      style
    });
  }, [selectedProvider, selectedModel, sourceLanguage, targetLanguage, style, onChange]);

  // 处理提供商变化
  const handleProviderChange = (event: SelectChangeEvent) => {
    setSelectedProvider(event.target.value);
    setSelectedModel(''); // 清空模型选择
  };

  // 处理模型变化
  const handleModelChange = (event: SelectChangeEvent) => {
    setSelectedModel(event.target.value);
  };

  // 处理源语言变化
  const handleSourceLanguageChange = (event: SelectChangeEvent) => {
    setSourceLanguage(event.target.value);
  };

  // 处理目标语言变化
  const handleTargetLanguageChange = (event: SelectChangeEvent) => {
    setTargetLanguage(event.target.value);
  };

  // 处理翻译风格变化
  const handleStyleChange = (event: SelectChangeEvent) => {
    setStyle(event.target.value);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">翻译配置</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={`已激活提供商: ${activeCount}`}>
            <Chip 
              label={`激活: ${activeCount}`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
          </Tooltip>
          <Tooltip title={`已配置提供商: ${configuredCount}`}>
            <Chip 
              label={`可用: ${configuredCount}`} 
              size="small" 
              color={configuredCount > 0 ? "success" : "error"} 
              variant="outlined" 
            />
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {configuredCount === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          没有已配置的翻译提供商。请前往<strong>设置 → AI服务配置</strong>配置API密钥。
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 提供商选择 */}
        <FormControl fullWidth>
          <InputLabel id="provider-label">翻译提供商</InputLabel>
          <Select
            labelId="provider-label"
            value={selectedProvider}
            label="翻译提供商"
            onChange={handleProviderChange}
            disabled={configuredProviders.length === 0}
          >
            {providerOptions.map((option) => (
              <MenuItem 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{option.label}</span>
                  {option.description && (
                    <Typography variant="caption" color="text.secondary">
                      ({option.description})
                    </Typography>
                  )}
                  {!isProviderConfigured(option.value) && (
                    <Chip label="未配置" size="small" color="warning" variant="outlined" />
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 模型选择 */}
        <FormControl fullWidth>
          <InputLabel id="model-label">翻译模型</InputLabel>
          <Select
            labelId="model-label"
            value={selectedModel}
            label="翻译模型"
            onChange={handleModelChange}
            disabled={!selectedProvider || modelOptions.length === 0}
          >
            {modelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{option.label}</span>
                  {option.isDefault && (
                    <Chip label="默认" size="small" color="primary" variant="outlined" />
                  )}
                  {option.description && (
                    <Typography variant="caption" color="text.secondary">
                      ({option.description})
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 语言选择 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="source-language-label">源语言</InputLabel>
            <Select
              labelId="source-language-label"
              value={sourceLanguage}
              label="源语言"
              onChange={handleSourceLanguageChange}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="target-language-label">目标语言</InputLabel>
            <Select
              labelId="target-language-label"
              value={targetLanguage}
              label="目标语言"
              onChange={handleTargetLanguageChange}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* 翻译风格 */}
        <FormControl fullWidth>
          <InputLabel id="style-label">翻译风格</InputLabel>
          <Select
            labelId="style-label"
            value={style}
            label="翻译风格"
            onChange={handleStyleChange}
          >
            {TRANSLATION_STYLES.map((styleOption) => (
              <MenuItem key={styleOption.id} value={styleOption.id}>
                {styleOption.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 配置摘要 */}
        {selectedProvider && selectedModel && (
          <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>当前配置</Typography>
            <Typography variant="body2" color="text.secondary">
              提供商: <strong>{providerOptions.find(p => p.value === selectedProvider)?.label}</strong><br/>
              模型: <strong>{modelOptions.find(m => m.value === selectedModel)?.label}</strong><br/>
              语言: <strong>{LANGUAGE_OPTIONS.find(l => l.code === sourceLanguage)?.name}</strong> → <strong>{LANGUAGE_OPTIONS.find(l => l.code === targetLanguage)?.name}</strong><br/>
              风格: <strong>{TRANSLATION_STYLES.find(s => s.id === style)?.name}</strong>
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default TranslationConfig;
