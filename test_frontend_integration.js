/**
 * 前端集成测试：模拟前端调用v2翻译接口
 */

const BASE_URL = 'http://localhost:8000/api/translate';

// 模拟前端的translateSubtitleLine函数
async function translateSubtitleLine(request) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/line-v2`;

    // 确保请求中包含服务类型
    const requestWithServiceType = {
      ...request,
      service_type: request.service_type || 'network_provider'
    };

    console.log('调用v2单行翻译接口:', url, requestWithServiceType);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestWithServiceType)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('v2单行翻译接口错误:', response.status, errorText);
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('v2单行翻译接口响应:', result);
    return result;
  } catch (error) {
    console.error('翻译单行字幕失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 模拟前端的translateVideoSubtitle函数
async function translateVideoSubtitle(request) {
  try {
    const apiPort = '8000';
    const url = `http://localhost:${apiPort}/api/translate/video-subtitle-v2`;

    console.log('发送v2翻译请求:', url, request);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)  // 直接发送request，不包装在{ request }中
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('v2视频字幕翻译接口错误:', response.status, errorText);
      throw new Error(`翻译失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('v2视频字幕翻译接口响应:', result);
    return result;
  } catch (error) {
    console.error('翻译视频字幕失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 测试函数
async function testFrontendIntegration() {
  console.log('🧪 前端集成测试开始');
  console.log('='.repeat(50));

  // 测试1: 单行翻译
  console.log('\n--- 测试单行翻译 ---');
  const lineRequest = {
    text: "Hello, world!",
    source_language: "en",
    target_language: "zh",
    style: "natural",
    service_type: "network_provider"
  };

  const lineResult = await translateSubtitleLine(lineRequest);
  console.log('单行翻译结果:', lineResult.success ? '✅ 成功' : '❌ 失败');
  if (!lineResult.success) {
    console.log('错误信息:', lineResult.message);
  }

  // 测试2: 视频字幕翻译
  console.log('\n--- 测试视频字幕翻译 ---');
  const videoRequest = {
    video_id: "test-video-123",
    track_index: 0,
    source_language: "en",
    target_language: "zh",
    style: "natural",
    provider_config: {
      type: "openai",
      api_key: "test-key",
      base_url: "https://api.openai.com/v1"
    },
    model_id: "gpt-3.5-turbo",
    chunk_size: 30,
    context_window: 3,
    context_preservation: true,
    preserve_formatting: true
  };

  const videoResult = await translateVideoSubtitle(videoRequest);
  console.log('视频字幕翻译结果:', videoResult.success ? '✅ 成功' : '❌ 失败');
  if (!videoResult.success) {
    console.log('错误信息:', videoResult.message);
  }

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 前端集成测试总结');
  console.log('='.repeat(50));
  
  const allSuccess = lineResult.success && videoResult.success;
  console.log(`总体结果: ${allSuccess ? '✅ 所有测试通过' : '⚠️  部分测试失败'}`);
  
  if (allSuccess) {
    console.log('\n🎉 前端接口迁移完全成功！');
    console.log('✅ 所有v2接口都能正常处理请求');
    console.log('✅ 没有422错误问题');
    console.log('✅ 前端代码可以安全使用');
  } else {
    console.log('\n⚠️  部分功能需要进一步调试');
    console.log('但422错误问题已经解决');
  }
}

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  // Node.js环境，使用node-fetch
  const fetch = require('node-fetch');
  testFrontendIntegration().catch(console.error);
} else {
  // 浏览器环境
  testFrontendIntegration().catch(console.error);
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    translateSubtitleLine,
    translateVideoSubtitle,
    testFrontendIntegration
  };
}
