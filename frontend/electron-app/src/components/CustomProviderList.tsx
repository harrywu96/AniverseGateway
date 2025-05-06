import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Button,
  Divider,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { getCustomProviders, activateCustomProvider, deleteCustomProvider } from '../services/api';

interface CustomProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  format_type: string;
  model_count: number;
  is_active: boolean;
}

interface CustomProviderListProps {
  onAddProvider: () => void;
  onEditProvider: (provider: CustomProvider) => void;
  onSelectProvider: (providerId: string) => void;
  onRefresh: () => void;
}

const CustomProviderList: React.FC<CustomProviderListProps> = ({
  onAddProvider,
  onEditProvider,
  onSelectProvider,
  onRefresh,
}) => {
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<CustomProvider | null>(null);
  const [error, setError] = useState('');

  // 加载自定义提供商列表
  const fetchProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getCustomProviders();
      if (response.success && response.data) {
        setProviders(response.data.providers);
        setActiveProvider(response.data.active_provider);
      } else {
        setError(response.message || '获取自定义提供商列表失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取自定义提供商列表出错');
      console.error('获取自定义提供商列表出错:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchProviders();
  }, []);

  // 激活提供商
  const handleActivate = async (providerId: string) => {
    try {
      const response = await activateCustomProvider(providerId);
      if (response.success) {
        setActiveProvider(providerId);
        // 通知父组件选择了新的提供商
        onSelectProvider(providerId);
        // 刷新列表
        fetchProviders();
      } else {
        setError(response.message || '激活提供商失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '激活提供商出错');
      console.error('激活提供商出错:', error);
    }
  };

  // 删除提供商
  const handleDelete = async () => {
    if (!providerToDelete) return;
    
    try {
      const response = await deleteCustomProvider(providerToDelete.id);
      if (response.success) {
        // 刷新列表
        fetchProviders();
        // 通知父组件刷新
        onRefresh();
        setDeleteDialogOpen(false);
        setProviderToDelete(null);
      } else {
        setError(response.message || '删除提供商失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除提供商出错');
      console.error('删除提供商出错:', error);
    }
  };

  // 打开删除对话框
  const openDeleteDialog = (provider: CustomProvider, event: React.MouseEvent) => {
    event.stopPropagation();
    setProviderToDelete(provider);
    setDeleteDialogOpen(true);
  };

  // 编辑提供商
  const handleEdit = (provider: CustomProvider, event: React.MouseEvent) => {
    event.stopPropagation();
    onEditProvider(provider);
  };

  // 获取提供商头像
  const getProviderAvatar = (provider: CustomProvider) => {
    // 使用首字母作为头像
    const initials = provider.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    return (
      <Avatar sx={{ bgcolor: provider.is_active ? '#4caf50' : '#f50057' }}>
        {initials}
      </Avatar>
    );
  };

  return (
    <Paper sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">自定义提供商</Typography>
        <Box>
          <Tooltip title="刷新提供商列表">
            <IconButton size="small" onClick={fetchProviders} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Divider />
      
      <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        {providers.length === 0 ? (
          <ListItem>
            <ListItemText
              primary="没有自定义提供商"
              secondary="点击下方按钮添加新的提供商"
            />
          </ListItem>
        ) : (
          providers.map((provider) => (
            <ListItem
              key={provider.id}
              button
              onClick={() => handleActivate(provider.id)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                bgcolor: provider.is_active ? 'action.selected' : 'transparent',
                '&:hover': {
                  bgcolor: provider.is_active ? 'action.selected' : 'action.hover',
                },
              }}
            >
              <ListItemAvatar>{getProviderAvatar(provider)}</ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {provider.name}
                    {provider.is_active && (
                      <Chip
                        label="活跃"
                        size="small"
                        color="success"
                        sx={{ ml: 1, height: 20 }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box component="span">
                    <Typography variant="caption" component="span">
                      {provider.base_url}
                    </Typography>
                    {provider.model_count > 0 && (
                      <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                        • {provider.model_count} 个模型
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="编辑提供商">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => handleEdit(provider, e)}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="删除提供商">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => openDeleteDialog(provider, e)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))
        )}
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

      {/* 删除提供商确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>删除提供商</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除提供商 "{providerToDelete?.name}" 吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDelete} color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CustomProviderList;
