# 视频重新导入字幕丢失问题修复报告

## 问题分析

### 根本原因
通过分析日志和代码，发现问题的根本原因是：

**前端API调用缺少参数**：前端在调用 `/api/videos/{id}` 接口时没有传递 `include_subtitles=true` 参数。

### 问题表现
1. **后端字幕提取成功**：从日志可以看出，后端确实成功检测并提取了9个字幕轨道
2. **前端获取失败**：前端调用 `GET /api/videos/{id}` 时，`include_subtitles=False`（默认值）
3. **API设计问题**：后端为了提升响应速度，默认不返回字幕轨道信息

### 日志证据
```
Python后端stderr: 2025-07-22 10:02:55,343 - backend.core.subtitle_extractor - INFO - 发现字幕轨道: 轨道 #0: eng, 标题: English, 默认
...
2025-07-22 10:02:55,343 - subtranslate.api.videos - INFO - 成功提取到 9 个字幕轨道
...
2025-07-22 10:02:56,848 - subtranslate.api.videos - INFO - 获取视频信息，ID: fac2087f-a111-459f-bafd-bf734545e2e9, include_subtitles: False
```

## 修复方案

### 1. 前端API调用修复

**文件**: `frontend/electron-app/src/pages/VideoDetail.tsx`
**修改**: 第215行，添加 `include_subtitles=true` 参数

```typescript
// 修改前
const url = `http://localhost:${apiPort}/api/videos/${id}`;

// 修改后  
const url = `http://localhost:${apiPort}/api/videos/${id}?include_subtitles=true`;
```

**文件**: `frontend/electron-app/src/pages/VideoDetailWithTranslation.tsx`
**修改**: 第203行，添加 `include_subtitles=true` 参数

```typescript
// 修改前
const response = await fetch(`http://localhost:${apiPort}/api/videos/${id}`);

// 修改后
const response = await fetch(`http://localhost:${apiPort}/api/videos/${id}?include_subtitles=true`);
```

### 2. API接口说明

**后端接口**: `GET /api/videos/{video_id}`
**参数**: 
- `include_subtitles`: boolean，默认为 `false`
- 当为 `true` 时，返回完整的字幕轨道信息
- 当为 `false` 时，只返回基本视频信息（提升响应速度）

## 测试验证

### 测试结果
✅ **不包含字幕参数** (`include_subtitles=false`)：字幕轨道数量为0
✅ **包含字幕参数** (`include_subtitles=true`)：正确返回9个字幕轨道

### 测试输出
```
2. 测试不包含字幕信息的调用...
字幕轨道数量: 0
has_embedded_subtitle: False

3. 测试包含字幕信息的调用...
字幕轨道数量: 9
has_embedded_subtitle: False
字幕轨道详情:
  轨道 0: 索引=0, 语言=eng, 标题=English
  轨道 1: 索引=1, 语言=spa, 标题=Latin American Spanish
  ...
```

## 其他发现

### 1. has_embedded_subtitle 字段问题
注意到 `has_embedded_subtitle` 仍然为 `False`，但实际上视频有9个字幕轨道。这可能是另一个需要修复的问题，但不影响字幕轨道的正常使用。

### 2. by-frontend-id 接口正常
`/api/videos/by-frontend-id/{frontend_id}` 接口已经自动处理字幕轨道提取，无需修改。

## 用户操作建议

1. **立即生效**：修复已经应用到前端代码
2. **重新加载页面**：刷新视频详情页面即可看到字幕轨道信息
3. **重新导入**：对于之前有问题的视频，重新导入或刷新页面即可

## 技术改进

1. **API调用优化**：前端现在正确请求完整的视频信息
2. **响应速度平衡**：保持了API的灵活性，可以根据需要选择是否包含字幕信息
3. **用户体验提升**：用户现在能够正确看到视频的字幕轨道信息

## 预防措施

1. **API文档完善**：确保前端开发者了解所有可用参数
2. **默认值考虑**：考虑是否应该将 `include_subtitles` 的默认值改为 `true`
3. **测试覆盖**：添加端到端测试确保前后端集成正常
