/**
 * Electron API 类型定义文件
 */

interface ElectronAPI {
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
  checkBackendStatus: () => Promise<boolean>;
  selectVideo: () => Promise<string | null>;
  uploadVideo: (filePath: string) => Promise<any>;
  onBackendStarted: (callback: () => void) => () => void;
  onBackendStopped: (callback: (data: { code: number }) => void) => () => void;
  restartBackend: () => Promise<{ success: boolean; error?: string }>;
  loadFasterWhisperConfig: (configPath: string) => Promise<{ success: boolean; message?: string; config?: any }>;
  transcribeWithGUIConfig: (params: { videoPath: string; configPath?: string; outputDir?: string }) => 
    Promise<{ success: boolean; message?: string; data?: any }>;
  getFasterWhisperParams: (configPath: string) => Promise<{ success: boolean; message?: string; parameters?: any }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {}; 