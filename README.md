# 异世界语桥 (AniVerse Gateway)

每一部动漫都是一个独特的异世界，而语言往往是阻隔我们深入其中的最大障碍。异世界语桥正是为此而生——它不仅仅是一个翻译工具，更是连接现实与动漫世界的神奇桥梁。通过先进的AI技术，让每一句台词都成为通往异世界的钥匙，让每一个追番的夜晚都充满无限可能。

## 功能特点

- **智能字幕提取**：自动从视频中提取内嵌字幕或识别外挂字幕文件
- **上下文感知翻译**：保持对话连贯性，理解角色关系和情境
- **多种 AI 模型支持**：支持 OpenAI、智谱 AI 等多种 AI 服务提供商
- **自定义 AI 提供商**：支持添加自定义 AI 服务提供商
- **字幕编辑器**：直观的界面，方便编辑和调整翻译结果
- **多种导出格式**：支持 SRT、ASS 等多种字幕格式导出

## 安装指南

### 使用Python venv环境（推荐使用UV）

```bash
# 安装UV（如果尚未安装）
curl -sSf https://install.python-poetry.org | python3 -

# 设置powershell执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
# 创建并激活虚拟环境
uv venv
source .venv/Scripts/activate  # bash

# 安装依赖
uv pip sync requirements.txt
```

### 使用Docker（可选）

```bash
docker pull yourusername/subtranslate:latest
docker run -p 8000:8000 -v /path/to/videos:/videos yourusername/subtranslate
```

## 开发环境设置

### 前提条件

- Python 3.10+
- Node.js 18+
- pnpm 8+

### 安装依赖

```bash
# 安装 Python 依赖
pip install -e .

# 安装前端依赖
pnpm install
```

### 开发模式运行

```bash
# 使用开发脚本启动
python scripts/dev.py
```

或者分别启动前端和后端：

```bash
# 启动后端
python backend/main.py

# 启动前端
pnpm dev
```

## 构建和打包

```bash
# 构建项目
python scripts/build.py

# 打包应用
python scripts/package.py
```

## 系统要求

- Python 3.10+
- FFmpeg（用于视频处理）
- 活跃的互联网连接（用于API访问）

## 字幕翻译子系统

字幕翻译子系统是异世界语桥的核心组件，负责处理字幕的提取、分析、翻译和整合过程。

### 特点

- **上下文感知翻译**：保持对话连贯性，理解角色关系和情境
- **文化适应**：智能处理文化特定的参考和习语
- **风格一致性**：保持原始对话的语气和风格
- **专业术语处理**：针对特定领域（如科技、医学、法律等）智能识别和翻译专业术语
- **批量处理能力**：高效处理多集剧集或多个视频文件

### 工作流程

1. **字幕提取**：从视频文件中提取内嵌字幕或读取外部字幕文件
2. **预处理**：清理文本，标记说话者、场景和特殊元素
3. **分块处理**：将长字幕文件分割成适合AI处理的语境相关块
4. **智能翻译**：通过AI模型进行翻译，保持对话连贯性和上下文
5. **后处理**：调整格式，确保时间码对齐，处理特殊字符
6. **质量检查**：验证翻译完整性，检测潜在问题
7. **整合输出**：生成新的字幕文件或将翻译结果嵌入到视频中

### 翻译模式

- **标准模式**：平衡质量和速度的通用翻译
- **精确模式**：偏重准确性，适合文档和教育内容
- **创意模式**：保留原文幽默和文化元素，适合娱乐内容
- **专业模式**：针对特定领域优化的专业术语翻译

## 项目结构

```
aniversegateway/
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
├── tests/                         # 测试
├── docs/                          # 文档
└── ...
```

## 详细文档

请参阅 [docs/README.md](docs/README.md) 获取更详细的项目文档，包括API参考、架构细节和开发指南。

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 支持的AI服务提供商

异世界语桥支持多种AI服务提供商，您可以根据需要选择：

- **OpenAI**：支持GPT-3.5和GPT-4等模型
- **智谱AI**：支持ChatGLM等国产大语言模型
- **火山引擎**：字节跳动的AI服务
- **百度文心一言**：百度的大语言模型
- **Anthropic**：Claude系列模型
- **Azure OpenAI**：微软Azure上的OpenAI服务
- **SiliconFlow**：支持DeepSeek、Qwen等多种开源大模型
- **自定义API**：支持自定义兼容OpenAI API格式的服务

要切换提供商，只需在`.env`文件中设置相应的`AI_PROVIDER`值和API密钥即可。

## 环境设置

本项目使用Python 3.10+和UV包管理器来管理依赖。

### 自动设置（推荐）

为了方便设置环境，我们提供了自动化脚本：

#### Windows用户

```bash
# 设置基本环境
setup_environment.bat

# 设置开发环境（包含开发工具）
setup_environment.bat --dev
```

#### Linux/macOS用户

```bash
# 设置基本环境
chmod +x setup_environment.sh
./setup_environment.sh

# 设置开发环境（包含开发工具）
./setup_environment.sh --dev
```

### 火山引擎机器学习平台SDK

本项目中使用的火山引擎机器学习平台SDK需要特殊安装。详细说明请参考 [火山引擎机器学习平台SDK安装指南](docs/ml_platform_setup.md)。


# 启动时通过环境变量设置
API_WORKERS=1 python src/run_api_server.py

# python全进程kill
taskkill /f /im python.exe

# 启动uv环境
source .venv/Scripts/activate

# 打包后端环境
source .venv/Scripts/activate && pyinstaller backend_build.spec --distpath frontend/electron-app/resources --workpath build/pyinstaller

# 打包(虚拟环境 git bash)
./build_package.bat