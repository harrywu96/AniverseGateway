# SRT 格式优化器使用指南

本文档详细介绍如何使用 `SRTOptimizer` 类来优化字幕翻译流程，减少 token 消耗，提高翻译效率。

## 背景

在字幕翻译过程中，SRT 文件通常包含许多格式化标签（如 HTML 标签），这些标签不需要被翻译，但会在计算 API 调用的 token 数量时被计入，导致不必要的成本增加。

`SRTOptimizer` 类的设计目标是：
1. 在发送到翻译 API 前，从字幕文本中提取出纯文本内容
2. 记录下所有格式信息
3. 翻译完成后，将格式信息重新应用到翻译后的文本中

这种方法可以显著减少 token 消耗，同时确保翻译结果保持原始格式。

## 安装和依赖

`SRTOptimizer` 已集成到 SubTranslate 项目中，无需额外安装。它位于 `src/subtranslate/services/utils.py` 文件中。

## 基本用法

### 1. 优化 SRT 内容

```python
from src.subtranslate.services.utils import SRTOptimizer

# 读取 SRT 文件
with open("example.srt", "r", encoding="utf-8") as f:
    srt_content = f.read()

# 优化 SRT 内容，提取纯文本并保存格式信息
optimized_srt, format_map = SRTOptimizer.optimize_srt_content(srt_content)

# optimized_srt 是去除了格式标签的纯文本 SRT
# format_map 是一个字典，保存了每个字幕行的格式信息
```

### 2. 将优化后的内容发送到翻译 API

```python
# 这里使用 AI 服务进行翻译
response = await ai_service.chat_completion(
    system_prompt="你是一个专业翻译助手",
    user_prompt=f"请翻译以下字幕内容:\n\n{optimized_srt}",
)

# 假设 response 是翻译后的 SRT 内容
translated_srt = response
```

### 3. 恢复格式

```python
# 将格式信息应用到翻译结果
restored_srt = SRTOptimizer.restore_srt_format(translated_srt, format_map)

# 保存结果
with open("translated.srt", "w", encoding="utf-8") as f:
    f.write(restored_srt)
```

## 高级用法

### 集成到翻译服务

`SRTOptimizer` 已被集成到 `SubtitleTranslator` 类的 `translate_file` 方法中。以下是关键部分的实现：

```python
async def translate_file(self, task: SubtitleTask, progress_callback: Optional[Callable] = None) -> str:
    # 读取源文件
    with open(task.source_path, "r", encoding="utf-8") as f:
        srt_content = f.read()

    # 优化 SRT 内容，提取纯文本并保存格式信息
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(srt_content)

    # 解析 SRT 文件内容
    subtitle_lines = self.parse_srt(optimized_srt)
    
    # ... 执行翻译流程 ...
    
    # 生成临时结果文件
    temp_result_path = self._generate_result_file(task, translated_lines)

    # 读取临时结果文件
    with open(temp_result_path, "r", encoding="utf-8") as f:
        translated_srt = f.read()

    # 恢复格式信息
    final_srt = SRTOptimizer.restore_srt_format(translated_srt, format_map)

    # 保存最终结果
    with open(temp_result_path, "w", encoding="utf-8") as f:
        f.write(final_srt)
    
    return temp_result_path
```

### 自定义格式处理

如果需要处理特殊的格式标签或者自定义格式抽取规则，可以扩展 `SRTOptimizer` 类或修改其方法。

## 优化效果

优化效果取决于原始 SRT 文件中格式标签的数量和复杂度。在包含大量 HTML 格式标记的字幕文件中，通常可以减少 30-60% 的 token 消耗。

例如，以下字幕行：

```
<font face="Trebuchet MS" size="24">And ever since, we've been obsessed with
the world of <i>A Tale of Perishing</i>, haven't we?</font>
```

优化后变为：

```
And ever since, we've been obsessed with
the world of A Tale of Perishing, haven't we?
```

在这个例子中，移除了 `<font>`, `<i>` 等标签，节省了大约 50% 的字符数。

## 完整示例

完整的示例可以在 `src/subtranslate/examples/srt_optimizer_demo.py` 和 `src/subtranslate/examples/srt_translation_with_optimizer.py` 中找到。

## 注意事项

1. **格式兼容性**：目前的实现主要针对 HTML 标签进行了优化，对于其他特殊格式（如 ASS 高级样式）可能需要额外的处理。

2. **文本对齐**：在恢复格式时，会尽量保持标签在文本中的相对位置，但由于翻译可能改变文本长度和结构，标签位置可能会有轻微偏移。

3. **错误处理**：在处理格式复杂的字幕时，建议添加适当的错误处理，以防格式解析或恢复失败。

4. **测试验证**：在应用到生产环境前，建议对不同类型的字幕文件进行充分测试，确保优化和恢复过程不会损失重要信息。

## 故障排除

如果遇到以下问题，可以尝试相应的解决方案：

1. **格式丢失或错乱**：检查原始字幕文件的格式是否标准，尝试使用字幕编辑软件修复格式后再处理。

2. **特殊标签无法识别**：扩展 `extract_text_and_format` 方法中的正则表达式，以适应特殊标签。

3. **恢复后的标签位置不正确**：调整 `restore_format` 方法中的插入逻辑，或预处理翻译结果以更好地匹配原文结构。

## API 参考

### SRTOptimizer 类

#### 静态方法

- `extract_text_and_format(text: str) -> tuple[str, list]`：从字幕文本中提取纯文本和格式信息

- `restore_format(clean_text: str, format_info: list) -> str`：将格式信息应用到纯文本上

- `optimize_srt_content(srt_content: str) -> tuple[str, dict]`：优化完整的 SRT 内容，返回优化后的内容和格式映射

- `restore_srt_format(srt_content: str, format_map: dict) -> str`：恢复 SRT 内容的格式

## 贡献

欢迎对 `SRTOptimizer` 类进行改进和扩展，特别是针对更复杂的字幕格式和更高效的格式处理方法。 