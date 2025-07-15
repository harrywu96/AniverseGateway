import React, { useState, useCallback, useMemo, memo } from 'react';
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
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Translate as TranslateIcon
} from '@mui/icons-material';
import { binarySearch } from '../utils/performanceUtils';
import { UnifiedSubtitleItem } from '@subtranslate/shared';
import { timeUtils } from '../utils/timeUtils';
import { subtitleDataUtils } from '../utils/subtitleDataUtils';

// 字幕项接口（保持向后兼容）
export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translated?: string; // 添加翻译结果字段
  translating?: boolean; // 添加翻译中状态字段
}

interface SubtitleEditorProps {
  subtitles: SubtitleItem[] | UnifiedSubtitleItem[]; // 支持新旧两种格式
  currentTime: number;
  loading?: boolean;
  error?: string | null;
  onSave?: (subtitle: SubtitleItem | UnifiedSubtitleItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onTranslate?: (id: string, config: any) => Promise<void>; // 添加翻译回调
  translationConfig?: any; // 添加翻译配置
  useUnifiedFormat?: boolean; // 是否使用新的统一格式
}

// 单独的字幕项组件，使用memo优化渲染性能
interface SubtitleItemProps {
  subtitle: SubtitleItem | UnifiedSubtitleItem;
  isActive: boolean;
  onEdit: (subtitle: SubtitleItem | UnifiedSubtitleItem) => void;
  onTranslate?: (subtitle: SubtitleItem | UnifiedSubtitleItem) => void; // 添加翻译回调
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isSaving: boolean;
  formatTime: (seconds: number) => string;
  useUnifiedFormat?: boolean;
}

const SubtitleItemComponent: React.FC<SubtitleItemProps> = memo(({
  subtitle,
  isActive,
  onEdit,
  onDelete,
  onTranslate,
  isDeleting,
  isSaving,
  formatTime,
  useUnifiedFormat = false
}) => {
  const theme = useTheme();

  // 获取文本内容，支持新旧格式
  const getText = () => {
    if (useUnifiedFormat && 'originalText' in subtitle) {
      return (subtitle as UnifiedSubtitleItem).originalText;
    }
    return (subtitle as SubtitleItem).text;
  };

  // 获取翻译内容，支持新旧格式
  const getTranslated = () => {
    if (useUnifiedFormat && 'translatedText' in subtitle) {
      return (subtitle as UnifiedSubtitleItem).translatedText;
    }
    return (subtitle as SubtitleItem).translated;
  };

  // 获取翻译状态，支持新旧格式
  const getTranslating = () => {
    return subtitle.translating || false;
  };
  
  return (
    <Paper
      sx={{
        p: 2,
        mb: 1,
        position: 'relative',
        bgcolor: isActive
          ? alpha(theme.palette.primary.main, 0.12)
          : 'background.paper',
        border: isActive 
          ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
          : `1px solid transparent`,
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: isActive 
            ? alpha(theme.palette.primary.main, 0.16)
            : alpha(theme.palette.action.hover, 0.04),
          transform: 'translateY(-1px)',
          boxShadow: isActive 
            ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
            : theme.shadows[2]
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography 
          variant="caption"
          sx={{
            color: isActive 
              ? theme.palette.primary.main
              : theme.palette.text.secondary,
            fontWeight: isActive ? 600 : 400
          }}
        >
          {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={() => onEdit(subtitle)}
            disabled={isSaving || isDeleting || subtitle.translating}
            sx={{
              color: isActive 
                ? theme.palette.primary.main 
                : theme.palette.action.active
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(subtitle.id)}
            disabled={isSaving || isDeleting || subtitle.translating}
            sx={{
              color: isActive 
                ? theme.palette.error.main 
                : theme.palette.action.active
            }}
          >
            {isDeleting ? (
              <CircularProgress size={20} />
            ) : (
              <DeleteIcon fontSize="small" />
            )}
          </IconButton>
          {/* 添加翻译按钮 */}
          {onTranslate && (
            <IconButton
              size="small"
              onClick={() => onTranslate(subtitle)}
              disabled={getTranslating()}
              color={getTranslated() ? "primary" : "default"}
              sx={{
                color: isActive
                  ? (getTranslated() ? theme.palette.primary.main : theme.palette.secondary.main)
                  : (getTranslated() ? theme.palette.primary.main : theme.palette.action.active)
              }}
            >
              {getTranslating() ? (
                <CircularProgress size={20} />
              ) : (
                <TranslateIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>
      </Box>
      <Typography
        variant="body1"
        sx={{
          color: isActive
            ? theme.palette.text.primary
            : theme.palette.text.primary,
          fontWeight: isActive ? 500 : 400,
          lineHeight: 1.6
        }}
      >
        {getText()}
      </Typography>

      {/* 显示翻译结果 */}
      {getTranslated() && (
        <Box sx={{
          width: '100%',
          mt: 1,
          p: 1,
          bgcolor: isActive 
            ? alpha(theme.palette.info.main, 0.08)
            : 'action.hover',
          borderRadius: 1,
          borderLeft: `3px solid ${theme.palette.info.main}`
        }}>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            翻译:
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              color: isActive 
                ? theme.palette.text.primary
                : theme.palette.text.secondary
            }}
          >
            {getTranslated()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
});

// 字幕列表组件，使用memo优化渲染性能
interface SubtitleListProps {
  subtitles: SubtitleItem[] | UnifiedSubtitleItem[];
  activeSubtitles: Map<string, boolean>;
  onEdit: (subtitle: SubtitleItem | UnifiedSubtitleItem) => void;
  onDelete: (id: string) => void;
  onTranslate?: (subtitle: SubtitleItem | UnifiedSubtitleItem) => void; // 添加翻译回调
  deletingId: string | null;
  savingId: string | null;
  formatTime: (seconds: number) => string;
  useUnifiedFormat?: boolean;
}

const SubtitleList: React.FC<SubtitleListProps> = memo(({
  subtitles,
  activeSubtitles,
  onEdit,
  onDelete,
  onTranslate,
  deletingId,
  savingId,
  formatTime,
  useUnifiedFormat = false
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
          onTranslate={onTranslate}
          isDeleting={deletingId === subtitle.id}
          isSaving={!!savingId}
          formatTime={formatTime}
          useUnifiedFormat={useUnifiedFormat}
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
  onDelete,
  onTranslate,
  translationConfig,
  useUnifiedFormat = false
}) => {
  // 添加翻译处理函数
  const handleTranslate = useCallback(async (subtitle: SubtitleItem | UnifiedSubtitleItem) => {
    if (!translationConfig || !onTranslate) return;

    try {
      // 直接调用翻译API，状态更新由父组件处理
      await onTranslate(subtitle.id, translationConfig);
    } catch (error) {
      console.error('翻译失败:', error);
      // 错误处理由父组件完成
    }
  }, [onTranslate, translationConfig]);
  const [editingSubtitle, setEditingSubtitle] = useState<SubtitleItem | UnifiedSubtitleItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 打开编辑对话框
  const handleEdit = useCallback((subtitle: SubtitleItem | UnifiedSubtitleItem) => {
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

    if (useUnifiedFormat && 'originalText' in editingSubtitle) {
      // 新格式
      setEditingSubtitle({
        ...editingSubtitle,
        originalText: e.target.value
      });
    } else {
      // 旧格式
      setEditingSubtitle({
        ...editingSubtitle,
        text: e.target.value
      });
    }
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
            onTranslate={onTranslate ? handleTranslate : undefined}
            deletingId={deletingId}
            savingId={savingId}
            formatTime={formatTime}
            useUnifiedFormat={useUnifiedFormat}
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
                value={
                  useUnifiedFormat && 'originalText' in editingSubtitle
                    ? (editingSubtitle as UnifiedSubtitleItem).originalText
                    : (editingSubtitle as SubtitleItem).text
                }
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
