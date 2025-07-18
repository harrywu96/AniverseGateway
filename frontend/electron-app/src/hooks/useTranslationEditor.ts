import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDebouncedCallback } from '../utils/useDebounce';

/**
 * 翻译结果接口
 */
export interface TranslationResult {
  id?: string;
  original: string;
  translated: string;
  startTime: number;
  endTime: number;
  confidence?: number;
  edited?: boolean;
}

/**
 * 编辑状态接口
 */
export interface EditState {
  editedResults: Map<string, TranslationResult>;
  undoStack: TranslationResult[][];
  redoStack: TranslationResult[][];
  hasUnsavedChanges: boolean;
}

/**
 * 虚拟列表状态接口
 */
export interface VirtualListState {
  displayedResults: TranslationResult[];
  loadedCount: number;
  totalCount: number;
}

/**
 * 翻译编辑器Hook返回值接口
 */
export interface UseTranslationEditorReturn {
  // 虚拟列表相关
  displayedResults: TranslationResult[];
  loadedCount: number;
  totalCount: number;
  loadMore: () => void;
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  
  // 编辑状态相关
  editedResults: Map<string, TranslationResult>;
  hasUnsavedChanges: boolean;
  editedCount: number;
  
  // 编辑操作
  updateResult: (id: string, newText: string) => void;
  resetResult: (id: string) => void;
  
  // 撤销重做
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // 批量操作
  resetAllEdits: () => void;
  getEditedResults: () => TranslationResult[];
  
  // 持久化
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

/**
 * 翻译编辑器状态管理Hook
 * 
 * @param results - 翻译结果数组
 * @param videoId - 视频ID，用于localStorage键名
 * @param pageSize - 虚拟列表每页大小，默认15
 * @returns 翻译编辑器状态和操作方法
 */
export const useTranslationEditor = (
  results: TranslationResult[],
  videoId: string,
  pageSize: number = 15
): UseTranslationEditorReturn => {
  // 为结果添加ID（如果没有的话）
  const resultsWithIds = useMemo(() => {
    return results.map((result, index) => ({
      ...result,
      id: result.id || `subtitle-${index}`,
    }));
  }, [results]);

  // 虚拟列表状态
  const [displayedResults, setDisplayedResults] = useState<TranslationResult[]>([]);
  const [loadedCount, setLoadedCount] = useState(pageSize);

  // 编辑状态
  const [editedResults, setEditedResults] = useState<Map<string, TranslationResult>>(new Map());
  const [undoStack, setUndoStack] = useState<TranslationResult[][]>([]);
  const [redoStack, setRedoStack] = useState<TranslationResult[][]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 最大撤销步数
  const maxUndoSteps = 50;

  // 初始化虚拟列表
  useEffect(() => {
    if (resultsWithIds.length > 0) {
      const initialResults = resultsWithIds.slice(0, Math.min(pageSize, resultsWithIds.length));
      setDisplayedResults(initialResults);
      setLoadedCount(Math.min(pageSize, resultsWithIds.length));
    } else {
      setDisplayedResults([]);
      setLoadedCount(0);
    }
  }, [resultsWithIds, pageSize]);

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (loadedCount < resultsWithIds.length) {
      const nextCount = Math.min(loadedCount + pageSize, resultsWithIds.length);
      setDisplayedResults(resultsWithIds.slice(0, nextCount));
      setLoadedCount(nextCount);
    }
  }, [loadedCount, resultsWithIds, pageSize]);

  // 处理滚动事件
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // 检查是否滚动到底部（留50px缓冲区）
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      loadMore();
    }
  }, [loadMore]);

  // 保存到localStorage的防抖函数
  const debouncedSave = useDebouncedCallback(() => {
    if (videoId && editedResults.size > 0) {
      try {
        const storageKey = `edited_subtitles_${videoId}`;
        const editedData: Record<string, TranslationResult> = {};
        editedResults.forEach((result, id) => {
          editedData[id] = result;
        });
        localStorage.setItem(storageKey, JSON.stringify(editedData));
        console.log('编辑结果已保存到localStorage:', editedResults.size, '条');
        // 注意：这里不设置 setHasUnsavedChanges(false)，因为只是保存到localStorage，不是真正的服务器保存
      } catch (error) {
        console.error('保存编辑结果到localStorage失败:', error);
      }
    }
  }, 500);

  // 添加到撤销栈
  const addToUndoStack = useCallback((currentState: TranslationResult[]) => {
    setUndoStack(prev => {
      const newStack = [...prev, currentState];
      // 限制撤销栈大小
      if (newStack.length > maxUndoSteps) {
        newStack.shift();
      }
      return newStack;
    });
    // 清空重做栈
    setRedoStack([]);
  }, [maxUndoSteps]);

  // 更新翻译结果
  const updateResult = useCallback((id: string, newText: string) => {
    const originalResult = resultsWithIds.find(r => r.id === id);
    if (!originalResult) return;

    // 保存当前状态到撤销栈
    const currentEditedResults = Array.from(editedResults.values());
    addToUndoStack(currentEditedResults);

    // 创建新的编辑结果
    const editedResult: TranslationResult = {
      ...originalResult,
      translated: newText,
      edited: true,
    };

    setEditedResults(prev => {
      const newMap = new Map(prev);
      newMap.set(id, editedResult);
      return newMap;
    });

    setHasUnsavedChanges(true);
    debouncedSave();
  }, [resultsWithIds, editedResults, addToUndoStack, debouncedSave]);

  // 重置单个结果
  const resetResult = useCallback((id: string) => {
    // 保存当前状态到撤销栈
    const currentEditedResults = Array.from(editedResults.values());
    addToUndoStack(currentEditedResults);

    setEditedResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });

    setHasUnsavedChanges(true);
    debouncedSave();
  }, [editedResults, addToUndoStack, debouncedSave]);

  // 撤销操作
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const currentEditedResults = Array.from(editedResults.values());
    setRedoStack(prev => [...prev, currentEditedResults]);

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    const newEditedMap = new Map<string, TranslationResult>();
    previousState.forEach(result => {
      if (result.id) {
        newEditedMap.set(result.id, result);
      }
    });
    setEditedResults(newEditedMap);

    setHasUnsavedChanges(true);
    debouncedSave();
  }, [undoStack, editedResults, debouncedSave]);

  // 重做操作
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentEditedResults = Array.from(editedResults.values());
    setUndoStack(prev => [...prev, currentEditedResults]);

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));

    const newEditedMap = new Map<string, TranslationResult>();
    nextState.forEach(result => {
      if (result.id) {
        newEditedMap.set(result.id, result);
      }
    });
    setEditedResults(newEditedMap);

    setHasUnsavedChanges(true);
    debouncedSave();
  }, [redoStack, editedResults, debouncedSave]);

  // 重置所有编辑
  const resetAllEdits = useCallback(() => {
    // 保存当前状态到撤销栈
    const currentEditedResults = Array.from(editedResults.values());
    addToUndoStack(currentEditedResults);

    setEditedResults(new Map());
    setHasUnsavedChanges(true);
    debouncedSave();
  }, [editedResults, addToUndoStack, debouncedSave]);

  // 获取最终的编辑结果
  const getEditedResults = useCallback((): TranslationResult[] => {
    return resultsWithIds.map(result => {
      const edited = editedResults.get(result.id!);
      return edited || result;
    });
  }, [resultsWithIds, editedResults]);

  // 手动保存到localStorage
  const saveToLocalStorage = useCallback(() => {
    debouncedSave();
  }, [debouncedSave]);

  // 从localStorage加载
  const loadFromLocalStorage = useCallback(() => {
    if (!videoId) return;

    try {
      const storageKey = `edited_subtitles_${videoId}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const editedData = JSON.parse(savedData);
        const editedMap = new Map<string, TranslationResult>();
        Object.entries(editedData).forEach(([id, result]) => {
          editedMap.set(id, result as TranslationResult);
        });
        setEditedResults(editedMap);
        console.log('已从localStorage加载编辑结果:', editedMap.size, '条');
      }
    } catch (error) {
      console.error('从localStorage加载编辑结果失败:', error);
    }
  }, [videoId]);

  // 组件挂载时加载保存的编辑结果
  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  // 计算编辑统计
  const editedCount = editedResults.size;
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return {
    // 虚拟列表相关
    displayedResults,
    loadedCount,
    totalCount: resultsWithIds.length,
    loadMore,
    handleScroll,
    
    // 编辑状态相关
    editedResults,
    hasUnsavedChanges,
    editedCount,
    
    // 编辑操作
    updateResult,
    resetResult,
    
    // 撤销重做
    undo,
    redo,
    canUndo,
    canRedo,
    
    // 批量操作
    resetAllEdits,
    getEditedResults,
    
    // 持久化
    saveToLocalStorage,
    loadFromLocalStorage,
  };
};

export default useTranslationEditor;
