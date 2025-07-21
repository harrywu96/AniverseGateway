# 翻译功能测试指南

## 概述

为了简化翻译功能的测试流程，避免每次都需要等待完整的翻译过程，我们提供了以下测试工具和方法：

## 🚀 快速测试方法

### 方法1: 前端测试面板（推荐）

1. **启动应用**
   ```bash
   # 启动后端
   cd backend
   python main.py
   
   # 启动前端
   cd frontend/electron-app
   npm start
   ```

2. **使用测试面板**
   - 进入任意视频的翻译页面
   - 在页面顶部会看到蓝色边框的"翻译功能测试面板"
   - 点击"模拟翻译过程"按钮：模拟完整的翻译流程（包括进度条）
   - 点击"直接获取示例结果"按钮：立即获取预设的翻译结果

3. **验证功能**
   - 检查翻译结果是否正确显示在左侧预览区域
   - 验证原文和译文是否都正确显示
   - 检查时间轴和可信度信息
   - 测试虚拟列表滚动加载功能

### 方法2: Python测试脚本

1. **安装依赖**
   ```bash
   pip install requests websockets
   ```

2. **运行测试脚本**
   ```bash
   python test_translation_api.py
   ```

3. **测试内容**
   - 示例结果API测试
   - 模拟翻译过程测试（包括WebSocket通信）
   - SRT解析功能测试

### 方法3: 直接API测试

使用curl或Postman测试API端点：

```bash
# 获取示例翻译结果
curl http://localhost:8000/api/test/sample-results

# 启动模拟翻译任务
curl -X POST http://localhost:8000/api/test/mock-translation \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "test-video",
    "track_index": 0,
    "source_language": "en",
    "target_language": "zh",
    "subtitle_count": 10
  }'
```

## 🔧 测试API端点

### 1. 获取示例结果
- **端点**: `GET /api/test/sample-results`
- **功能**: 立即返回预设的翻译结果
- **用途**: 快速测试前端显示逻辑

### 2. 模拟翻译过程
- **端点**: `POST /api/test/mock-translation`
- **功能**: 模拟完整的翻译流程，包括进度更新
- **参数**:
  ```json
  {
    "video_id": "string",
    "track_index": 0,
    "source_language": "en",
    "target_language": "zh",
    "subtitle_count": 10
  }
  ```

### 3. WebSocket进度监听
- **端点**: `WS /api/test/ws/{task_id}`
- **功能**: 实时接收翻译进度和结果
- **消息格式**:
  ```json
  // 进度消息
  {
    "type": "progress",
    "percentage": 50,
    "current": 2,
    "total": 5,
    "currentItem": "正在处理第 2 个分块...",
    "estimatedTime": 6
  }
  
  // 完成消息
  {
    "type": "completed",
    "message": "翻译完成",
    "results": [...]
  }
  
  // 错误消息
  {
    "type": "error",
    "message": "错误信息"
  }
  ```

## 🐛 问题排查

### 常见问题

1. **测试面板不显示**
   - 检查是否正确导入了 `TranslationTestPanel` 组件
   - 确认组件没有被条件渲染隐藏

2. **API请求失败**
   - 确认后端服务正在运行（http://localhost:8000）
   - 检查防火墙和端口占用
   - 查看后端日志输出

3. **WebSocket连接失败**
   - 确认WebSocket端点正确注册
   - 检查浏览器控制台的错误信息
   - 验证任务ID是否正确传递

4. **翻译结果不显示**
   - 检查前端控制台的日志输出
   - 验证数据格式是否匹配前端期望
   - 确认 `setTranslationResults` 被正确调用

### 调试技巧

1. **启用详细日志**
   - 后端：检查 `logger.info` 输出
   - 前端：查看浏览器控制台的 `console.log`

2. **数据格式验证**
   - 使用浏览器开发者工具的Network标签查看API响应
   - 检查WebSocket消息的格式和内容

3. **逐步测试**
   - 先测试示例结果API（最简单）
   - 再测试模拟翻译过程
   - 最后测试真实翻译功能

## 📝 测试检查清单

### 前端功能测试
- [ ] 测试面板正确显示
- [ ] 模拟翻译按钮可点击
- [ ] 进度条正确更新
- [ ] 翻译结果正确显示在预览区域
- [ ] 原文和译文都正确显示
- [ ] 时间轴信息正确
- [ ] 可信度标签显示
- [ ] 虚拟列表滚动加载工作正常

### 后端API测试
- [ ] 示例结果API返回正确数据
- [ ] 模拟翻译API正确启动任务
- [ ] WebSocket连接成功建立
- [ ] 进度消息正确发送
- [ ] 完成消息包含翻译结果
- [ ] 错误处理正确工作

### 数据格式测试
- [ ] 翻译结果包含所有必需字段
- [ ] 时间格式正确（秒数和SRT格式）
- [ ] 原文和译文内容正确
- [ ] 可信度值在合理范围内

## 🎯 下一步

完成测试后，您可以：

1. **验证修复效果**: 确认翻译结果预览功能正常工作
2. **测试真实翻译**: 使用实际的翻译API验证完整流程
3. **性能优化**: 根据测试结果优化虚拟列表和数据处理
4. **用户体验改进**: 基于测试反馈改进界面和交互

## 📞 支持

如果在测试过程中遇到问题，请：

1. 检查后端和前端的日志输出
2. 使用浏览器开发者工具调试
3. 参考本文档的问题排查部分
4. 运行Python测试脚本验证后端API
