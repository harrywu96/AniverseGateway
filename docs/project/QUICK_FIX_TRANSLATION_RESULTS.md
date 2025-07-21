# 翻译结果显示问题快速修复方案

## 问题确认

当前翻译完成后，前端显示空白的原因是：

**文件**：`backend/api/routers/translate_v2.py` 第281行
```python
"results": [],  # 翻译结果将在这里填充 ❌ 但实际没有填充
```

## 快速修复方案

### 方案A：最小修改（推荐）

直接在回调函数中获取翻译结果，无需大幅重构。

#### 步骤1：添加结果获取函数

在 `translate_v2.py` 中添加：

```python
def parse_srt_content(srt_content: str) -> List[Dict]:
    """解析SRT内容为前端格式"""
    import re
    
    results = []
    # SRT格式正则表达式
    pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.*?)(?=\n\d+\n|\n*$)'
    
    matches = re.findall(pattern, srt_content, re.DOTALL)
    
    for match in matches:
        index, start_time, end_time, text = match
        
        # 转换时间为秒数
        start_seconds = srt_time_to_seconds(start_time)
        end_seconds = srt_time_to_seconds(end_time)
        
        results.append({
            "index": int(index),
            "startTime": start_seconds,
            "endTime": end_seconds,
            "startTimeStr": start_time,
            "endTimeStr": end_time,
            "original": text.strip(),
            "translated": text.strip(),  # 翻译后的内容
        })
    
    return results

def srt_time_to_seconds(time_str: str) -> float:
    """SRT时间格式转秒数"""
    # "00:01:23,456" -> 83.456
    time_part, ms_part = time_str.split(',')
    hours, minutes, seconds = map(int, time_part.split(':'))
    milliseconds = int(ms_part)
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
```

#### 步骤2：修改回调函数

```python
# 在 process_video_subtitle_translation 函数中
async def callback(progress: float, status: str, message: str):
    """进度回调函数"""
    try:
        # 根据状态创建前端期望的消息格式
        if status == "completed":
            # 获取翻译结果
            translation_results = []
            try:
                # 从翻译任务中获取结果
                if hasattr(translator, 'last_translation_result'):
                    # 如果翻译器保存了最后的结果
                    srt_content = translator.last_translation_result.get('translated_content', '')
                    if srt_content:
                        translation_results = parse_srt_content(srt_content)
                
                # 备选方案：从临时文件读取
                if not translation_results:
                    temp_result_file = os.path.join(temp_dir, f"{task_id}_result.srt")
                    if os.path.exists(temp_result_file):
                        with open(temp_result_file, 'r', encoding='utf-8') as f:
                            srt_content = f.read()
                            translation_results = parse_srt_content(srt_content)
                            
            except Exception as e:
                logger.error(f"获取翻译结果失败: {e}")
                translation_results = []
            
            websocket_message = {
                "type": "completed",
                "message": message,
                "results": translation_results,  # ✅ 实际翻译结果
            }
        elif status == "failed":
            websocket_message = {"type": "error", "message": message}
        else:
            # 进行中状态
            websocket_message = {
                "type": "progress",
                "percentage": progress,
                "current": 0,
                "total": 0,
                "currentItem": message,
                "estimatedTime": None,
            }

        # 通过WebSocket广播进度更新
        await manager.broadcast(task_id, websocket_message)
        
        logger.info(
            f"任务 {task_id} 进度: {progress}%, 状态: {status}, 消息: {message}"
        )
    except Exception as e:
        logger.error(f"进度回调失败: {e}")
```

#### 步骤3：修改翻译任务保存结果

在翻译完成时保存结果到临时文件：

```python
# 在 process_video_subtitle_translation 函数的翻译部分
try:
    # ... 现有翻译逻辑
    
    # 执行翻译
    success = await translator.translate_task(task, callback)
    
    if success:
        # 保存翻译结果到临时文件供回调使用
        if hasattr(task, 'result_path') and task.result_path:
            temp_result_file = os.path.join(temp_dir, f"{task_id}_result.srt")
            if os.path.exists(task.result_path):
                import shutil
                shutil.copy2(task.result_path, temp_result_file)
        
        await callback(100.0, "completed", "翻译完成")
    else:
        await callback(0.0, "failed", "翻译失败")
        
except Exception as e:
    logger.error(f"翻译任务异常: {e}")
    await callback(0.0, "failed", f"翻译异常: {str(e)}")
```

### 方案B：更完整的解决方案

如果方案A不够稳定，可以考虑更完整的修改：

#### 1. 修改翻译器返回结果

**文件**：`backend/core/subtitle_translator.py`

```python
async def translate_task(self, task: SubtitleTask, progress_callback=None) -> Dict:
    """翻译任务，返回详细结果"""
    try:
        # ... 现有翻译逻辑
        
        # 返回详细结果而不是简单的布尔值
        return {
            "success": True,
            "translated_content": translated_content,
            "format_map": format_map,
            "result_path": output_path,
            "translated_lines": translated_lines,  # 添加结构化数据
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
```

#### 2. 在翻译完成时直接传递结果

```python
# 在 translate_v2.py 中
result = await translator.translate_task(task, callback)

if result.get("success"):
    # 直接使用翻译器返回的结构化数据
    translated_lines = result.get("translated_lines", [])
    translation_results = [
        {
            "index": line.index,
            "startTime": srt_time_to_seconds(line.start_time),
            "endTime": srt_time_to_seconds(line.end_time),
            "startTimeStr": line.start_time,
            "endTimeStr": line.end_time,
            "original": line.text,
            "translated": line.translated_text,
        }
        for line in translated_lines
    ]
    
    # 将结果传递给回调
    await callback(100.0, "completed", "翻译完成", translation_results)
```

## 推荐实施步骤

### 第一步：验证问题
1. 确认翻译确实完成了（检查后端日志）
2. 确认问题确实是 `results: []`

### 第二步：实施方案A
1. 添加 `parse_srt_content` 和 `srt_time_to_seconds` 函数
2. 修改回调函数获取翻译结果
3. 测试验证

### 第三步：如果方案A不行，实施方案B
1. 修改翻译器返回结构
2. 修改回调函数签名
3. 全面测试

## 测试验证

修复后应该能看到：

```javascript
// 前端接收到的 WebSocket 消息
{
  "type": "completed",
  "message": "翻译完成",
  "results": [
    {
      "index": 1,
      "startTime": 1.5,
      "endTime": 4.2,
      "startTimeStr": "00:00:01,500",
      "endTimeStr": "00:00:04,200",
      "original": "Hello world",
      "translated": "你好世界"
    },
    // ... 更多结果
  ]
}
```

## 注意事项

1. **编码问题**：确保SRT文件以UTF-8编码读取
2. **时间格式**：注意SRT使用逗号分隔毫秒，不是点号
3. **错误处理**：添加充分的异常处理，避免影响翻译流程
4. **性能**：对于长字幕文件，考虑结果数量限制

这个修复应该能立即解决翻译结果显示为空的问题，让用户能够看到翻译结果。
