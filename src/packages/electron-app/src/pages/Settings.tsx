import React, { useState } from 'react';
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
} from '@mui/material';
import { LANGUAGE_OPTIONS, TRANSLATION_STYLES } from '@subtranslate/shared';

const Settings: React.FC = () => {
  const [saved, setSaved] = useState(false);
  
  // 这里可以添加实际的设置状态，例如：
  const [apiKey, setApiKey] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('zh');
  const [defaultStyle, setDefaultStyle] = useState('natural');
  const [darkMode, setDarkMode] = useState(true);
  
  const handleSave = () => {
    // 这里应该实现实际的保存逻辑
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
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
    </Box>
  );
};

export default Settings; 