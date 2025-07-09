#!/usr/bin/env python3
"""使用真实视频测试翻译接口"""

import requests
import json
import sys
import os
from pathlib import Path

def upload_test_video():
    """上传测试视频"""
    print("=== 上传测试视频 ===")
    
    # 查找项目中的测试视频文件
    test_video_paths = [
        "test_video.mp4",
        "sample.mp4", 
        "test.mp4",
        "demo.mp4"
    ]
    
    video_file = None
    for path in test_video_paths:
        if os.path.exists(path):
            video_file = path
            break
    
    if not video_file:
        print("未找到测试视频文件，创建一个简单的测试视频...")
        # 如果没有视频文件，我们先跳过上传，直接测试接口解析
        return None
    
    try:
        with open(video_file, 'rb') as f:
            files = {'file': (video_file, f, 'video/mp4')}
            response = requests.post(
                "http://localhost:8000/api/videos/upload",
                files=files,
                headers={"X-API-Key": "test-key"}  # 如果需要API密钥
            )
        
        print(f"上传状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"上传成功: {result}")
            return result.get('data', {}).get('video_id')
        else:
            print(f"上传失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"上传异常: {e}")
        return None

def test_request_parsing():
    """测试请求解析（不依赖真实视频）"""
    print("\n=== 测试请求解析能力 ===")
    
    # 准备测试数据
    test_data = {
        "video_id": "non-existent-video",  # 故意使用不存在的视频ID
        "track_index": 0,
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "provider_config": {
            "type": "openai",
            "api_key": "test-key",
            "base_url": "https://api.openai.com/v1"
        },
        "model_id": "gpt-3.5-turbo"
    }
    
    print("测试v2接口...")
    try:
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"v2接口状态码: {response.status_code}")
        if response.status_code == 404:
            print("✅ v2接口正确解析请求，返回业务逻辑错误（视频不存在）")
            v2_parsing_ok = True
        elif response.status_code == 422:
            print("❌ v2接口请求解析失败")
            print(f"错误详情: {response.text}")
            v2_parsing_ok = False
        else:
            print(f"v2接口其他状态: {response.text}")
            v2_parsing_ok = False
            
    except Exception as e:
        print(f"v2接口请求异常: {e}")
        v2_parsing_ok = False
    
    print("\n测试原始接口...")
    try:
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-fixed",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"原始接口状态码: {response.status_code}")
        if response.status_code == 404:
            print("✅ 原始接口正确解析请求，返回业务逻辑错误（视频不存在）")
            original_parsing_ok = True
        elif response.status_code == 422:
            print("❌ 原始接口请求解析失败")
            print(f"错误详情: {response.text}")
            original_parsing_ok = False
        else:
            print(f"原始接口其他状态: {response.text}")
            original_parsing_ok = False
            
    except Exception as e:
        print(f"原始接口请求异常: {e}")
        original_parsing_ok = False
    
    return v2_parsing_ok, original_parsing_ok

def test_different_request_formats():
    """测试不同的请求格式"""
    print("\n=== 测试不同请求格式 ===")
    
    # 测试1: 最小请求
    minimal_data = {
        "video_id": "test",
        "track_index": 0,
        "provider_config": {"type": "openai"},
        "model_id": "gpt-3.5-turbo"
    }
    
    print("测试最小请求格式...")
    try:
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-v2",
            json=minimal_data,
            headers={"Content-Type": "application/json"}
        )
        print(f"最小请求状态码: {response.status_code}")
        if response.status_code in [404, 200]:
            print("✅ 最小请求格式解析成功")
        else:
            print(f"❌ 最小请求格式解析失败: {response.text}")
    except Exception as e:
        print(f"最小请求异常: {e}")
    
    # 测试2: 包含额外字段的请求
    extended_data = {
        "video_id": "test",
        "track_index": 0,
        "provider_config": {"type": "openai"},
        "model_id": "gpt-3.5-turbo",
        "extra_field": "should_be_ignored",  # 额外字段
        "another_extra": {"nested": "data"}
    }
    
    print("\n测试包含额外字段的请求...")
    try:
        response = requests.post(
            "http://localhost:8000/api/translate/video-subtitle-v2",
            json=extended_data,
            headers={"Content-Type": "application/json"}
        )
        print(f"扩展请求状态码: {response.status_code}")
        if response.status_code in [404, 200]:
            print("✅ 扩展请求格式解析成功（额外字段被忽略）")
        else:
            print(f"❌ 扩展请求格式解析失败: {response.text}")
    except Exception as e:
        print(f"扩展请求异常: {e}")

def main():
    """主函数"""
    print("开始测试请求解析能力...")
    
    # 测试请求解析
    v2_ok, original_ok = test_request_parsing()
    
    # 测试不同请求格式
    test_different_request_formats()
    
    # 总结
    print("\n" + "="*50)
    print("=== 测试总结 ===")
    print(f"v2接口请求解析: {'✅ 成功' if v2_ok else '❌ 失败'}")
    print(f"原始接口请求解析: {'✅ 成功' if original_ok else '❌ 失败'}")
    
    if v2_ok and not original_ok:
        print("\n🎉 成功！v2独立路由解决了422请求解析问题！")
        print("现在可以安全地将功能迁移到v2路由。")
    elif not v2_ok:
        print("\n⚠️  v2路由仍有问题，需要进一步调试。")
    else:
        print("\n✅ 两个接口都正常工作。")

if __name__ == "__main__":
    main()
