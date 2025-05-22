/**
 * Electron API 类型定义文件
 */

interface ElectronAPI {
  // 基本功能
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  openDirectoryDialog: (options: any) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  openFileDialog: (options: any) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  validateModel: (modelPath: string) => Promise<{
    valid: boolean;
    message?: string;
    modelInfo?: any;
  }>;

  // 后端管理
  checkBackendStatus: () => Promise<boolean>;
  selectVideo: () => Promise<string | null>;
  uploadVideo: (filePath: string) => Promise<any>;
  clearCache: () => Promise<{ success: boolean; message?: string; error?: string; data?: any }>;
  onBackendStarted: (callback: () => void) => () => void;
  onBackendStopped: (callback: (data: { code: number }) => void) => () => void;
  restartBackend: () => Promise<{ success: boolean; error?: string }>;

  // Faster Whisper相关
  loadFasterWhisperConfig: (configPath: string) => Promise<{ success: boolean; message?: string; config?: any }>;
  transcribeWithGUIConfig: (params: { videoPath: string; configPath?: string; outputDir?: string }) =>
    Promise<{ success: boolean; message?: string; data?: any }>;
  getFasterWhisperParams: (configPath: string) => Promise<{ success: boolean; message?: string; parameters?: any }>;

  // AI提供商相关
  getProviders: () => Promise<{ providers: any[]; current_provider: string }>;
  getProviderDetails: (providerId: string) => Promise<{ success: boolean; message?: string; data: any }>;
  getProviderModels: (providerId: string) => Promise<{ success: boolean; models: any[] }>;
  updateProvider: (
    providerId: string,
    apiKey: string,
    defaultModel: string,
    baseUrl?: string,
    modelParams?: {
      temperature?: number;
      top_p?: number;
      max_tokens?: number;
      message_limit_enabled?: boolean;
    }
  ) => Promise<{ success: boolean; message?: string }>;
  testProvider: (providerId: string, apiKey: string, baseUrl?: string, model?: string, formatType?: string) =>
    Promise<{ success: boolean; message: string; data?: any }>;
  createCustomProvider: (name: string, apiKey: string, baseUrl: string, defaultModel?: string, formatType?: string) =>
    Promise<{ success: boolean; message?: string; provider_id?: string }>;
  deleteCustomProvider: (providerId: string) => Promise<{ success: boolean; message?: string }>;
  activateProvider: (providerId: string) => Promise<{ success: boolean; message?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    electron?: ElectronAPI;
  }
}

export {};