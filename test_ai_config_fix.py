#!/usr/bin/env python3
"""测试AI服务配置修复的脚本"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/translate"

def test_ai_config_with_frontend_format():
    """测试使用前端格式的AI服务配置"""
    print("=== 测试AI服务配置修复 ===")
    
    # 使用与前端相同的数据格式
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
            "id": "siliconflow",  # 前端发送的字段名
            "apiKey": "sk-test-key-12345",  # 前端发送的字段名
            "apiHost": "https://api.siliconflow.cn/v1"  # 前端发送的字段名
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
            print("✅ AI服务配置成功，返回预期的业务错误（视频不存在）")
            print(f"响应: {response.json()}")
            return True
        elif response.status_code == 400:
            response_data = response.json()
            error_message = response_data.get('message', '')
            if "'NoneType' object has no attribute 'model'" in error_message:
                print("❌ AI服务配置仍有问题：openai配置对象为None")
                print(f"错误详情: {error_message}")
                return False
            else:
                print("⚠️  其他400错误")
                print(f"错误详情: {error_message}")
                return False
        elif response.status_code == 422:
            print("❌ 请求解析失败")
            print(f"错误详情: {response.text}")
            return False
        else:
            print(f"⚠️  其他状态码: {response.status_code}")
            print(f"响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return False

def test_different_provider_formats():
    """测试不同提供商格式"""
    print("\n=== 测试不同提供商格式 ===")
    
    test_cases = [
        {
            "name": "SiliconFlow提供商",
            "provider_config": {
                "id": "siliconflow",
                "apiKey": "sk-test-key",
                "apiHost": "https://api.siliconflow.cn/v1"
            }
        },
        {
            "name": "自定义提供商",
            "provider_config": {
                "id": "custom-deepseek",
                "apiKey": "sk-test-key",
                "apiHost": "https://api.deepseek.com/v1"
            }
        },
        {
            "name": "OpenAI提供商",
            "provider_config": {
                "id": "openai",
                "apiKey": "sk-test-key",
                "apiHost": "https://api.openai.com/v1"
            }
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\n测试 {test_case['name']}...")
        
        test_data = {
            "video_id": "test-video-id",
            "track_index": 0,
            "source_language": "en",
            "target_language": "zh",
            "style": "natural",
            "provider_config": test_case["provider_config"],
            "model_id": "test-model"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/video-subtitle-v2",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 404:
                print(f"✅ {test_case['name']} 配置成功")
                results.append(True)
            elif response.status_code == 400:
                error_message = response.json().get('message', '')
                if "'NoneType' object has no attribute 'model'" in error_message:
                    print(f"❌ {test_case['name']} 配置失败：AI服务配置问题")
                    results.append(False)
                else:
                    print(f"⚠️  {test_case['name']} 其他400错误: {error_message}")
                    results.append(False)
            else:
                print(f"⚠️  {test_case['name']} 状态码: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print(f"❌ {test_case['name']} 请求异常: {e}")
            results.append(False)
    
    return all(results)

def main():
    """主函数"""
    print("🧪 开始测试AI服务配置修复...")
    
    # 测试基本AI配置
    basic_test_ok = test_ai_config_with_frontend_format()
    
    # 测试不同提供商格式
    provider_test_ok = test_different_provider_formats()
    
    # 总结
    print("\n" + "="*50)
    print("📊 测试结果总结:")
    print(f"基本AI配置: {'✅ 通过' if basic_test_ok else '❌ 失败'}")
    print(f"提供商格式: {'✅ 通过' if provider_test_ok else '❌ 失败'}")
    
    if basic_test_ok and provider_test_ok:
        print("\n🎉 所有测试通过！AI服务配置修复成功！")
        sys.exit(0)
    else:
        print("\n❌ 部分测试失败，需要进一步修复")
        sys.exit(1)

if __name__ == "__main__":
    main()
