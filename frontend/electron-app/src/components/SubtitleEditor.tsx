import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { binarySearch } from '../utils/performanceUtils';

// 字幕项接口
export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleEditorProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  loading?: boolean;
  error?: string | null;
  onSave?: (subtitle: SubtitleItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

// 单独的字幕项组件，使用memo优化渲染性能
interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onEdit: (subtitle: SubtitleItem) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isSaving: boolean;
  formatTime: (seconds: number) => string;
}

const SubtitleItemComponent: React.FC<SubtitleItemProps> = memo(({
  subtitle,
  isActive,
  onEdit,
  onDelete,
  isDeleting,
  isSaving,
  formatTime
}) => {
  return (
    <Paper
      sx={{
        p: 2,
        mb: 1,
        position: 'relative',
        bgcolor: isActive
          ? 'rgba(144, 202, 249, 0.2)'
          : 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption">
          {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={() => onEdit(subtitle)}
            disabled={isSaving || isDeleting}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(subtitle.id)}
            disabled={isSaving || isDeleting || isDeleting}
          >
            {isDeleting ? (
              <CircularProgress size={20} />
            ) : (
              <DeleteIcon fontSize="small" />
            )}
          </IconButton>
        </Box>
      </Box>
      <Typography variant="body1">{subtitle.text}</Typography>
    </Paper>
  );
});

// 字幕列表组件，使用memo优化渲染性能
interface SubtitleListProps {
  subtitles: SubtitleItem[];
  activeSubtitles: Map<string, boolean>;
  onEdit: (subtitle: SubtitleItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  savingId: string | null;
  formatTime: (seconds: number) => string;
}

const SubtitleList: React.FC<SubtitleListProps> = memo(({
  subtitles,
  activeSubtitles,
  onEdit,
  onDelete,
  deletingId,
  savingId,
  formatTime
}) => {
  return (
    <>
      {subtitles.map((subtitle) => (
        <SubtitleItemComponent
          key={subtitle.id}
          subtitle={subtitle}
          isActive={!!activeSubtitles.get(subtitle.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={deletingId === subtitle.id}
          isSaving={!!savingId}
          formatTime={formatTime}
        />
      ))}
    </>
  );
});

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  subtitles,
  currentTime,
  loading = false,
  error = null,
  onSave,
  onDelete
}) => {
  const [editingSubtitle, setEditingSubtitle] = useState<SubtitleItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 打开编辑对话框
  const handleEdit = useCallback((subtitle: SubtitleItem) => {
    setEditingSubtitle({ ...subtitle });
    setDialogOpen(true);
  }, []);

  // 关闭编辑对话框
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingSubtitle(null);
  }, []);

  // 保存编辑的字幕
  const handleSave = useCallback(async () => {
    if (!editingSubtitle || !onSave) return;

    try {
      setSavingId(editingSubtitle.id);
      await onSave(editingSubtitle);
      setDialogOpen(false);
      setEditingSubtitle(null);
    } catch (error) {
      console.error('保存字幕失败:', error);
    } finally {
      setSavingId(null);
    }
  }, [editingSubtitle, onSave]);

  // 删除字幕
  const handleDelete = useCallback(async (id: string) => {
    if (!onDelete) return;

    try {
      setDeletingId(id);
      await onDelete(id);
    } catch (error) {
      console.error('删除字幕失败:', error);
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  // 更新编辑中的字幕文本
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingSubtitle) return;
    setEditingSubtitle({
      ...editingSubtitle,
      text: e.target.value
    });
  };

  // 更新编辑中的字幕开始时间
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingSubtitle) return;
    const timeInSeconds = parseTimeToSeconds(e.target.value);
    if (isNaN(timeInSeconds)) return;

    setEditingSubtitle({
      ...editingSubtitle,
      startTime: timeInSeconds
    });
  };

  // 更新编辑中的字幕结束时间
  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingSubtitle) return;
    const timeInSeconds = parseTimeToSeconds(e.target.value);
    if (isNaN(timeInSeconds)) return;

    setEditingSubtitle({
      ...editingSubtitle,
      endTime: timeInSeconds
    });
  };

  // 将时间字符串解析为秒数
  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length !== 3) return NaN;

    const [hours, minutes, seconds] = parts.map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // 将秒数格式化为时间字符串 (HH:MM:SS.mmm)
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }, []);

  // 使用二分查找快速找到当前时间对应的字幕
  const activeSubtitles = useMemo(() => {
    // 创建一个映射，记录每个字幕是否处于活动状态
    const activeMap = new Map<string, boolean>();

    // 使用二分查找找到第一个结束时间大于当前时间的字幕
    const index = binarySearch(subtitles, (item) => item.endTime >= currentTime);

    if (index !== -1) {
      // 从找到的位置开始，向后检查几个字幕
      for (let i = index; i < subtitles.length && i < index + 5; i++) {
        const subtitle = subtitles[i];
        if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
          activeMap.set(subtitle.id, true);
        }
      }
    }

    return activeMap;
  }, [subtitles, currentTime]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 字幕列表 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        ) : subtitles.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }}>
            没有可用的字幕
          </Typography>
        ) : (
          <SubtitleList
            subtitles={subtitles}
            activeSubtitles={activeSubtitles}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletingId={deletingId}
            savingId={savingId}
            formatTime={formatTime}
          />
        )}
      </Box>

      {/* 编辑对话框 */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">编辑字幕</Typography>
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {editingSubtitle && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="开始时间"
                  value={formatTime(editingSubtitle.startTime)}
                  onChange={handleStartTimeChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  helperText="格式: HH:MM:SS.mmm"
                />
                <TextField
                  label="结束时间"
                  value={formatTime(editingSubtitle.endTime)}
                  onChange={handleEndTimeChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  helperText="格式: HH:MM:SS.mmm"
                />
              </Box>
              <TextField
                label="字幕文本"
                value={editingSubtitle.text}
                onChange={handleTextChange}
                fullWidth
                variant="outlined"
                multiline
                rows={4}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            startIcon={savingId ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            disabled={!!savingId}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// 使用React.memo包装组件，避免不必要的重新渲染
export default memo(SubtitleEditor);
