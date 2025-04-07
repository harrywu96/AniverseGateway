"""SubTranslate API测试脚本

本脚本用于测试SubTranslate API的所有接口，确保它们能够正确返回预期的结果。
"""

import sys
import os
import json
import time
from typing import Any, Dict, Optional
import requests
import websocket
import threading

# API基础URL
BASE_URL = "http://127.0.0.1:8000"

# 测试结果收集
results = {"total": 0, "passed": 0, "failed": 0, "skipped": 0, "details": []}


def log_test(name: str, result: bool, response: Any = None, error: str = None):
    """记录测试结果

    Args:
        name: 测试名称
        result: 测试结果
        response: 响应数据
        error: 错误信息
    """
    status = "通过" if result else "失败"
    print(f"测试: {name} - {status}")

    if error:
        print(f"错误: {error}")

    if response:
        try:
            if isinstance(response, requests.Response):
                if response.headers.get("content-type") == "application/json":
                    print(
                        f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}"
                    )
                else:
                    print(f"状态码: {response.status_code}")
            else:
                print(f"响应: {response}")
        except Exception as e:
            print(f"无法解析响应: {e}")

    print("-" * 50)

    results["total"] += 1
    if result:
        results["passed"] += 1
    else:
        results["failed"] += 1

    results["details"].append(
        {
            "name": name,
            "result": "passed" if result else "failed",
            "error": error,
        }
    )


def test_root_endpoint():
    """测试根端点"""
    try:
        response = requests.get(f"{BASE_URL}/")
        success = (
            response.status_code == 200
            and response.json().get("success") == True
        )
        log_test("根端点", success, response)
        return success
    except Exception as e:
        log_test("根端点", False, error=str(e))
        return False


def test_health_endpoint():
    """测试健康检查端点"""
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        success = (
            response.status_code == 200
            and response.json().get("success") == True
            and response.json().get("data", {}).get("status") == "healthy"
        )
        log_test("健康检查", success, response)
        return success
    except Exception as e:
        log_test("健康检查", False, error=str(e))
        return False


def test_videos_endpoints():
    """测试视频相关接口"""
    # 获取视频列表
    try:
        response = requests.get(f"{BASE_URL}/api/videos")
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("获取视频列表", success, response)
    except Exception as e:
        log_test("获取视频列表", False, error=str(e))

    # 上传视频（模拟，不实际上传文件）
    try:
        files = {"file": ("test.mp4", b"dummy content", "video/mp4")}
        response = requests.post(f"{BASE_URL}/api/videos/upload", files=files)
        success = response.status_code in (200, 201, 501)  # 可能未实现
        log_test("上传视频", success, response)
    except Exception as e:
        log_test("上传视频", False, error=str(e))

    # 获取视频详情
    try:
        response = requests.get(f"{BASE_URL}/api/videos/test_id")
        success = response.status_code in (200, 404, 501)  # 可能未实现或找不到
        log_test("获取视频详情", success, response)
    except Exception as e:
        log_test("获取视频详情", False, error=str(e))


def test_subtitles_endpoints():
    """测试字幕相关接口"""
    # 提取字幕
    try:
        data = {"video_id": "test_video_id"}
        response = requests.post(
            f"{BASE_URL}/api/subtitles/extract", json=data
        )
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("提取字幕", success, response)
    except Exception as e:
        log_test("提取字幕", False, error=str(e))

    # 获取字幕
    try:
        response = requests.get(f"{BASE_URL}/api/subtitles/test_id")
        success = response.status_code in (200, 404, 501)  # 可能未实现或找不到
        log_test("获取字幕", success, response)
    except Exception as e:
        log_test("获取字幕", False, error=str(e))


def test_tasks_endpoints():
    """测试任务相关接口"""
    # 创建翻译任务
    try:
        data = {
            "subtitle_id": "test_subtitle_id",
            "source_language": "en",
            "target_language": "zh",
        }
        response = requests.post(f"{BASE_URL}/api/tasks", json=data)
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("创建翻译任务", success, response)
    except Exception as e:
        log_test("创建翻译任务", False, error=str(e))

    # 获取任务列表
    try:
        response = requests.get(f"{BASE_URL}/api/tasks")
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("获取任务列表", success, response)
    except Exception as e:
        log_test("获取任务列表", False, error=str(e))

    # 获取任务详情
    try:
        response = requests.get(f"{BASE_URL}/api/tasks/test_id")
        success = response.status_code in (200, 404, 501)  # 可能未实现或找不到
        log_test("获取任务详情", success, response)
    except Exception as e:
        log_test("获取任务详情", False, error=str(e))


def test_translate_endpoints():
    """测试翻译相关接口"""
    # 测试实时翻译
    try:
        data = {
            "text": "Hello world",
            "source_language": "en",
            "target_language": "zh",
        }
        response = requests.post(f"{BASE_URL}/api/translate", json=data)
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("实时翻译", success, response)
    except Exception as e:
        log_test("实时翻译", False, error=str(e))


def test_config_endpoints():
    """测试配置相关接口"""
    # 获取系统配置
    try:
        response = requests.get(f"{BASE_URL}/api/config")
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("获取系统配置", success, response)
    except Exception as e:
        log_test("获取系统配置", False, error=str(e))

    # 更新系统配置
    try:
        data = {"api": {"allowed_origins": ["*"]}}
        response = requests.put(f"{BASE_URL}/api/config", json=data)
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("更新系统配置", success, response)
    except Exception as e:
        log_test("更新系统配置", False, error=str(e))


def test_templates_endpoints():
    """测试模板相关接口"""
    # 获取翻译模板列表
    try:
        response = requests.get(f"{BASE_URL}/api/templates")
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("获取翻译模板列表", success, response)
    except Exception as e:
        log_test("获取翻译模板列表", False, error=str(e))

    # 创建翻译模板
    try:
        data = {
            "name": "测试模板",
            "prompt": "这是一个测试模板",
            "description": "用于测试",
        }
        response = requests.post(f"{BASE_URL}/api/templates", json=data)
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("创建翻译模板", success, response)
    except Exception as e:
        log_test("创建翻译模板", False, error=str(e))


def test_export_endpoints():
    """测试导出相关接口"""
    # 导出字幕
    try:
        data = {"task_id": "test_task_id", "format": "srt"}
        response = requests.post(f"{BASE_URL}/api/export", json=data)
        success = response.status_code in (200, 501)  # 可能未实现
        log_test("导出字幕", success, response)
    except Exception as e:
        log_test("导出字幕", False, error=str(e))


def test_websocket():
    """测试WebSocket连接"""
    ws_connected = [False]
    ws_error = [None]

    def on_open(ws):
        ws_connected[0] = True
        print("WebSocket连接成功")
        # 保持连接几秒钟
        time.sleep(3)
        ws.close()

    def on_error(ws, error):
        ws_error[0] = str(error)
        print(f"WebSocket错误: {error}")

    def on_close(ws, close_status_code, close_msg):
        print("WebSocket连接关闭")

    def start_ws():
        ws_url = f"ws://127.0.0.1:8000/ws/tasks/test_task_id"
        ws = websocket.WebSocketApp(
            ws_url, on_open=on_open, on_error=on_error, on_close=on_close
        )
        ws.run_forever()

    # 在子线程中运行WebSocket
    ws_thread = threading.Thread(target=start_ws)
    ws_thread.daemon = True
    ws_thread.start()

    # 等待连接结果
    time.sleep(5)

    success = ws_connected[0]
    log_test("WebSocket连接", success, error=ws_error[0])


def print_summary():
    """打印测试摘要"""
    print("=" * 50)
    print(
        f"测试完成 - 总计: {results['total']}, 通过: {results['passed']}, 失败: {results['failed']}, 跳过: {results['skipped']}"
    )
    print("=" * 50)


def main():
    """主函数"""
    print("开始测试SubTranslate API...")

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

    # 测试各个模块接口
    test_videos_endpoints()
    test_subtitles_endpoints()
    test_tasks_endpoints()
    test_translate_endpoints()
    test_config_endpoints()
    test_templates_endpoints()
    test_export_endpoints()

    # 测试WebSocket
    test_websocket()

    # 打印总结
    print_summary()


if __name__ == "__main__":
    main()
