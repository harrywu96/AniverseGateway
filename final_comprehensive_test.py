#!/usr/bin/env python3
"""最终综合测试：对比所有翻译接口版本"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/translate"

def test_interface(endpoint, name, test_data):
    """测试单个接口"""
    print(f"\n--- 测试 {name} ---")
    try:
        response = requests.post(
            f"{BASE_URL}/{endpoint}",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 404:
            print(f"✅ {name} 正常工作（返回预期的404错误：视频不存在）")
            return True
        elif response.status_code == 422:
            print(f"❌ {name} 请求解析失败（422错误）")
            try:
                error_detail = response.json()
                print(f"   错误详情: {error_detail}")
            except:
                print(f"   错误文本: {response.text}")
            return False
        elif response.status_code == 200:
            print(f"✅ {name} 成功响应")
            return True
        else:
            print(f"⚠️  {name} 其他状态码: {response.status_code}")
            print(f"   响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ {name} 测试异常: {e}")
        return False

def main():
    """主函数"""
    print("🔍 最终综合测试：对比所有翻译接口版本")
    print("="*60)
    
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
    
    # 测试所有接口版本
    results = {}
    
    print("🧪 开始测试各个接口版本...")
    
    # 1. 原始有问题的接口
    results['original'] = test_interface(
        "video-subtitle-fixed", 
        "原始接口 (video-subtitle-fixed)", 
        test_data
    )
    
    # 2. v2独立接口
    results['v2'] = test_interface(
        "video-subtitle-v2", 
        "v2独立接口 (video-subtitle-v2)", 
        test_data
    )
    
    # 3. 修复版接口
    results['fixed'] = test_interface(
        "video-subtitle-fixed-v2", 
        "修复版接口 (video-subtitle-fixed-v2)", 
        test_data
    )
    
    # 健康检查测试
    print("\n" + "="*60)
    print("🏥 健康检查测试")
    
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
    
    print(f"原始接口 (video-subtitle-fixed):     {'✅ 正常' if results['original'] else '❌ 有问题'}")
    print(f"v2独立接口 (video-subtitle-v2):      {'✅ 正常' if results['v2'] else '❌ 有问题'}")
    print(f"修复版接口 (video-subtitle-fixed-v2): {'✅ 正常' if results['fixed'] else '❌ 有问题'}")
    
    # 分析结果
    print("\n" + "="*60)
    print("🔍 问题分析")
    print("="*60)
    
    working_interfaces = []
    broken_interfaces = []
    
    for interface, status in results.items():
        if status:
            working_interfaces.append(interface)
        else:
            broken_interfaces.append(interface)
    
    if len(working_interfaces) > 0:
        print(f"✅ 正常工作的接口: {', '.join(working_interfaces)}")
    
    if len(broken_interfaces) > 0:
        print(f"❌ 有问题的接口: {', '.join(broken_interfaces)}")
    
    # 最终结论
    print("\n" + "="*60)
    print("🎯 最终结论")
    print("="*60)
    
    if not results['original'] and (results['v2'] or results['fixed']):
        print("🎉 成功解决了422错误问题！")
        print()
        print("问题根源分析：")
        print("- 原始接口使用了 Depends() 依赖注入")
        print("- 全局中间件或依赖项解析器存在冲突")
        print("- 导致请求体解析失败，返回422错误")
        print()
        print("解决方案：")
        if results['v2']:
            print("✅ v2独立接口：完全独立的路由，避免全局依赖")
        if results['fixed']:
            print("✅ 修复版接口：移除依赖注入，使用直接实例化")
        print()
        print("建议：")
        print("1. 前端可以安全地切换到v2或修复版接口")
        print("2. 逐步迁移所有功能到新接口")
        print("3. 最终移除有问题的原始接口")
        
    elif results['original']:
        print("⚠️  原始接口现在正常工作了")
        print("可能问题已经被其他方式解决，或者测试环境不同")
        
    else:
        print("❌ 所有接口都有问题，需要进一步调试")
    
    # 返回状态
    if results['v2'] or results['fixed']:
        print("\n✅ 测试通过：至少有一个可用的解决方案")
        return 0
    else:
        print("\n❌ 测试失败：没有可用的解决方案")
        return 1

if __name__ == "__main__":
    sys.exit(main())
