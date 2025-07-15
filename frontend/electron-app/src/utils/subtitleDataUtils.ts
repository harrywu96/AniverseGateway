/**
 * 字幕数据转换工具
 * 
 * 提供新旧字幕数据格式之间的转换函数，
 * 确保向后兼容性和数据一致性。
 */

import { 
  UnifiedSubtitleItem, 
  TranslationResult, 
  SubtitleItem 
} from '@subtranslate/shared';
import { timeUtils } from './timeUtils';

/**
 * 字幕数据转换工具类
 */
export const subtitleDataUtils = {
  /**
   * 将旧格式的SubtitleItem转换为新的UnifiedSubtitleItem
   * @param oldItem 旧格式的字幕项
   * @param index 字幕索引（可选，如果未提供则尝试从ID解析）
   * @returns 新格式的统一字幕项
   */
  convertToUnified: (oldItem: SubtitleItem, index?: number): UnifiedSubtitleItem => {
    // 尝试从ID中解析索引，如果失败则使用提供的索引或默认值
    const subtitleIndex = index ?? parseInt(oldItem.id) || 1;

    return {
      id: oldItem.id,
      index: subtitleIndex,
      startTime: oldItem.startTime,
      endTime: oldItem.endTime,
      startTimeStr: timeUtils.secondsToSrt(oldItem.startTime),
      endTimeStr: timeUtils.secondsToSrt(oldItem.endTime),
      originalText: oldItem.text,
      translatedText: oldItem.translated,
      translating: oldItem.translating,
      edited: false, // 默认未编辑
    };
  },

  /**
   * 将UnifiedSubtitleItem转换为旧格式的SubtitleItem
   * @param unifiedItem 统一格式的字幕项
   * @returns 旧格式的字幕项
   */
  convertToLegacy: (unifiedItem: UnifiedSubtitleItem): SubtitleItem => {
    return {
      id: unifiedItem.id,
      startTime: unifiedItem.startTime,
      endTime: unifiedItem.endTime,
      text: unifiedItem.originalText,
      translated: unifiedItem.translatedText,
      translating: unifiedItem.translating,
    };
  },

  /**
   * 批量转换旧格式数组为新格式数组
   * @param oldItems 旧格式字幕项数组
   * @returns 新格式统一字幕项数组
   */
  convertArrayToUnified: (oldItems: SubtitleItem[]): UnifiedSubtitleItem[] => {
    return oldItems.map((item, index) => 
      subtitleDataUtils.convertToUnified(item, index + 1)
    );
  },

  /**
   * 批量转换新格式数组为旧格式数组
   * @param unifiedItems 统一格式字幕项数组
   * @returns 旧格式字幕项数组
   */
  convertArrayToLegacy: (unifiedItems: UnifiedSubtitleItem[]): SubtitleItem[] => {
    return unifiedItems.map(item => subtitleDataUtils.convertToLegacy(item));
  },

  /**
   * 从后端翻译结果创建UnifiedSubtitleItem
   * @param backendResult 后端返回的翻译结果
   * @returns 统一格式的字幕项
   */
  createFromBackendResult: (backendResult: any): UnifiedSubtitleItem => {
    return {
      id: backendResult.index?.toString() || Date.now().toString(),
      index: backendResult.index || 1,
      startTime: backendResult.startTime || 0,
      endTime: backendResult.endTime || 0,
      startTimeStr: backendResult.startTimeStr || timeUtils.secondsToSrt(backendResult.startTime || 0),
      endTimeStr: backendResult.endTimeStr || timeUtils.secondsToSrt(backendResult.endTime || 0),
      originalText: backendResult.original || '',
      translatedText: backendResult.translated,
      confidence: backendResult.confidence,
      edited: false,
      translating: false,
    };
  },

  /**
   * 批量从后端翻译结果创建UnifiedSubtitleItem数组
   * @param backendResults 后端返回的翻译结果数组
   * @returns 统一格式的字幕项数组
   */
  createArrayFromBackendResults: (backendResults: any[]): UnifiedSubtitleItem[] => {
    return backendResults.map(result => subtitleDataUtils.createFromBackendResult(result));
  },

  /**
   * 验证UnifiedSubtitleItem的数据完整性
   * @param item 要验证的字幕项
   * @returns 验证结果和错误信息
   */
  validateUnifiedItem: (item: UnifiedSubtitleItem): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!item.id) {
      errors.push('缺少ID字段');
    }

    if (typeof item.index !== 'number' || item.index < 1) {
      errors.push('索引必须是大于0的数字');
    }

    if (!timeUtils.isValidTimeRange(item.startTime, item.endTime)) {
      errors.push('时间范围无效');
    }

    if (!item.originalText?.trim()) {
      errors.push('原文内容不能为空');
    }

    if (item.startTimeStr && !timeUtils.isValidSrtTime(item.startTimeStr)) {
      errors.push('开始时间SRT格式无效');
    }

    if (item.endTimeStr && !timeUtils.isValidSrtTime(item.endTimeStr)) {
      errors.push('结束时间SRT格式无效');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * 修复UnifiedSubtitleItem的数据问题
   * @param item 要修复的字幕项
   * @returns 修复后的字幕项
   */
  fixUnifiedItem: (item: UnifiedSubtitleItem): UnifiedSubtitleItem => {
    const fixed = { ...item };

    // 修复ID
    if (!fixed.id) {
      fixed.id = Date.now().toString();
    }

    // 修复索引
    if (typeof fixed.index !== 'number' || fixed.index < 1) {
      fixed.index = 1;
    }

    // 修复时间
    if (!timeUtils.isValidTimeRange(fixed.startTime, fixed.endTime)) {
      fixed.startTime = Math.max(0, fixed.startTime || 0);
      fixed.endTime = Math.max(fixed.startTime + 1, fixed.endTime || fixed.startTime + 1);
    }

    // 修复SRT时间格式
    if (!fixed.startTimeStr || !timeUtils.isValidSrtTime(fixed.startTimeStr)) {
      fixed.startTimeStr = timeUtils.secondsToSrt(fixed.startTime);
    }

    if (!fixed.endTimeStr || !timeUtils.isValidSrtTime(fixed.endTimeStr)) {
      fixed.endTimeStr = timeUtils.secondsToSrt(fixed.endTime);
    }

    // 修复文本
    if (!fixed.originalText?.trim()) {
      fixed.originalText = '(空字幕)';
    }

    return fixed;
  },

  /**
   * 批量修复UnifiedSubtitleItem数组
   * @param items 要修复的字幕项数组
   * @returns 修复后的字幕项数组
   */
  fixUnifiedArray: (items: UnifiedSubtitleItem[]): UnifiedSubtitleItem[] => {
    return items.map((item, index) => {
      const fixed = subtitleDataUtils.fixUnifiedItem(item);
      // 确保索引连续
      fixed.index = index + 1;
      return fixed;
    });
  },

  /**
   * 合并字幕项（用于编辑状态管理）
   * @param original 原始字幕项
   * @param updates 更新的字段
   * @returns 合并后的字幕项
   */
  mergeSubtitleItem: (
    original: UnifiedSubtitleItem, 
    updates: Partial<UnifiedSubtitleItem>
  ): UnifiedSubtitleItem => {
    const merged = { ...original, ...updates };

    // 如果时间发生变化，同步更新SRT格式时间
    if (updates.startTime !== undefined && updates.startTime !== original.startTime) {
      merged.startTimeStr = timeUtils.secondsToSrt(updates.startTime);
    }

    if (updates.endTime !== undefined && updates.endTime !== original.endTime) {
      merged.endTimeStr = timeUtils.secondsToSrt(updates.endTime);
    }

    // 如果SRT时间发生变化，同步更新秒数时间
    if (updates.startTimeStr !== undefined && updates.startTimeStr !== original.startTimeStr) {
      merged.startTime = timeUtils.srtToSeconds(updates.startTimeStr);
    }

    if (updates.endTimeStr !== undefined && updates.endTimeStr !== original.endTimeStr) {
      merged.endTime = timeUtils.srtToSeconds(updates.endTimeStr);
    }

    // 标记为已编辑
    if (updates.originalText !== undefined || updates.translatedText !== undefined) {
      merged.edited = true;
    }

    return merged;
  }
};

/**
 * 时间验证工具（从timeUtils导入并扩展）
 */
export const timeValidation = {
  /**
   * 验证SRT时间格式
   */
  isValidSrtTime: (timeStr: string): boolean => {
    const srtTimeRegex = /^\d{2}:\d{2}:\d{2},\d{3}$/;
    return srtTimeRegex.test(timeStr);
  },

  /**
   * 验证时间范围
   */
  isValidTimeRange: (startSeconds: number, endSeconds: number): boolean => {
    return (
      !isNaN(startSeconds) &&
      !isNaN(endSeconds) &&
      startSeconds >= 0 &&
      endSeconds >= 0 &&
      startSeconds < endSeconds
    );
  }
};

// 默认导出
export default subtitleDataUtils;
