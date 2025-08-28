# Aniverse Gateway - 异世界语桥

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg" alt="Python Version">
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  <!-- <img src="https://img.shields.io/github/actions/workflow/status/harrywu96/AniverseGateway/main.yml?branch=main" alt="Build Status"> -->
  <!-- <img src="https://img.shields.io/github/stars/harrywu96/AniverseGateway" alt="GitHub stars">
  <img src="https://img.shields.io/github/forks/harrywu96/AniverseGateway" alt="GitHub forks"> -->
</p>

<p align="center">
  <strong>异世界语桥是一款功能强大的桌面应用程序，旨在打造一个本地优先、AI 驱动的视频字幕生成与翻译工作流程。</strong>
</p>

<p align="center">
  <a href="#-功能亮点">功能亮点</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-快速上手">快速上手</a> •
  <a href="#-如何使用">如何使用</a> •
  <a href="#-贡献指南">贡献指南</a> •
  <a href="#-授权许可">授权许可</a>
</p>

---

<!-- <p align="center">
  <img src="YOUR_SCREENSHOT_OR_GIF_HERE" alt="Aniverse Gateway 应用程序截图" width="80%">
</p> -->

异世界语桥（Aniverse Gateway）旨在为动漫爱好者提供了一套属于自己的快速翻译"生肉"（其他语言的视频）的软件，能够自动化处理视频翻译中最繁琐的环节，让您可以在自己的电脑上快捷完成从"生肉"番剧到自己语言的熟肉的完整翻译流程，确保数据的私密性与自主性。

**当前版本状态：** 本项目目前专注于基于**已有字幕轨道**的翻译流程。语音转文字（ASR）、本地ollama功能正在规划中。应用目前已在 Windows 平台稳定运行，macOS 和 Linux 的兼容性测试将在未来进行。

## ✨ 功能亮点

* **🎬 视频管理**：轻松导入本地视频文件，创建您的个人视频库。
* **📜 字幕提取**：自动检测并提取视频内嵌的字幕轨道作为翻译原文。
* **🧠 AI 翻译**：
    * 支持在设置中配置自定义 AI 提供商（任何与 OpenAI API 兼容的服务）。
    * 内置高质量的翻译提示词（Prompt），确保开箱即用的专业翻译效果。
    * 已填写提供商数据支持持久化存储。
* **✍️ 所见即所得字幕编辑器**：
    * 在视频播放器旁，直观地并排对比、编辑原始字幕与翻译字幕。
    * 支持时间轴微调、文本修正和格式调整。
    * 已翻译字幕内容支持持久化存储。
* **🚀 异步任务处理**：所有翻译任务都在后端作为异步任务执行，界面保持流畅响应。
* **💻 桌面端应用**：基于 Electron 和 React，目前已在 Windows 平台提供稳定的图形化操作体验。
* **🛡️ 本地优先，保障隐私**：核心功能在本地执行，您的视频和填写的提供商数据无需上传到第三方云服务。

## 💡 核心优势：为高质量翻译而生

本项目不仅是简单地调用 AI 大模型进行翻译，更在细节上进行了深度优化，以解决视频字幕翻译中的核心痛点：

1.  **Token 成本优化**
    本项目在将字幕发送给大模型前，会进行精密的预处理。通过 SRT 格式优化，从而智能筛选并移除无效的字幕格式标签（如 `<i>`, `<b>`, 颜色标签等），只将纯净的文本内容传送给 AI，显著减少不必要的 Token 消耗，为您节省成本。

2.  **智能上下文分块翻译**
    为突破大模型单次请求的 `max_token` 限制，本项目开发了一套智能分块算法。它会将长字幕文件切分为大小合适、可被模型处理的逻辑块。更重要的是，在翻译每个新分块时，算法会**自动携带前一个分块的原文和译文作为上下文**，确保了长句、跨句对话以及专业术语在整个翻译过程中的连贯性、准确性和自然感。

3.  **精准的格式处理**
    翻译完成后，系统会对返回的字幕内容进行严格的格式化处理，确保生成的 `.srt` 文件拥有精准的时间轴和规范的格式，可被所有标准播放器正确识别。

## 🛠️ 技术架构

Aniverse Gateway 采用前后端分离的本地客户端-服务器架构。

* **后端 (Backend)**：
    * **框架**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
    * **语音识别**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
    * **AI 服务集成**: Ollama, OpenAI-compatible APIs
    * **媒体处理**: FFmpeg
    * **主要职责**: API 服务、视频处理、字幕生成、AI 翻译任务管理。

* **前端 (Frontend)**：
    * **框架**: [Electron](https://www.electronjs.org/), [React](https://reactjs.org/), [Vite](https://vitejs.dev/)
    * **语言**: TypeScript
    * **UI 组件库**: [Material-UI (MUI)](https://mui.com/)
    * **状态管理**: Redux Toolkit
    * **主要职责**: 提供用户图形界面、与后端 API 交互、状态管理。

* **开发环境**:
    * **Python 包管理**: `uv`
    * **Node.js 包管理**: `pnpm` (Monorepo 工作区)

## 🚀 快速上手

请确保您的开发环境已安装以下必要工具：

* [Python](https://www.python.org/) (建议版本 3.11+)
* [Node.js](https://nodejs.org/) (建议版本 20+)
* [pnpm](https://pnpm.io/)
* [FFmpeg](https://ffmpeg.org/download.html) (请确保 `ffmpeg` 命令在您的系统 PATH 中可用)

#### 1. 克隆代码仓库

```bash
git clone [https://github.com/harrywu96/AniverseGateway.git](https://github.com/harrywu96/AniverseGateway.git)
cd AniverseGateway
```
#### 2. 配置后端

```bash
# 创建并激活虚拟环境 (推荐)
python -m venv .venv
source .venv/bin/activate  # on Windows, use `.venv\Scripts\activate`

# 安装 Python 依赖
pip install -r requirements.txt
```
#### 3. 配置前端

```bash
# 安装 Node.js 依赖
pnpm install
```
#### 4. 运行应用程序

```bash
# 在根目录运行，会同时启动前后端服务
pnpm dev

# 单独启动后端服务器
python backend/run_api_server.py # 服务器将默认在 http://127.0.0.1:8000 启动。


```

## 📖 如何使用

1. **配置翻译服务**：在“设置”页面，添加并配置您的 AI 翻译服务提供商（需要提供服务的 API 地址和密钥）。
2. **添加视频**：在主界面点击添加按钮，选择导入一个包含字幕轨道的视频文件。
3. **执行翻译**：进入视频详情页，系统会自动提取字幕。选择您配置好的翻译服务和目标语言，然后开始翻译任务。
4. **编辑与导出**：翻译完成后，您可以在字幕编辑器中进行校对和修改。完成后，点击导出按钮即可得到翻译好的 .srt 字幕文件。

## ❤️ 贡献指南

我们热烈欢迎任何形式的贡献！无论是报告错误、提出功能建议，PR。
<!-- 请参考我们的 [CONTRIBUTING.md](https://www.google.com/search?q=CONTRIBUTING.md) 文件来了解详细的贡献流程。 -->

## 📜 授权许可

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE) 授权。
