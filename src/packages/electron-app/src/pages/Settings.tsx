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
} from '@mui/material';
import { LANGUAGE_OPTIONS, TRANSLATION_STYLES } from '@subtranslate/shared';

const Settings: React.FC = () => {
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  
  // 通用设置
  const [apiKey, setApiKey] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('zh');
  const [defaultStyle, setDefaultStyle] = useState('natural');
  const [darkMode, setDarkMode] = useState(true);
  
  // Faster-Whisper 设置
  const [modelPath, setModelPath] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [device, setDevice] = useState('auto');
  const [computeType, setComputeType] = useState('auto');

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
          }
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
          apiKey
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
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="provider-label">AI 服务提供商</InputLabel>
              <Select
                labelId="provider-label"
                label="AI 服务提供商"
                value="openai"
              >
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="azure">Azure OpenAI</MenuItem>
                <MenuItem value="anthropic">Anthropic Claude</MenuItem>
                <MenuItem value="glm">智谱 GLM</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="API 密钥"
              variant="outlined"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="model-label">模型</InputLabel>
              <Select
                labelId="model-label"
                label="模型"
                value="gpt-4"
              >
                <MenuItem value="gpt-4">GPT-4</MenuItem>
                <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                <MenuItem value="glm-4">GLM-4</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
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
        
        <FormControlLabel
          control={
            <Switch
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
          }
          label="深色模式"
        />
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