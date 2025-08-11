import { configureStore, combineReducers } from '@reduxjs/toolkit';

import providerReducer from './providerSlice';
// 如果将来有其他 slices，可以在这里导入
// import settingsSlice from './settingsSlice';

const rootReducer = combineReducers({
  provider: providerReducer,
  // settings: settingsSlice, // 添加其他 reducers
});

// 配置同步中间件：监听配置相关的action并同步到文件
const configSyncMiddleware = (store: any) => (next: any) => (action: any) => {
  const result = next(action);

  // 监听provider相关的action
  if (action.type.startsWith('provider/')) {
    const state = store.getState();
    // 异步同步到Electron文件，避免阻塞UI
    setTimeout(() => {
      syncConfigToElectron(state);
    }, 0);
  }

  return result;
};

// 同步配置到Electron文件的函数
async function syncConfigToElectron(state: any) {
  try {
    if (window.electronAPI && window.electronAPI.syncConfigToFiles) {
      await window.electronAPI.syncConfigToFiles({
        providers: state.provider.providers,
        currentProviderId: state.provider.currentProviderId,
        currentModelId: state.provider.currentModelId,
      });
      console.log('配置已同步到文件');
    }
  } catch (error) {
    console.error('同步配置到文件失败:', error);
  }
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 保持基本的序列化检查
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
      },
    }).concat(configSyncMiddleware), // 添加配置同步中间件
  devTools: process.env.NODE_ENV !== 'production', // 开发环境中启用 DevTools
});

// 从 store 本身推断出 `RootState` 和 `AppDispatch` 类型
export type RootState = ReturnType<typeof store.getState>;
// 推断类型：{provider: ProviderState, ...}
export type AppDispatch = typeof store.dispatch; 