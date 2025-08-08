import { useReducer, useCallback, useRef, useEffect } from 'react';
import { 
  TranslationService, 
  TranslationResult, 
  TranslationProgress, 
  TranslationRequest 
} from '../services/translationService';
import { WebSocketService, WebSocketCallbacks } from '../services/websocketService';

// 翻译状态枚举
export enum TranslationStatus {
  IDLE = 'idle',
  CONFIGURING = 'configuring',
  TRANSLATING = 'translating',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

// 翻译状态接口
export interface TranslationState {
  status: TranslationStatus;
  progress: TranslationProgress;
  results: TranslationResult[];
  error: string | null;
  currentTaskId: string | null;
  isLoading: boolean;
}

// Action类型
type TranslationAction =
  | { type: 'SET_STATUS'; payload: TranslationStatus }
  | { type: 'SET_PROGRESS'; payload: TranslationProgress }
  | { type: 'SET_RESULTS'; payload: TranslationResult[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TASK_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_STATE' }
  | { type: 'CLEAR_ERROR' };

// 初始状态
const initialState: TranslationState = {
  status: TranslationStatus.IDLE,
  progress: {
    current: 0,
    total: 0,
    percentage: 0
  },
  results: [],
  error: null,
  currentTaskId: null,
  isLoading: false
};

// Reducer函数
function translationReducer(state: TranslationState, action: TranslationAction): TranslationState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    
    case 'SET_RESULTS':
      return { ...state, results: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_TASK_ID':
      return { ...state, currentTaskId: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

// Hook选项接口
export interface UseTranslationOptions {
  videoId?: string;
  targetLanguage?: string;
  onTranslationComplete?: (results: TranslationResult[]) => void;
  onTranslationError?: (error: string) => void;
}

/**
 * 翻译功能的自定义Hook
 * 
 * 功能特性：
 * 1. 使用useReducer管理复杂的翻译状态
 * 2. 集成WebSocket连接和消息处理
 * 3. 提供完整的翻译操作方法
 * 4. 自动处理错误和清理
 */
export const useTranslation = (options: UseTranslationOptions = {}) => {
  const { videoId, targetLanguage, onTranslationComplete, onTranslationError } = options;
  
  const [state, dispatch] = useReducer(translationReducer, initialState);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // WebSocket回调函数
  const wsCallbacks: WebSocketCallbacks = {
    onProgress: useCallback((progress: TranslationProgress) => {
      dispatch({ type: 'SET_PROGRESS', payload: progress });
    }, []),

    onCompleted: useCallback(async (results: TranslationResult[]) => {
      // 清空历史数据
      if (videoId && targetLanguage) {
        try {
          await TranslationService.clearTranslation({ videoId, targetLanguage });
        } catch (error) {
          console.error('清空历史翻译数据失败:', error);
        }
      }

      dispatch({ type: 'SET_STATUS', payload: TranslationStatus.COMPLETED });
      dispatch({ type: 'SET_RESULTS', payload: results });
      dispatch({ type: 'SET_TASK_ID', payload: null });

      // 保存翻译结果
      if (videoId && targetLanguage && results.length > 0) {
        try {
          await TranslationService.saveTranslation({
            videoId,
            results,
            targetLanguage,
            fileName: `${videoId}_${targetLanguage}`,
            isRealTranslation: true
          });
        } catch (error) {
          console.error('保存翻译结果失败:', error);
        }
      }

      onTranslationComplete?.(results);
    }, [videoId, targetLanguage, onTranslationComplete]),

    onError: useCallback((error: string) => {
      dispatch({ type: 'SET_STATUS', payload: TranslationStatus.ERROR });
      dispatch({ type: 'SET_ERROR', payload: error });
      dispatch({ type: 'SET_TASK_ID', payload: null });
      onTranslationError?.(error);
    }, [onTranslationError]),

    onCancelled: useCallback((message: string) => {
      dispatch({ type: 'SET_STATUS', payload: TranslationStatus.CANCELLED });
      dispatch({ type: 'SET_TASK_ID', payload: null });
      console.log('翻译已取消:', message);
    }, []),

    onOpen: useCallback(() => {
      console.log('WebSocket连接已建立');
    }, []),

    onClose: useCallback(() => {
      console.log('WebSocket连接已关闭');
      wsServiceRef.current = null;
    }, [])
  };

  // 开始翻译
  const startTranslation = useCallback(async (request: TranslationRequest) => {
    try {
      dispatch({ type: 'SET_STATUS', payload: TranslationStatus.TRANSLATING });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING', payload: true });

      // 创建取消控制器
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 发起翻译请求
      const result = await TranslationService.startTranslation(request);
      
      if (!result.success) {
        throw new Error(result.message || '翻译请求失败');
      }

      const taskId = result.data?.task_id;
      if (!taskId) {
        throw new Error('未获取到任务ID');
      }

      dispatch({ type: 'SET_TASK_ID', payload: taskId });

      // 建立WebSocket连接
      wsServiceRef.current = new WebSocketService();
      wsServiceRef.current.connect(taskId, wsCallbacks);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      dispatch({ type: 'SET_STATUS', payload: TranslationStatus.ERROR });
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_TASK_ID', payload: null });
      onTranslationError?.(errorMessage);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [wsCallbacks, onTranslationError]);

  // 停止翻译
  const stopTranslation = useCallback(async () => {
    try {
      // 调用后端取消API
      if (state.currentTaskId) {
        await TranslationService.cancelTranslation(state.currentTaskId);
      }
    } catch (error) {
      console.error('发送取消请求失败:', error);
    }

    // 执行前端清理
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (wsServiceRef.current) {
      wsServiceRef.current.disconnect();
    }

    dispatch({ type: 'SET_STATUS', payload: TranslationStatus.CANCELLED });
    dispatch({ type: 'SET_TASK_ID', payload: null });
  }, [state.currentTaskId]);

  // 加载保存的翻译结果
  const loadTranslation = useCallback(async (videoId: string, targetLanguage: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const result = await TranslationService.loadTranslation({ videoId, targetLanguage });
      
      if (result.success && result.data?.results) {
        const isRealTranslation = result.data.isRealTranslation !== false;
        
        if (isRealTranslation) {
          dispatch({ type: 'SET_RESULTS', payload: result.data.results });
          dispatch({ type: 'SET_STATUS', payload: TranslationStatus.COMPLETED });
          console.log('成功加载保存的翻译结果:', result.data.results.length, '条');
        } else {
          console.log('跳过模拟翻译结果');
        }
      }
    } catch (error) {
      console.error('加载翻译结果失败:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // 保存翻译结果
  const saveTranslation = useCallback(async (
    videoId: string,
    results: TranslationResult[],
    targetLanguage: string,
    fileName: string,
    edited: boolean = false
  ) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await TranslationService.saveTranslation({
        videoId,
        results,
        targetLanguage,
        fileName,
        edited,
        isRealTranslation: true
      });

      console.log('翻译结果保存成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // 删除翻译结果
  const deleteTranslation = useCallback(async (videoId: string, targetLanguage: string): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const result = await TranslationService.deleteTranslation({ videoId, targetLanguage });
      
      if (result.success) {
        dispatch({ type: 'RESET_STATE' });
        console.log('翻译结果已删除');
        return true;
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // 重置状态
  const resetTranslation = useCallback(() => {
    // 清理WebSocket连接
    if (wsServiceRef.current) {
      wsServiceRef.current.disconnect();
    }
    
    // 清理取消控制器
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    dispatch({ type: 'RESET_STATE' });
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // 状态
    ...state,
    
    // 操作方法
    startTranslation,
    stopTranslation,
    loadTranslation,
    saveTranslation,
    deleteTranslation,
    resetTranslation,
    clearError,
    
    // 状态检查
    isTranslating: state.status === TranslationStatus.TRANSLATING,
    isCompleted: state.status === TranslationStatus.COMPLETED,
    hasError: state.status === TranslationStatus.ERROR,
    isCancelled: state.status === TranslationStatus.CANCELLED,
    hasResults: state.results.length > 0,
  };
};
