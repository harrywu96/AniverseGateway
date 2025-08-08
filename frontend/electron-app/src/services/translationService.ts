import { ApiResponse } from '@aniversegateway/shared';

const API_BASE_URL = 'http://localhost:8000';

export interface TranslationResult {
  original: string;
  translated: string;
  startTime: number;
  endTime: number;
  confidence?: number;
  edited?: boolean;
}

export interface TranslationProgress {
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
  model?: string;
  preview?: Array<{
    original: string;
    translated: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    display_note?: string;
  };
  totalUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    display_note?: string;
  };
}

export interface TranslationRequest {
  video_id: string;
  track_index: number;
  source_language: string;
  target_language: string;
  style: string;
  provider_config: {
    id: string;
    apiKey: string;
    apiHost?: string;
  };
  model_id: string;
  chunk_size?: number;
  context_window?: number;
  context_preservation?: boolean;
  preserve_formatting?: boolean;
}

export interface LoadTranslationRequest {
  videoId: string;
  targetLanguage: string;
}

export interface SaveTranslationRequest {
  videoId: string;
  results: TranslationResult[];
  targetLanguage: string;
  fileName: string;
  edited?: boolean;
  isRealTranslation?: boolean;
}

export interface DeleteTranslationRequest {
  videoId: string;
  targetLanguage: string;
}

export interface ClearTranslationRequest {
  videoId: string;
  targetLanguage: string;
}

/**
 * 翻译服务类
 * 负责所有翻译相关的API调用
 */
export class TranslationService {
  /**
   * 开始翻译视频字幕
   */
  static async startTranslation(request: TranslationRequest): Promise<ApiResponse<{ task_id: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/video-subtitle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`翻译请求失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 取消翻译任务
   */
  static async cancelTranslation(taskId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/cancel/${taskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`取消翻译失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 加载保存的翻译结果
   */
  static async loadTranslation(request: LoadTranslationRequest): Promise<ApiResponse<{ results: TranslationResult[]; isRealTranslation?: boolean }>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`加载翻译结果失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 保存翻译结果
   */
  static async saveTranslation(request: SaveTranslationRequest): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`保存翻译结果失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 删除翻译结果
   */
  static async deleteTranslation(request: DeleteTranslationRequest): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`删除翻译结果失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 清空翻译数据
   */
  static async clearTranslation(request: ClearTranslationRequest): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/translate/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`清空翻译数据失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
