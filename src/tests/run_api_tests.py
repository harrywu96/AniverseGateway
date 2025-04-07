"""API测试启动脚本

这个脚本用于启动API服务器并运行API测试。
"""

import os
import sys
import time
import subprocess
import argparse
from pathlib import Path

# 确保在src同级目录运行脚本
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

# 测试脚本路径
API_TEST_SCRIPT = str(ROOT_DIR / "src" / "tests" / "api_test.py")
API_ENDPOINTS_TEST_SCRIPT = str(ROOT_DIR / "src" / "tests" / "api_endpoints_test.py")


def start_api_server():
    """启动API服务器"""
    print("启动API服务器...")
    
    # 使用uvicorn启动API服务器
    server_cmd = ["uvicorn", "src.subtranslate.api.app:app", "--reload"]
    
    try:
        # 非阻塞方式启动服务器
        server_process = subprocess.Popen(
            server_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=ROOT_DIR,
        )
        
        # 等待服务器启动
        print("等待API服务器启动...")
        time.sleep(3)  # 给服务器一些启动时间
        
        # 检查服务器是否成功启动
        if server_process.poll() is not None:
            # 服务器已退出
            stdout, stderr = server_process.communicate()
            print(f"API服务器启动失败: {stderr}")
            return None
        
        print("API服务器已启动")
        return server_process
    
    except Exception as e:
        print(f"启动API服务器时出错: {e}")
        return None


def run_tests(test_script):
    """运行API测试脚本

    Args:
        test_script: 测试脚本路径
    
    Returns:
        bool: 测试是否成功
    """
    print(f"运行测试脚本: {test_script}...")
    
    try:
        # 运行测试脚本
        result = subprocess.run(
            [sys.executable, test_script],
            capture_output=True,
            text=True,
            cwd=ROOT_DIR,
        )
        
        # 输出测试结果
        print(result.stdout)
        
        if result.stderr:
            print(f"测试脚本错误: {result.stderr}")
        
        return result.returncode == 0
    
    except Exception as e:
        print(f"运行测试脚本时出错: {e}")
        return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="运行API测试")
    parser.add_argument("--no-server", action="store_true", help="不启动API服务器，假设服务器已经在运行")
    parser.add_argument("--test-script", choices=["simple", "full", "both"], default="both", 
                      help="要运行的测试脚本: simple=基础测试, full=全面测试, both=两者都运行")
    args = parser.parse_args()
    
    server_process = None
    
    try:
        # 启动API服务器（如果需要）
        if not args.no_server:
            server_process = start_api_server()
            if not server_process:
                return 1
        
        # 根据参数选择运行哪个测试脚本
        if args.test_script in ["simple", "both"]:
            print("\n======== 运行简单API测试 ========\n")
            run_tests(API_TEST_SCRIPT)
        
        if args.test_script in ["full", "both"]:
            print("\n======== 运行全面API测试 ========\n")
            run_tests(API_ENDPOINTS_TEST_SCRIPT)
        
        return 0
    
    finally:
        # 无论如何都要尝试终止服务器进程
        if server_process:
            print("停止API服务器...")
            server_process.terminate()
            server_process.wait(timeout=5)
            print("API服务器已停止")


if __name__ == "__main__":
    sys.exit(main()) 