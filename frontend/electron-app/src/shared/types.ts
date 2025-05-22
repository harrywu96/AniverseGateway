/**
 * AI提供商接口
 */
export interface AIProvider {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  model_count: number;
  logo_url?: string;
  base_url?: string;
  api_key?: string;
}

/**
 * AI模型接口
 */
export interface AIModel {
  id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  provider_id: string;
  capabilities?: string[];
  // 新增高级模型参数
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  message_limit_enabled?: boolean;
}

/**
 * 本地模型接口
 */
export interface LocalModel {
  id: string;
  name: string;
  model_path: string;
  base_url: string;
  model_type: string;
}

/**
 * Ollama配置接口
 */
export interface OllamaConfig {
  base_url: string;
  model: string;
  api_key?: string;
}

/**
 * 翻译配置接口
 */
export interface TranslationConfig {
  provider: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  style: string;
}

/**
 * 翻译请求接口
 */
export interface TranslationRequest {
  text: string;
  provider: string;
  model: string;
  source_language: string;
  target_language: string;
  style: string;
  preserve_formatting?: boolean;
  context_preservation?: boolean;
}

/**
 * 翻译响应接口
 */
export interface TranslationResponse {
  success: boolean;
  message?: string;
  data?: {
    translated: string;
    source_language?: string;
    target_language?: string;
  };
}

/**
 * 视频信息接口
 */
export interface VideoInfo {
  id: string;
  fileName: string;
  filePath: string;
  duration?: number;
  width?: number;
  height?: number;
  subtitleTracks?: SubtitleTrack[];
  thumbnailPath?: string;
}

/**
 * 字幕轨道接口
 */
export interface SubtitleTrack {
  id: string;
  language: string;
  title?: string;
  format?: string;
  isDefault?: boolean;
}

/**
 * 字幕项接口
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
 * API响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * 应用设置接口
 */
export interface AppSettings {
  // 语言设置
  sourceLanguage: string;
  targetLanguage: string;
  defaultStyle: string;

  // 主题设置
  darkMode: boolean;

  // AI服务设置
  selectedProvider: string;
  selectedModel: string;
  apiKey?: string;
  baseUrl?: string;

  // Faster-Whisper设置
  modelPath?: string;
  configPath?: string;
  device?: string;
  computeType?: string;
}

/**
 * 任务状态接口
 */
export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: any;
}
