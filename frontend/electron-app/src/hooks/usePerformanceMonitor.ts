import { useEffect, useRef, useCallback } from 'react';

/**
 * 性能监控Hook
 * 用于监控组件渲染性能和滚动性能
 */
export const usePerformanceMonitor = (componentName: string, enabled: boolean = false) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const scrollEventCountRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());

  // 监控渲染性能
  useEffect(() => {
    if (!enabled) return;
    
    renderCountRef.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    
    if (renderCountRef.current % 10 === 0) {
      console.log(`[性能监控] ${componentName} - 渲染次数: ${renderCountRef.current}, 平均间隔: ${timeSinceLastRender}ms`);
    }
    
    lastRenderTimeRef.current = now;
  });

  // 监控滚动性能
  const monitorScroll = useCallback(() => {
    if (!enabled) return;
    
    scrollEventCountRef.current++;
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTimeRef.current;
    
    if (scrollEventCountRef.current % 20 === 0) {
      console.log(`[性能监控] ${componentName} - 滚动事件: ${scrollEventCountRef.current}, 平均间隔: ${timeSinceLastScroll}ms`);
    }
    
    lastScrollTimeRef.current = now;
  }, [componentName, enabled]);

  // 重置计数器
  const resetCounters = useCallback(() => {
    renderCountRef.current = 0;
    scrollEventCountRef.current = 0;
    lastRenderTimeRef.current = Date.now();
    lastScrollTimeRef.current = Date.now();
  }, []);

  return {
    monitorScroll,
    resetCounters,
    getRenderCount: () => renderCountRef.current,
    getScrollEventCount: () => scrollEventCountRef.current
  };
};

/**
 * 滚动性能优化Hook
 * 提供防抖和节流功能
 */
export const useScrollOptimization = () => {
  const rafIdRef = useRef<number>();
  const lastScrollTopRef = useRef(0);

  // 使用requestAnimationFrame优化滚动处理 - 添加空值检查
  const optimizedScrollHandler = useCallback((
    callback: (scrollTop: number, scrollHeight: number, clientHeight: number) => void,
    element: HTMLElement | null
  ) => {
    if (!element) {
      console.warn('滚动元素为空，跳过优化处理');
      return;
    }

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      if (!element) return; // 再次检查

      const { scrollTop, scrollHeight, clientHeight } = element;

      // 只有滚动位置真正改变时才执行回调
      if (Math.abs(scrollTop - lastScrollTopRef.current) > 1) {
        callback(scrollTop, scrollHeight, clientHeight);
        lastScrollTopRef.current = scrollTop;
      }
    });
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { optimizedScrollHandler };
};
