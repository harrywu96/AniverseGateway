import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 检查后端状态
  checkBackendStatus: () => ipcRenderer.invoke('check-backend-status'),

  // 选择视频文件
  selectVideo: () => ipcRenderer.invoke('select-video'),

  // 上传本地视频文件
  uploadVideo: (filePath: string) => ipcRenderer.invoke('upload-video', filePath),

  // 清除缓存
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // 监听后端启动事件
  onBackendStarted: (callback: () => void) => {
    ipcRenderer.on('backend-started', callback);
    return () => ipcRenderer.removeListener('backend-started', callback);
  },

  // 监听后端停止事件
  onBackendStopped: (callback: (data: { code: number }) => void) => {
    const wrappedCallback = (_event: any, data: { code: number }) => callback(data);
    ipcRenderer.on('backend-stopped', wrappedCallback);
    return () => ipcRenderer.removeListener('backend-stopped', wrappedCallback);
  },

  // 重启后端服务
  restartBackend: () => ipcRenderer.invoke('restart-backend'),

  // ==== 设置相关接口 ====
  // 获取设置
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // 保存设置
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  // 打开文件夹选择对话框
  openDirectoryDialog: (options: any) => ipcRenderer.invoke('open-directory-dialog', options),

  // 打开文件选择对话框
  openFileDialog: (options: any) => ipcRenderer.invoke('open-file-dialog', options),

  // 验证模型
  validateModel: (modelPath: string) => ipcRenderer.invoke('validate-model', modelPath),

  // ==== AI提供商相关接口 ====
  // 获取提供商列表
  getProviders: () => ipcRenderer.invoke('get-providers'),

  // 获取提供商详情
  getProviderDetails: (providerId: string) => ipcRenderer.invoke('get-provider-details', providerId),

  // 获取提供商模型列表
  getProviderModels: (providerId: string) => ipcRenderer.invoke('get-provider-models', providerId),

  // 更新提供商配置
  updateProvider: (providerId: string, apiKey: string, defaultModel: string, baseUrl?: string) =>
    ipcRenderer.invoke('update-provider', providerId, apiKey, defaultModel, baseUrl),

  // 测试提供商连接
  testProvider: (providerId: string, apiKey: string, baseUrl?: string, model?: string, formatType?: string) =>
    ipcRenderer.invoke('test-provider', providerId, apiKey, baseUrl, model, formatType),

  // 创建自定义提供商
  createCustomProvider: (name: string, apiKey: string, baseUrl: string, defaultModel?: string, formatType?: string, models?: any[]) =>
    ipcRenderer.invoke('create-custom-provider', name, apiKey, baseUrl, defaultModel, formatType, models),

  // 删除自定义提供商
  deleteCustomProvider: (providerId: string) => ipcRenderer.invoke('delete-custom-provider', providerId),

  // 激活提供商
  activateProvider: (providerId: string) => ipcRenderer.invoke('activate-provider', providerId),

  // ==== Faster Whisper 相关接口 ====
  // 加载Faster Whisper GUI配置文件
  loadFasterWhisperConfig: (configPath: string) => ipcRenderer.invoke('load-faster-whisper-config', configPath),

  // 应用Faster Whisper配置进行语音转写
  transcribeWithGUIConfig: (params: { videoPath: string, configPath: string, outputDir?: string }) =>
    ipcRenderer.invoke('transcribe-with-gui-config', params),

  // 获取Faster Whisper配置参数
  getFasterWhisperParams: (configPath: string) => ipcRenderer.invoke('get-faster-whisper-params', configPath)
});