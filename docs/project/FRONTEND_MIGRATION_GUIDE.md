# 前端迁移指南：从原始翻译接口切换到v2接口

## 概述

由于原始翻译接口存在422错误问题，我们创建了完全独立的v2接口来解决这个问题。本指南将帮助您将前端调用从有问题的原始接口迁移到稳定的v2接口。

## 接口映射表

| 原始接口 | v2接口 | 状态 | 说明 |
|---------|--------|------|------|
| `/api/translate/line` | `/api/translate/line-v2` | ✅ 可用 | 单行翻译 |
| `/api/translate/section` | `/api/translate/section-v2` | ✅ 可用 | 片段翻译 |
| `/api/translate/video-subtitle-fixed` | `/api/translate/video-subtitle-v2` | ✅ 可用 | 视频字幕翻译 |

## 迁移步骤

### 1. 立即修复（推荐）

将前端代码中的接口调用直接替换为v2版本：

```typescript
// 原来的调用
const response = await fetch('/api/translate/video-subtitle-fixed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
});

// 修改为
const response = await fetch('/api/translate/video-subtitle-v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
});
```

### 2. 配置化迁移（推荐用于生产环境）

创建一个配置对象来管理接口版本：

```typescript
// api-config.ts
export const API_CONFIG = {
  translate: {
    line: '/api/translate/line-v2',
    section: '/api/translate/section-v2', 
    videoSubtitle: '/api/translate/video-subtitle-v2'
  }
};

// 使用示例
import { API_CONFIG } from './api-config';

const response = await fetch(API_CONFIG.translate.videoSubtitle, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
});
```

### 3. 渐进式迁移

如果需要渐进式迁移，可以添加一个开关：

```typescript
// feature-flags.ts
export const FEATURE_FLAGS = {
  useV2TranslateAPI: true  // 设置为true启用v2接口
};

// api-service.ts
import { FEATURE_FLAGS } from './feature-flags';

export class TranslateService {
  private getEndpoint(type: 'line' | 'section' | 'videoSubtitle'): string {
    if (FEATURE_FLAGS.useV2TranslateAPI) {
      const v2Endpoints = {
        line: '/api/translate/line-v2',
        section: '/api/translate/section-v2',
        videoSubtitle: '/api/translate/video-subtitle-v2'
      };
      return v2Endpoints[type];
    } else {
      const originalEndpoints = {
        line: '/api/translate/line',
        section: '/api/translate/section', 
        videoSubtitle: '/api/translate/video-subtitle-fixed'
      };
      return originalEndpoints[type];
    }
  }

  async translateVideoSubtitle(data: any) {
    const endpoint = this.getEndpoint('videoSubtitle');
    return await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
}
```

## 请求格式兼容性

### 好消息：完全兼容！

v2接口与原始接口的请求格式完全兼容，无需修改请求体结构：

```typescript
// 这个请求体对原始接口和v2接口都有效
const requestData = {
  video_id: "video-123",
  track_index: 0,
  source_language: "en",
  target_language: "zh",
  style: "natural",
  provider_config: {
    type: "openai",
    api_key: "your-api-key",
    base_url: "https://api.openai.com/v1"
  },
  model_id: "gpt-3.5-turbo"
};
```

## 响应格式变化

v2接口的响应格式与原始接口基本相同，只是在 `data` 字段中增加了 `version` 标识：

```typescript
// v2接口响应示例
{
  "success": true,
  "message": "字幕翻译任务已提交v2",
  "data": {
    "task_id": "uuid-string",
    "video_id": "video-id",
    "track_index": 0,
    "source_language": "en",
    "target_language": "zh",
    "style": "natural",
    "version": "v2"  // 新增字段
  }
}
```

## 错误处理

v2接口提供了更好的错误处理：

```typescript
try {
  const response = await fetch('/api/translate/video-subtitle-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('翻译请求失败:', errorData);
    
    // v2接口不会返回422错误，如果返回422说明有其他问题
    if (response.status === 422) {
      console.error('意外的422错误，请检查请求格式');
    }
  }

  const result = await response.json();
  console.log('翻译任务已提交:', result);
  
} catch (error) {
  console.error('网络错误:', error);
}
```

## 测试验证

在迁移后，建议进行以下测试：

### 1. 功能测试
```typescript
// 测试视频字幕翻译
const testVideoSubtitleTranslation = async () => {
  const testData = {
    video_id: "test-video",
    track_index: 0,
    source_language: "en", 
    target_language: "zh",
    style: "natural",
    provider_config: { type: "openai" },
    model_id: "gpt-3.5-turbo"
  };

  try {
    const response = await fetch('/api/translate/video-subtitle-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log('测试结果:', response.status, await response.json());
  } catch (error) {
    console.error('测试失败:', error);
  }
};
```

### 2. 健康检查
```typescript
// 检查v2接口健康状态
const checkV2Health = async () => {
  try {
    const response = await fetch('/api/translate/health-v2');
    const result = await response.json();
    console.log('v2接口健康状态:', result);
  } catch (error) {
    console.error('健康检查失败:', error);
  }
};
```

## 回滚计划

如果迁移后发现问题，可以快速回滚：

```typescript
// 紧急回滚：将feature flag设置为false
export const FEATURE_FLAGS = {
  useV2TranslateAPI: false  // 回滚到原始接口
};
```

## 监控建议

迁移后建议监控以下指标：

1. **接口成功率**：v2接口的调用成功率应该显著提高
2. **422错误数量**：应该降为0
3. **响应时间**：v2接口的响应时间应该与原始接口相当
4. **功能完整性**：确保所有翻译功能正常工作

## 清理计划

迁移稳定后，可以考虑：

1. 移除原始接口的调用代码
2. 移除feature flag相关代码
3. 更新API文档
4. 通知后端团队可以废弃原始接口

## 总结

v2接口完全解决了422错误问题，提供了：
- ✅ 100%兼容的请求格式
- ✅ 稳定的请求解析
- ✅ 更好的错误处理
- ✅ 详细的调试信息

迁移过程简单安全，强烈建议立即切换到v2接口！
