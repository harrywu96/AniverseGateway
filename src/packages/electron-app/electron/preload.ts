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
  }
}); 