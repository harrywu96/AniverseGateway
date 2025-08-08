import React, { useEffect } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Button, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayIcon from '@mui/icons-material/PlayArrow';

interface Option { value: string; label: string; }

interface LanguageOption { code: string; name: string; flag?: string; }

interface ProviderModel { id: string; name?: string; }

interface ProviderItem {
  id: string;
  name: string;
  apiKey?: string;
  apiHost?: string;
  is_active?: boolean;
  is_configured?: boolean;
  models?: ProviderModel[];
}

interface TranslationConfigPanelProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (val: string) => void;
  onTargetChange: (val: string) => void;

  languageOptions: LanguageOption[];

  trackOptions: Option[];
  selectedTrackId: string;
  onTrackChange: (val: string) => void;

  providers: ProviderItem[];
  selectedProviderId: string;
  onProviderChange: (val: string) => void;
  selectedModelId: string;
  onModelChange: (val: string) => void;

  isConfigComplete: boolean;
  onStart: () => void;
}

const TranslationConfigPanel: React.FC<TranslationConfigPanelProps> = ({
  sourceLanguage, targetLanguage, onSourceChange, onTargetChange,
  languageOptions,
  trackOptions, selectedTrackId, onTrackChange,
  providers, selectedProviderId, onProviderChange, selectedModelId, onModelChange,
  isConfigComplete, onStart
}) => {
  const selectedProvider = providers.find(p => p.id === selectedProviderId);
  const models = selectedProvider?.models || [];

  // 当提供商切换时，如果当前选择的模型不在新提供商的模型列表中，则清空模型选择
  useEffect(() => {
    if (selectedModelId && models.length > 0 && !models.find(m => m.id === selectedModelId)) {
      onModelChange('');
    }
  }, [selectedProviderId, models, selectedModelId, onModelChange]);

  const selectSx = { '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } } as const;
  const menuProps = { PaperProps: { sx: { maxHeight: 360, '& .MuiMenuItem-root': { whiteSpace: 'normal', wordBreak: 'break-all' } } } } as const;
  const renderEllipsis = (label: string) => (
    <Tooltip title={label} placement="top" arrow>
      <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Box>
    </Tooltip>
  );

  const trackLabel = (val: string) => trackOptions.find(o => o.value === val)?.label || '';
  const providerLabel = (val: string) => providers.find(p => p.id === val)?.name || val || '';
  const modelLabel = (val: string) => models.find(m => m.id === val)?.name || val || '';

  return (
    <Box sx={{ p: 2 }}>
      {/* 外层面板，采用 CSS Grid 进行强对齐布局 */}
      <Box
        sx={(theme) => ({
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(2, 1fr)',
            xl: 'repeat(3, 1fr)',
          },
          gap: 2,
          alignItems: 'end', // 让所有控件底部对齐
          p: { xs: 2, md: 2.5 },
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        })}
      >
        {/* 源语言 */}
        <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 1', lg: 'span 1', xl: 'span 1' } }}>
          <InputLabel>源语言</InputLabel>
          <Select
            value={sourceLanguage}
            label="源语言"
            onChange={(e) => onSourceChange(e.target.value)}
            sx={selectSx}
            MenuProps={menuProps}
            renderValue={(v) => renderEllipsis(languageOptions.find(l => l.code === v)?.name || (v as string))}
          >
            {languageOptions.map(lang => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{lang.name}</Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 目标语言 */}
        <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 1', lg: 'span 1', xl: 'span 1' } }}>
          <InputLabel>目标语言</InputLabel>
          <Select
            value={targetLanguage}
            label="目标语言"
            onChange={(e) => onTargetChange(e.target.value)}
            sx={selectSx}
            MenuProps={menuProps}
            renderValue={(v) => renderEllipsis(languageOptions.find(l => l.code === v)?.name || (v as string))}
          >
            {languageOptions.map(lang => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{lang.name}</Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 字幕轨道 */}
        <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 1', lg: 'span 1', xl: 'span 1' } }}>
          <InputLabel>字幕轨道</InputLabel>
          <Select
            value={selectedTrackId}
            label="字幕轨道"
            onChange={(e) => onTrackChange(e.target.value)}
            sx={selectSx}
            MenuProps={menuProps}
            renderValue={(v) => renderEllipsis(trackLabel(v as string))}
          >
            {trackOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{opt.label}</Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 服务提供商 */}
        <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 1', lg: 'span 1', xl: 'span 1' } }}>
          <InputLabel>服务提供商</InputLabel>
          <Select
            value={selectedProviderId}
            label="服务提供商"
            onChange={(e) => onProviderChange(e.target.value)}
            disabled={providers.length === 0}
            sx={selectSx}
            MenuProps={menuProps}
            renderValue={(v) => renderEllipsis(providerLabel(v as string))}
          >
            {providers.length === 0 ? (
              <MenuItem value="" disabled>无激活的提供商，请到设置中添加</MenuItem>
            ) : (
              providers.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{p.name || p.id}</Box>
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* 模型 */}
        <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 1', lg: 'span 1', xl: 'span 1' } }}>
          <InputLabel>模型</InputLabel>
          <Select
            value={selectedModelId}
            label="模型"
            onChange={(e) => onModelChange(e.target.value)}
            disabled={!selectedProviderId || models.length === 0}
            sx={selectSx}
            MenuProps={menuProps}
            renderValue={(v) => renderEllipsis(modelLabel(v as string))}
          >
            {models.length === 0 ? (
              <MenuItem value="" disabled>无可用模型</MenuItem>
            ) : (
              models.map(m => (
                <MenuItem key={m.id} value={m.id}>
                  <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{m.name || m.id}</Box>
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* 开始翻译按钮 */}
        <Button
          variant="contained"
          startIcon={<PlayIcon />}
          disabled={!isConfigComplete}
          onClick={onStart}
          sx={{
            gridColumn: { xs: '1 / -1', sm: 'span 2', md: 'span 2', lg: 'span 2', xl: 'span 3' },
            height: 44,
            fontWeight: 600,
            width: '100%'
          }}
        >
          开始翻译
        </Button>

        {/* 说明文字 */}
        <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mt: 0.5 }}>
          <InfoOutlinedIcon fontSize="small" />
          <Typography variant="body2">请选择字幕轨道、语言、提供商和模型后开始翻译</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default TranslationConfigPanel;

