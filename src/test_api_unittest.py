"""API单元测试模块

该模块使用unittest和FastAPI TestClient对API进行测试。
"""

import unittest
import sys
from fastapi.testclient import TestClient
from test_api import app

# 添加调试信息
print("开始测试...")
print(f"Python版本: {sys.version}")


class TestAPI(unittest.TestCase):
    """API测试类"""

    def setUp(self):
        """测试前设置"""
        print("设置测试客户端...")
        self.client = TestClient(app)
        print("测试客户端设置完成")

    def test_root(self):
        """测试根端点"""
        print("测试根端点...")
        response = self.client.get("/")
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["message"], "SubTranslate API测试服务正在运行")

    def test_health(self):
        """测试健康检查端点"""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["message"], "API服务运行正常")
        self.assertEqual(data["data"]["status"], "healthy")

    def test_videos_list(self):
        """测试视频列表端点"""
        response = self.client.get("/api/videos")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 2)  # 有两个模拟视频

    def test_video_detail(self):
        """测试视频详情端点"""
        # 测试存在的视频
        response = self.client.get("/api/videos/video1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["id"], "video1")

        # 测试不存在的视频
        response = self.client.get("/api/videos/nonexistent")
        self.assertEqual(response.status_code, 404)

    def test_subtitles_list(self):
        """测试字幕列表端点"""
        # 测试所有字幕
        response = self.client.get("/api/subtitles")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 2)  # 有两个模拟字幕

        # 测试按视频ID筛选字幕
        response = self.client.get("/api/subtitles?video_id=video1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 2)  # video1有两个字幕

        # 测试不存在的视频ID
        response = self.client.get("/api/subtitles?video_id=nonexistent")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 0)  # 应该没有字幕

    def test_tasks_list(self):
        """测试任务列表端点"""
        # 测试所有任务
        response = self.client.get("/api/tasks")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 2)  # 有两个模拟任务

        # 测试按状态筛选任务
        response = self.client.get("/api/tasks?status=completed")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 1)  # 有一个已完成的任务

    def test_task_detail(self):
        """测试任务详情端点"""
        # 测试存在的任务
        response = self.client.get("/api/tasks/task1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["id"], "task1")

        # 测试不存在的任务
        response = self.client.get("/api/tasks/nonexistent")
        self.assertEqual(response.status_code, 404)

    def test_translate_text(self):
        """测试文本翻译端点"""
        # 测试有效请求
        request_data = {
            "text": "Hello world",
            "source_language": "en",
            "target_language": "zh",
        }
        response = self.client.post("/api/translate/text", json=request_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["source_text"], "Hello world")
        self.assertEqual(data["data"]["translated_text"], "[zh] Hello world")

        # 测试空文本
        request_data = {
            "text": "",
            "source_language": "en",
            "target_language": "zh",
        }
        response = self.client.post("/api/translate/text", json=request_data)
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    print("开始执行单元测试...")
    unittest.main(verbosity=2)
