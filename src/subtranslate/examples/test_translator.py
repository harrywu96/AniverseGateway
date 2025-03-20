"""字幕翻译功能测试示例

这个示例演示了如何使用SubTranslate的字幕翻译功能。
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from src.subtranslate.core import SubtitleTranslator
from src.subtranslate.schemas.config import SystemConfig
from src.subtranslate.schemas.task import TranslationStyle


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def progress_callback(task_id: str, progress: float):
    """进度回调函数

    Args:
        task_id: 任务ID
        progress: 进度百分比
    """
    logger.info(f"任务 {task_id} 进度: {progress:.2f}%")


async def main():
    """主函数"""
    # 加载环境变量
    load_dotenv()

    # 检查是否提供了字幕文件路径
    if len(sys.argv) < 2:
        logger.error("请提供字幕文件路径作为命令行参数")
        return

    # 获取命令行参数
    srt_file = sys.argv[1]
    source_language = sys.argv[2] if len(sys.argv) > 2 else "en"
    target_language = sys.argv[3] if len(sys.argv) > 3 else "zh"
    style_name = sys.argv[4] if len(sys.argv) > 4 else "natural"

    # 检查字幕文件是否存在
    if not os.path.exists(srt_file):
        logger.error(f"字幕文件 {srt_file} 不存在")
        return

    # 初始化配置
    try:
        config = SystemConfig.from_env()
        logger.info(f"使用的AI服务提供商: {config.ai_service.provider}")
    except Exception as e:
        logger.error(f"加载配置失败: {e}")
        return

    # 创建字幕翻译器
    translator = SubtitleTranslator(config)

    # 确定翻译风格
    try:
        style = TranslationStyle(style_name)
    except ValueError:
        logger.warning(f"不支持的翻译风格 {style_name}，使用默认风格 natural")
        style = TranslationStyle.NATURAL

    # 创建翻译任务
    task = SubtitleTranslator.create_task(
        video_id="test_video",
        source_path=srt_file,
        source_language=source_language,
        target_language=target_language,
        style=style,
        chunk_size=5,  # 每次翻译5条字幕
        context_window=2,  # 上下文窗口为2条字幕
    )

    # 执行翻译任务
    logger.info(f"开始翻译字幕 {srt_file}")
    success = await translator.translate_task(task, progress_callback)

    if success:
        logger.info(f"翻译成功! 结果保存在: {task.result_path}")
    else:
        logger.error(f"翻译失败: {task.error_message}")


if __name__ == "__main__":
    asyncio.run(main())
