#!/usr/bin/env python3
"""测试所有翻译相关接口是否存在422问题"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/translate"

def test_endpoint(endpoint, method, data=None, name=""):
    """测试单个端点"""
    print(f"\n--- 测试 {name} ({method} {endpoint}) ---")
    try:
        if method.upper() == "GET":
            response = requests.get(f"{BASE_URL}/{endpoint}")
        elif method.upper() == "POST":
            response = requests.post(
                f"{BASE_URL}/{endpoint}",
                json=data,
                headers={"Content-Type": "application/json"}
            )
        else:
            print(f"❌ 不支持的方法: {method}")
            return False
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 422:
            print(f"❌ {name} 存在422错误（请求解析失败）")
            try:
                error_detail = response.json()
                print(f"   错误详情: {error_detail}")
            except:
                print(f"   错误文本: {response.text}")
            return False
        elif response.status_code in [200, 404, 501]:
            print(f"✅ {name} 正常工作（状态码: {response.status_code}）")
            return True
        else:
            print(f"⚠️  {name} 其他状态码: {response.status_code}")
            print(f"   响应: {response.text[:200]}...")
            return True  # 不是422错误就算正常
            
    except Exception as e:
        print(f"❌ {name} 测试异常: {e}")
        return False

def main():
    """主函数"""
    print("🔍 检查所有翻译相关接口是否存在422问题")
    print("="*60)
    
    # 准备测试数据
    line_translate_data = {
        "text": "Hello, world!",
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "service_type": "network_provider"
    }
    
    section_translate_data = {
        "lines": [
            {"text": "Hello", "start": 0, "end": 1000},
            {"text": "World", "start": 1000, "end": 2000}
        ],
        "source_language": "en",
        "target_language": "zh"
    }
    
    video_subtitle_data = {
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
    
    # 测试所有翻译接口
    results = {}
    
    print("🧪 开始测试各个翻译接口...")
    
    # 1. 单行翻译接口
    results['line'] = test_endpoint(
        "line", 
        "POST", 
        line_translate_data, 
        "单行翻译接口 (/line)"
    )
    
    # 2. 片段翻译接口
    results['section'] = test_endpoint(
        "section", 
        "POST", 
        section_translate_data, 
        "片段翻译接口 (/section)"
    )
    
    # 3. 原始视频字幕翻译接口
    results['video_original'] = test_endpoint(
        "video-subtitle-fixed", 
        "POST", 
        video_subtitle_data, 
        "原始视频字幕翻译接口 (/video-subtitle-fixed)"
    )
    
    # 4. v2视频字幕翻译接口
    results['video_v2'] = test_endpoint(
        "video-subtitle-v2", 
        "POST", 
        video_subtitle_data, 
        "v2视频字幕翻译接口 (/video-subtitle-v2)"
    )
    
    # 5. 修复版视频字幕翻译接口
    results['video_fixed'] = test_endpoint(
        "video-subtitle-fixed-v2", 
        "POST", 
        video_subtitle_data, 
        "修复版视频字幕翻译接口 (/video-subtitle-fixed-v2)"
    )
    
    # 6. 提供商列表接口
    results['providers'] = test_endpoint(
        "providers", 
        "GET", 
        None, 
        "提供商列表接口 (/providers)"
    )
    
    # 7. 模板列表接口
    results['templates'] = test_endpoint(
        "templates", 
        "GET", 
        None, 
        "模板列表接口 (/templates)"
    )
    
    # 健康检查接口
    print("\n" + "="*60)
    print("🏥 健康检查接口测试")
    
    health_endpoints = [
        ("health-v2", "v2健康检查"),
        ("health-fixed", "修复版健康检查")
    ]
    
    for endpoint, name in health_endpoints:
        try:
            response = requests.get(f"{BASE_URL}/{endpoint}")
            if response.status_code == 200:
                print(f"✅ {name}: 正常")
            else:
                print(f"❌ {name}: 异常 ({response.status_code})")
        except Exception as e:
            print(f"❌ {name}: 异常 ({e})")
    
    # 总结报告
    print("\n" + "="*60)
    print("📊 测试总结报告")
    print("="*60)
    
    working_interfaces = []
    broken_interfaces = []
    
    for interface, status in results.items():
        if status:
            working_interfaces.append(interface)
        else:
            broken_interfaces.append(interface)
    
    print("✅ 正常工作的接口:")
    for interface in working_interfaces:
        print(f"   - {interface}")
    
    if broken_interfaces:
        print("\n❌ 有422问题的接口:")
        for interface in broken_interfaces:
            print(f"   - {interface}")
    else:
        print("\n🎉 没有发现422问题的接口！")
    
    # 分析依赖注入问题
    print("\n" + "="*60)
    print("🔍 依赖注入问题分析")
    print("="*60)
    
    depends_interfaces = {
        'line': '使用 Depends(get_system_config), Depends(get_subtitle_translator)',
        'section': '使用 Depends(get_system_config), Depends(get_subtitle_translator)', 
        'video_original': '使用 Depends(get_system_config), Depends(get_video_storage)',
        'providers': '使用 Depends(get_system_config)',
        'templates': '使用 Depends(get_subtitle_translator)'
    }
    
    print("使用依赖注入的接口:")
    for interface, deps in depends_interfaces.items():
        status = "❌ 有问题" if not results.get(interface, True) else "✅ 正常"
        print(f"   - {interface}: {deps} - {status}")
    
    print("\n不使用依赖注入的接口:")
    no_depends_interfaces = ['video_v2', 'video_fixed']
    for interface in no_depends_interfaces:
        status = "❌ 有问题" if not results.get(interface, True) else "✅ 正常"
        print(f"   - {interface}: 直接实例化 - {status}")
    
    # 最终建议
    print("\n" + "="*60)
    print("💡 修复建议")
    print("="*60)
    
    if any(not results.get(interface, True) for interface in depends_interfaces.keys()):
        print("发现使用依赖注入的接口存在422问题，建议：")
        print("1. 为有问题的接口创建独立版本（类似v2接口）")
        print("2. 移除依赖注入，使用直接实例化")
        print("3. 逐步迁移前端调用到新接口")
        print("4. 最终移除有问题的原始接口")
    else:
        print("✅ 所有接口都正常工作，无需额外修复")
    
    # 返回状态
    if broken_interfaces:
        print(f"\n❌ 发现 {len(broken_interfaces)} 个有问题的接口")
        return 1
    else:
        print("\n✅ 所有接口都正常工作")
        return 0

if __name__ == "__main__":
    sys.exit(main())
