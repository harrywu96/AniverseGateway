/**
 * Electron API 类型定义文件
 */

interface ElectronAPI {
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<any>;
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
    modelInfo?: {
      name?: string;
    };
  }>;
  checkBackendStatus: () => Promise<any>;
  selectVideo: () => Promise<any>;
  uploadVideo: (filePath: string) => Promise<any>;
  onBackendStarted: (callback: () => void) => () => void;
  onBackendStopped: (callback: (data: { code: number }) => void) => () => void;
  restartBackend: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {}; 