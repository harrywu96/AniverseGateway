/**
 * 预加载脚本
 *
 * 该脚本在渲染进程加载之前运行，可以访问 Node.js API 和 Electron API。
 * 通过 contextBridge 安全地暴露 API 给渲染进程。
 */

import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 视频相关
  selectVideo: () => ipcRenderer.invoke('select-video'),
  uploadVideo: (filePath: string) => ipcRenderer.invoke('upload-video', filePath),

  // 后端相关
  checkBackendStatus: () => ipcRenderer.invoke('check-backend-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  onBackendStarted: (callback: () => void) => {
    ipcRenderer.on('backend-started', callback);
    return () => ipcRenderer.removeListener('backend-started', callback);
  },
  onBackendStopped: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('backend-stopped', callback);
    return () => ipcRenderer.removeListener('backend-stopped', callback);
  },
  onBackendError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('backend-error', callback);
    return () => ipcRenderer.removeListener('backend-error', callback);
  },

  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  openDirectoryDialog: (options: any) => ipcRenderer.invoke('open-directory-dialog', options),
  openFileDialog: (options: any) => ipcRenderer.invoke('open-file-dialog', options),

  // 缓存相关
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // 模型相关
  validateModel: (modelPath: string) => ipcRenderer.invoke('validate-model', modelPath),
});

// 打印预加载脚本已加载的消息
console.log('预加载脚本已加载');
