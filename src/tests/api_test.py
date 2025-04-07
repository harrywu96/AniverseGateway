"""API测试脚本

这个脚本用于测试SubTranslate API的各种接口功能。
"""

import requests
import json
import time
import asyncio
import websockets
import sys
import os
from pathlib import Path

# 确保在src同级目录运行脚本
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

# API服务器地址
API_BASE_URL = "http://localhost:8000"
WS_BASE_URL = "ws://localhost:8000"

# 测试结果颜色标记
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

# 测试结果统计
results = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "total": 0
}


def print_result(name, result, message=None):
    """打印测试结果
    
    Args:
        name: 测试名称
        result: 测试结果 (passed, failed, skipped)
        message: 额外信息
    """
    if result == "passed":
        status = f"{GREEN}通过{RESET}"
        results["passed"] += 1
    elif result == "failed":
        status = f"{RED}失败{RESET}"
        results["failed"] += 1
    else:  # skipped
        status = f"{YELLOW}跳过{RESET}"
        results["skipped"] += 1
    
    results["total"] += 1
    
    print(f"测试 {name}: {status}")
    if message:
        print(f"  {message}")
    print()


def test_health_check():
    """测试健康检查接口"""
    url = f"{API_BASE_URL}/api/health"
    try:
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data.get("success") and data.get("data", {}).get("status") == "healthy":
            print_result("健康检查", "passed")
            return True
        else:
            print_result("健康检查", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("健康检查", "failed", f"异常: {str(e)}")
        return False


def test_root_endpoint():
    """测试根接口"""
    url = f"{API_BASE_URL}/"
    try:
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            print_result("根接口", "passed")
            return True
        else:
            print_result("根接口", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("根接口", "failed", f"异常: {str(e)}")
        return False


def test_line_translation():
    """测试单行翻译接口"""
    url = f"{API_BASE_URL}/api/translate/line"
    payload = {
        "text": "Hello, this is a test for subtitle translation.",
        "source_language": "en",
        "target_language": "zh",
        "style": "natural"
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            print_result("单行翻译", "passed", f"翻译结果: {data.get('data', {}).get('translated_text', '')}")
            return True
        elif response.status_code == 500:
            print_result("单行翻译", "failed", f"服务器错误: {data.get('message', '未知错误')}")
            return False
        else:
            print_result("单行翻译", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("单行翻译", "failed", f"异常: {str(e)}")
        return False


def test_ai_providers():
    """测试获取AI提供商列表接口"""
    url = f"{API_BASE_URL}/api/translate/providers"
    try:
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            providers = data.get("data", {}).get("providers", [])
            active = data.get("data", {}).get("active_provider", "")
            print_result("AI提供商列表", "passed", f"可用提供商: {', '.join(providers)}, 当前激活: {active}")
            return True
        else:
            print_result("AI提供商列表", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("AI提供商列表", "failed", f"异常: {str(e)}")
        return False


def test_templates():
    """测试获取翻译模板列表接口"""
    url = f"{API_BASE_URL}/api/translate/templates"
    try:
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            templates = data.get("data", [])
            template_names = [t.get("name") for t in templates]
            print_result("翻译模板列表", "passed", f"可用模板: {', '.join(template_names) if template_names else '无'}")
            return True
        else:
            print_result("翻译模板列表", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("翻译模板列表", "failed", f"异常: {str(e)}")
        return False


def test_section_translation():
    """测试字幕片段翻译接口"""
    url = f"{API_BASE_URL}/api/translate/section"
    payload = {
        "lines": [
            {"line_id": "1", "text": "Hello, this is line one."},
            {"line_id": "2", "text": "This is the second line."}
        ],
        "source_language": "en",
        "target_language": "zh"
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        
        if response.status_code == 501:
            # 预期这个接口未实现
            print_result("字幕片段翻译", "skipped", "功能未实现 (预期结果)")
            return True
        elif response.status_code == 200 and data.get("success"):
            print_result("字幕片段翻译", "passed", "功能已实现，测试通过")
            return True
        else:
            print_result("字幕片段翻译", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("字幕片段翻译", "failed", f"异常: {str(e)}")
        return False


async def test_websocket():
    """测试WebSocket连接"""
    url = f"{WS_BASE_URL}/ws/tasks/test_task_id"
    try:
        async with websockets.connect(url) as websocket:
            # 发送消息
            await websocket.send(json.dumps({"type": "test", "data": "test_message"}))
            
            # 设置超时等待响应
            response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
            data = json.loads(response)
            
            if data.get("status") == "received":
                print_result("WebSocket连接", "passed", f"响应: {data}")
                return True
            else:
                print_result("WebSocket连接", "failed", f"意外响应: {data}")
                return False
    except asyncio.TimeoutError:
        print_result("WebSocket连接", "failed", "超时，未收到响应")
        return False
    except Exception as e:
        print_result("WebSocket连接", "failed", f"异常: {str(e)}")
        return False


def print_summary():
    """打印测试结果汇总"""
    print("\n=============== 测试结果汇总 ===============")
    print(f"通过: {GREEN}{results['passed']}{RESET}")
    print(f"失败: {RED}{results['failed']}{RESET}")
    print(f"跳过: {YELLOW}{results['skipped']}{RESET}")
    print(f"总计: {results['total']}")
    print("===========================================\n")


def main():
    """主测试函数"""
    print("开始API测试...\n")
    
    # 基础API测试
    if not test_health_check():
        print(f"{YELLOW}警告: 健康检查失败，API服务器可能未运行，跳过后续测试。{RESET}")
        print_summary()
        return
    
    test_root_endpoint()
    
    # 翻译相关API测试
    test_line_translation()
    test_ai_providers()
    test_templates()
    test_section_translation()
    
    # 异步测试
    try:
        asyncio.run(test_websocket())
    except Exception as e:
        print_result("WebSocket连接", "failed", f"运行异步测试失败: {str(e)}")
    
    # 打印汇总信息
    print_summary()


if __name__ == "__main__":
    main() 