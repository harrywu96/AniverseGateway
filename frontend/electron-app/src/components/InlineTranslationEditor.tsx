import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  IconButton,
  Chip,
  useTheme,
  alpha,
  Tooltip,
  Fade
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Undo as UndoIcon,
  AccessTime as TimeIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { createModernCardStyles } from '../utils/modernStyles';
import { timeUtils } from '../utils/timeUtils';
import { TranslationResult } from '../hooks/useTranslationEditor';

/**
 * 内联翻译编辑器组件属性接口
 */
export interface InlineTranslationEditorProps {
  /** 翻译结果数据 */
  result: TranslationResult;
  
  /** 是否处于编辑模式 */
  isEditing: boolean;
  
  /** 是否高亮显示（当前播放时间） */
  isHighlighted?: boolean;
  
  /** 是否显示时间信息 */
  showTime?: boolean;
  
  /** 是否显示置信度 */
  showConfidence?: boolean;
  
  /** 是否只读模式 */
  readOnly?: boolean;
  
  /** 开始编辑回调 */
  onEdit?: (id: string) => void;
  
  /** 保存编辑回调 */
  onSave?: (id: string, newText: string) => void;
  
  /** 取消编辑回调 */
  onCancel?: () => void;
  
  /** 重置编辑回调 */
  onReset?: (id: string) => void;
  
  /** 时间跳转回调 */
  onTimeJump?: (time: number) => void;
  
  /** 自定义样式 */
  sx?: any;
}

/**
 * 内联翻译编辑器组件
 * 支持原文译文对照显示和内联编辑功能
 */
const InlineTranslationEditor: React.FC<InlineTranslationEditorProps> = ({
  result,
  isEditing,
  isHighlighted = false,
  showTime = true,
  showConfidence = true,
  readOnly = false,
  onEdit,
  onSave,
  onCancel,
  onReset,
  onTimeJump,
  sx
}) => {
  const theme = useTheme();
  const textFieldRef = useRef<HTMLInputElement>(null);
  
  // 编辑状态
  const [editText, setEditText] = useState(result.translated);
  const [isSaving, setIsSaving] = useState(false);

  // 当进入编辑模式时，重置编辑文本并聚焦
  useEffect(() => {
    if (isEditing) {
      setEditText(result.translated);
      // 延迟聚焦，确保DOM已更新
      setTimeout(() => {
        const inputElement = textFieldRef.current;
        if (inputElement) {
          inputElement.focus();
          // 选中所有文本
          if (inputElement.select) {
            inputElement.select();
          } else {
            // 备用方案：设置选择范围
            inputElement.setSelectionRange?.(0, inputElement.value.length);
          }
        }
      }, 100);
    }
  }, [isEditing, result.translated]);

  // 处理键盘事件
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }, []);

  // 保存编辑
  const handleSave = useCallback(async () => {
    if (!onSave || !result.id || editText === result.translated) {
      handleCancel();
      return;
    }

    try {
      setIsSaving(true);
      await onSave(result.id, editText.trim());
    } catch (error) {
      console.error('保存翻译编辑失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, result.id, result.translated, editText]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setEditText(result.translated);
    onCancel?.();
  }, [result.translated, onCancel]);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    if (readOnly || !onEdit || !result.id) return;
    onEdit(result.id);
  }, [readOnly, onEdit, result.id]);

  // 重置编辑
  const handleReset = useCallback(() => {
    if (!onReset || !result.id) return;
    onReset(result.id);
  }, [onReset, result.id]);

  // 时间跳转
  const handleTimeJump = useCallback(() => {
    if (!onTimeJump) return;
    onTimeJump(result.startTime);
  }, [onTimeJump, result.startTime]);

  // 格式化时间显示
  const formatTime = useCallback((seconds: number): string => {
    return timeUtils.formatDisplayTime(seconds);
  }, []);

  // 计算样式
  const cardStyles = createModernCardStyles(
    theme, 
    isHighlighted ? 'primary' : result.edited ? 'success' : 'default',
    isHighlighted ? 1.5 : 1.0
  );

  return (
    <Fade in={true} timeout={300}>
      <Paper
        sx={{
          ...cardStyles,
          mb: 1,
          p: 2,
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isHighlighted 
            ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`
            : undefined,
          ...sx
        }}
        onClick={!isEditing && !readOnly ? handleStartEdit : undefined}
      >
        {/* 时间信息栏 */}
        {showTime && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatTime(result.startTime)} - {formatTime(result.endTime)}
              </Typography>
              {onTimeJump && (
                <Tooltip title="跳转到此时间">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTimeJump();
                    }}
                    sx={{ 
                      ml: 0.5,
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <PlayIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* 编辑状态指示 */}
              {result.edited && (
                <Chip
                  label="已编辑"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              )}
              
              {/* 置信度显示 */}
              {showConfidence && result.confidence && (
                <Chip
                  label={`${Math.round(result.confidence * 100)}%`}
                  size="small"
                  color={result.confidence > 0.8 ? 'success' : result.confidence > 0.6 ? 'warning' : 'error'}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              )}
              
              {/* 重置按钮 */}
              {result.edited && onReset && !isEditing && (
                <Tooltip title="重置编辑">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { color: 'warning.main' }
                    }}
                  >
                    <UndoIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}

        {/* 内容区域 */}
        <Grid container spacing={2}>
          {/* 原文 */}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}
              >
                原文
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  lineHeight: 1.6,
                  color: 'text.primary',
                  opacity: isEditing ? 0.7 : 1
                }}
              >
                {result.original}
              </Typography>
            </Box>
          </Grid>

          {/* 译文 */}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}
              >
                译文
              </Typography>
              
              {isEditing ? (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <TextField
                    inputRef={textFieldRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    multiline
                    minRows={2}
                    maxRows={6}
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={isSaving}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        '&.Mui-focused': {
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme.palette.primary.main,
                            borderWidth: 2
                          }
                        }
                      }
                    }}
                    placeholder="输入译文..."
                  />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Tooltip title="保存 (Enter)">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleSave}
                          disabled={isSaving || editText.trim() === result.translated}
                          sx={{
                            color: 'success.main',
                            '&:hover': { backgroundColor: alpha(theme.palette.success.main, 0.1) }
                          }}
                        >
                          <SaveIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="取消 (Esc)">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleCancel}
                          disabled={isSaving}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.1) }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      lineHeight: 1.6,
                      color: result.edited ? 'success.main' : 'text.primary',
                      fontWeight: result.edited ? 600 : 400,
                      flex: 1,
                      cursor: readOnly ? 'default' : 'pointer',
                      '&:hover': readOnly ? {} : {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        borderRadius: 1,
                        px: 0.5,
                        py: 0.25,
                        mx: -0.5,
                        my: -0.25
                      }
                    }}
                    onClick={!readOnly ? handleStartEdit : undefined}
                  >
                    {result.translated || '点击编辑译文...'}
                  </Typography>

                  {!readOnly && (
                    <Tooltip title="编辑译文">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit();
                        }}
                        sx={{
                          opacity: 0.6,
                          color: 'text.secondary',
                          '&:hover': {
                            opacity: 1,
                            color: 'primary.main',
                            backgroundColor: alpha(theme.palette.primary.main, 0.1)
                          }
                        }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Fade>
  );
};

export default memo(InlineTranslationEditor);
