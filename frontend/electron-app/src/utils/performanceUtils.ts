/**
 * 性能优化工具函数
 */

/**
 * 节流函数 - 限制函数的执行频率
 * @param func 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);
    
    if (remaining <= 0) {
      // 如果已经过了足够的时间，立即执行
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      func.apply(this, args);
    } else if (!timeoutId) {
      // 否则，设置一个定时器在剩余时间后执行
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 防抖函数 - 延迟函数的执行，直到一段时间内没有再次调用
 * @param func 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 二分查找 - 查找数组中第一个满足条件的元素索引
 * @param arr 有序数组
 * @param predicate 判断函数，返回true表示找到目标
 * @returns 找到的元素索引，如果没有找到则返回-1
 */
export function binarySearch<T>(
  arr: T[],
  predicate: (item: T) => boolean
): number {
  let left = 0;
  let right = arr.length - 1;
  let result = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (predicate(arr[mid])) {
      result = mid;
      right = mid - 1; // 继续向左查找，寻找第一个满足条件的元素
    } else {
      left = mid + 1;
    }
  }
  
  return result;
}
