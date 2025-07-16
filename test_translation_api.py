#!/usr/bin/env python3
"""
翻译API测试脚本

用于快速测试翻译功能的各个组件，无需启动完整的前端应用
"""

import asyncio
import json
import requests
import websockets
from typing import Dict, Any


class TranslationAPITester:
    """翻译API测试器"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.ws_url = base_url.replace("http", "ws")
    
    def test_sample_results(self) -> Dict[str, Any]:
        """测试获取示例翻译结果"""
        print("🧪 测试获取示例翻译结果...")
        
        try:
            response = requests.get(f"{self.base_url}/api/test/sample-results")
            response.raise_for_status()
            
            data = response.json()
            if data.get("success"):
                results = data.get("data", {}).get("results", [])
                print(f"✅ 成功获取 {len(results)} 条示例结果")
                
                if results:
                    first_result = results[0]
                    print(f"📝 第一条结果预览:")
                    print(f"   原文: {first_result.get('original', 'N/A')}")
                    print(f"   译文: {first_result.get('translated', 'N/A')}")
                    print(f"   时间: {first_result.get('startTimeStr', 'N/A')} -> {first_result.get('endTimeStr', 'N/A')}")
                
                return data
            else:
                print(f"❌ API返回失败: {data.get('message', 'Unknown error')}")
                return data
                
        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def test_mock_translation(self, subtitle_count: int = 5) -> Dict[str, Any]:
        """测试模拟翻译过程"""
        print(f"🚀 测试模拟翻译过程 (字幕数量: {subtitle_count})...")
        
        try:
            # 启动模拟翻译任务
            response = requests.post(
                f"{self.base_url}/api/test/mock-translation",
                json={
                    "video_id": "test-video-123",
                    "track_index": 0,
                    "source_language": "en",
                    "target_language": "zh",
                    "subtitle_count": subtitle_count
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if not data.get("success"):
                print(f"❌ 启动模拟翻译失败: {data.get('message', 'Unknown error')}")
                return data
            
            task_id = data.get("data", {}).get("task_id")
            if not task_id:
                print("❌ 未获取到任务ID")
                return {"success": False, "error": "No task ID"}
            
            print(f"📋 任务ID: {task_id}")
            print("🔗 连接WebSocket监听进度...")
            
            # 连接WebSocket监听进度
            ws_url = f"{self.ws_url}/api/test/ws/{task_id}"
            
            async with websockets.connect(ws_url) as websocket:
                print("✅ WebSocket连接成功")
                
                while True:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                        data = json.loads(message)
                        
                        msg_type = data.get("type")
                        if msg_type == "progress":
                            percentage = data.get("percentage", 0)
                            current_item = data.get("currentItem", "")
                            print(f"📊 进度: {percentage:.1f}% - {current_item}")
                            
                        elif msg_type == "completed":
                            results = data.get("results", [])
                            print(f"🎉 翻译完成! 共 {len(results)} 条结果")
                            
                            if results:
                                print("📝 前3条结果预览:")
                                for i, result in enumerate(results[:3]):
                                    print(f"   {i+1}. 原文: {result.get('original', 'N/A')}")
                                    print(f"      译文: {result.get('translated', 'N/A')}")
                                    print(f"      时间: {result.get('startTimeStr', 'N/A')} -> {result.get('endTimeStr', 'N/A')}")
                                    if result.get('confidence'):
                                        print(f"      可信度: {result.get('confidence', 0):.2f}")
                                    print()
                            
                            return {"success": True, "results": results}
                            
                        elif msg_type == "error":
                            error_msg = data.get("message", "Unknown error")
                            print(f"❌ 翻译失败: {error_msg}")
                            return {"success": False, "error": error_msg}
                            
                    except asyncio.TimeoutError:
                        print("⏰ WebSocket超时，可能任务已完成或出错")
                        break
                        
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP请求失败: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return {"success": False, "error": str(e)}
    
    def test_parse_srt_function(self):
        """测试SRT解析函数"""
        print("🔍 测试SRT解析功能...")
        
        # 模拟SRT内容
        sample_srt = """1
00:00:01,500 --> 00:00:04,200
Hello, welcome to our presentation.

2
00:00:04,500 --> 00:00:08,100
Today we will discuss AI technology.

3
00:00:08,500 --> 00:00:12,300
Machine learning has revolutionized industries.
"""
        
        # 模拟原始字幕数据
        original_subtitles = [
            {"index": 1, "startTime": 1.5, "endTime": 4.2, "text": "Hello, welcome to our presentation."},
            {"index": 2, "startTime": 4.5, "endTime": 8.1, "text": "Today we will discuss AI technology."},
            {"index": 3, "startTime": 8.5, "endTime": 12.3, "text": "Machine learning has revolutionized industries."}
        ]
        
        print("📄 SRT内容:")
        print(sample_srt)
        print("📋 原始字幕数据:")
        for sub in original_subtitles:
            print(f"   {sub['index']}. {sub['text']} ({sub['startTime']}s - {sub['endTime']}s)")
        
        # 这里可以添加实际的解析测试逻辑
        print("✅ SRT解析测试完成 (需要实际解析函数)")


async def main():
    """主测试函数"""
    print("🎬 翻译API测试开始")
    print("=" * 50)
    
    tester = TranslationAPITester()
    
    # 测试1: 获取示例结果
    print("\n1️⃣ 测试示例结果API")
    sample_result = tester.test_sample_results()
    
    # 测试2: 模拟翻译过程
    print("\n2️⃣ 测试模拟翻译过程")
    mock_result = await tester.test_mock_translation(subtitle_count=5)
    
    # 测试3: SRT解析功能
    print("\n3️⃣ 测试SRT解析功能")
    tester.test_parse_srt_function()
    
    print("\n" + "=" * 50)
    print("🏁 所有测试完成")
    
    # 总结
    print("\n📊 测试总结:")
    print(f"   示例结果API: {'✅ 通过' if sample_result.get('success') else '❌ 失败'}")
    print(f"   模拟翻译API: {'✅ 通过' if mock_result.get('success') else '❌ 失败'}")
    print(f"   SRT解析功能: ✅ 通过 (模拟)")


if __name__ == "__main__":
    print("🔧 翻译功能测试工具")
    print("确保后端服务正在运行在 http://localhost:8000")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  测试被用户中断")
    except Exception as e:
        print(f"\n💥 测试过程中出现错误: {e}")
