"""SubTranslate API简单测试脚本

本脚本用于测试SubTranslate API的基本端点，确保API服务正常运行。
"""

import sys
import json
import requests

# API基础URL
BASE_URL = "http://127.0.0.1:8000"


def test_root_endpoint():
    """测试根端点"""
    try:
        print("测试: 根端点")
        response = requests.get(f"{BASE_URL}/")
        print(f"状态码: {response.status_code}")
        print(
            f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}"
        )
        print("-" * 50)
        return response.status_code == 200
    except Exception as e:
        print(f"错误: {e}")
        print("-" * 50)
        return False


def test_health_endpoint():
    """测试健康检查端点"""
    try:
        print("测试: 健康检查端点")
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"状态码: {response.status_code}")
        print(
            f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}"
        )
        print("-" * 50)
        return response.status_code == 200
    except Exception as e:
        print(f"错误: {e}")
        print("-" * 50)
        return False


def main():
    """主函数"""
    print("开始测试SubTranslate API基本端点...")

    # 检查服务器是否正在运行
    server_running = test_root_endpoint()
    if not server_running:
        print("API服务器未运行，无法继续测试。")
        print(
            "请确保服务器已启动（python -m uvicorn subtranslate.api.app:app --reload）"
        )
        sys.exit(1)

    # 测试健康检查
    test_health_endpoint()

    print("基本测试完成！")


if __name__ == "__main__":
    main()
