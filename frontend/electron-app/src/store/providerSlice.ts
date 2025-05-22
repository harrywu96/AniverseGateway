import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 定义 Provider 模型接口，参考 CHERRY_STUDIO_API_KEY_SAVE_PLAN.md
export interface AIModel {
  id: string;
  name: string;
  isDefault?: boolean;
  description?: string;
  provider_id: string; // Added to match shared/types.ts for compatibility
  capabilities?: string[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  message_limit_enabled?: boolean;
  // 根据需要添加其他模型属性，例如 context_length, max_tokens 等
}

export interface Provider {
  id: string; // 通常是唯一的标识符，例如 'openai', 'azure_openai', 'custom-xxxx'
  name: string; // 用户友好的名称，例如 'OpenAI', 'Azure OpenAI Service'
  apiKey: string;
  apiHost?: string; // 例如 OpenAI 的 base URL, Azure 的 endpoint
  models: AIModel[];
  is_active: boolean; // Renamed from enabled, matches shared/types.ts and existing logic
  isSystem: boolean; // 是否为系统预置 Provider (不可删除)
  description?: string; // Added from shared/types.ts
  logo_url?: string; // Added from shared/types.ts
  model_count: number; // Added from shared/types.ts, ensure this is populated or calculated
  is_configured?: boolean; // Added to match expected prop types in child components
  // 根据需要添加其他特定于提供商的属性
  // 例如：deploymentName (for Azure), apiVersion, etc.
}

// 定义 llmSlice (或 providerSlice) 的状态结构
export interface ProviderState {
  providers: Provider[];
  currentProviderId: string | null; // 当前选中的 Provider ID
  currentModelId: string | null;    // 当前选中的 Model ID
  // defaultProviderId: string | null; // 可以考虑用于存储默认Provider的ID
}

// 初始状态
const initialState: ProviderState = {
  providers: [], // 初始为空，可以通过API加载或由用户添加
  currentProviderId: null,
  currentModelId: null,
};

const providerSlice = createSlice({
  name: 'provider', // slice 的名称，用于 Redux DevTools 等
  initialState,
  reducers: {
    setProviders: (state, action: PayloadAction<Provider[]>) => {
      state.providers = action.payload;
      // 可选：如果当前选中的 provider 不在新的列表中，则清空选择
      if (state.currentProviderId && !action.payload.find(p => p.id === state.currentProviderId)) {
        state.currentProviderId = null;
        state.currentModelId = null;
      }
    },
    addProvider: (state, action: PayloadAction<Provider>) => {
      // 避免添加重复 ID 的 Provider
      if (!state.providers.find(p => p.id === action.payload.id)) {
        state.providers.push(action.payload);
      }
    },
    // 更新 Provider，action.payload 应包含 id 及需要更新的字段
    updateProvider: (state, action: PayloadAction<Partial<Provider> & { id: string }>) => {
      const index = state.providers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.providers[index] = { ...state.providers[index], ...action.payload };
      }
    },
    removeProvider: (state, action: PayloadAction<string>) => { // payload 为 Provider ID
      state.providers = state.providers.filter(p => p.id !== action.payload);
      // 如果移除了当前选中的 Provider，则清空选择
      if (state.currentProviderId === action.payload) {
        state.currentProviderId = null;
        state.currentModelId = null;
      }
    },
    setCurrentProviderId: (state, action: PayloadAction<string | null>) => {
      state.currentProviderId = action.payload;
      // 当 Provider 切换时，清空已选模型，或根据新 Provider 设置默认模型
      state.currentModelId = null; 
      if (action.payload) {
        const provider = state.providers.find(p => p.id === action.payload);
        const defaultModel = provider?.models.find(m => m.isDefault);
        if (defaultModel) {
          state.currentModelId = defaultModel.id;
        } else if (provider?.models.length) {
          // state.currentModelId = provider.models[0].id; // 或者选择第一个
        }
      }
    },
    setCurrentModelId: (state, action: PayloadAction<string | null>) => {
      state.currentModelId = action.payload;
    },
    // Renamed from toggleProviderEnabled to reflect the change from 'enabled' to 'is_active'
    // The actual update to is_active will likely be part of updateProvider or a dedicated IPC call handled elsewhere
    // For now, the action that directly maps to is_active field update, assuming it's direct from UI:
    setProviderActiveStatus: (state, action: PayloadAction<{ id: string; is_active: boolean }>) => {
      const provider = state.providers.find(p => p.id === action.payload.id);
      if (provider) {
        provider.is_active = action.payload.is_active;
      }
    },
  },
});

// 导出 actions
export const {
  setProviders,
  addProvider,
  updateProvider,
  removeProvider,
  setCurrentProviderId,
  setCurrentModelId,
  setProviderActiveStatus,
} = providerSlice.actions;

// 导出 reducer
export default providerSlice.reducer; 