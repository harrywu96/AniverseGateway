import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Typography,
  Button,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
  Terminal as TerminalIcon
} from '@mui/icons-material';
import { Provider as AIProvider } from '../store/providerSlice';

interface ProviderListProps {
  providers: AIProvider[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  onAddProvider: () => void;
  onRefreshProviders: () => void;
  onToggleProviderActive: (providerId: string, isActive: boolean) => void;
  onAddLocalModel?: () => void;
  onConfigureOllama?: () => void;
  loading: boolean;
}

const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  selectedProvider,
  onSelectProvider,
  onAddProvider,
  onRefreshProviders,
  onToggleProviderActive,
  onAddLocalModel,
  onConfigureOllama,
  loading,
}) => {
  // 获取提供商头像
  const getProviderAvatar = (provider: AIProvider) => {
    if (provider.logo_url) {
      return <Avatar src={provider.logo_url} alt={provider.name} />;
    }

    // 根据提供商类型设置不同的颜色
    let bgColor = '#1976d2'; // 默认蓝色

    if (provider.id === 'custom' || provider.id.startsWith('custom-')) {
      bgColor = '#f50057'; // 自定义提供商使用粉色
    } else if (provider.id === 'local') {
      bgColor = '#4caf50'; // 本地模型使用绿色
    } else if (provider.id === 'ollama') {
      bgColor = '#ff9800'; // Ollama使用橙色
    }

    // 如果没有logo，使用首字母作为头像
    const initials = provider.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    return (
      <Avatar sx={{ bgcolor: bgColor }}>
        {initials}
      </Avatar>
    );
  };

  return (
    <Paper sx={{ width: 250, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">提供商</Typography>
        <Box>
          <Tooltip title="刷新提供商列表">
            <IconButton size="small" onClick={onRefreshProviders} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Divider />

      <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        {providers.map((provider) => (
          <ListItem
            key={provider.id}
            button
            selected={provider.id === selectedProvider}
            onClick={() => onSelectProvider(provider.id)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              },
            }}
          >
            <ListItemAvatar>{getProviderAvatar(provider)}</ListItemAvatar>
            <ListItemText
              primary={provider.name}
              secondary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      // color: provider.is_active ? 'success.main' : 'text.secondary',
                      // fontWeight: provider.is_active ? 'bold' : 'normal',
                    }}
                  >
                    {/* {provider.is_active ? '活跃' : '未激活'} */}
                  </Typography>
                  {provider.model_count > 0 ? (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {provider.model_count} 个模型
                    </Typography>
                  ) : (
                    <Typography component="span" variant="caption" color="text.secondary">
                      无可用模型
                    </Typography>
                  )}
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                onChange={() => onToggleProviderActive(provider.id, !provider.is_active)}
                checked={provider.is_active}
                disabled={loading}
              />
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddProvider}
          disabled={loading}
        >
          添加提供商
        </Button>

        {onAddLocalModel && (
          <Button
            fullWidth
            variant="outlined"
            color="success"
            startIcon={<ComputerIcon />}
            onClick={onAddLocalModel}
            disabled={loading}
          >
            添加本地模型
          </Button>
        )}

        {onConfigureOllama && (
          <Button
            fullWidth
            variant="outlined"
            color="warning"
            startIcon={<TerminalIcon />}
            onClick={onConfigureOllama}
            disabled={loading}
          >
            配置Ollama
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default ProviderList;
