/**
 * 提供模拟的Electron API实现，用于在浏览器环境中调试
 */

// 确保window.electronAPI始终存在
if (typeof window !== 'undefined') {
  // 如果电子API不存在，创建一个模拟实现
  if (!window.electronAPI) {
    console.log('初始化模拟的Electron API');
    window.electronAPI = {
      // 检查后端状态
      checkBackendStatus: async () => {
        console.log('模拟: 检查后端状态');
        return true;
      },
      
      // 选择视频文件
      selectVideo: async () => {
        console.log('模拟: 选择视频文件');
        return null;
      },
      
      // 上传本地视频文件
      uploadVideo: async (filePath) => {
        console.log('模拟: 上传视频文件', filePath);
        return { success: true };
      },
      
      // 监听后端启动事件
      onBackendStarted: (callback) => {
        console.log('模拟: 注册后端启动事件监听');
        // 模拟3秒后启动
        setTimeout(callback, 3000);
        return () => {
          console.log('模拟: 移除后端启动事件监听');
        };
      },
      
      // 监听后端停止事件
      onBackendStopped: (callback) => {
        console.log('模拟: 注册后端停止事件监听');
        return () => {
          console.log('模拟: 移除后端停止事件监听');
        };
      }
    };
  }
}

export {};
