import React from 'react';
import { Box, Button, Chip, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import TranslationResultEditor from '../TranslationResultEditor';

interface Props {
  results: any[];
  currentTime: number;
  videoId: string;
  readOnly: boolean;
  showPreview: boolean;
  onTimeJump: (t: number) => void;
  onEditStateChange: (hasUnsaved: boolean, editedCount: number) => void;
  onSave: (edited: any[]) => void;
  onDelete: () => void | Promise<boolean>;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  hasUnsavedChanges: boolean;
  editedCount: number;
  onExport: (results: any[]) => void;
}

const TranslationResultsPanel: React.FC<Props> = ({
  results, currentTime, videoId, readOnly, showPreview, onTimeJump,
  onEditStateChange, onSave, onDelete,
  isEditMode, onToggleEditMode, hasUnsavedChanges, editedCount, onExport
}) => {
  if (!results?.length) return null;
  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="导出编辑后的字幕文件">
            <Button variant="outlined" color="secondary" startIcon={<DownloadIcon />} onClick={() => onExport(results)} size="small" disabled={!results.length}>导出字幕</Button>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {hasUnsavedChanges && (
            <Chip label={`${editedCount} 条未保存`} color="warning" size="small" variant="filled" />
          )}
          <Tooltip title={isEditMode ? '切换到预览模式' : '切换到编辑模式'}>
            <Button variant={isEditMode ? 'contained' : 'outlined'} color="primary" startIcon={isEditMode ? <VisibilityIcon /> : <EditIcon />} onClick={onToggleEditMode} size="small">
              {isEditMode ? '预览模式' : '编辑模式'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      <TranslationResultEditor
        results={results}
        currentTime={currentTime}
        videoId={videoId}
        readOnly={readOnly}
        showPreview={showPreview}
        onTimeJump={onTimeJump}
        onEditStateChange={onEditStateChange}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Box>
  );
};

export default TranslationResultsPanel;

