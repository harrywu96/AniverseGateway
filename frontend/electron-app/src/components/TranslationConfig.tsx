import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { getProviders, getProviderModels } from '../services/api';
import { LANGUAGE_OPTIONS, TRANSLATION_STYLES } from '../shared';

interface TranslationConfigProps {
  onChange: (config: any) => void;
  defaultConfig?: any;
}

const TranslationConfig: React.FC<TranslationConfigProps> = ({
  onChange,
  defaultConfig = {}
}) => {
  // 状态
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(defaultConfig.provider || 'siliconflow');
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState(defaultConfig.model || '');
  const [sourceLanguage, setSourceLanguage] = useState(defaultConfig.sourceLanguage || 'en');
  const [targetLanguage, setTargetLanguage] = useState(defaultConfig.targetLanguage || 'zh');
  const [style, setStyle] = useState(defaultConfig.style || 'natural');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载提供商列表
  useEffect(() => {
    fetchProviders();
  }, []);

  // 当提供商变化时，加载模型列表
  useEffect(() => {
    if (selectedProvider) {
      fetchModels(selectedProvider);
    }
  }, [selectedProvider]);

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

  // 获取提供商列表
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await getProviders();
      if (response.success && response.data) {
        setProviders(response.data.providers);

        // 如果当前选择的提供商不在列表中，选择第一个
        if (response.data.providers.length > 0 &&
            !response.data.providers.some((p: any) => p.id === selectedProvider)) {
          setSelectedProvider(response.data.providers[0].id);
        }
      } else {
        setError(response.message || '获取提供商列表失败');
      }
    } catch (error: any) {
      setError(`获取提供商列表出错: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取模型列表
  const fetchModels = async (providerId: string) => {
    try {
      setLoading(true);
      const response = await getProviderModels(providerId);
      if (response.success && response.data) {
        setModels(response.data.models);

        // 如果当前选择的模型不在列表中，选择第一个
        if (response.data.models.length > 0 &&
            !response.data.models.some((m: any) => m.id === selectedModel)) {
          setSelectedModel(response.data.models[0].id);
        }
      } else {
        setError(response.message || `获取${providerId}的模型列表失败`);
      }
    } catch (error: any) {
      setError(`获取模型列表出错: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

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
      <Typography variant="h6" gutterBottom>翻译配置</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 提供商选择 */}
        <FormControl fullWidth>
          <InputLabel id="provider-label">翻译提供商</InputLabel>
          <Select
            labelId="provider-label"
            value={selectedProvider}
            label="翻译提供商"
            onChange={handleProviderChange}
            disabled={loading}
          >
            {providers.map((provider) => (
              <MenuItem key={provider.id} value={provider.id}>
                {provider.name}
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
            disabled={loading || models.length === 0}
          >
            {models.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name}
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
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  );
};

export default TranslationConfig;
