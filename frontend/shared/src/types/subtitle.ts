/**
 * 统一的字幕数据模型
 * 
 * 这个文件定义了项目中所有字幕相关的数据结构，
 * 解决前后端数据格式不一致的问题，并提供向后兼容性。
 */

/**
 * 统一的字幕项接口
 * 包含所有必要的时间格式和文本字段
 */
export interface UnifiedSubtitleItem {
  /** 唯一标识符 */
  id: string;
  
  /** 字幕索引（从1开始） */
  index: number;
  
  /** 开始时间（秒数，JavaScript标准） */
  startTime: number;
  
  /** 结束时间（秒数，JavaScript标准） */
  endTime: number;
  
  /** 开始时间（SRT格式："HH:MM:SS,mmm"） */
  startTimeStr: string;
  
  /** 结束时间（SRT格式："HH:MM:SS,mmm"） */
  endTimeStr: string;
  
  /** 原文内容 */
  originalText: string;
  
  /** 翻译后的内容（可选） */
  translatedText?: string;
  
  /** 翻译置信度（0-1之间，可选） */
  confidence?: number;
  
  /** 是否已被用户编辑过 */
  edited?: boolean;
  
  /** 是否正在翻译中 */
  translating?: boolean;
}

/**
 * 翻译结果接口
 * 继承自UnifiedSubtitleItem，但要求必须有翻译内容
 */
export interface TranslationResult extends UnifiedSubtitleItem {
  /** 翻译后的内容（必须） */
  translatedText: string;
}

/**
 * 字幕样式配置接口
 */
export interface SubtitleStyle {
  /** 字体大小 */
  fontSize?: string;
  
  /** 字体颜色 */
  color?: string;
  
  /** 背景颜色 */
  backgroundColor?: string;
  
  /** 字体族 */
  fontFamily?: string;
  
  /** 文字阴影 */
  textShadow?: string;
  
  /** 字幕位置 */
  position?: 'bottom' | 'top' | 'center';
  
  /** 透明度 */
  opacity?: number;
  
  /** 边框样式 */
  border?: string;
  
  /** 内边距 */
  padding?: string;
  
  /** 圆角 */
  borderRadius?: string;
}

/**
 * 字幕轨道信息接口（扩展版）
 */
export interface SubtitleTrackInfo {
  /** 轨道ID */
  id: string;
  
  /** 语言代码 */
  language?: string;
  
  /** 轨道标题 */
  title?: string;
  
  /** 字幕格式 */
  format: string;
  
  /** 是否为外部字幕 */
  isExternal: boolean;
  
  /** 字幕文件路径（外部字幕） */
  path?: string;
  
  /** 是否为默认轨道 */
  isDefault?: boolean;
  
  /** 字幕总数 */
  totalLines?: number;
  
  /** 总时长（秒） */
  duration?: number;
}

/**
 * 字幕编辑状态接口
 */
export interface SubtitleEditState {
  /** 当前编辑的字幕ID */
  editingId?: string;
  
  /** 是否有未保存的更改 */
  hasUnsavedChanges: boolean;
  
  /** 撤销栈 */
  undoStack: UnifiedSubtitleItem[][];
  
  /** 重做栈 */
  redoStack: UnifiedSubtitleItem[][];
  
  /** 最大撤销步数 */
  maxUndoSteps: number;
}

/**
 * 向后兼容的字幕项接口
 * 保持与现有代码的兼容性
 */
export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translated?: string;
  translating?: boolean;
}

/**
 * 字幕搜索结果接口
 */
export interface SubtitleSearchResult {
  /** 匹配的字幕项 */
  subtitle: UnifiedSubtitleItem;
  
  /** 匹配的文本片段 */
  matchedText: string;
  
  /** 匹配类型 */
  matchType: 'original' | 'translated';
  
  /** 匹配位置 */
  matchIndex: number;
  
  /** 匹配长度 */
  matchLength: number;
}

/**
 * 字幕导出配置接口
 */
export interface SubtitleExportConfig {
  /** 导出格式 */
  format: 'srt' | 'vtt' | 'ass' | 'txt';
  
  /** 是否包含原文 */
  includeOriginal: boolean;
  
  /** 是否包含译文 */
  includeTranslated: boolean;
  
  /** 文件编码 */
  encoding: 'utf-8' | 'gbk' | 'utf-16';
  
  /** 时间格式 */
  timeFormat?: 'srt' | 'vtt';
  
  /** 自定义样式（仅ASS格式） */
  customStyle?: SubtitleStyle;
}
