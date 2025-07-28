import { API_PATHS, DEFAULT_API_BASE_URL, ApiResponse, AIProvider, AIModel } from '@aniversegateway/shared';
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
    if (window.electronAPI && typeof window.electronAPI.getProviders === 'function') {
      console.log('Fetching providers via Electron IPC (direct method call)...');
      const ipcResponse = await window.electronAPI.getProviders();
      // main/index.ts的getProviderList返回的是 { providers, current_provider }
      // 这直接符合 ApiResponse.data 的期望结构
      if (ipcResponse && typeof ipcResponse.providers !== 'undefined' && typeof ipcResponse.current_provider !== 'undefined') {
        console.log('Successfully fetched providers via IPC (direct method call):', ipcResponse);
        return {
          success: true,
          message: '获取提供商列表成功 (from IPC)',
          data: ipcResponse, // ipcResponse 已经是 { providers: AIProvider[], current_provider: string } 格式
        };
      } else {
        // IPC 调用成功但返回数据格式不符合预期
        console.error('IPC getProviders returned unexpected data format:', ipcResponse);
        // 可以选择抛出错误或回退到HTTP
        // 为了明确问题，这里先抛出错误
        throw new Error('IPC getProviders 返回数据格式不正确');
      }
    } else {
      // Fallback to HTTP if not in Electron or getProviders is not available
      console.log('Electron API or getProviders method not available, fetching providers via HTTP...');
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.PROVIDERS}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('获取提供商列表失败 (HTTP):', response.status, response.statusText, errorText);
        throw new Error(`获取提供商列表失败 (HTTP): ${response.status} ${response.statusText} - ${errorText}`);
      }
      const httpData = await response.json();
      console.log('Successfully fetched providers via HTTP:', httpData);
      return httpData; // 假设HTTP API直接返回 ApiResponse 结构
    }
  } catch (error) {
    console.error('获取提供商列表出错 (getProviders function):', error);
    // 确保返回 ApiResponse 格式的错误
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取提供商列表时发生未知错误',
      data: { providers: [], current_provider: '' }, // 提供一个默认的data结构
    };
  }
}

/**
 * 获取指定提供商的模型列表
 * @param providerId 提供商ID
 * @returns 模型列表
 */
export async function getProviderModels(providerId: string): Promise<ApiResponse<{ provider: string, models: AIModel[] }>> {
  try {
    let rawModels: any[] = [];
    let source: string = '';

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getProviderModels(providerId);
        if (result.success) {
          rawModels = result.models || [];
          source = 'ipc';
        } else {
          // 如果IPC调用明确失败但未抛出错误，则记录并准备回退
          const ipcMessage = (result as any).message || 'IPC getProviderModels failed without a specific message';
          console.warn(`IPC getProviderModels for ${providerId} reported failure: ${ipcMessage}. Falling back to HTTP.`);
        }
      } catch (electronError) {
        console.error(`通过Electron获取提供商 ${providerId} 的模型列表出错:`, electronError);
        // 如果Electron接口失败，尝试使用后端API
      }
    }

    // 如果IPC未成功获取模型 (source不是ipc，或者 rawModels仍为空数组)
    if (source !== 'ipc') {
      console.log(`Fetching provider models for ${providerId} via HTTP API.`);
      const response = await fetch(`${DEFAULT_API_BASE_URL}${API_PATHS.MODELS(providerId)}`);
      if (!response.ok) {
        throw new Error(`获取模型列表失败 (HTTP): ${response.status} ${response.statusText}`);
      }
      const jsonResponse = await response.json();
      if (jsonResponse.success && jsonResponse.data) {
        rawModels = jsonResponse.data.models || [];
        source = 'http';
      } else {
        throw new Error(`获取模型列表失败 (HTTP API Error): ${jsonResponse.message || 'Unknown API error'}`);
      }
    }

    // 统一转换模型结构，确保包含 provider_id
    const transformedModels: AIModel[] = rawModels.map(model => ({
      ...model,
      provider_id: model.provider || providerId, // 使用 model.provider, 如果没有则回退到函数参数 providerId
      // capabilities: model.capabilities || [], // 确保 capabilities 总是数组
      // is_default: model.is_default || false, // 确保 is_default 存在
    }));

    return {
      success: true,
      message: `获取模型列表成功 (from ${source || 'unknown'})`,
      data: {
        provider: providerId,
        models: transformedModels
      }
    };

  } catch (error) {
    console.error(`获取提供商 ${providerId} 的模型列表出错:`, error);
    // 重新抛出错误或返回一个标准的错误响应
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: {
        provider: providerId,
        models: []
      }
    } as ApiResponse<{ provider: string, models: AIModel[] }>;
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
 * @param modelParams 可选的模型参数
 * @returns 更新结果
 */
export async function updateProvider(
  providerId: string,
  apiKey: string,
  defaultModel: string,
  baseUrl?: string,
  modelParams?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    message_limit_enabled?: boolean;
  }
): Promise<ApiResponse<any>> {
  try {
    // 使用Electron IPC接口更新提供商配置
    if (window.electronAPI) {
      const result = await window.electronAPI.updateProvider(
        providerId,
        apiKey,
        defaultModel,
        baseUrl,
        modelParams
      );
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
          model_params: modelParams
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
      // 传递所有参数，包括models
      const result = await window.electronAPI.createCustomProvider(name, apiKey, baseUrl, defaultModel, formatType, models);
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
 * 翻译单行字幕 - 使用v2接口解决422错误
 */
export async function translateSubtitleLine(request: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/line-v2`;

    // 确保请求中包含服务类型
    const requestWithServiceType = {
      ...request,
      service_type: request.service_type || 'network_provider'
    };

    console.log('调用v2单行翻译接口:', url, requestWithServiceType);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestWithServiceType)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('v2单行翻译接口错误:', response.status, errorText);
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('v2单行翻译接口响应:', result);
    return result;
  } catch (error) {
    console.error('翻译单行字幕失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试视频字幕翻译请求
 */
export async function testVideoSubtitleRequest(request: any) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/video-subtitle-test`;

    console.log('发送测试请求:', request);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`测试请求失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('测试请求失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 翻译视频字幕轨道 - 使用v2接口解决422错误
 */
export async function translateVideoSubtitle(request: {
  video_id: string;
  track_index: number;
  source_language: string;
  target_language: string;
  style: string;
  provider_config: any;
  model_id: string;
  chunk_size?: number;
  context_window?: number;
  context_preservation?: boolean;
  preserve_formatting?: boolean;
}) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/video-subtitle-v2`;

    console.log('发送v2翻译请求:', url, request);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)  // 直接发送request，不包装在{ request }中
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('v2视频字幕翻译接口错误:', response.status, errorText);
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('v2视频字幕翻译接口响应:', result);
    return result;
  } catch (error) {
    console.error('翻译视频字幕失败:', error);
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

/**
 * 更新提供商的活跃状态
 * @param providerId 提供商ID
 * @param isActive 是否活跃
 * @returns 更新结果
 */
export const updateProviderActiveStatus = async (providerId: string, isActive: boolean): Promise<ApiResponse<null>> => {
  try {
    if (window.electronAPI) {
      const result = await window.electronAPI.updateProviderStatus(providerId, isActive);
      if (result && typeof result.success === 'boolean') {
        return result as ApiResponse<null>;
      }
      return { success: false, message: result?.message || 'IPC call to update-provider-status returned unexpected structure or failed' };
    } else {
      console.warn('updateProviderActiveStatus: Not in Electron context or IPC not available.');
      return { success: false, message: '无法更新提供商状态：非Electron环境且无HTTP回退实现' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新提供商状态时发生未知错误';
    console.error('updateProviderActiveStatus error:', error);
    return { success: false, message };
  }
};