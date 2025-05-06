# SubTranslate 项目重构迁移进度

本文档记录了 SubTranslate 项目从旧结构迁移到新结构的进度。

## 迁移计划

按照前后端分离原则重新组织项目结构，消除冗余代码，提高代码可维护性和可扩展性。

## 新项目结构

```
project/
├── frontend/                      # 所有前端代码
│   ├── electron-app/              # Electron 应用
│   │   ├── electron/              # Electron 主进程代码
│   │   └── src/                   # 渲染进程代码 (React)
│   └── shared/                    # 共享代码
├── backend/                       # 所有后端代码
│   ├── api/                       # API 接口
│   ├── core/                      # 核心功能
│   ├── schemas/                   # 数据模型
│   ├── services/                  # 服务
│   └── ...
├── scripts/                       # 构建和部署脚本
├── tests/                         # 测试
├── docs/                          # 文档
└── ...
```

## 迁移进度

### 1. 准备工作

- [x] 创建新的目录结构
- [x] 创建迁移脚本

### 2. 后端代码迁移

- [x] 创建 backend/__init__.py
- [x] 创建 backend/main.py
- [x] 创建 backend/run_api_server.py
- [x] 创建 backend/api/__init__.py
- [x] 创建 backend/api/app.py
- [x] 创建 backend/api/websocket.py
- [x] 创建 backend/api/dependencies.py
- [x] 创建 backend/api/routers/__init__.py
- [x] 迁移 src/subtranslate/api/routers 到 backend/api/routers
- [x] 迁移 src/subtranslate/core 到 backend/core
- [x] 迁移 src/subtranslate/schemas 到 backend/schemas
- [x] 迁移 src/subtranslate/services 到 backend/services

### 3. 前端代码迁移

- [x] 迁移 src/packages/electron-app 到 frontend/electron-app
- [x] 迁移 src/packages/shared 到 frontend/shared
- [x] 清理重复的 JS 文件
- [x] 更新 Electron 主进程中的后端启动代码
- [x] 更新 electron-builder.json 中的后端路径

### 4. 配置文件更新

- [x] 创建根目录 package.json
- [x] 创建 pnpm-workspace.yaml
- [x] 更新 pyproject.toml
- [x] 更新 .env.example
- [x] 更新 .gitignore

### 5. 脚本创建

- [x] 创建 scripts/dev.py
- [x] 创建 scripts/build.py
- [x] 创建 scripts/package.py
- [x] 创建 scripts/migrate_backend.py
- [x] 创建 scripts/migrate_frontend.py

### 6. 文档更新

- [x] 更新 README.md
- [x] 更新 docs/DEVELOPER_GUIDE.md
- [x] 创建 docs/MIGRATION_PROGRESS.md

## 待完成任务

- [ ] 运行单元测试
- [ ] 运行集成测试
- [ ] 进行手动测试
- [ ] 构建生产版本
- [ ] 打包应用

## 注意事项

1. 迁移过程中可能会遇到导入路径问题，需要仔细检查和更新所有导入语句。
2. 前端代码中的 API 调用路径可能需要更新。
3. 构建和打包配置可能需要进一步调整。

## 回滚计划

如果迁移过程中遇到严重问题，可以按照以下步骤回滚：

1. 保留原始代码备份
2. 恢复原始目录结构
3. 恢复原始配置文件

## 迁移完成后的清理工作

- [ ] 移除旧的 src 目录
- [ ] 移除迁移脚本
- [ ] 更新文档
