#!/usr/bin/env python3
"""测试独立翻译路由v2的脚本"""

import requests
import json
import sys

def test_health_check():
    """测试健康检查端点"""
    print("=== 测试健康检查端点 ===")
    try:
        response = requests.get("http://localhost:8000/api/translate/health-v2")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"健康检查失败: {e}")
        return False

def test_video_subtitle_v2():
    """测试视频字幕翻译v2接口"""
    print("\n=== 测试视频字幕翻译v2接口 ===")
    
    # 准备测试数据
    test_data = {
        "video_id": "test-video-123",
        "track_index": 0,
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "provider_config": {
            "type": "openai",
            "api_key": "test-key",
            "base_url": "https://api.openai.com/v1"
        },
        "model_id": "gpt-3.5-turbo",
        "chunk_size": 30,
        "context_window": 3,
        "context_preservation": True,
        "preserve_formatting": True
    }
    
    try:
        # 发送POST请求
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            print(f"成功响应: {response.json()}")
            return True
        else:
            print(f"错误响应: {response.text}")
            try:
                error_json = response.json()
                print(f"错误详情: {json.dumps(error_json, indent=2, ensure_ascii=False)}")
            except:
                pass
            return False
            
    except Exception as e:
        print(f"请求失败: {e}")
        return False

def test_original_video_subtitle():
    """测试原始视频字幕翻译接口（对比）"""
    print("\n=== 测试原始视频字幕翻译接口（对比） ===")
    
    # 准备测试数据
    test_data = {
        "video_id": "test-video-123",
        "track_index": 0,
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "provider_config": {
            "type": "openai",
            "api_key": "test-key",
            "base_url": "https://api.openai.com/v1"
        },
        "model_id": "gpt-3.5-turbo",
        "chunk_size": 30,
        "context_window": 3,
        "context_preservation": True,
        "preserve_formatting": True
    }
    
    try:
        # 发送POST请求到原始接口
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-fixed",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            print(f"成功响应: {response.json()}")
            return True
        else:
            print(f"错误响应: {response.text}")
            try:
                error_json = response.json()
                print(f"错误详情: {json.dumps(error_json, indent=2, ensure_ascii=False)}")
            except:
                pass
            return False
            
    except Exception as e:
        print(f"请求失败: {e}")
        return False

def main():
    """主函数"""
    print("开始测试独立翻译路由v2...")
    
    # 测试健康检查
    if not test_health_check():
        print("健康检查失败，退出测试")
        sys.exit(1)
    
    # 测试新的v2接口
    print("\n" + "="*50)
    v2_success = test_video_subtitle_v2()
    
    # 测试原始接口进行对比
    print("\n" + "="*50)
    original_success = test_original_video_subtitle()
    
    # 总结
    print("\n" + "="*50)
    print("=== 测试总结 ===")
    print(f"v2接口测试: {'成功' if v2_success else '失败'}")
    print(f"原始接口测试: {'成功' if original_success else '失败'}")
    
    if v2_success and not original_success:
        print("✅ v2接口工作正常，原始接口存在问题，说明独立路由解决了问题！")
    elif not v2_success and not original_success:
        print("❌ 两个接口都有问题，需要进一步调试")
    elif v2_success and original_success:
        print("✅ 两个接口都工作正常")
    else:
        print("⚠️  原始接口工作但v2接口有问题，需要检查v2实现")

if __name__ == "__main__":
    main()
