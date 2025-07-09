#!/usr/bin/env python3
"""全面测试v2独立翻译路由的脚本"""

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

def test_dependencies():
    """测试依赖项状态"""
    print("\n=== 测试依赖项状态 ===")
    try:
        response = requests.get(f"{BASE_URL}/debug/dependencies")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 依赖项检查成功")
            print(f"   配置加载: {data['data']['config_loaded']}")
            print(f"   视频存储: {data['data']['video_storage_initialized']}")
            print(f"   翻译器: {data['data']['translator_initialized']}")
            print(f"   视频数量: {data['data']['video_count']}")
            print(f"   临时目录: {data['data']['temp_dir']}")
            print(f"   AI提供商: {data['data']['ai_provider']}")
            return True
        else:
            print(f"❌ 依赖项检查失败: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 依赖项检查异常: {e}")
        return False

def test_request_parsing():
    """测试请求解析"""
    print("\n=== 测试请求解析 ===")
    
    test_data = {
        "video_id": "test-video",
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
    
    try:
        response = requests.post(
            f"{BASE_URL}/debug/parse-request",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 请求解析成功")
            print(f"   原始请求体大小: {data['data']['raw_body_size']} bytes")
            print(f"   Content-Type: {data['data']['content_type']}")
            print(f"   解析的字段数: {len(data['data']['parsed_request'])}")
            return True
        else:
            print(f"❌ 请求解析失败: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 请求解析异常: {e}")
        return False

def test_video_subtitle_interface():
    """测试视频字幕翻译接口"""
    print("\n=== 测试视频字幕翻译接口 ===")
    
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
        response = requests.post(
            f"{BASE_URL}/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 404:
            print("✅ 接口正常工作（返回预期的404错误：视频不存在）")
            data = response.json()
            print(f"   错误消息: {data['message']}")
            return True
        elif response.status_code == 422:
            print("❌ 接口请求解析失败（422错误）")
            print(f"   错误详情: {response.text}")
            return False
        elif response.status_code == 200:
            print("✅ 接口成功响应（如果有真实视频）")
            data = response.json()
            print(f"   任务ID: {data['data']['task_id']}")
            return True
        else:
            print(f"⚠️  接口返回其他状态码: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 接口测试异常: {e}")
        return False

def compare_with_original():
    """与原始接口对比"""
    print("\n=== 与原始接口对比 ===")
    
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
        "model_id": "gpt-3.5-turbo"
    }
    
    # 测试原始接口
    print("测试原始接口...")
    try:
        response = requests.post(
            f"{BASE_URL}/video-subtitle-fixed",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"原始接口状态码: {response.status_code}")
        if response.status_code == 422:
            print("❌ 原始接口存在422错误（请求解析失败）")
            original_ok = False
        elif response.status_code == 404:
            print("✅ 原始接口正常工作")
            original_ok = True
        else:
            print(f"⚠️  原始接口其他状态: {response.text}")
            original_ok = False
    except Exception as e:
        print(f"❌ 原始接口测试异常: {e}")
        original_ok = False
    
    # 测试v2接口
    print("\n测试v2接口...")
    try:
        response = requests.post(
            f"{BASE_URL}/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"v2接口状态码: {response.status_code}")
        if response.status_code == 404:
            print("✅ v2接口正常工作")
            v2_ok = True
        elif response.status_code == 422:
            print("❌ v2接口存在422错误")
            v2_ok = False
        else:
            print(f"⚠️  v2接口其他状态: {response.text}")
            v2_ok = False
    except Exception as e:
        print(f"❌ v2接口测试异常: {e}")
        v2_ok = False
    
    return original_ok, v2_ok

def main():
    """主函数"""
    print("开始全面测试v2独立翻译路由...")
    print("="*60)
    
    results = {}
    
    # 执行各项测试
    results['health'] = test_health_check()
    results['dependencies'] = test_dependencies()
    results['parsing'] = test_request_parsing()
    results['interface'] = test_video_subtitle_interface()
    
    # 对比测试
    original_ok, v2_ok = compare_with_original()
    results['original'] = original_ok
    results['v2'] = v2_ok
    
    # 总结报告
    print("\n" + "="*60)
    print("=== 测试总结报告 ===")
    print(f"健康检查: {'✅ 通过' if results['health'] else '❌ 失败'}")
    print(f"依赖项状态: {'✅ 通过' if results['dependencies'] else '❌ 失败'}")
    print(f"请求解析: {'✅ 通过' if results['parsing'] else '❌ 失败'}")
    print(f"接口功能: {'✅ 通过' if results['interface'] else '❌ 失败'}")
    print(f"原始接口: {'✅ 正常' if results['original'] else '❌ 有问题'}")
    print(f"v2接口: {'✅ 正常' if results['v2'] else '❌ 有问题'}")
    
    # 最终结论
    print("\n" + "="*60)
    if results['v2'] and not results['original']:
        print("🎉 成功！v2独立路由完美解决了422错误问题！")
        print("✅ v2路由可以正常解析请求并处理业务逻辑")
        print("❌ 原始路由存在请求解析问题")
        print("\n建议：可以安全地将前端调用切换到v2接口")
    elif results['v2'] and results['original']:
        print("✅ 两个接口都正常工作")
        print("可能原始问题已经被其他方式解决")
    elif not results['v2']:
        print("❌ v2接口仍有问题，需要进一步调试")
    else:
        print("⚠️  测试结果不明确，需要人工检查")
    
    # 返回总体成功状态
    overall_success = all([
        results['health'],
        results['dependencies'], 
        results['parsing'],
        results['interface'],
        results['v2']
    ])
    
    return 0 if overall_success else 1

if __name__ == "__main__":
    sys.exit(main())
