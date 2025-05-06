/**
 * 提供模拟的Electron API实现，用于在浏览器环境中调试
 */

// 确保window.electronAPI始终存在
if (typeof window !== 'undefined') {
  // 如果电子API不存在，创建一个模拟实现
  if (!window.electronAPI) {
    console.log('初始化模拟的Electron API (非Electron环境)');
    window.electronAPI = {
      // 检查后端状态
      checkBackendStatus: async () => {
        console.log('模拟: 检查后端状态');
        try {
          // 尝试连接真实的后端
          const response = await fetch('http://127.0.0.1:8000/api/health');
          if (response.ok) {
            console.log('模拟: 检测到真实后端服务');
            return true;
          }
        } catch (error) {
          console.log('模拟: 无法连接到真实后端，使用模拟数据');
        }
        return true; // 默认返回true，保持原有行为
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
      },

      // 获取设置
      getSettings: async () => {
        console.log('模拟: 获取设置');
        return {};
      },

      // 保存设置
      saveSettings: async (settings) => {
        console.log('模拟: 保存设置', settings);
        return { success: true };
      },

      // ==== AI提供商相关接口 ====
      // 获取提供商列表
      getProviders: async () => {
        console.log('模拟: 获取提供商列表');
        return {
          providers: [
            {
              id: 'siliconflow',
              name: 'SiliconFlow',
              is_active: true,
              is_configured: true,
              model_count: 2
            }
          ],
          current_provider: 'siliconflow'
        };
      },

      // 获取提供商详情
      getProviderDetails: async (providerId) => {
        console.log('模拟: 获取提供商详情', providerId);
        return {
          success: true,
          data: {
            id: providerId,
            name: providerId === 'siliconflow' ? 'SiliconFlow' : '自定义提供商',
            base_url: 'https://api.example.com/v1',
            api_key: '********',
            default_model: 'default-model'
          }
        };
      },

      // 获取提供商模型列表
      getProviderModels: async (providerId) => {
        console.log('模拟: 获取提供商模型列表', providerId);
        return {
          success: true,
          models: [
            {
              id: 'model-1',
              name: 'Model 1',
              context_window: 4096,
              capabilities: ['chat'],
              is_default: true
            },
            {
              id: 'model-2',
              name: 'Model 2',
              context_window: 8192,
              capabilities: ['chat'],
              is_default: false
            }
          ]
        };
      },

      // 更新提供商配置
      updateProvider: async (providerId, apiKey, defaultModel, baseUrl) => {
        console.log('模拟: 更新提供商配置', { providerId, apiKey, defaultModel, baseUrl });
        return { success: true };
      },

      // 测试提供商连接
      testProvider: async (providerId, apiKey, baseUrl, model, formatType) => {
        console.log('模拟: 测试提供商连接', { providerId, apiKey, baseUrl, model, formatType });
        return { success: true, message: '连接成功' };
      },

      // 创建自定义提供商
      createCustomProvider: async (name, apiKey, baseUrl, defaultModel, formatType) => {
        console.log('模拟: 创建自定义提供商', { name, apiKey, baseUrl, defaultModel, formatType });
        return { success: true, provider_id: 'custom-' + Date.now() };
      },

      // 删除自定义提供商
      deleteCustomProvider: async (providerId) => {
        console.log('模拟: 删除自定义提供商', providerId);
        return { success: true };
      },

      // 激活提供商
      activateProvider: async (providerId) => {
        console.log('模拟: 激活提供商', providerId);
        return { success: true };
      }
    };
  }
}

export {};
