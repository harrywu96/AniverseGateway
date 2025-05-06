// 导出所有类型
export * from './types';

// API路径常量
export const API_PATHS = {
  ROOT: '/',
  HEALTH: '/api/health',
  VIDEOS: '/api/videos',
  VIDEOS_UPLOAD: '/api/videos/upload',
  VIDEOS_UPLOAD_LOCAL: '/api/videos/upload-local',
  VIDEOS_DETAIL: (id: string) => `/api/videos/${id}`,
  SUBTITLES: '/api/subtitles',
  SUBTITLES_EXTRACT: '/api/subtitles/extract',
  SUBTITLES_DETAIL: (id: string) => `/api/subtitles/${id}`,
  TASKS: '/api/tasks',
  TASKS_DETAIL: (id: string) => `/api/tasks/${id}`,
  TRANSLATE: '/api/translate',
  CONFIG: '/api/config',
  CONFIG_UPDATE: '/api/config/update',
  PROVIDERS: '/api/providers',
  MODELS: (provider: string) => `/api/providers/${provider}/models`,
  TEMPLATES: '/api/templates',
  TEMPLATES_DETAIL: (id: string) => `/api/templates/${id}`,
  EXPORT: '/api/export',
  EXPORT_FORMATS: '/api/export/formats',
  WEBSOCKET: '/ws'
};

// 默认的API基础URL
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

// 翻译风格
export const TRANSLATION_STYLES = [
  { id: 'literal', name: '直译' },
  { id: 'natural', name: '自然' },
  { id: 'formal', name: '正式' },
  { id: 'casual', name: '随意' },
  { id: 'creative', name: '创意' }
];

// 语言选项
export const LANGUAGE_OPTIONS = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' }
];

// 工具函数
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}