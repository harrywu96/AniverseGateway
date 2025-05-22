# API Key Management & Persistence Refactor Plan (Redux Integration)

Based on `CHERRY_STUDIO_API_KEY_SAVE_PLAN.md`.

## Implementation Checklist and Progress

**Overall Status**: In Progress

**Key for Status:**
*   `[X]` = 已完成 (Completed)
*   `[P]` = 部分完成 / 进行中 (Partially Completed / In Progress)
*   `[ ]` = 未开始 (Not Started)

---

### 阶段 1: Redux 基础结构搭建

*   `[X]` 1. **安装依赖库**:
    *   在 `frontend/electron-app/package.json` 中添加 `@reduxjs/toolkit`, `react-redux`, `redux-persist`。
    *   用户已确认执行 `pnpm install`。
*   `[X]` 2. **创建目录**: `frontend/electron-app/src/store`。
*   `[X]` 3. **创建 `providerSlice.ts`**:
    *   文件路径: `frontend/electron-app/src/store/providerSlice.ts`
    *   包含 `Provider` 接口, `ProviderState`, `initialState`, 以及核心 reducers (`setProviders`, `addProvider`, `updateProvider`, `removeProvider`, `setCurrentProviderId`, `setCurrentModelId`, `setProviderActiveStatus`)。
    *   已根据 `shared/types.ts` 和子组件需求调整接口（如添加 `is_configured`, `provider_id` 到 `AIModel` 等）。
*   `[X]` 4. **创建 `store.ts` (或 `index.ts` in store directory)**:
    *   文件路径: `frontend/electron-app/src/store/index.ts`
    *   配置 Redux store，集成 `providerSlice`，并设置 `redux-persist` (使用默认 `storage`)。
    *   导出 `store`, `persistor`, `RootState`, `AppDispatch`。
*   `[X]` 5. **创建 `hooks.ts`**:
    *   文件路径: `frontend/electron-app/src/store/hooks.ts`
    *   创建类型化的 `useAppDispatch` 和 `useAppSelector` hooks。
*   `[X]` 6. **在应用中集成 Redux Store**:
    *   文件路径: `frontend/electron-app/src/main.tsx`
    *   使用 `<ReduxProvider store={store}>` 和 `<PersistGate loading={null} persistor={persistor}>` 包裹根组件。

---

### 阶段 2: 重构核心设置页面 (`Settings.tsx`)

*   `[P]` 7. **`Settings.tsx` 状态读取重构**:
    *   移除用于 `providers`, `selectedProvider` (现为 `currentProviderId`), `apiKey`, `baseUrl` 的 `useState`。
    *   使用 `useAppSelector` 从 Redux store 中读取这些状态。
    *   **状态**: 初步完成。`Settings.tsx` 已改为从 Redux读取核心 Provider 数据。但由于子组件 props 和类型不匹配，仍存在 linter 错误，需要进一步解决。
*   `[P]` 8. **`Settings.tsx` - `fetchProviders` 重构**:
    *   (如果仍然需要从 IPC/API 获取初始或默认 Provider 列表)
    *   调用 API 后，派发 `setProviders` action 将数据存入 Redux store。
    *   如果 API 返回了 `current_provider`，则派发 `setCurrentProviderId` action。
    *   **状态**: 初步完成。`fetchProviders` 已修改为 dispatch Redux actions，并包含将 API 返回数据映射到新 `Provider` 结构的逻辑。后续需在解决类型问题后验证。
*   `[P]` 9. **`Settings.tsx` - `fetchModels` 重构**:
    *   (如果需要为选定 Provider 单独加载模型列表)
    *   当 `currentProviderId` 变化时，如果需要从 IPC 获取模型，则调用 API。
    *   获取到模型数据后，派发 `updateProviderAction`，将模型列表更新到 Redux store 中对应的 Provider 对象内。
    *   **状态**: 初步完成。`fetchModels` 已修改为 dispatch `updateProviderAction`，包含模型数据映射。后续需在解决类型问题后验证。
*   `[P]` 10. **`Settings.tsx` - `handleToggleProviderActive` 重构**:
    *   派发 `setProviderActiveStatus` action。
    *   **状态**: 已在 `Settings.tsx` 中修改为使用 `setProviderActiveStatus`。包含乐观更新和错误回滚逻辑。后续需在解决类型问题后验证。
*   `[P]` 11. **`Settings.tsx` - API 密钥和 Base URL 输入与更新**:
    *   输入框的值由组件局部 state (`currentApiKeyInput`, `currentBaseUrlInput`) 管理。
    *   当输入完成或显式保存时，派发 `updateProviderAction` 更新 Redux store 中对应 Provider 的 `apiKey` 和 `apiHost`。
    *   **状态**: `Settings.tsx` 中已为此创建本地 state (`currentApiKeyInput`, `currentBaseUrlInput`)，并在 `useEffect` 中同步自选定 Provider。更新 Redux 的逻辑已在 `handleSave` 和新增的 `handleUpdateProviderDetails` 中初步实现。此部分强依赖 `ProviderDetail.tsx` 的重构。
*   `[P]` 12. **`Settings.tsx` - 移除旧的持久化逻辑**:
    *   移除 `handleSave` 函数和自动保存 `useEffect` Hook 中针对 Provider 配置部分对 `window.electronAPI.saveSettings` 的调用。
    *   **状态**: 部分完成。`saveSettings` 调用已修改为仅保存非 Provider 配置（通用设置）。旧的 Provider 相关字段（apiKey, baseUrl）的直接保存已移除。`redux-persist` 将负责 Provider 数据的持久化。
*   `[P]` 13. **`Settings.tsx` - 自定义 Provider 的增删改**:
    *   创建/编辑/删除 Provider 的操作应派发 `addProviderAction`, `updateProviderAction`, `removeProviderAction`。
    *   **状态**: `Settings.tsx` 中针对 `CustomProviderDialog` 的 `onSave` 回调逻辑已初步修改为派发 Redux actions。`handleDeleteProvider` 也已添加。但 `CustomProviderDialog.tsx` 本身及其 props 需要彻底重构才能完全对接。

---

### 阶段 3: 重构子组件与清理

*   `[ ]` 14. **重构子组件**:
    *   `ProviderDetail.tsx`: 修改 props 定义以接受从 `Settings.tsx` 传递的 `apiKeyInput`, `baseUrlInput`, `onApiKeyInputChange`, `onBaseUrlInputChange`, `onSaveProviderDetails` 等。移除其内部的 API Key/Base URL state 和相关 API 调用。确保其使用的 `Provider` 和 `AIModel` 类型与 `providerSlice.ts` 一致。
    *   `ProviderList.tsx`: 确认其 props (`selectedProvider` 等) 和内部类型与 `providerSlice.ts` 一致。
    *   `CustomProviderDialog.tsx`: 修改 props (`editProvider`) 和 `onSave` 回调，使其能正确接收和返回符合 `providerSlice.ts` 中 `Provider` 类型的数据，并处理添加/编辑逻辑。
*   `[ ]` 15. **调整 `preload.ts` 和主进程逻辑**:
    *   移除或标记为废弃主进程中与 `save-settings` (关于 Provider 部分), `update-provider`, `create-custom-provider`, `delete-custom-provider` 相关的 IPC 事件处理器逻辑。
    *   `get-settings` 保留用于加载其他非 Provider 的应用设置。
    *   `get-providers` (API) 如果仅用于提供"出厂设置"或"可用服务列表"，可以保留，但不应再返回用户配置的 API 密钥。
*   `[ ]` 16. **测试**:
    *   验证 API 密钥和 Provider 配置的输入、保存、应用重启后的恢复。
    *   验证 Provider 的增删改查。
    *   验证模型选择和相关参数的持久化。
    *   验证与其他设置的交互是否正常。
    *   检查 Electron 环境下 `redux-persist` 的存储位置和内容。

---
**当前工作焦点**:
目前正在处理 **阶段 2** 中 `Settings.tsx` 的重构。由于 `Settings.tsx` 与其子组件 (`ProviderDetail`, `CustomProviderDialog` 等) 紧密耦合，下一步需要深入修改这些子组件，以解决连锁的类型错误和逻辑调整。 