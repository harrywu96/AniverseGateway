# SubTranslate 应用打包指南

## 概述

本项目实现了Electron+Python的完整打包方案，支持开发环境和生产环境的自动区分。

## 架构说明

### 开发环境
- Electron主进程检测到 `!app.isPackaged` 时启动开发模式
- 直接调用Python虚拟环境中的python.exe运行backend/main.py
- 显示Python控制台窗口便于调试

### 生产环境  
- Electron主进程检测到 `app.isPackaged` 时启动生产模式
- 调用打包在resources/目录下的backend.exe
- 隐藏Python控制台窗口提供更好的用户体验

## 打包流程

### 1. 自动打包（推荐）
```bash
# 运行完整打包脚本
build_package.bat
```

### 2. 手动分步打包

#### 步骤1：打包Python后端
```bash
# 激活虚拟环境
source .venv/Scripts/activate

# 使用PyInstaller打包
pyinstaller backend_build.spec --distpath frontend/electron-app/resources --workpath build/pyinstaller
```

#### 步骤2：构建Electron前端
```bash
cd frontend/electron-app
npm run build
```

#### 步骤3：打包完整应用
```bash
npm run build:electron
```

## 关键文件说明

### backend_build.spec
PyInstaller配置文件，包含：
- 隐藏导入模块配置
- 数据文件包含规则
- 排除不需要的模块
- 单文件打包配置

### package.json (electron-app)
包含electron-builder配置：
- extraResources: 指定包含backend.exe
- 跨平台打包配置
- NSIS安装程序配置

### electron/main/index.ts
主进程代码修改：
- 使用app.isPackaged区分环境
- 动态选择Python路径和启动参数
- 进程生命周期管理

## 测试方法

### 开发环境测试
```bash
cd frontend/electron-app
npx electron ../../test_dev_environment.js
```

### 生产环境测试
```bash
test_production_environment.bat
```

## 输出文件

打包完成后会生成：
- `frontend/electron-app/dist-electron/SubTranslate Setup 1.0.0.exe` - 安装包
- `frontend/electron-app/dist-electron/win-unpacked/` - 解压版应用

## 环境要求

- Node.js 16+
- Python 3.8+ with uv环境
- Windows 10/11 (当前配置)

## 故障排除

### 常见问题

1. **PyInstaller打包失败**
   - 检查虚拟环境是否正确激活
   - 确认所有依赖已安装
   - 查看build/pyinstaller/warn-*.txt日志

2. **Electron构建失败**
   - 检查TypeScript错误
   - 确认所有npm依赖已安装
   - 使用npm run build:check进行完整检查

3. **应用启动后Python后端无法连接**
   - 检查backend.exe是否正确包含在resources/目录
   - 确认端口8000未被占用
   - 查看应用日志或控制台输出

### 调试技巧

1. **开发环境调试**
   - 使用test_dev_environment.js测试Python进程启动
   - 检查控制台输出确认环境检测正确

2. **生产环境调试**
   - 临时修改windowsHide为false显示Python控制台
   - 使用Process Monitor监控文件访问
   - 检查Windows事件日志

## 扩展支持

### 跨平台打包
当前配置支持Windows，要支持其他平台需要：

1. 修改backend_build.spec支持不同平台的可执行文件扩展名
2. 更新package.json中的electron-builder配置
3. 调整主进程中的路径处理逻辑

### 自动更新
可以集成electron-updater实现自动更新功能。

## 性能优化

1. **减小包体积**
   - 优化PyInstaller的hiddenimports配置
   - 使用electron-builder的文件过滤
   - 启用代码压缩和混淆

2. **启动速度优化**
   - 预热Python进程
   - 延迟加载非关键模块
   - 优化Electron渲染进程
