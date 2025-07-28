# 异世界语桥 (AniVerse Gateway) 项目开发者指南

本文档为异世界语桥项目开发者提供全面的指导和参考，包括环境设置、开发标准、代码规范、测试方法和常见问题解决方案。

## 目录

1. [开发环境设置](#开发环境设置)
2. [代码组织结构](#代码组织结构)
3. [开发工作流](#开发工作流)
4. [编码规范](#编码规范)
5. [测试指南](#测试指南)
6. [文档规范](#文档规范)
7. [版本控制](#版本控制)
8. [问题和故障排除](#问题和故障排除)
9. [性能优化](#性能优化)
10. [安全考虑](#安全考虑)

## 开发环境设置

### 前提条件
- Python 3.10 或更高版本
- Node.js 18 或更高版本
- pnpm 8 或更高版本
- FFmpeg（用于视频处理）
- Git 版本控制

### 环境设置步骤

1. **克隆代码库**
   ```bash
   git clone [repository-url]
   cd aniversegateway
   ```

2. **安装 Python 依赖**
   ```bash
   # 安装 Python 依赖
   pip install -e .
   ```

3. **安装前端依赖**
   ```bash
   # 安装前端依赖
   pnpm install
   ```

4. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp .env.example .env

   # 编辑 .env 文件，填入必要的配置信息
   # 特别是 AI 服务提供商的 API 密钥等敏感信息
   ```

5. **验证设置**
   ```bash
   # 启动开发环境
   python scripts/dev.py
   ```

## 代码组织结构

SubTranslate 项目采用前后端分离的结构化模块设计，严格遵循关注点分离原则：

```
subtranslate/
├── frontend/                      # 所有前端代码
│   ├── electron-app/              # Electron 应用
│   │   ├── electron/              # Electron 主进程代码
│   │   ├── src/                   # 渲染进程代码 (React)
│   │   └── ...
│   └── shared/                    # 共享代码
├── backend/                       # 所有后端代码
│   ├── api/                       # API 接口
│   ├── core/                      # 核心功能
│   ├── schemas/                   # 数据模型
│   ├── services/                  # 服务
│   └── ...
├── scripts/                       # 构建和部署脚本
├── tests/                         # 测试目录
├── docs/                          # 文档
└── ...
```

### 模块职责

#### 后端模块

- **backend/api**: FastAPI 应用和路由定义
- **backend/core**: 核心业务逻辑，包括视频处理、字幕提取和翻译
- **backend/schemas**: Pydantic 数据模型定义
- **backend/services**: 外部服务集成，如 FFmpeg 和 AI 服务提供商

#### 前端模块

- **frontend/electron-app/electron/main**: Electron 主进程代码
- **frontend/electron-app/electron/preload**: Electron 预加载脚本
- **frontend/electron-app/src/components**: React 组件
- **frontend/electron-app/src/pages**: 页面组件
- **frontend/electron-app/src/services**: 前端服务
- **frontend/shared**: 共享类型和常量

## 开发工作流

### 功能开发流程

1. **拉取最新代码**
   ```bash
   git checkout develop
   git pull
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **开发功能**
   - 遵循 Schema 驱动开发方法
   - 先定义数据模型和接口
   - 然后实现具体功能
   - 编写单元测试

4. **本地测试**
   ```bash
   # 运行单元测试
   pytest

   # 运行代码质量检查
   ruff check .
   mypy .
   ```

5. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. **创建合并请求**
   - 提交 PR 到 `develop` 分支
   - 请求代码审查
   - 解决反馈问题

## 编码规范

### Python 代码规范

- 遵循 [PEP 8](https://www.python.org/dev/peps/pep-0008/) 风格指南
- 使用 [PEP 484](https://www.python.org/dev/peps/pep-0484/) 类型注解
- 遵循 [PEP 517/621](https://www.python.org/dev/peps/pep-0517/) 项目元数据规范
- 行长度限制: 79 字符
- 使用 4 空格缩进
- 使用 f-string 进行字符串格式化
- 类和函数应有文档字符串

### Schema 驱动开发

请参考 [Schema 驱动开发指南](./SCHEMA_DRIVEN_DEVELOPMENT.md) 了解详细的 Schema 先行开发方法。

### 依赖管理

请参考 [UV 依赖管理指南](./UV_DEPENDENCY_MANAGEMENT.md) 了解如何使用 UV 管理项目依赖。

### 代码质量工具

- **Black**: 自动代码格式化
- **isort**: 导入语句排序
- **mypy**: 静态类型检查
- **ruff**: 快速 Python linter
- **pre-commit**: 提交前自动检查

## 测试指南

### 测试结构

- **单元测试**: 测试单个函数和类
- **集成测试**: 测试多个组件的交互
- **端到端测试**: 测试完整功能流程

### 编写测试的最佳实践

- 每个模块和功能都应有测试
- 使用 pytest 作为测试框架
- 使用 pytest-cov 检查测试覆盖率
- 模拟外部依赖（如 OpenAI API）
- 测试边界条件和错误情况

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定模块的测试
pytest tests/schemas/

# 带覆盖率报告
pytest --cov=src/subtranslate
```

## 文档规范

### 代码文档

- 每个模块、类和函数都应有文档字符串
- 文档字符串使用 [Google 风格](https://sphinxcontrib-napoleon.readthedocs.io/en/latest/example_google.html)
- 复杂逻辑应有行内注释说明

### 项目文档

- **README.md**: 项目概述和快速开始
- **DEVELOPMENT_STEPS.md**: 开发步骤清单
- **SCHEMA_DRIVEN_DEVELOPMENT.md**: Schema 驱动开发指南
- **UV_DEPENDENCY_MANAGEMENT.md**: UV 依赖管理指南
- **DEVELOPER_GUIDE.md**: 本文档，开发者综合指南

## 版本控制

### 分支模型

- **main**: 稳定的生产版本
- **develop**: 开发主分支
- **feature/xx**: 功能开发分支
- **fix/xx**: 错误修复分支

### 提交信息规范

使用[约定式提交](https://www.conventionalcommits.org/)格式:

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

类型包括:
- **feat**: 新功能
- **fix**: 修复bug
- **docs**: 文档变更
- **style**: 代码风格变更（不影响功能）
- **refactor**: 代码重构
- **perf**: 性能优化
- **test**: 测试相关
- **build**: 构建系统变更
- **ci**: CI配置变更

## 问题和故障排除

### 常见问题

1. **依赖问题**
   - 使用 `python uv_setup.py clean` 重置环境
   - 检查 requirements.txt 是否有冲突

2. **FFmpeg 相关问题**
   - 确保 FFmpeg 正确安装并在 PATH 中
   - 或在 .env 文件中设置 FFMPEG_PATH

3. **API 密钥问题**
   - 检查 .env 文件中的 API 密钥配置
   - 验证 API 密钥有效性

### 调试技巧

- 使用 `APP_DEBUG=true` 启用调试模式
- 检查日志文件获取详细错误信息
- 使用 Python 调试器 (pdb/ipdb) 进行交互式调试

## 性能优化

### 代码级优化

- 避免不必要的计算和内存分配
- 利用 Python 标准库的优化函数
- 考虑使用异步处理大量 I/O 操作

### 系统级优化

- 合理设置 `MAX_CONCURRENT_TASKS`
- 适当配置 FFmpeg 线程数
- 使用缓存减少重复计算

## 安全考虑

### 数据安全

- 避免将敏感信息硬编码在源代码中
- 使用环境变量或安全存储服务管理密钥
- 处理用户数据时遵循最小权限原则

### API 安全

- 实施适当的访问控制
- 使用 HTTPS 保护 API 通信
- 验证和清理所有用户输入

---

本指南将根据项目的发展不断更新。如有问题或建议，请联系项目维护者。