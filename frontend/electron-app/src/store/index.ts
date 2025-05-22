import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // 默认为 localStorage

import providerReducer from './providerSlice';
// 如果将来有其他 slices，可以在这里导入
// import otherSliceReducer from './otherSlice';

const rootReducer = combineReducers({
  provider: providerReducer,
  // other: otherSliceReducer, // 添加其他 reducers
});

const persistConfig = {
  key: 'subtranslate-app', // 修改key以匹配项目的实际名称
  storage,                // 使用的存储引擎 (localStorage)
  version: 1,            // 版本号，用于迁移 (如果需要)
  whitelist: ['provider'], // 只持久化 provider slice 的状态，其他 slice 如果有则不会被持久化
  // blacklist: [], // 如果 whitelist 未定义，可以使用 blacklist 来排除某些 slice
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略 redux-persist 的特定 actions，这些 actions 可能包含非序列化值
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production', // 开发环境中启用 DevTools
});

export const persistor = persistStore(store);

// 从 store 本身推断出 `RootState` 和 `AppDispatch` 类型
export type RootState = ReturnType<typeof store.getState>;
// 推断类型：{provider: ProviderState, ...}
export type AppDispatch = typeof store.dispatch; 