import { contextBridge, ipcRenderer } from 'electron';
// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
    // 检查后端状态
    checkBackendStatus: function () { return ipcRenderer.invoke('check-backend-status'); },
    // 选择视频文件
    selectVideo: function () { return ipcRenderer.invoke('select-video'); },
    // 上传本地视频文件
    uploadVideo: function (filePath) { return ipcRenderer.invoke('upload-video', filePath); },
    // 监听后端启动事件
    onBackendStarted: function (callback) {
        ipcRenderer.on('backend-started', callback);
        return function () { return ipcRenderer.removeListener('backend-started', callback); };
    },
    // 监听后端停止事件
    onBackendStopped: function (callback) {
        var wrappedCallback = function (_event, data) { return callback(data); };
        ipcRenderer.on('backend-stopped', wrappedCallback);
        return function () { return ipcRenderer.removeListener('backend-stopped', wrappedCallback); };
    }
});
