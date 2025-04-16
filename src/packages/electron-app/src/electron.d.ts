// 为Electron API添加全局类型声明

interface ElectronAPI {
  checkBackendStatus: () => Promise<boolean>;
  selectVideo: () => Promise<string | null>;
  uploadVideo: (filePath: string) => Promise<any>;
  onBackendStarted: (callback: () => void) => () => void;
  onBackendStopped: (callback: (data: { code: number }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {}; 