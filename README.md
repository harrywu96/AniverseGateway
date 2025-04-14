# SubTranslate - 智能视频字幕翻译系统

SubTranslate是一个自动化视频字幕提取、翻译和整合系统，能够从各种视频格式中提取字幕，借助AI进行智能翻译，并将翻译后的字幕与原视频关联。

## 功能特点

- 自动从MKV、MP4等视频格式中提取字幕
- 通过GPT进行智能翻译，保持对话自然流畅
- 智能处理文化差异和上下文连贯性
- 支持批量处理多个视频文件
- 提供友好的Web界面和命令行接口
- 自动保存翻译后的字幕到原视频所在目录

## 安装指南

### 使用Python venv环境（推荐使用UV）

```bash
# 安装UV（如果尚未安装）
curl -sSf https://install.python-poetry.org | python3 -

# 设置powershell执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
# 创建并激活虚拟环境
uv venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate  # Windows

# 安装依赖
uv pip sync requirements.txt
```

### 使用Docker（可选）

```bash
docker pull yourusername/subtranslate:latest
docker run -p 8000:8000 -v /path/to/videos:/videos yourusername/subtranslate
```

## 快速开始

### 配置

1. 复制示例配置文件
```bash
cp .env.example .env
```

2. 编辑配置文件，添加您的API密钥
```
# 使用OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here

# 或使用智谱AI
AI_PROVIDER=zhipuai
ZHIPUAI_API_KEY=your_api_key_here

# 或使用SiliconFlow
AI_PROVIDER=siliconflow
SILICONFLOW_API_KEY=your_api_key_here
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V2.5
```

### 使用Web界面

1. 启动服务器
```bash
python -m subtranslate.main
```

2. 在浏览器中访问 http://localhost:8000

### 使用命令行

```bash
# 翻译单个视频字幕
subtranslate translate /path/to/video.mp4

# 批量翻译目录中的所有视频
subtranslate translate-batch /path/to/videos/
```

## 系统要求

- Python 3.10+
- FFmpeg（用于视频处理）
- 活跃的互联网连接（用于API访问）

## 字幕翻译子系统

字幕翻译子系统是SubTranslate的核心组件，负责处理字幕的提取、分析、翻译和整合过程。

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
subtranslate/
├── src/
│   └── subtranslate/
│       ├── api/            # FastAPI后端
│       ├── cli/            # 命令行接口
│       ├── core/           # 核心业务逻辑
│       ├── schemas/        # Pydantic数据模型
│       ├── services/       # 业务服务
│       └── ui/             # 前端资源
├── frontend/               # React前端应用
├── tests/                  # 测试目录
├── docs/                   # 文档
├── pyproject.toml          # 项目配置
└── README.md               # 项目说明
```

## 详细文档

请参阅 [docs/README.md](docs/README.md) 获取更详细的项目文档，包括API参考、架构细节和开发指南。

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 支持的AI服务提供商

SubTranslate支持多种AI服务提供商，您可以根据需要选择：

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


