# 语音转写功能使用指南

异世界语桥现在提供了语音转写功能，可以将视频和音频文件自动转写为 SRT 字幕文件。本功能基于 Faster Whisper 实现，支持多种模型大小和配置选项。

## 安装依赖

使用以下命令安装 Faster Whisper 及其依赖项：

```bash
pip install faster-whisper==0.10.0
# 或者使用 UV (推荐)
uv pip install faster-whisper==0.10.0
```

## 通过命令行使用

项目提供了一个简单的命令行工具，用于快速转写音频和视频文件：

```bash
python -m src.aniversegateway.cli.transcribe /path/to/video_or_audio_file
```

### 命令行选项

```
usage: transcribe.py [-h] [-o OUTPUT_DIR] [-m {tiny,base,small,medium,large,large-v2,large-v3}] 
                     [-l LANGUAGE] [-t {transcribe,translate}] [-d {cuda,cpu,mps}] 
                     [-c {float16,float32,int8}] [-k] [-v] target

异世界语桥语音转写工具

positional arguments:
  target                视频或音频文件/目录的路径

options:
  -h, --help            显示此帮助信息并退出
  -o OUTPUT_DIR, --output-dir OUTPUT_DIR
                        字幕输出目录（默认为与源文件相同目录）
  -m {tiny,base,small,medium,large,large-v2,large-v3}, --model {tiny,base,small,medium,large,large-v2,large-v3}
                        模型大小（默认为medium）
  -l LANGUAGE, --language LANGUAGE
                        语言代码（默认自动检测）
  -t {transcribe,translate}, --task {transcribe,translate}
                        任务类型：transcribe（转写）或translate（翻译为英文）
  -d {cuda,cpu,mps}, --device {cuda,cpu,mps}
                        计算设备（默认为cuda，如果可用）
  -c {float16,float32,int8}, --compute-type {float16,float32,int8}
                        计算精度类型（默认为float16）
  -k, --keep-audio      保留提取的音频文件
  -v, --verbose         显示详细日志
```

### 示例

1. 使用默认设置转写视频：

```bash
python -m src.subtranslate.cli.transcribe my_video.mp4
```

2. 指定输出目录和语言：

```bash
python -m src.subtranslate.cli.transcribe my_video.mp4 -o ./subtitles -l zh
```

3. 使用较小的模型在 CPU 上运行：

```bash
python -m src.subtranslate.cli.transcribe my_audio.mp3 -m small -d cpu
```

4. 批量处理目录中的所有视频：

```bash
python -m src.subtranslate.cli.transcribe ./videos_directory/
```

## 通过 API 使用

SubTranslate 提供了 RESTful API 接口，用于集成到其他应用程序中：

### 转写文件

**POST /api/speech-to-text/transcribe**

上传音频或视频文件，并使用 Faster Whisper 进行转写。

请求参数：
- `file`: 要转写的音频或视频文件（表单文件上传）
- `data`: JSON 字符串，包含以下字段：
  - `model_size`: 模型大小（默认：medium）
  - `language`: 语言代码（可选）
  - `task`: 任务类型（transcribe 或 translate，默认：transcribe）
  - `vad_filter`: 是否使用 VAD 过滤（默认：true）
  - `word_timestamps`: 是否生成单词时间戳（默认：true）
  - `keep_audio`: 是否保留音频文件（默认：false）
  - `device`: 计算设备（可选）
  - `compute_type`: 计算精度（可选）

响应：
- 任务 ID，用于后续获取结果

### 获取任务状态

**GET /api/speech-to-text/task/{task_id}**

获取转写任务的状态和结果（如果已完成）。

### 下载字幕文件

**GET /api/speech-to-text/download/{task_id}/{filename}**

下载生成的字幕文件。

### WebSocket 进度更新

**WebSocket /api/speech-to-text/ws/{task_id}**

通过 WebSocket 接收任务进度更新。

## 配置选项

可以在 `.env` 文件中配置语音转写功能的默认参数：

```
# 语音转写配置
SPEECH_TO_TEXT_DEVICE=cuda
SPEECH_TO_TEXT_COMPUTE_TYPE=float16
SPEECH_TO_TEXT_MODEL_DIR=~/.cache/whisper
SPEECH_TO_TEXT_DEFAULT_MODEL=medium
SPEECH_TO_TEXT_VAD_FILTER=true
SPEECH_TO_TEXT_WORD_TIMESTAMPS=true
```

## 支持的文件格式

- 音频文件：.wav, .mp3, .m4a, .flac, .ogg, .aac
- 视频文件：.mp4, .mkv, .avi, .mov, .wmv, .webm

## 模型选择指南

- **tiny**: 最小的模型，低资源消耗，速度最快，但准确度较低。适合简单的音频和测试。
- **base**: 小型模型，速度较快，准确度适中。适合一般场景。
- **small**: 中小型模型，平衡速度和准确度。
- **medium**: 中型模型，准确度较高，速度适中。**推荐用于大多数场景**。
- **large**: 大型模型，准确度最高，但资源消耗大，速度较慢。适合对准确度要求高的场景。
- **large-v2**: 改进版大型模型，比原版更准确。
- **large-v3**: 最新的大型模型，支持更多语言和方言。

## 性能考虑

- 使用 CUDA 设备（如 NVIDIA GPU）可显著提高转写速度
- 较大的模型需要更多 GPU 内存
- 转写长视频时，建议使用较小的模型以减少内存使用
- 使用 VAD 过滤可有效跳过无声段，加快处理速度 