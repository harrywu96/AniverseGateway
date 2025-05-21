import { API_PATHS, DEFAULT_API_BASE_URL, ApiResponse, AIProvider, AIModel } from '@subtranslate/shared';
import '../electron.d.ts';

interface ProviderDetails {
  id: string;
  name: string;
  base_url?: string;
  api_key?: string; // 通常会被掩码
  default_model?: string;
  format_type?: string;
}

/**
 * 获取所有AI服务提供商
 * @returns 提供商列表
 */
export async function getProviders(): Promise<ApiResponse<{ providers: AIProvider[], current_provider: string }>> {
  try {
    // 使用后端API获取提供商列表，无论是否在Electron环境中
    const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}`);
    if (!response.ok) {
      throw new Error(`获取提供商列表失败: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取提供商列表出错:', error);
    throw error;
  }
}

/**
 * 获取指定提供商的模型列表
 * @param providerId 提供商ID
 * @returns 模型列表
 */
export async function getProviderModels(providerId: string): Promise<ApiResponse<{ provider: string, models: AIModel[] }>> {
  try {
    // 使用Electron IPC接口获取模型列表
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getProviderModels(providerId);
        return {
          success: result.success,
          message: '获取模型列表成功',
          data: {
            provider: providerId,
            models: result.models || []
          }
        };
      } catch (electronError) {
        console.error(`通过Electron获取提供商 ${providerId} 的模型列表出错:`, electronError);
        // 如果Electron接口失败，尝试使用后端API
      }
    }

    // 使用后端API获取模型列表
    const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.MODELS(providerId)}`);
    if (!response.ok) {
      throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`获取提供商 ${providerId} 的模型列表出错:`, error);
    throw error;
  }
}

/**
 * 测试提供商连接
 * @param providerId 提供商ID
 * @param apiKey API密钥
 * @param baseUrl 可选的API基础URL
 * @param model 可选的模型ID
 * @param formatType 可选的API格式类型
 * @returns 测试结果
 */
export async function testProvider(
  providerId: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
  formatType?: string
): Promise<ApiResponse<{
  success: boolean,
  message: string,
  models_tested?: Array<{
    model_id: string,
    success: boolean,
    message: string,
    response_time: number,
    response_data?: any
  }>
}>> {
  try {
    // 使用Electron IPC接口测试提供商连接
    if (window.electronAPI) {
      const result = await window.electronAPI.testProvider(providerId, apiKey, baseUrl, model, formatType);
      return {
        success: true,
        message: result.message || '测试连接成功',
        data: result.data || { success: result.success }
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerId,
          api_key: apiKey,
          base_url: baseUrl,
          model: model,
          format_type: formatType
        }),
      });

      if (!response.ok) {
        throw new Error(`测试提供商连接失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('测试提供商连接出错:', error);
    throw error;
  }
}

/**
 * 更新提供商配置
 * @param providerId 提供商ID
 * @param apiKey API密钥
 * @param defaultModel 默认模型
 * @param baseUrl 可选的API基础URL
 * @returns 更新结果
 */
export async function updateProvider(
  providerId: string,
  apiKey: string,
  defaultModel: string,
  baseUrl?: string
): Promise<ApiResponse<any>> {
  try {
    // 使用Electron IPC接口更新提供商配置
    if (window.electronAPI) {
      const result = await window.electronAPI.updateProvider(providerId, apiKey, defaultModel, baseUrl);
      return {
        success: result.success,
        message: result.message || '更新提供商配置成功',
        data: result
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerId,
          api_key: apiKey,
          default_model: defaultModel,
          base_url: baseUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`更新提供商配置失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('更新提供商配置出错:', error);
    throw error;
  }
}

/**
 * 创建自定义提供商
 * @param name 提供商名称
 * @param apiKey API密钥
 * @param baseUrl API基础URL
 * @param defaultModel 默认模型ID
 * @param formatType API格式类型
 * @param models 模型列表
 * @returns 创建结果
 */
export async function createCustomProvider(
  name: string,
  apiKey: string,
  baseUrl: string,
  defaultModel: string,
  formatType: string = 'openai',
  models: any[] = []
): Promise<ApiResponse<any>> {
  try {
    // 使用Electron IPC接口创建自定义提供商
    if (window.electronAPI) {
      // 由于Electron接口只接受5个参数，我们不能直接传递models
      const result = await window.electronAPI.createCustomProvider(name, apiKey, baseUrl, defaultModel, formatType);
      return {
        success: result.success,
        message: result.message || '创建自定义提供商成功',
        data: result
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          api_key: apiKey,
          base_url: baseUrl,
          default_model: defaultModel,
          format_type: formatType,
          models,
        }),
      });

      if (!response.ok) {
        throw new Error(`创建自定义提供商失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('创建自定义提供商出错:', error);
    throw error;
  }
}

/**
 * 创建自定义模型
 * @param providerId 提供商ID
 * @param modelId 模型ID
 * @param modelName 模型名称
 * @param contextWindow 上下文窗口大小
 * @param capabilities 模型能力
 * @returns 创建结果
 */
export async function createCustomModel(
  providerId: string,
  modelId: string,
  modelName: string,
  contextWindow: number = 4096,
  capabilities: string[] = ['chat']
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: providerId,
        id: modelId,
        name: modelName,
        context_window: contextWindow,
        capabilities,
      }),
    });

    if (!response.ok) {
      throw new Error(`创建自定义模型失败: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('创建自定义模型出错:', error);
    throw error;
  }
}

/**
 * 删除自定义模型
 * @param providerId 提供商ID
 * @param modelId 模型ID
 * @returns 删除结果
 */
export async function deleteCustomModel(
  providerId: string,
  modelId: string
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/models`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: providerId,
        model_id: modelId,
      }),
    });

    if (!response.ok) {
      throw new Error(`删除自定义模型失败: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('删除自定义模型出错:', error);
    throw error;
  }
}

/**
 * 获取所有自定义提供商
 * @returns 自定义提供商列表
 */
export async function getCustomProviders(): Promise<ApiResponse<{
  providers: Array<{
    id: string;
    name: string;
    base_url: string;
    api_key: string;
    model: string;
    format_type: string;
    model_count: number;
    is_active: boolean;
  }>;
  active_provider: string | null;
}>> {
  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/custom/list`);
    if (!response.ok) {
      throw new Error(`获取自定义提供商列表失败: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取自定义提供商列表出错:', error);
    throw error;
  }
}

/**
 * 激活自定义提供商
 * @param providerId 提供商ID
 * @returns 激活结果
 */
export async function activateCustomProvider(providerId: string): Promise<ApiResponse<any>> {
  try {
    // 使用Electron IPC接口激活提供商
    if (window.electronAPI) {
      const result = await window.electronAPI.activateProvider(providerId);
      return {
        success: result.success,
        message: result.message || '激活提供商成功',
        data: result
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/custom/${providerId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`激活自定义提供商失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('激活自定义提供商出错:', error);
    throw error;
  }
}

/**
 * 删除自定义提供商
 * @param providerId 提供商ID
 * @returns 删除结果
 */
export async function deleteCustomProvider(providerId: string): Promise<ApiResponse<any>> {
  try {
    // 使用Electron IPC接口删除自定义提供商
    if (window.electronAPI) {
      const result = await window.electronAPI.deleteCustomProvider(providerId);
      return {
        success: result.success,
        message: result.message || '删除自定义提供商成功',
        data: result
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/custom/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`删除自定义提供商失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('删除自定义提供商出错:', error);
    throw error;
  }
}

/**
 * 获取提供商详细信息
 * @param providerId 提供商ID
 * @returns 提供商详细信息
 */
export async function getProviderDetails(providerId: string): Promise<ApiResponse<ProviderDetails>> {
  try {
    // 使用Electron IPC接口获取提供商详情
    if (window.electronAPI) {
      const result = await window.electronAPI.getProviderDetails(providerId);
      return {
        success: result.success,
        message: result.message || '获取提供商详细信息成功',
        data: result.data
      };
    } else {
      // 如果不在Electron环境中，使用原来的API调用
      // 如果是自定义提供商，直接使用自定义提供商列表端点
      if (providerId.startsWith('custom-')) {
        try {
          // 先尝试使用自定义提供商列表端点
          const customResponse = await getCustomProviders();
          if (customResponse.success && customResponse.data) {
            const realProviderId = providerId.substring(7); // 去除'custom-'前缀
            const provider = customResponse.data.providers.find(p => p.id === realProviderId);
            console.log('自定义提供商列表:', customResponse.data.providers);
            if (provider) {
              return {
                success: true,
                message: '获取提供商详细信息成功',
                data: {
                  id: providerId,
                  name: provider.name,
                  base_url: provider.base_url,
                  api_key: provider.api_key, // 通常会被掩码
                  default_model: provider.model,
                  format_type: provider.format_type
                }
              };
            }
          }
        } catch (customError) {
          console.error(`使用自定义提供商列表端点获取详细信息失败:`, customError);
          // 如果失败，继续尝试使用通用端点
        }
      }

      // 对于所有提供商（包括自定义提供商），使用通用的API端点
      const url = `${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}/${providerId}`;
      const response = await fetch(url);

      if (!response.ok) {
        // 如果是自定义提供商且获取失败，再次尝试使用自定义提供商列表端点
        if (providerId.startsWith('custom-')) {
          const customResponse = await getCustomProviders();
          if (customResponse.success && customResponse.data) {
            const realProviderId = providerId.substring(7); // 去除'custom-'前缀
            const provider = customResponse.data.providers.find(p => p.id === realProviderId);

            if (provider) {
              return {
                success: true,
                message: '获取提供商详细信息成功',
                data: {
                  id: providerId,
                  name: provider.name,
                  base_url: provider.base_url,
                  api_key: provider.api_key, // 通常会被掩码
                  default_model: provider.model,
                  format_type: provider.format_type
                }
              };
            }
          }
        }

        throw new Error(`获取提供商详细信息失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error(`获取提供商详细信息出错:`, error);
    throw error;
  }
}

/**
 * 获取本地模型列表
 */
export async function getLocalModels() {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/models/local`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取本地模型列表失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取本地模型列表失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      data: { models: [] }
    };
  }
}

/**
 * 测试本地模型连接
 */
export async function testLocalModel(serviceUrl: string, modelName?: string) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/models/local/test`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_url: serviceUrl,
        model: modelName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`测试本地模型连接失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('测试本地模型连接失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 保存本地模型配置
 */
export async function saveLocalModel(modelConfig: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/models/local`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modelConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`保存本地模型配置失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('保存本地模型配置失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 获取Ollama配置
 */
export async function getOllamaConfig() {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/config/ollama`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取Ollama配置失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取Ollama配置失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
}

/**
 * 保存Ollama配置
 */
export async function saveOllamaConfig(config: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/config/ollama`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`保存Ollama配置失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('保存Ollama配置失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 翻译单行字幕
 */
export async function translateSubtitleLine(request: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/line`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('翻译单行字幕失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 翻译字幕文件
 */
export async function translateSubtitleFile(request: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/file`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('翻译字幕文件失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 获取所有模型列表
 */
export async function getAllModels() {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/models`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取模型列表失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取模型列表失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      data: { models: [] }
    };
  }
}