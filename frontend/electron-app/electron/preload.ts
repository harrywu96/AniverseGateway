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

  // AI提供商相关
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getProviderDetails: (providerId: string) => ipcRenderer.invoke('get-provider-details', providerId),
  getProviderModels: (providerId: string) => ipcRenderer.invoke('get-provider-models', providerId),
  updateProvider: (providerId: string, apiKey: string, defaultModel: string, baseUrl?: string) =>
    ipcRenderer.invoke('update-provider', providerId, apiKey, defaultModel, baseUrl),
  testProvider: (providerId: string, apiKey: string, baseUrl?: string, model?: string, formatType?: string) =>
    ipcRenderer.invoke('test-provider', providerId, apiKey, baseUrl, model, formatType),
  createCustomProvider: (name: string, apiKey: string, baseUrl: string, defaultModel?: string, formatType?: string, models?: any[]) =>
    ipcRenderer.invoke('create-custom-provider', name, apiKey, baseUrl, defaultModel, formatType, models),
  deleteCustomProvider: (providerId: string) =>
    ipcRenderer.invoke('delete-custom-provider', providerId),
  activateProvider: (providerId: string) =>
    ipcRenderer.invoke('activate-provider', providerId),

  // 新增：更新提供商状态
  updateProviderStatus: (providerId: string, isActive: boolean) => ipcRenderer.invoke('update-provider-status', providerId, isActive),
});

// 打印预加载脚本已加载的消息
console.log('预加载脚本已加载');
