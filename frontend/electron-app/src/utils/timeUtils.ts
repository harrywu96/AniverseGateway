/**
 * 时间格式转换工具函数
 * 
 * 提供SRT时间格式与JavaScript秒数之间的双向转换，
 * 以及其他时间相关的实用函数。
 */

/**
 * 时间转换工具类
 */
export const timeUtils = {
  /**
   * SRT时间格式转秒数
   * @param timeStr SRT时间格式字符串，如 "00:01:23,456"
   * @returns 秒数，如 83.456
   * 
   * @example
   * timeUtils.srtToSeconds("00:01:23,456") // 返回 83.456
   * timeUtils.srtToSeconds("01:30:00,000") // 返回 5400
   */
  srtToSeconds: (timeStr: string): number => {
    try {
      // 分割时间部分和毫秒部分
      const [time, ms] = timeStr.split(',');
      if (!time || ms === undefined) {
        throw new Error('Invalid SRT time format');
      }

      // 分割小时、分钟、秒
      const [hours, minutes, seconds] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        throw new Error('Invalid time components');
      }

      const milliseconds = Number(ms) || 0;
      if (isNaN(milliseconds) || milliseconds < 0 || milliseconds >= 1000) {
        throw new Error('Invalid milliseconds');
      }

      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    } catch (error) {
      console.error(`时间格式转换失败: ${timeStr}`, error);
      return 0;
    }
  },

  /**
   * 秒数转SRT时间格式
   * @param seconds 秒数
   * @returns SRT时间格式字符串，如 "00:01:23,456"
   * 
   * @example
   * timeUtils.secondsToSrt(83.456) // 返回 "00:01:23,456"
   * timeUtils.secondsToSrt(5400) // 返回 "01:30:00,000"
   */
  secondsToSrt: (seconds: number): string => {
    try {
      if (isNaN(seconds) || seconds < 0) {
        throw new Error('Invalid seconds value');
      }

      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);

      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms
        .toString()
        .padStart(3, '0')}`;
    } catch (error) {
      console.error(`秒数转换失败: ${seconds}`, error);
      return '00:00:00,000';
    }
  },

  /**
   * 格式化显示时间（用于UI显示）
   * @param seconds 秒数
   * @returns 格式化的时间字符串，如 "01:23"
   * 
   * @example
   * timeUtils.formatDisplayTime(83.456) // 返回 "01:23"
   * timeUtils.formatDisplayTime(5400) // 返回 "90:00"
   */
  formatDisplayTime: (seconds: number): string => {
    try {
      if (isNaN(seconds) || seconds < 0) {
        return '00:00';
      }

      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);

      return `${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } catch (error) {
      console.error(`显示时间格式化失败: ${seconds}`, error);
      return '00:00';
    }
  },

  /**
   * 格式化详细时间（包含小时）
   * @param seconds 秒数
   * @returns 格式化的时间字符串，如 "01:23:45"
   * 
   * @example
   * timeUtils.formatDetailedTime(83.456) // 返回 "00:01:23"
   * timeUtils.formatDetailedTime(5400) // 返回 "01:30:00"
   */
  formatDetailedTime: (seconds: number): string => {
    try {
      if (isNaN(seconds) || seconds < 0) {
        return '00:00:00';
      }

      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error(`详细时间格式化失败: ${seconds}`, error);
      return '00:00:00';
    }
  },

  /**
   * 解析时间字符串为秒数（支持多种格式）
   * @param timeStr 时间字符串，支持 "MM:SS" 或 "HH:MM:SS" 格式
   * @returns 秒数
   * 
   * @example
   * timeUtils.parseTimeString("01:23") // 返回 83
   * timeUtils.parseTimeString("01:23:45") // 返回 5025
   */
  parseTimeString: (timeStr: string): number => {
    try {
      const parts = timeStr.split(':').map(Number);
      
      if (parts.length === 2) {
        // MM:SS 格式
        const [minutes, seconds] = parts;
        return minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // HH:MM:SS 格式
        const [hours, minutes, seconds] = parts;
        return hours * 3600 + minutes * 60 + seconds;
      } else {
        throw new Error('Invalid time format');
      }
    } catch (error) {
      console.error(`时间字符串解析失败: ${timeStr}`, error);
      return 0;
    }
  },

  /**
   * 计算时间差
   * @param startSeconds 开始时间（秒）
   * @param endSeconds 结束时间（秒）
   * @returns 时间差（秒）
   */
  calculateDuration: (startSeconds: number, endSeconds: number): number => {
    return Math.max(0, endSeconds - startSeconds);
  },

  /**
   * 验证时间范围是否有效
   * @param startSeconds 开始时间（秒）
   * @param endSeconds 结束时间（秒）
   * @returns 是否有效
   */
  isValidTimeRange: (startSeconds: number, endSeconds: number): boolean => {
    return (
      !isNaN(startSeconds) &&
      !isNaN(endSeconds) &&
      startSeconds >= 0 &&
      endSeconds >= 0 &&
      startSeconds < endSeconds
    );
  },

  /**
   * 格式化时间范围
   * @param startSeconds 开始时间（秒）
   * @param endSeconds 结束时间（秒）
   * @returns 格式化的时间范围字符串
   * 
   * @example
   * timeUtils.formatTimeRange(60, 120) // 返回 "01:00 - 02:00"
   */
  formatTimeRange: (startSeconds: number, endSeconds: number): string => {
    const start = timeUtils.formatDisplayTime(startSeconds);
    const end = timeUtils.formatDisplayTime(endSeconds);
    return `${start} - ${end}`;
  },

  /**
   * 获取时间戳（用于调试和日志）
   * @returns 当前时间戳字符串
   */
  getTimestamp: (): string => {
    return new Date().toISOString();
  }
};

/**
 * 时间验证工具
 */
export const timeValidation = {
  /**
   * 验证SRT时间格式
   * @param timeStr 时间字符串
   * @returns 是否为有效的SRT时间格式
   */
  isValidSrtTime: (timeStr: string): boolean => {
    const srtTimeRegex = /^\d{2}:\d{2}:\d{2},\d{3}$/;
    return srtTimeRegex.test(timeStr);
  },

  /**
   * 验证时间字符串格式
   * @param timeStr 时间字符串
   * @returns 是否为有效的时间格式
   */
  isValidTimeString: (timeStr: string): boolean => {
    const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
    return timeRegex.test(timeStr);
  }
};

// 默认导出
export default timeUtils;
