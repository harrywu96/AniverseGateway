const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 检查后端状态
  checkBackendStatus: () => ipcRenderer.invoke('check-backend-status'),
  
  // 选择视频文件
  selectVideo: () => ipcRenderer.invoke('select-video'),
  
  // 上传本地视频文件
  uploadVideo: (filePath) => ipcRenderer.invoke('upload-video', filePath),
  
  // 监听后端启动事件
  onBackendStarted: (callback) => {
    ipcRenderer.on('backend-started', callback);
    return () => ipcRenderer.removeListener('backend-started', callback);
  },
  
  // 监听后端停止事件
  onBackendStopped: (callback) => {
    const wrappedCallback = (_event, data) => callback(data);
    ipcRenderer.on('backend-stopped', wrappedCallback);
    return () => ipcRenderer.removeListener('backend-stopped', wrappedCallback);
  }
}); 