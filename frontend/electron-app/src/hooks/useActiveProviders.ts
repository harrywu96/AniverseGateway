import { useMemo } from 'react';
import { useAppSelector } from '../store/hooks';
import { Provider, AIModel } from '../store/providerSlice';

/**
 * 活跃提供商信息
 */
export interface ActiveProvider {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  models: AIModel[];
  isConfigured: boolean;
  modelCount: number;
}

/**
 * 提供商选择器选项
 */
export interface ProviderOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}

/**
 * 模型选择器选项
 */
export interface ModelOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  capabilities?: string[];
  disabled?: boolean;
}

/**
 * 提供商分组配置
 */
export interface ProviderGroup {
  id: string;
  label: string;
  providers: ActiveProvider[];
}

/**
 * Hook返回值
 */
export interface UseActiveProvidersReturn {
  // 基础数据
  activeProviders: ActiveProvider[];
  configuredProviders: ActiveProvider[];
  allProviders: Provider[];
  
  // 计数信息
  totalCount: number;
  activeCount: number;
  configuredCount: number;
  
  // 当前选择
  currentProvider: Provider | null;
  currentModel: AIModel | null;
  
  // 选择器选项
  providerOptions: ProviderOption[];
  getModelOptions: (providerId?: string) => ModelOption[];
  
  // 分组数据
  providerGroups: ProviderGroup[];
  
  // 实用方法
  getProvider: (providerId: string) => Provider | null;
  getProviderModels: (providerId: string) => AIModel[];
  isProviderActive: (providerId: string) => boolean;
  isProviderConfigured: (providerId: string) => boolean;
  hasCapability: (providerId: string, modelId: string, capability: string) => boolean;
}

/**
 * Hook选项
 */
export interface UseActiveProvidersOptions {
  /** 是否只包含已配置的提供商 */
  onlyConfigured?: boolean;
  /** 是否只包含激活的提供商 */
  onlyActive?: boolean;
  /** 排除的提供商ID列表 */
  excludeProviders?: string[];
  /** 包含的提供商ID列表（如果指定，只返回这些提供商） */
  includeProviders?: string[];
  /** 是否按名称排序 */
  sortByName?: boolean;
  /** 是否按激活状态排序（激活的在前） */
  sortByActive?: boolean;
  /** 是否启用分组 */
  enableGrouping?: boolean;
  /** 自定义分组规则 */
  customGrouping?: (provider: Provider) => string;
}

/**
 * 获取激活的翻译服务提供商Hook
 * 
 * 功能特性：
 * 1. 从Redux store获取提供商数据
 * 2. 筛选激活状态的提供商
 * 3. 提供模型选择功能
 * 4. 支持分组和排序
 * 5. 生成选择器选项
 * 6. 提供实用的查询方法
 * 
 * @param options 配置选项
 * @returns 提供商数据和操作方法
 */
export const useActiveProviders = (
  options: UseActiveProvidersOptions = {}
): UseActiveProvidersReturn => {
  const {
    onlyConfigured = false,
    onlyActive = true,
    excludeProviders = [],
    includeProviders = [],
    sortByName = true,
    sortByActive = true,
    enableGrouping = false,
    customGrouping
  } = options;

  // 从Redux store获取数据
  const providers = useAppSelector(state => state.provider.providers);
  const currentProviderId = useAppSelector(state => state.provider.currentProviderId);
  const currentModelId = useAppSelector(state => state.provider.currentModelId);

  // 筛选和处理提供商数据
  const processedData = useMemo(() => {
    let filteredProviders = [...providers];

    // 基础筛选
    if (onlyActive) {
      filteredProviders = filteredProviders.filter(p => p.is_active);
    }

    if (onlyConfigured) {
      filteredProviders = filteredProviders.filter(p => p.is_configured !== false && p.apiKey);
    }

    // 包含/排除筛选
    if (includeProviders.length > 0) {
      filteredProviders = filteredProviders.filter(p => includeProviders.includes(p.id));
    }

    if (excludeProviders.length > 0) {
      filteredProviders = filteredProviders.filter(p => !excludeProviders.includes(p.id));
    }

    // 排序
    if (sortByActive || sortByName) {
      filteredProviders.sort((a, b) => {
        // 首先按激活状态排序
        if (sortByActive) {
          const aActive = a.is_active ? 1 : 0;
          const bActive = b.is_active ? 1 : 0;
          if (aActive !== bActive) {
            return bActive - aActive; // 激活的在前
          }
        }

        // 然后按名称排序
        if (sortByName) {
          return a.name.localeCompare(b.name);
        }

        return 0;
      });
    }

    // 转换为ActiveProvider格式
    const activeProviders: ActiveProvider[] = filteredProviders.map(provider => ({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      logoUrl: provider.logo_url,
      models: provider.models,
      isConfigured: provider.is_configured !== false && !!provider.apiKey,
      modelCount: provider.model_count || provider.models.length
    }));

    // 获取已配置的提供商
    const configuredProviders = activeProviders.filter(p => p.isConfigured);

    return {
      filteredProviders,
      activeProviders,
      configuredProviders
    };
  }, [
    providers,
    onlyActive,
    onlyConfigured,
    excludeProviders,
    includeProviders,
    sortByName,
    sortByActive
  ]);

  // 当前选择的提供商和模型
  const currentProvider = useMemo(() => {
    return providers.find(p => p.id === currentProviderId) || null;
  }, [providers, currentProviderId]);

  const currentModel = useMemo(() => {
    if (!currentProvider || !currentModelId) return null;
    return currentProvider.models.find(m => m.id === currentModelId) || null;
  }, [currentProvider, currentModelId]);

  // 生成提供商选择器选项
  const providerOptions = useMemo((): ProviderOption[] => {
    return processedData.activeProviders.map(provider => ({
      value: provider.id,
      label: provider.name,
      description: provider.description,
      disabled: !provider.isConfigured,
      group: enableGrouping && customGrouping 
        ? customGrouping(providers.find(p => p.id === provider.id)!)
        : undefined
    }));
  }, [processedData.activeProviders, enableGrouping, customGrouping, providers]);

  // 生成模型选择器选项的函数
  const getModelOptions = useMemo(() => {
    return (providerId?: string): ModelOption[] => {
      const targetProviderId = providerId || currentProviderId;
      if (!targetProviderId) return [];

      const provider = providers.find(p => p.id === targetProviderId);
      if (!provider) return [];

      return provider.models.map(model => ({
        value: model.id,
        label: model.name,
        description: model.description,
        isDefault: model.isDefault,
        capabilities: model.capabilities,
        disabled: false
      }));
    };
  }, [providers, currentProviderId]);

  // 提供商分组
  const providerGroups = useMemo((): ProviderGroup[] => {
    if (!enableGrouping) return [];

    const groups = new Map<string, ActiveProvider[]>();
    
    processedData.activeProviders.forEach(provider => {
      const originalProvider = providers.find(p => p.id === provider.id);
      if (!originalProvider) return;

      const groupKey = customGrouping 
        ? customGrouping(originalProvider)
        : originalProvider.isSystem ? '系统提供商' : '自定义提供商';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(provider);
    });

    return Array.from(groups.entries()).map(([label, providers]) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      providers
    }));
  }, [processedData.activeProviders, enableGrouping, customGrouping, providers]);

  // 实用方法
  const getProvider = useMemo(() => {
    return (providerId: string): Provider | null => {
      return providers.find(p => p.id === providerId) || null;
    };
  }, [providers]);

  const getProviderModels = useMemo(() => {
    return (providerId: string): AIModel[] => {
      const provider = getProvider(providerId);
      return provider?.models || [];
    };
  }, [getProvider]);

  const isProviderActive = useMemo(() => {
    return (providerId: string): boolean => {
      const provider = getProvider(providerId);
      return provider?.is_active === true;
    };
  }, [getProvider]);

  const isProviderConfigured = useMemo(() => {
    return (providerId: string): boolean => {
      const provider = getProvider(providerId);
      return provider ? (provider.is_configured !== false && !!provider.apiKey) : false;
    };
  }, [getProvider]);

  const hasCapability = useMemo(() => {
    return (providerId: string, modelId: string, capability: string): boolean => {
      const provider = getProvider(providerId);
      if (!provider) return false;

      const model = provider.models.find(m => m.id === modelId);
      if (!model) return false;

      return model.capabilities?.includes(capability) === true;
    };
  }, [getProvider]);

  // 计数信息
  const totalCount = providers.length;
  const activeCount = processedData.activeProviders.length;
  const configuredCount = processedData.configuredProviders.length;

  return {
    // 基础数据
    activeProviders: processedData.activeProviders,
    configuredProviders: processedData.configuredProviders,
    allProviders: providers,
    
    // 计数信息
    totalCount,
    activeCount,
    configuredCount,
    
    // 当前选择
    currentProvider,
    currentModel,
    
    // 选择器选项
    providerOptions,
    getModelOptions,
    
    // 分组数据
    providerGroups,
    
    // 实用方法
    getProvider,
    getProviderModels,
    isProviderActive,
    isProviderConfigured,
    hasCapability
  };
}; 