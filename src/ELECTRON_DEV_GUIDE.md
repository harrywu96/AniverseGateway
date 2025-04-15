# SubTranslate Electron 应用开发指南

本文档提供了 SubTranslate 项目中 Electron 部分的开发和调试指南。项目使用 pnpm + monorepo 管理前端代码，采用 React + Vite + Electron 技术栈开发桌面应用。

## 项目结构

SubTranslate 项目采用 monorepo 结构，使用 pnpm 管理工作空间：

```
src/
├── backend/            # Python 后端代码
├── packages/           # 前端包
│   ├── electron-app/   # Electron 应用程序
│   └── shared/         # 共享类型和工具函数
├── package.json        # 工作空间配置
└── pnpm-workspace.yaml # 工作空间定义
```

## 前后端架构

SubTranslate 采用前后端分离的架构：

1. **Python 后端**：使用 FastAPI 实现，提供 RESTful API 和 WebSocket 接口
2. **Electron 前端**：
   - 主进程：负责启动 Python 后端服务、管理窗口
   - 渲染进程：使用 React 实现 UI，通过 HTTP 和 WebSocket 与后端通信

## 开发环境设置

### 前提条件

- Node.js >= 18
- pnpm >= 8
- Python >= 3.10

### 安装依赖

```bash
# 进入项目目录
cd src

# 安装所有依赖
pnpm install
```

### 开发模式运行

```bash
# 启动开发模式
pnpm dev
```

这将会：
1. 启动 Vite 开发服务器（用于 React 前端）
2. 启动 Electron 主进程
3. 主进程会自动启动 Python 后端

## 调试指南

### 调试 React 前端

1. Vite 开发服务器运行在 http://localhost:5173
2. 可以使用浏览器开发工具调试渲染进程

### 调试 Electron 主进程

1. 主进程日志会显示在终端中
2. 可以设置环境变量开启额外日志：
   ```bash
   $env:DEBUG="electron:*" 
   pnpm dev
   ```

### 调试 Python 后端

1. 后端日志会显示在 Electron 终端输出中
2. 也可以单独启动后端进行调试：
   ```bash
   python run_api_server.py
   ```

## 构建项目

```bash
# 构建整个应用
pnpm build
```

这将会：
1. 构建 React 前端
2. 构建 Electron 应用
3. 将 Python 后端代码和依赖打包到资源目录

构建输出位于 `src/packages/electron-app/release` 目录。

## IPC 通信

Electron 主进程和渲染进程通过 IPC 进行通信：

- 渲染进程调用主进程的方法：`ipcRenderer.invoke('channel', ...args)`
- 主进程响应渲染进程的请求：`ipcMain.handle('channel', handler)`

主要的 IPC 通道：

- `check-backend-status`: 检查后端服务状态
- `select-video`: 打开文件选择对话框选择视频
- `upload-video`: 上传本地视频到后端

## 前后端对接指南

### API 请求

React 前端通过 HTTP 请求与 Python 后端通信。所有 API 路径常量定义在 `@subtranslate/shared` 包中：

```typescript
import { API_PATHS } from '@subtranslate/shared';

// 例如获取视频列表
fetch(API_PATHS.VIDEOS)
  .then(response => response.json())
  .then(data => console.log(data));
```

### 实时进度

翻译任务的实时进度使用 WebSocket 通信：

```typescript
import { API_PATHS } from '@subtranslate/shared';

const ws = new WebSocket(`ws://localhost:8000${API_PATHS.WEBSOCKET}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 处理进度更新
};
```

## 代码规范

- 使用 TypeScript 类型检查
- 遵循 React 最佳实践
- 使用 MUI（Material-UI）组件库构建界面
- 在 `@subtranslate/shared` 包中定义所有共享类型和常量

## 常见问题和解决方案

### Q: 如何重启后端服务?

A: 重启整个 Electron 应用，或者在开发模式下按 Ctrl+R 刷新渲染进程。后端服务由 Electron 主进程管理。

### Q: 前端报告 API 连接错误?

A: 检查后端服务是否正常运行。Electron 主进程日志会显示后端启动情况。

### Q: 如何添加新的 API 路径?

A: 在 `@subtranslate/shared/src/index.ts` 文件中的 `API_PATHS` 对象中添加新路径。

### Q: 如何向 Electron 主进程添加新功能?

A: 在 `electron/main/index.ts` 中添加新的 IPC 处理程序，并更新相应的渲染进程代码。 