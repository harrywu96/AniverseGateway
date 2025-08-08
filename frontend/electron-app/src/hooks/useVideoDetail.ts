import { useState, useEffect, useCallback } from 'react';
import { VideoInfo } from '@aniversegateway/shared';
import { VideoService } from '../services/videoService';
import { useAppContext } from '../context/AppContext';

export interface VideoDetailState {
  video: VideoInfo | null;
  loading: boolean;
  error: string | null;
  selectedTrackId: string;
}

export interface UseVideoDetailOptions {
  videoId?: string;
  autoLoad?: boolean;
}

/**
 * 视频详情管理Hook
 * 
 * 功能特性：
 * 1. 管理视频信息的加载和状态
 * 2. 处理字幕轨道选择
 * 3. 集成全局状态和后端API
 * 4. 提供错误处理和重试机制
 */
export const useVideoDetail = (options: UseVideoDetailOptions = {}) => {
  const { videoId, autoLoad = true } = options;
  const { state: appState } = useAppContext();

  const [state, setState] = useState<VideoDetailState>({
    video: null,
    loading: false,
    error: null,
    selectedTrackId: ''
  });

  // 更新状态的辅助函数
  const updateState = useCallback((updates: Partial<VideoDetailState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 从全局状态查找视频
  const findVideoInGlobalState = useCallback((id: string): VideoInfo | null => {
    return appState.videos.find(v => v.id === id) || null;
  }, [appState.videos]);

  // 从后端加载视频信息
  const loadVideoFromBackend = useCallback(async (id: string): Promise<VideoInfo | null> => {
    try {
      const response = await VideoService.getVideoById(id, true);
      
      if (response.success && response.data) {
        // 转换后端数据格式为前端格式
        const backendData = response.data as any; // 临时使用any类型处理后端数据结构差异
        const videoData: VideoInfo = {
          id: backendData.id,
          fileName: backendData.filename || '',
          filePath: backendData.path || '',
          format: backendData.format || '',
          duration: backendData.duration || 0,
          hasEmbeddedSubtitles: backendData.has_embedded_subtitle || false,
          hasExternalSubtitles: backendData.external_subtitles?.length > 0 || false,
          subtitleTracks: (backendData.subtitle_tracks || []).map((track: any) => ({
            id: track.index?.toString() || track.id?.toString() || '',
            language: track.language || 'unknown',
            title: track.title || '',
            format: track.codec || track.format || 'unknown',
            isExternal: false,
            // 添加后端字段映射
            ...(track.id && { backendTrackId: track.id }),
            ...(track.index !== undefined && { backendIndex: track.index })
          }))
        };
        
        return videoData;
      }
      
      return null;
    } catch (error) {
      console.error('从后端加载视频失败:', error);
      throw error;
    }
  }, []);

  // 加载视频信息
  const loadVideo = useCallback(async (id: string) => {
    if (!id) return;

    updateState({ loading: true, error: null });

    try {
      // 首先从全局状态查找
      let video = findVideoInGlobalState(id);
      
      if (video) {
        console.log('从全局状态找到视频:', video.fileName);
        updateState({ 
          video, 
          loading: false,
          selectedTrackId: video.subtitleTracks?.[0]?.id || ''
        });
        return;
      }

      // 从后端获取
      console.log('从后端加载视频信息:', id);
      video = await loadVideoFromBackend(id);
      
      if (video) {
        updateState({ 
          video, 
          loading: false,
          selectedTrackId: video.subtitleTracks?.[0]?.id || ''
        });
      } else {
        updateState({ 
          loading: false, 
          error: '视频未找到' 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载视频失败';
      console.error('加载视频失败:', error);
      updateState({ 
        loading: false, 
        error: `加载视频失败: ${errorMessage}` 
      });
    }
  }, [findVideoInGlobalState, loadVideoFromBackend, updateState]);

  // 重新加载视频
  const reloadVideo = useCallback(() => {
    if (videoId) {
      loadVideo(videoId);
    }
  }, [videoId, loadVideo]);

  // 选择字幕轨道
  const selectTrack = useCallback((trackId: string) => {
    updateState({ selectedTrackId: trackId });
  }, [updateState]);

  // 获取当前选中的字幕轨道
  const getSelectedTrack = useCallback(() => {
    if (!state.video?.subtitleTracks || !state.selectedTrackId) {
      return null;
    }
    return state.video.subtitleTracks.find(track => track.id === state.selectedTrackId) || null;
  }, [state.video?.subtitleTracks, state.selectedTrackId]);

  // 获取字幕轨道选项
  const getTrackOptions = useCallback(() => {
    if (!state.video?.subtitleTracks) return [];
    
    return state.video.subtitleTracks.map(track => ({
      value: track.id,
      label: `${track.language || '未知语言'} - ${track.title || track.format}`,
      track: track
    }));
  }, [state.video?.subtitleTracks]);

  // 清除错误
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      video: null,
      loading: false,
      error: null,
      selectedTrackId: ''
    });
  }, []);

  // 自动加载视频
  useEffect(() => {
    if (autoLoad && videoId) {
      loadVideo(videoId);
    }
  }, [autoLoad, videoId, loadVideo]);

  // 监听全局状态变化，自动更新视频信息
  useEffect(() => {
    if (videoId && !state.loading) {
      const globalVideo = findVideoInGlobalState(videoId);
      if (globalVideo && (!state.video || state.video.id !== globalVideo.id)) {
        updateState({ 
          video: globalVideo,
          selectedTrackId: state.selectedTrackId || globalVideo.subtitleTracks?.[0]?.id || ''
        });
      }
    }
  }, [videoId, appState.videos, state.loading, state.video, state.selectedTrackId, findVideoInGlobalState, updateState]);

  return {
    // 状态
    ...state,
    
    // 计算属性
    selectedTrack: getSelectedTrack(),
    trackOptions: getTrackOptions(),
    hasSubtitleTracks: (state.video?.subtitleTracks?.length || 0) > 0,
    
    // 操作方法
    loadVideo,
    reloadVideo,
    selectTrack,
    clearError,
    resetState,
    
    // 状态检查
    isLoading: state.loading,
    hasError: !!state.error,
    hasVideo: !!state.video,
  };
};
