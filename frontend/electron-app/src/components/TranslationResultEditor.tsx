import React, { useState, useCallback, useMemo, useRef, memo, useEffect } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  LinearProgress,
  TextField,
  InputAdornment,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { createModernCardStyles } from '../utils/modernStyles';
import { useTranslationEditor, TranslationResult } from '../hooks/useTranslationEditor';
import { useDebouncedCallback } from '../utils/useDebounce';
import InlineTranslationEditor from './InlineTranslationEditor';

/**
 * 翻译结果编辑器主组件属性接口
 */
export interface TranslationResultEditorProps {
  /** 翻译结果数组 */
  results: TranslationResult[];
  
  /** 当前播放时间（秒） */
  currentTime?: number;
  
  /** 视频ID，用于持久化存储 */
  videoId: string;
  
  /** 是否只读模式 */
  readOnly?: boolean;
  
  /** 是否显示预览模式 */
  showPreview?: boolean;
  
  /** 虚拟列表页面大小 */
  pageSize?: number;
  
  /** 最大高度 */
  maxHeight?: number | string;
  
  /** 时间跳转回调 */
  onTimeJump?: (time: number) => void;
  
  /** 编辑状态变化回调 */
  onEditStateChange?: (hasChanges: boolean, editedCount: number) => void;
  
  /** 保存回调 */
  onSave?: (editedResults: TranslationResult[]) => void;
  
  /** 自定义样式 */
  sx?: any;
}

/**
 * 翻译结果编辑器主组件
 * 集成内联编辑组件、虚拟列表、时间同步等功能
 */
const TranslationResultEditor: React.FC<TranslationResultEditorProps> = ({
  results,
  currentTime = 0,
  videoId,
  readOnly = false,
  showPreview = false,
  pageSize = 15,
  maxHeight = 600,
  onTimeJump,
  onEditStateChange,
  onSave,
  sx
}) => {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 使用翻译编辑器Hook
  const {
    displayedResults,
    loadedCount,
    totalCount,
    loadMore,
    handleScroll,
    editedResults,
    hasUnsavedChanges,
    editedCount,
    updateResult,
    resetResult,
    undo,
    redo,
    canUndo,
    canRedo,
    resetAllEdits,
    getEditedResults,
    saveToLocalStorage
  } = useTranslationEditor(results, videoId, pageSize);

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);

  // 搜索和过滤状态
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 防抖搜索
  const debouncedSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  // 通知父组件编辑状态变化
  React.useEffect(() => {
    console.log('编辑状态变化:', { hasUnsavedChanges, editedCount });
    onEditStateChange?.(hasUnsavedChanges, editedCount);
  }, [hasUnsavedChanges, editedCount, onEditStateChange]);

  // 过滤结果
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return displayedResults;

    const term = searchTerm.toLowerCase();
    return displayedResults.filter(result =>
      result.original.toLowerCase().includes(term) ||
      result.translated.toLowerCase().includes(term)
    );
  }, [displayedResults, searchTerm]);

  // 判断是否为当前播放时间的字幕
  const isCurrentSubtitle = useCallback((result: TranslationResult) => {
    return currentTime >= result.startTime && currentTime <= result.endTime;
  }, [currentTime]);

  // 键盘快捷键处理
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 如果正在编辑，不处理全局快捷键
    if (editingId) return;

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 's': // Ctrl+S 保存
          event.preventDefault();
          if (hasUnsavedChanges) {
            const finalResults = getEditedResults();
            onSave?.(finalResults);
          }
          break;
        case 'z': // Ctrl+Z 撤销
          event.preventDefault();
          if (canUndo) {
            undo();
          }
          break;
        case 'y': // Ctrl+Y 重做
          event.preventDefault();
          if (canRedo) {
            redo();
          }
          break;
        case 'f': // Ctrl+F 搜索
          event.preventDefault();
          setShowSearchBar(true);
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 100);
          break;
      }
    } else if (event.key === 'Escape') {
      // ESC 关闭搜索栏
      if (showSearchBar) {
        event.preventDefault();
        setShowSearchBar(false);
        setSearchTerm('');
        debouncedSearch('');
      }
    }
  }, [editingId, hasUnsavedChanges, canUndo, canRedo, showSearchBar, getEditedResults, onSave, undo, redo, debouncedSearch]);

  // 注册键盘事件监听
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 处理时间跳转
  const handleTimeJump = useCallback((time: number) => {
    onTimeJump?.(time);
  }, [onTimeJump]);

  // 处理编辑开始
  const handleEditStart = useCallback((id: string) => {
    if (readOnly) return;
    setEditingId(id);
  }, [readOnly]);

  // 处理编辑取消
  const handleEditCancel = useCallback(() => {
    setEditingId(null);
  }, []);

  // 处理编辑保存
  const handleEditSave = useCallback((id: string, newText: string) => {
    updateResult(id, newText);
    setEditingId(null);
  }, [updateResult]);

  // 处理重置
  const handleReset = useCallback((id: string) => {
    resetResult(id);
  }, [resetResult]);

  // 处理保存所有编辑
  const handleSaveAll = useCallback(async () => {
    try {
      const finalResults = getEditedResults();
      console.log('保存所有编辑结果:', finalResults.length, '条');

      // 调用父组件的保存函数
      if (onSave) {
        await onSave(finalResults);
        console.log('编辑结果已保存到服务器');
      }

      // 保存到localStorage作为备份
      saveToLocalStorage();
    } catch (error) {
      console.error('保存编辑结果失败:', error);
    }
  }, [getEditedResults, onSave, saveToLocalStorage]);

  // 当切换到预览模式时，退出当前编辑
  useEffect(() => {
    if (showPreview) {
      setEditingId(null);
    }
  }, [showPreview]);

  // 计算进度
  const progress = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;

  // 获取当前高亮的字幕
  const currentSubtitle = useMemo(() => {
    return displayedResults.find(result => isCurrentSubtitle(result));
  }, [displayedResults, isCurrentSubtitle]);

  // 容器样式
  const containerStyles = createModernCardStyles(theme, 'primary', 1.2);

  return (
    <Fade in={true} timeout={800}>
      <Card sx={{ ...containerStyles, ...sx }}>
        {/* 头部 */}
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <EditIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {showPreview ? '翻译结果预览' : '翻译结果编辑'}
              </Typography>
              <Chip
                label={`${totalCount} 条 (显示 ${loadedCount})`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {editedCount > 0 && (
                <Chip
                  label={`已编辑 ${editedCount} 条`}
                  size="small"
                  color="success"
                  variant="filled"
                />
              )}
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1}>
              {/* 撤销重做按钮 */}
              {!readOnly && !showPreview && (
                <>
                  <Tooltip title="撤销">
                    <span>
                      <IconButton
                        size="small"
                        onClick={undo}
                        disabled={!canUndo}
                        sx={{ color: canUndo ? 'text.primary' : 'text.disabled' }}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="重做">
                    <span>
                      <IconButton
                        size="small"
                        onClick={redo}
                        disabled={!canRedo}
                        sx={{ color: canRedo ? 'text.primary' : 'text.disabled' }}
                      >
                        <RedoIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}

              {/* 保存按钮 */}
              {!readOnly && !showPreview && hasUnsavedChanges && (
                <Tooltip title="保存所有编辑">
                  <IconButton
                    size="small"
                    onClick={handleSaveAll}
                    sx={{ 
                      color: 'success.main',
                      '&:hover': { backgroundColor: alpha(theme.palette.success.main, 0.1) }
                    }}
                  >
                    <SaveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* 重置所有编辑 */}
              {!readOnly && !showPreview && editedCount > 0 && (
                <Tooltip title="重置所有编辑">
                  <IconButton
                    size="small"
                    onClick={resetAllEdits}
                    sx={{ 
                      color: 'warning.main',
                      '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.1) }
                    }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* 搜索按钮 */}
              <Tooltip title="搜索字幕 (Ctrl+F)">
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowSearchBar(prev => !prev);
                    if (!showSearchBar) {
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 100);
                    }
                  }}
                  sx={{
                    color: showSearchBar ? 'primary.main' : 'text.secondary',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>


            </Stack>
          }
          sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.04)})`,
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
          }}
        />

        {/* 进度条 */}
        {loadedCount < totalCount && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main
              }
            }}
          />
        )}

        {/* 搜索栏 */}
        {showSearchBar && (
          <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
            <TextField
              ref={searchInputRef}
              fullWidth
              size="small"
              placeholder="搜索原文或译文... (按 ESC 关闭)"
              onChange={(e) => debouncedSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.background.paper, 0.9)
                  },
                  '&.Mui-focused': {
                    backgroundColor: theme.palette.background.paper
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main
                  }
                }
              }}
            />
            {searchTerm && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                找到 {filteredResults.length} 条匹配结果
              </Typography>
            )}
          </Box>
        )}

        {/* 内容区域 */}
        <CardContent sx={{ p: 0 }}>
          <Box
            ref={scrollContainerRef}
            onScroll={handleScroll}
            sx={{
              maxHeight,
              overflow: 'auto',
              p: 2,
              '&::-webkit-scrollbar': {
                width: 8
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05)
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: alpha(theme.palette.primary.main, 0.3),
                borderRadius: 4,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.5)
                }
              }
            }}
          >
            {/* 加载状态 */}
            {filteredResults.length === 0 && (
              <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                {searchTerm ? '没有找到匹配的字幕' : totalCount === 0 ? '暂无翻译结果' : '正在加载翻译结果...'}
              </Typography>
            )}

            {/* 字幕列表 */}
            {filteredResults.map((result) => (
              <InlineTranslationEditor
                key={result.id}
                result={result}
                isEditing={!showPreview && editingId === result.id}
                isHighlighted={isCurrentSubtitle(result)}
                readOnly={readOnly || showPreview}
                showTime={true}
                showConfidence={true}
                onEdit={readOnly || showPreview ? undefined : handleEditStart}
                onSave={handleEditSave}
                onCancel={handleEditCancel}
                onReset={handleReset}
                onTimeJump={handleTimeJump}
                sx={{ mb: 1 }}
              />
            ))}

            {/* 加载更多提示 */}
            {loadedCount < totalCount && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  已显示 {loadedCount} / {totalCount} 条结果
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  滚动到底部加载更多...
                </Typography>
              </Box>
            )}

            {/* 全部加载完成提示 */}
            {loadedCount >= totalCount && totalCount > pageSize && (
              <Typography 
                variant="body2" 
                sx={{ 
                  textAlign: 'center', 
                  py: 3, 
                  color: 'text.secondary',
                  fontStyle: 'italic'
                }}
              >
                已显示全部 {totalCount} 条结果
              </Typography>
            )}
          </Box>
        </CardContent>

        {/* 底部状态栏 */}
        {(hasUnsavedChanges || currentSubtitle || !readOnly) && (
          <Box
            sx={{
              p: 2,
              borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.main, 0.02)})`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* 当前字幕信息 */}
              {currentSubtitle && (
                <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                  当前: {currentSubtitle.original}
                </Typography>
              )}

              {/* 编辑状态信息 */}
              {hasUnsavedChanges && (
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  有未保存的更改
                </Typography>
              )}
            </Box>

            {/* 键盘快捷键提示 */}
            {!readOnly && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  快捷键:
                </Typography>
                <Chip
                  label="Ctrl+F 搜索"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                />
                <Chip
                  label="Ctrl+S 保存"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                />
                <Chip
                  label="Ctrl+Z 撤销"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                />
                <Chip
                  label="ESC 关闭搜索"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                />
              </Box>
            )}
          </Box>
        )}
      </Card>
    </Fade>
  );
};

export default memo(TranslationResultEditor);
