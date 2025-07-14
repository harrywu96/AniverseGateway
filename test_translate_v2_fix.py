#!/usr/bin/env python3
"""测试翻译v2修复的脚本"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/translate"

def test_health_check():
    """测试健康检查"""
    print("=== 测试健康检查 ===")
    try:
        response = requests.get(f"{BASE_URL}/health-v2")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 健康检查成功: {data['message']}")
            return True
        else:
            print(f"❌ 健康检查失败: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 健康检查异常: {e}")
        return False

def test_video_subtitle_translation():
    """测试视频字幕翻译接口"""
    print("\n=== 测试视频字幕翻译接口 ===")
    
    # 测试数据
    test_data = {
        "video_id": "test-video-id",
        "track_index": 0,
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "preserve_formatting": True,
        "context_preservation": True,
        "chunk_size": 10,
        "context_window": 3,
        "provider_config": {
            "provider_type": "siliconflow",
            "api_key": "test-key",
            "base_url": "https://api.siliconflow.cn/v1",
            "model_id": "deepseek-ai/DeepSeek-V3"
        },
        "model_id": "deepseek-ai/DeepSeek-V3"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 404:
            print("✅ 接口正常工作，返回预期的业务错误（视频不存在）")
            print(f"响应: {response.json()}")
            return True
        elif response.status_code == 422:
            print("❌ 接口仍有请求解析问题")
            print(f"错误详情: {response.text}")
            return False
        elif response.status_code == 500:
            response_data = response.json()
            if "'dict' object has no attribute 'file_path'" in response_data.get('message', ''):
                print("❌ 仍存在 file_path 属性错误")
                return False
            else:
                print("⚠️  其他服务器错误")
                print(f"错误详情: {response.text}")
                return False
        else:
            print(f"⚠️  其他状态码: {response.status_code}")
            print(f"响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return False

def main():
    """主函数"""
    print("🧪 开始测试翻译v2修复...")
    
    # 测试健康检查
    health_ok = test_health_check()
    if not health_ok:
        print("❌ 健康检查失败，退出测试")
        sys.exit(1)
    
    # 测试视频字幕翻译接口
    translation_ok = test_video_subtitle_translation()
    
    # 总结
    print("\n" + "="*50)
    print("📊 测试结果总结:")
    print(f"健康检查: {'✅ 通过' if health_ok else '❌ 失败'}")
    print(f"翻译接口: {'✅ 通过' if translation_ok else '❌ 失败'}")
    
    if health_ok and translation_ok:
        print("\n🎉 所有测试通过！修复成功！")
        sys.exit(0)
    else:
        print("\n❌ 部分测试失败，需要进一步修复")
        sys.exit(1)

if __name__ == "__main__":
    main()
