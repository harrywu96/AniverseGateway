import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Button,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { AIProvider } from '@subtranslate/shared';

interface ProviderListProps {
  providers: AIProvider[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  onAddProvider: () => void;
  onRefreshProviders: () => void;
  loading: boolean;
}

const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  selectedProvider,
  onSelectProvider,
  onAddProvider,
  onRefreshProviders,
  loading,
}) => {
  // 获取提供商头像
  const getProviderAvatar = (provider: AIProvider) => {
    if (provider.logo_url) {
      return <Avatar src={provider.logo_url} alt={provider.name} />;
    }
    
    // 如果没有logo，使用首字母作为头像
    const initials = provider.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    return (
      <Avatar sx={{ bgcolor: provider.id === 'custom' ? '#f50057' : '#1976d2' }}>
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
                      color: provider.is_active ? 'success.main' : 'text.secondary',
                      fontWeight: provider.is_active ? 'bold' : 'normal',
                    }}
                  >
                    {provider.is_active ? '活跃' : '未激活'}
                  </Typography>
                  {provider.model_count > 0 && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      • {provider.model_count} 个模型
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
      
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddProvider}
          disabled={loading}
        >
          添加提供商
        </Button>
      </Box>
    </Paper>
  );
};

export default ProviderList;
