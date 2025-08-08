import { TranslationProgress, TranslationResult } from './translationService';

const WS_BASE_URL = 'ws://localhost:8000';

export interface WebSocketMessage {
  type: 'progress' | 'completed' | 'error' | 'cancelled';
  message?: string;
  current?: number;
  total?: number;
  percentage?: number;
  currentItem?: string;
  estimatedTime?: number;
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
  results?: TranslationResult[];
}

export interface WebSocketCallbacks {
  onProgress?: (progress: TranslationProgress) => void;
  onCompleted?: (results: TranslationResult[]) => void;
  onError?: (error: string) => void;
  onCancelled?: (message: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * WebSocket服务类
 * 负责管理翻译进度的WebSocket连接
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketCallbacks = {};

  /**
   * 连接到翻译任务的WebSocket
   */
  connect(taskId: string, callbacks: WebSocketCallbacks): void {
    this.callbacks = callbacks;
    
    const wsUrl = `${WS_BASE_URL}/api/translate/ws/${taskId}`;
    console.log('建立WebSocket连接:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('翻译WebSocket连接已建立');
      this.callbacks.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket收到消息:', data);
        
        this.handleMessage(data);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
        this.callbacks.onError?.('消息解析失败');
      }
    };

    this.ws.onerror = (event) => {
      console.error('翻译WebSocket错误:', event);
      this.callbacks.onError?.('WebSocket连接错误');
    };

    this.ws.onclose = () => {
      console.log('翻译WebSocket连接已关闭');
      this.callbacks.onClose?.();
      this.ws = null;
    };
  }

  /**
   * 处理WebSocket消息
   */
  private handleMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'progress':
        if (this.callbacks.onProgress) {
          const progress: TranslationProgress = {
            current: data.current || 0,
            total: data.total || 0,
            percentage: data.percentage || 0,
            currentItem: data.currentItem,
            estimatedTimeRemaining: data.estimatedTime,
            model: data.model,
            preview: data.preview,
            usage: data.usage,
            totalUsage: data.totalUsage,
          };
          this.callbacks.onProgress(progress);
        }
        break;

      case 'completed':
        console.log('翻译完成消息详情:', {
          type: data.type,
          message: data.message,
          results: data.results,
          resultsLength: data.results?.length || 0,
          resultsType: typeof data.results,
          firstResult: data.results?.[0]
        });
        
        if (this.callbacks.onCompleted && data.results) {
          this.callbacks.onCompleted(data.results);
        }
        break;

      case 'error':
        this.callbacks.onError?.(data.message || '未知错误');
        break;

      case 'cancelled':
        console.log('收到后端取消确认:', data.message);
        this.callbacks.onCancelled?.(data.message || '翻译已取消');
        break;

      default:
        console.warn('未知的WebSocket消息类型:', data.type);
    }
  }

  /**
   * 关闭WebSocket连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取连接状态
   */
  getReadyState(): number | null {
    return this.ws?.readyState || null;
  }
}
