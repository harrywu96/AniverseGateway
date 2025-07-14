#!/usr/bin/env python3
"""测试视频存储修复的脚本"""

import requests
import json
import sys
import os
import tempfile

BASE_URL = "http://localhost:8000"

def create_test_video_file():
    """创建一个测试视频文件"""
    # 创建一个临时文件作为测试视频
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
        # 写入一些测试数据
        f.write(b"fake video content for testing")
        return f.name

def test_video_upload():
    """测试视频上传"""
    print("=== 测试视频上传 ===")
    
    try:
        # 创建测试视频文件
        test_video_path = create_test_video_file()
        print(f"创建测试视频文件: {test_video_path}")
        
        # 上传视频
        with open(test_video_path, 'rb') as f:
            files = {'file': ('test_video.mp4', f, 'video/mp4')}
            response = requests.post(f"{BASE_URL}/api/videos/upload", files=files)
        
        print(f"上传响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                video_id = data['data']['id']
                print(f"✅ 视频上传成功，ID: {video_id}")
                
                # 清理测试文件
                os.unlink(test_video_path)
                
                return video_id
            else:
                print(f"❌ 视频上传失败: {data.get('message')}")
                return None
        else:
            print(f"❌ 视频上传失败，状态码: {response.status_code}")
            print(f"响应: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ 视频上传异常: {e}")
        return None

def test_video_list():
    """测试视频列表"""
    print("\n=== 测试视频列表 ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/videos")
        print(f"列表响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                videos = data['data']
                print(f"✅ 获取视频列表成功，视频数量: {len(videos)}")
                for video in videos:
                    print(f"  - 视频ID: {video['id']}, 文件名: {video['filename']}")
                return videos
            else:
                print(f"❌ 获取视频列表失败: {data.get('message')}")
                return []
        else:
            print(f"❌ 获取视频列表失败，状态码: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ 获取视频列表异常: {e}")
        return []

def test_video_translation(video_id):
    """测试视频翻译"""
    print(f"\n=== 测试视频翻译 (视频ID: {video_id}) ===")
    
    # 测试数据
    test_data = {
        "video_id": video_id,
        "track_index": 0,
        "source_language": "en",
        "target_language": "zh",
        "style": "natural",
        "preserve_formatting": True,
        "context_preservation": True,
        "chunk_size": 10,
        "context_window": 3,
        "provider_config": {
            "id": "siliconflow",
            "apiKey": "sk-test-key-12345",
            "apiHost": "https://api.siliconflow.cn/v1"
        },
        "model_id": "deepseek-ai/DeepSeek-V3"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/translate/video-subtitle-v2",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"翻译响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 翻译请求成功: {data.get('message')}")
            return True
        elif response.status_code == 404:
            data = response.json()
            error_message = data.get('message', '')
            if "视频不存在" in error_message:
                print(f"❌ 翻译失败：视频存储实例不一致，视频不存在")
                return False
            elif "字幕轨道不存在" in error_message:
                print(f"⚠️  翻译失败：字幕轨道不存在（这是预期的，因为测试视频没有字幕）")
                print(f"✅ 视频存储实例一致性问题已修复")
                return True
            else:
                print(f"❌ 翻译失败: {error_message}")
                return False
        else:
            print(f"❌ 翻译失败，状态码: {response.status_code}")
            print(f"响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 翻译请求异常: {e}")
        return False

def test_debug_dependencies():
    """测试调试端点"""
    print("\n=== 测试调试端点 ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/translate/debug/dependencies")
        print(f"调试响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                debug_info = data['data']
                print(f"✅ 调试信息获取成功:")
                print(f"  - 视频数量: {debug_info.get('video_count', 0)}")
                print(f"  - 临时目录: {debug_info.get('temp_dir', 'unknown')}")
                print(f"  - AI提供商: {debug_info.get('ai_provider', 'unknown')}")
                return debug_info
            else:
                print(f"❌ 调试信息获取失败: {data.get('message')}")
                return None
        else:
            print(f"❌ 调试信息获取失败，状态码: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ 调试信息获取异常: {e}")
        return None

def main():
    """主函数"""
    print("🧪 开始测试视频存储修复...")
    
    # 测试视频上传
    video_id = test_video_upload()
    if not video_id:
        print("\n❌ 视频上传失败，无法继续测试")
        sys.exit(1)
    
    # 测试视频列表
    videos = test_video_list()
    
    # 测试调试端点
    debug_info = test_debug_dependencies()
    
    # 测试视频翻译
    translation_ok = test_video_translation(video_id)
    
    # 总结
    print("\n" + "="*50)
    print("📊 测试结果总结:")
    print(f"视频上传: {'✅ 成功' if video_id else '❌ 失败'}")
    print(f"视频列表: {'✅ 成功' if videos else '❌ 失败'}")
    print(f"调试信息: {'✅ 成功' if debug_info else '❌ 失败'}")
    print(f"视频翻译: {'✅ 成功' if translation_ok else '❌ 失败'}")
    
    if video_id and translation_ok:
        print("\n🎉 视频存储修复成功！视频存储实例一致性问题已解决！")
        sys.exit(0)
    else:
        print("\n❌ 部分测试失败，需要进一步修复")
        sys.exit(1)

if __name__ == "__main__":
    main()
