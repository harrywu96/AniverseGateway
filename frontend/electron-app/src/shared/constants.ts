/**
 * 语言选项
 */
export const LANGUAGE_OPTIONS = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'it', name: '意大利语' },
  { code: 'ru', name: '俄语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'hi', name: '印地语' },
  { code: 'bn', name: '孟加拉语' },
  { code: 'pa', name: '旁遮普语' },
  { code: 'te', name: '泰卢固语' },
  { code: 'mr', name: '马拉地语' },
  { code: 'ta', name: '泰米尔语' },
  { code: 'ur', name: '乌尔都语' },
  { code: 'gu', name: '古吉拉特语' },
  { code: 'kn', name: '卡纳达语' },
  { code: 'ml', name: '马拉雅拉姆语' },
  { code: 'vi', name: '越南语' },
  { code: 'th', name: '泰语' },
  { code: 'id', name: '印尼语' },
  { code: 'ms', name: '马来语' },
  { code: 'nl', name: '荷兰语' },
  { code: 'sv', name: '瑞典语' },
  { code: 'no', name: '挪威语' },
  { code: 'da', name: '丹麦语' },
  { code: 'fi', name: '芬兰语' },
  { code: 'pl', name: '波兰语' },
  { code: 'tr', name: '土耳其语' },
  { code: 'cs', name: '捷克语' },
  { code: 'hu', name: '匈牙利语' },
  { code: 'el', name: '希腊语' },
  { code: 'he', name: '希伯来语' },
  { code: 'auto', name: '自动检测' },
];

/**
 * 翻译风格
 */
export const TRANSLATION_STYLES = [
  { id: 'natural', name: '自然流畅', description: '自然流畅的翻译，适合大多数场景' },
  { id: 'formal', name: '正式', description: '正式、专业的翻译风格，适合商务和学术场景' },
  { id: 'casual', name: '口语化', description: '口语化、日常对话风格的翻译' },
  { id: 'literal', name: '直译', description: '尽可能直译原文，保留原文结构' },
  { id: 'creative', name: '创意', description: '创意性翻译，适合文学、广告等场景' },
];

/**
 * 默认的AI提供商配置
 */
export const DEFAULT_PROVIDERS = [
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    description: '硅基智能提供的AI服务',
    is_active: true,
    model_count: 0,
    logo_url: '',
  },
  {
    id: 'local',
    name: '本地模型',
    description: '使用本地部署的大语言模型',
    is_active: false,
    model_count: 0,
    logo_url: '',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '使用Ollama运行的本地模型',
    is_active: false,
    model_count: 0,
    logo_url: '',
  },
];

/**
 * 默认的翻译配置
 */
export const DEFAULT_TRANSLATION_CONFIG = {
  provider: 'siliconflow',
  model: '',
  sourceLanguage: 'en',
  targetLanguage: 'zh',
  style: 'natural',
};

/**
 * 默认的Ollama配置
 */
export const DEFAULT_OLLAMA_CONFIG = {
  base_url: 'http://localhost:11434',
  model: '',
  api_key: '',
};

/**
 * 默认的本地模型配置
 */
export const DEFAULT_LOCAL_MODEL_CONFIG = {
  name: '',
  model_path: '',
  base_url: 'http://localhost:8080',
  model_type: 'gguf',
};
