import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VideoInfo } from '@aniversegateway/shared';

// 定义应用状态接口
interface AppState {
  videos: VideoInfo[];
  selectedVideo: VideoInfo | null;
}

// 定义上下文接口
interface AppContextType {
  state: AppState;
  addVideo: (video: VideoInfo) => void;
  selectVideo: (video: VideoInfo | null) => void;
  removeVideo: (videoId: string) => void;
  clearVideos: () => void;
}

// 创建上下文
const AppContext = createContext<AppContextType | undefined>(undefined);

// 初始状态
const initialState: AppState = {
  videos: [],
  selectedVideo: null,
};

// 提供者组件
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  // 添加视频
  const addVideo = (video: VideoInfo) => {
    setState(prevState => ({
      ...prevState,
      videos: [...prevState.videos.filter(v => v.id !== video.id), video],
    }));
  };

  // 选择视频
  const selectVideo = (video: VideoInfo | null) => {
    setState(prevState => ({
      ...prevState,
      selectedVideo: video,
    }));
  };

  // 移除视频
  const removeVideo = (videoId: string) => {
    setState(prevState => ({
      ...prevState,
      videos: prevState.videos.filter(video => video.id !== videoId),
      selectedVideo: prevState.selectedVideo?.id === videoId ? null : prevState.selectedVideo,
    }));
  };

  // 清空视频
  const clearVideos = () => {
    setState({
      videos: [],
      selectedVideo: null,
    });
  };

  // 提供上下文值
  const contextValue: AppContextType = {
    state,
    addVideo,
    selectVideo,
    removeVideo,
    clearVideos,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// 自定义钩子，用于访问上下文
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
