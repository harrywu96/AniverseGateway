import { ApiResponse, VideoInfo } from '@aniversegateway/shared';

const API_BASE_URL = 'http://localhost:8000';

export interface VideoDetailResponse {
  success: boolean;
  message: string;
  data?: VideoInfo;
}

/**
 * 视频服务类
 * 负责所有视频相关的API调用
 */
export class VideoService {
  /**
   * 根据ID获取视频信息
   */
  static async getVideoById(
    videoId: string, 
    includeSubtitles: boolean = false
  ): Promise<VideoDetailResponse> {
    const url = `${API_BASE_URL}/api/videos/${videoId}?include_subtitles=${includeSubtitles}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取视频信息失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 获取所有视频列表
   */
  static async getVideoList(): Promise<ApiResponse<VideoInfo[]>> {
    const response = await fetch(`${API_BASE_URL}/api/videos`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取视频列表失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 上传本地视频文件
   */
  static async uploadLocalVideo(filePath: string): Promise<VideoDetailResponse> {
    const response = await fetch(`${API_BASE_URL}/api/videos/upload-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_path: filePath }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`上传视频失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 上传视频文件（FormData方式）
   */
  static async uploadVideo(file: File): Promise<VideoDetailResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/videos/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`上传视频失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 删除视频
   */
  static async deleteVideo(videoId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/videos/${videoId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`删除视频失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 加载本地视频文件（分析视频信息）
   */
  static async loadVideo(filePath: string, extractSubtitles: boolean = true): Promise<VideoDetailResponse> {
    const response = await fetch(`${API_BASE_URL}/api/videos/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        extract_subtitles: extractSubtitles,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`加载视频失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 通过前端ID获取视频信息
   */
  static async getVideoByFrontendId(frontendId: string): Promise<VideoDetailResponse> {
    const response = await fetch(`${API_BASE_URL}/api/videos/frontend/${frontendId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`通过前端ID获取视频失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * 清空所有视频缓存
   */
  static async clearVideoCache(): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/api/videos/clear-cache`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`清空视频缓存失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
