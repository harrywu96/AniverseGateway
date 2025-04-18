import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 检查后端状态
  checkBackendStatus: () => ipcRenderer.invoke('check-backend-status'),
  
  // 选择视频文件
  selectVideo: () => ipcRenderer.invoke('select-video'),
  
  // 上传本地视频文件
  uploadVideo: (filePath: string) => ipcRenderer.invoke('upload-video', filePath),
  
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
  validateModel: (modelPath: string) => ipcRenderer.invoke('validate-model', modelPath)
}); 