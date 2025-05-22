import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 防抖Hook - 延迟执行函数或状态更新，直到指定时间段内没有进一步变化
 * 
 * 使用场景：
 * - 处理用户输入（搜索框、表单验证）
 * - 防止按钮重复点击
 * - 网络请求优化
 * - 窗口resize事件
 * 
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟时间（毫秒），默认300ms
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器，延迟更新防抖值
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清理函数：在依赖项变化时清除之前的定时器
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调Hook - 创建一个防抖版本的回调函数
 * 
 * @param callback - 需要防抖的回调函数
 * @param delay - 防抖延迟时间（毫秒），默认300ms
 * @param deps - 依赖项数组
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(  callback: T,  delay: number = 300,  deps?: React.DependencyList): T {  const timeoutRef = useRef<number>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // 清除之前的定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 设置新的定时器
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...(deps || [])]
  ) as T;

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * 防抖状态Hook - 创建一个带防抖功能的状态管理Hook
 * 
 * @param initialValue - 初始值
 * @param delay - 防抖延迟时间（毫秒），默认300ms
 * @returns [debouncedValue, setValue, immediateValue]
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, (value: T) => void, T] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(immediateValue, delay);

  return [debouncedValue, setImmediateValue, immediateValue];
}

/**
 * 高级防抖Hook - 支持请求取消和状态管理
 * 
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟时间（毫秒）
 * @param options - 配置选项
 * @returns 包含防抖值和控制函数的对象
 */
export function useAdvancedDebounce<T>(
  value: T,
  delay: number = 300,
  options: {
    leading?: boolean; // 是否在开始时立即执行
    trailing?: boolean; // 是否在结束时执行（默认true）
    maxWait?: number; // 最大等待时间
  } = {}
): {
  debouncedValue: T;
  isPending: boolean;
  cancel: () => void;
  flush: () => void;
} {
  const { leading = false, trailing = true, maxWait } = options;
  
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState<boolean>(false);
  
    const timeoutRef = useRef<number>();  const maxTimeoutRef = useRef<number>();
  const lastCallTimeRef = useRef<number>();
  const lastInvokeTimeRef = useRef<number>(0);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    lastCallTimeRef.current = undefined;
    setIsPending(false);
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      setDebouncedValue(value);
      lastInvokeTimeRef.current = Date.now();
      cancel();
    }
  }, [value, cancel]);

  useEffect(() => {
    const now = Date.now();
    lastCallTimeRef.current = now;
    
    const shouldInvoke = () => {
      const timeSinceLastCall = now - (lastCallTimeRef.current || 0);
      const timeSinceLastInvoke = now - lastInvokeTimeRef.current;
      
      return (
        !lastCallTimeRef.current ||
        timeSinceLastCall >= delay ||
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
      );
    };

    const invokeFunc = () => {
      setDebouncedValue(value);
      lastInvokeTimeRef.current = Date.now();
      setIsPending(false);
    };

    const leadingEdge = () => {
      lastInvokeTimeRef.current = now;
      if (leading) {
        invokeFunc();
      } else {
        setIsPending(true);
      }
    };

    const trailingEdge = () => {
      if (trailing && lastCallTimeRef.current) {
        invokeFunc();
      } else {
        setIsPending(false);
      }
    };

    if (shouldInvoke()) {
      if (lastCallTimeRef.current === now) {
        leadingEdge();
      } else {
        invokeFunc();
      }
    } else {
      setIsPending(true);
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置新的定时器
    timeoutRef.current = setTimeout(trailingEdge, delay);

    // 如果设置了最大等待时间
    if (maxWait !== undefined && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        invokeFunc();
        if (maxTimeoutRef.current) {
          clearTimeout(maxTimeoutRef.current);
          maxTimeoutRef.current = undefined;
        }
      }, maxWait);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, leading, trailing, maxWait, flush]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    debouncedValue,
    isPending,
    cancel,
    flush
  };
}

/**
 * 请求防抖Hook - 专门用于API请求的防抖处理
 * 支持AbortController自动取消请求
 * 
 * @param requestFn - 请求函数
 * @param delay - 防抖延迟时间（毫秒）
 * @returns 防抖后的请求函数和状态
 */
export function useDebouncedRequest<T extends any[], R>(
  requestFn: (...args: T) => Promise<R>,
  delay: number = 300
): {
  debouncedRequest: (...args: T) => Promise<R>;
  isLoading: boolean;
  cancel: () => void;
} {
    const [isLoading, setIsLoading] = useState(false);  const timeoutRef = useRef<number>();  const abortControllerRef = useRef<AbortController>();

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }
    setIsLoading(false);
  }, []);

  const debouncedRequest = useCallback(
    (...args: T): Promise<R> => {
      return new Promise((resolve, reject) => {
        // 取消之前的请求
        cancel();

        // 创建新的AbortController
        abortControllerRef.current = new AbortController();
        const controller = abortControllerRef.current;

        setIsLoading(true);

        timeoutRef.current = setTimeout(async () => {
          try {
            // 检查是否已被取消
            if (controller.signal.aborted) {
              throw new Error('Request was cancelled');
            }

            const result = await requestFn(...args);
            
            // 再次检查是否已被取消（异步操作完成后）
            if (controller.signal.aborted) {
              throw new Error('Request was cancelled');
            }

            setIsLoading(false);
            resolve(result);
          } catch (error) {
            setIsLoading(false);
            reject(error);
          }
        }, delay);
      });
    },
    [requestFn, delay, cancel]
  );

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    debouncedRequest,
    isLoading,
    cancel
  };
} 