"""日志配置工具模块

提供统一的日志配置功能，确保在开发环境和生产环境中都能正确输出日志。
"""

import logging
import logging.handlers
import sys
import os
from pathlib import Path
from typing import Optional, List


def setup_logging(
    log_level: str = "INFO",
    log_file_path: Optional[str] = None,
    log_format: Optional[str] = None,
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    console_output: bool = True,
) -> None:
    """设置统一的日志配置
    
    Args:
        log_level: 日志级别，默认为 INFO
        log_file_path: 日志文件路径，如果为None则自动生成
        log_format: 日志格式，如果为None则使用默认格式
        max_file_size: 单个日志文件最大大小（字节），默认10MB
        backup_count: 保留的日志文件备份数量，默认5个
        console_output: 是否同时输出到控制台，默认True
    """
    # 设置默认日志格式
    if log_format is None:
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # 获取日志文件路径
    if log_file_path is None:
        log_file_path = get_log_file_path()
    
    # 确保日志目录存在
    log_dir = Path(log_file_path).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 清除现有的处理器
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 创建格式化器
    formatter = logging.Formatter(log_format)
    
    # 创建处理器列表
    handlers: List[logging.Handler] = []
    
    # 添加文件处理器（使用RotatingFileHandler进行日志轮转）
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
    except Exception as e:
        print(f"WARNING: 无法创建日志文件处理器: {e}")
    
    # 添加控制台处理器（如果需要）
    if console_output:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)
    
    # 配置根日志器
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        handlers=handlers,
        format=log_format,
        force=True  # 强制重新配置
    )
    
    # 记录日志配置信息
    logger = logging.getLogger("logging_utils")
    logger.info(f"日志系统已初始化")
    logger.info(f"日志级别: {log_level}")
    logger.info(f"日志文件: {log_file_path}")
    logger.info(f"控制台输出: {console_output}")
    logger.info(f"是否为打包环境: {getattr(sys, 'frozen', False)}")


def get_log_file_path(filename: str = "aniversegateway.log") -> str:
    """获取日志文件的完整路径
    
    Args:
        filename: 日志文件名，默认为 aniversegateway.log
        
    Returns:
        str: 日志文件的完整路径
    """
    # 优先使用环境变量指定的日志文件路径
    env_log_file = os.getenv("LOG_FILE")
    if env_log_file:
        return env_log_file
    
    # 检查是否在PyInstaller打包环境中
    if getattr(sys, "frozen", False):
        # 打包环境：使用与temp目录相同的父目录
        try:
            import tempfile
            
            log_dir = (
                Path(tempfile.gettempdir()) / "AniVerseGateway" / "logs"
            )
            log_dir.mkdir(parents=True, exist_ok=True)
            return str(log_dir / filename)
        except Exception:
            # 如果创建失败，使用系统临时目录
            return str(
                Path(tempfile.gettempdir()) / f"aniversegateway_{filename}"
            )
    else:
        # 开发环境：使用项目根目录下的logs
        log_dir = Path("./logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        return str(log_dir / filename)


def get_logger(name: str) -> logging.Logger:
    """获取指定名称的日志器
    
    Args:
        name: 日志器名称
        
    Returns:
        logging.Logger: 日志器实例
    """
    return logging.getLogger(name)


def configure_uvicorn_logging(log_file_path: Optional[str] = None) -> dict:
    """配置Uvicorn的日志配置
    
    Args:
        log_file_path: 日志文件路径，如果为None则自动生成
        
    Returns:
        dict: Uvicorn日志配置字典
    """
    if log_file_path is None:
        log_file_path = get_log_file_path("uvicorn.log")
    
    # 确保日志目录存在
    log_dir = Path(log_file_path).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 基于默认配置进行修改
    import uvicorn.config
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    
    # 添加文件处理器
    log_config["handlers"]["file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": log_file_path,
        "maxBytes": 10 * 1024 * 1024,  # 10MB
        "backupCount": 5,
        "encoding": "utf-8",
        "formatter": "default",
    }
    
    # 修改日志器配置，添加文件输出
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        if logger_name in log_config["loggers"]:
            if "handlers" not in log_config["loggers"][logger_name]:
                log_config["loggers"][logger_name]["handlers"] = []
            log_config["loggers"][logger_name]["handlers"].append("file")
    
    return log_config
