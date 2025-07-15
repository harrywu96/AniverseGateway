/**
 * 视频信息模型
 */
export interface VideoInfo {
  id: string;
  fileName: string;
  filePath: string;
  format: string;
  duration: number;
  hasEmbeddedSubtitles: boolean;
  hasExternalSubtitles: boolean;
  subtitleTracks?: SubtitleTrack[];
}

/**
 * 字幕轨道信息
 */
export interface SubtitleTrack {
  id: string;
  language?: string;
  title?: string;
  format: string;
  isExternal: boolean;
  path?: string;
}

/**
 * 翻译配置
 */
export interface TranslationConfig {
  sourceLanguage: string;
  targetLanguage: string;
  style?: string;
  aiProvider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customPrompt?: string;
  glossary?: Record<string, string>;
}

/**
 * 翻译任务
 */
export interface TranslationTask {
  id: string;
  videoId: string;
  subtitleTrackId: string;
  config: TranslationConfig;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * API响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * AI服务提供商
 */
export interface AIProvider {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
  is_configured: boolean;
  is_active: boolean;
  model_count: number;
  default_model?: string;
  models?: AIModel[];
}

/**
 * AI模型
 */
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  context_window: number;
  capabilities: string[];
  is_default: boolean;
  description?: string;
  default_parameters?: Record<string, any>;
}

/**
 * 系统配置
 */
export interface SystemConfig {
  apiProviders: Record<string, boolean>;
  defaultProvider: string;
  defaultModel: string;
  defaultSourceLanguage: string;
  defaultTargetLanguage: string;
  defaultStyle: string;
  ffmpegPath?: string;
}

/**
 * 应用状态
 */
export interface AppState {
  isBackendRunning: boolean;
  isProcessing: boolean;
  currentTask?: TranslationTask;
  recentVideos: VideoInfo[];
}

// 导出新的统一字幕数据模型
export * from './types/subtitle';