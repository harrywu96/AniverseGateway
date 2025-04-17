"""API服务器诊断工具

这个脚本用于诊断API服务器启动问题，包括端口占用检查、依赖检查等。
"""

import sys
import socket
import subprocess
import platform
import importlib.util
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("api_diagnostics")


def check_port_available(port=8000, host="127.0.0.1"):
    """检查端口是否可用"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex((host, port))
            if result == 0:  # 端口已被占用
                logger.error(f"端口 {port} 已被占用")
                return False
            return True  # 端口可用
    except Exception as e:
        logger.error(f"检查端口时出错: {e}")
        return False


def check_required_modules():
    """检查必要的Python模块是否已安装"""
    required_modules = [
        "fastapi",
        "uvicorn",
        "pydantic",
    ]

    missing_modules = []
    for module in required_modules:
        if importlib.util.find_spec(module) is None:
            missing_modules.append(module)

    if missing_modules:
        logger.error(f"缺少以下Python模块: {', '.join(missing_modules)}")
        return False

    logger.info("所有必需的Python模块已安装")
    return True


def check_python_version():
    """检查Python版本"""
    version = sys.version_info
    logger.info(f"Python版本: {version.major}.{version.minor}.{version.micro}")

    if version.major < 3 or (version.major == 3 and version.minor < 8):
        logger.error("Python版本太低，需要Python 3.8+")
        return False

    return True


def check_project_structure():
    """检查项目结构"""
    # 检查运行路径
    script_path = Path(__file__).resolve()
    project_root = script_path.parent

    logger.info(f"脚本路径: {script_path}")
    logger.info(f"项目根目录: {project_root}")

    # 检查重要文件
    api_server_script = project_root / "run_api_server.py"
    subtranslate_dir = project_root / "subtranslate"

    if not api_server_script.exists():
        logger.error(f"找不到API服务器脚本: {api_server_script}")
        return False

    if not subtranslate_dir.exists() or not subtranslate_dir.is_dir():
        logger.error(f"找不到subtranslate包: {subtranslate_dir}")
        return False

    api_dir = subtranslate_dir / "api"
    if not api_dir.exists() or not api_dir.is_dir():
        logger.error(f"找不到API模块: {api_dir}")
        return False

    logger.info("项目结构检查通过")
    return True


def kill_process_on_port(port=8000):
    """尝试杀死占用指定端口的进程"""
    try:
        if platform.system() == "Windows":
            output = subprocess.check_output(
                f"netstat -ano | findstr :{port}", shell=True
            ).decode()

            if output:
                lines = output.strip().split("\n")
                for line in lines:
                    if "LISTENING" in line:
                        pid = line.strip().split()[-1]
                        logger.info(
                            f"尝试终止占用端口 {port} 的进程 (PID: {pid})..."
                        )
                        try:
                            subprocess.check_output(
                                f"taskkill /F /PID {pid}", shell=True
                            )
                            logger.info(f"成功终止进程 {pid}")
                        except subprocess.CalledProcessError:
                            logger.error(f"无法终止进程 {pid}")
        else:
            output = subprocess.check_output(
                f"lsof -i :{port} | grep LISTEN", shell=True
            ).decode()

            if output:
                pid = output.strip().split()[1]
                logger.info(f"尝试终止占用端口 {port} 的进程 (PID: {pid})...")
                try:
                    subprocess.check_output(f"kill -9 {pid}", shell=True)
                    logger.info(f"成功终止进程 {pid}")
                except subprocess.CalledProcessError:
                    logger.error(f"无法终止进程 {pid}")

        return check_port_available(port)
    except Exception as e:
        logger.error(f"尝试释放端口时出错: {e}")
        return False


def run_diagnostics():
    """运行所有诊断检查"""
    logger.info("开始API服务器诊断...")
    logger.info(f"操作系统: {platform.system()} {platform.release()}")

    # 检查Python版本
    python_ok = check_python_version()

    # 检查项目结构
    structure_ok = check_project_structure()

    # 检查必要模块
    modules_ok = check_required_modules()

    # 检查端口
    port = 8000
    port_ok = check_port_available(port)

    if not port_ok:
        logger.info("尝试释放端口...")
        port_ok = kill_process_on_port(port)

    # 总结
    logger.info("\n诊断结果摘要:")
    logger.info(f"Python版本检查: {'通过' if python_ok else '失败'}")
    logger.info(f"项目结构检查: {'通过' if structure_ok else '失败'}")
    logger.info(f"必要模块检查: {'通过' if modules_ok else '失败'}")
    logger.info(f"端口 {port} 检查: {'通过' if port_ok else '失败'}")

    # 提供解决建议
    if not all([python_ok, structure_ok, modules_ok, port_ok]):
        logger.info("\n解决建议:")

        if not python_ok:
            logger.info("- 请安装Python 3.8或更高版本")

        if not structure_ok:
            logger.info("- 请确保你在正确的项目目录中运行此脚本")
            logger.info("- 检查项目文件是否完整")

        if not modules_ok:
            logger.info("- 安装缺失的模块: uv pip install -r requirements.txt")

        if not port_ok:
            logger.info(f"- 端口 {port} 被占用，请关闭占用该端口的应用程序")
            logger.info("- 或者更改API_PORT环境变量使用不同端口")
    else:
        logger.info("\n所有检查通过，API服务器应该可以正常启动")
        logger.info("尝试运行 python run_api_server.py 启动服务器")


if __name__ == "__main__":
    run_diagnostics()
