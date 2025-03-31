"""字幕翻译系统 MVP 功能集成测试

本脚本测试 SubTranslate 项目的核心功能实现（MVP）：
- 从视频中提取字幕
- 字幕优化以节约 token
- 通过 SiliconFlow API 进行翻译
- 将翻译结果还原格式后导出到视频原目录

使用方法:
    python src/subtranslate/examples/mvp_test.py <视频文件路径> [源语言代码] [目标语言代码]

示例:
    python src/subtranslate/examples/mvp_test.py ./test_videos/sample.mp4 en zh
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from dotenv import load_dotenv

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.subtranslate.schemas.video import VideoInfo
from src.subtranslate.schemas.config import SystemConfig
from src.subtranslate.schemas.task import SubtitleTask, TranslationStyle
from src.subtranslate.core.subtitle_extractor import SubtitleExtractor
from src.subtranslate.core.subtitle_translator import SubtitleTranslator
from src.subtranslate.services.utils import SRTOptimizer
from src.subtranslate.services.subtitle_export import SubtitleExporter

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


async def extract_subtitle_from_video(
    video_path: str,
    output_dir: Optional[str] = None,
    preferred_language: Optional[str] = None,
) -> Tuple[VideoInfo, Optional[Path]]:
    """从视频中提取字幕

    Args:
        video_path: 视频文件路径
        output_dir: 输出目录，默认为视频所在目录
        preferred_language: 首选字幕语言

    Returns:
        Tuple[VideoInfo, Optional[Path]]: 视频信息和提取的字幕文件路径
    """
    logger.info(f"开始从视频中提取字幕: {video_path}")

    # 检查文件是否存在
    if not os.path.exists(video_path):
        logger.error(f"视频文件不存在: {video_path}")
        return None, None

    try:
        # 创建字幕提取器
        extractor = SubtitleExtractor()

        # 获取视频信息
        video_info = VideoInfo(
            file_path=video_path,
            title=Path(video_path).stem,
        )

        # 检测外挂字幕文件
        external_subtitles = extractor.detect_subtitle_files(video_path)
        if external_subtitles:
            logger.info(
                f"检测到外挂字幕文件: {[str(s) for s in external_subtitles]}"
            )
            # 如果存在外挂字幕，优先使用第一个
            subtitle_path = external_subtitles[0]
            # 如果外挂字幕不是SRT格式，转换为SRT
            if extractor.get_subtitle_format(subtitle_path).value != "srt":
                subtitle_path = extractor.convert_to_srt(subtitle_path)
                logger.info(f"已将字幕转换为SRT格式: {subtitle_path}")

            logger.info(f"使用外挂字幕: {subtitle_path}")
            return video_info, subtitle_path

        # 如果没有外挂字幕，提取内嵌字幕
        logger.info("未检测到外挂字幕，尝试提取内嵌字幕...")
        tracks = extractor.get_subtitle_tracks(video_path)

        if not tracks:
            logger.warning("视频不包含字幕轨道")
            return video_info, None

        logger.info(f"检测到 {len(tracks)} 个字幕轨道:")
        for track in tracks:
            logger.info(f"  {track}")

        # 选择最合适的轨道
        track_index = extractor.select_best_track(tracks, preferred_language)

        if track_index is None:
            logger.warning("无法选择合适的字幕轨道")
            return video_info, None

        logger.info(f"选择轨道 #{track_index}: {tracks[track_index]}")

        # 提取字幕并转换为SRT格式
        subtitle_path = extractor.extract_embedded_subtitle(
            video_info=video_info,
            track_index=track_index,
            output_dir=output_dir,
        )

        logger.info(f"成功提取字幕: {subtitle_path}")
        return video_info, subtitle_path

    except Exception as e:
        logger.error(f"提取字幕时发生错误: {e}")
        return None, None


async def translate_subtitle(
    subtitle_path: Path,
    config: SystemConfig,
    source_language: str = "en",
    target_language: str = "zh",
    translation_style: TranslationStyle = TranslationStyle.NATURAL,
) -> Optional[str]:
    """翻译字幕文件

    Args:
        subtitle_path: 字幕文件路径
        config: 系统配置
        source_language: 源语言代码
        target_language: 目标语言代码
        translation_style: 翻译风格

    Returns:
        Optional[str]: 翻译后的字幕内容，如果失败则返回None
    """
    logger.info(f"开始翻译字幕: {subtitle_path}")

    try:
        # 读取字幕内容
        with open(subtitle_path, "r", encoding="utf-8") as f:
            srt_content = f.read()

        logger.info(f"字幕内容长度: {len(srt_content)} 字符")

        # 使用优化器减少 token 使用量
        logger.info("优化字幕内容以减少 token 使用量...")
        optimized_srt, format_map = SRTOptimizer.optimize_srt_content(
            srt_content
        )

        logger.info(f"优化后内容长度: {len(optimized_srt)} 字符")
        logger.info(f"节省: {len(srt_content) - len(optimized_srt)} 字符")
        logger.info(f"格式映射包含 {len(format_map)} 个条目")

        # 创建字幕翻译器
        translator = SubtitleTranslator(config)

        # 创建翻译任务
        task = SubtitleTranslator.create_task(
            video_id=subtitle_path.stem,
            source_path=str(subtitle_path),
            source_language=source_language,
            target_language=target_language,
            style=translation_style,
            preserve_formatting=True,
            chunk_size=10,  # 每次翻译10条字幕
            context_window=3,  # 上下文窗口为3条字幕
        )

        # 执行翻译任务
        logger.info(f"开始执行翻译任务，任务ID: {task.id}")
        success = await translator.translate_task(task, progress_callback)

        if not success:
            logger.error(f"翻译任务失败: {task.error_message}")
            return None

        logger.info("翻译完成!")

        # 从结果文件读取翻译内容
        with open(task.result_path, "r", encoding="utf-8") as f:
            translated_content = f.read()

        return translated_content, format_map, task

    except Exception as e:
        logger.error(f"翻译过程中发生错误: {e}")
        return None


async def main():
    """主函数"""
    # 加载环境变量
    load_dotenv()

    # 检查命令行参数
    if len(sys.argv) < 2:
        logger.error("请提供视频文件路径作为命令行参数")
        print(
            f"用法: python {__file__} <视频文件路径> [源语言代码] [目标语言代码]"
        )
        return

    # 获取命令行参数
    video_path = sys.argv[1]
    source_language = sys.argv[2] if len(sys.argv) > 2 else "en"
    target_language = sys.argv[3] if len(sys.argv) > 3 else "zh"

    # 加载系统配置
    try:
        config = SystemConfig.from_env()
        logger.info(f"使用的AI服务提供商: {config.ai_service.provider}")

        # 验证是否使用 SiliconFlow API
        if config.ai_service.provider != "siliconflow":
            logger.warning(
                "当前配置不是使用 SiliconFlow API，请在 .env 文件中设置 AI_PROVIDER=siliconflow"
            )
            choice = input("是否继续使用当前 AI 提供商进行测试? (y/n): ")
            if choice.lower() != "y":
                logger.info("测试已取消")
                return
    except Exception as e:
        logger.error(f"加载配置失败: {e}")
        return

    # 步骤1: 从视频中提取字幕
    video_info, subtitle_path = await extract_subtitle_from_video(
        video_path=video_path, preferred_language=source_language
    )

    if subtitle_path is None:
        logger.error("无法提取字幕，测试终止")
        return

    # 步骤2: 翻译字幕
    translation_result = await translate_subtitle(
        subtitle_path=subtitle_path,
        config=config,
        source_language=source_language,
        target_language=target_language,
    )

    if translation_result is None:
        logger.error("翻译失败，测试终止")
        return

    translated_content, format_map, task = translation_result

    # 步骤3: 导出结果
    # 注意：SubtitleTranslator.translate_task 已经处理了导出，这里只是为了演示完整流程
    logger.info("检查翻译结果...")

    # 显示结果摘要
    result_preview = translated_content.split("\n")[:10]
    preview_text = "\n".join(result_preview)
    separator = "-" * 40
    logger.info(
        f"翻译结果预览 (前10行):\n{separator}\n{preview_text}\n{separator}"
    )

    # 显示完整信息
    logger.info(f"源字幕: {subtitle_path}")
    logger.info(f"翻译结果: {task.result_path}")
    logger.info(f"翻译风格: {task.config.style.value}")
    logger.info(f"源语言: {task.source_language}")
    logger.info(f"目标语言: {task.target_language}")
    logger.info(f"翻译状态: {task.status}")
    logger.info("测试完成!")


if __name__ == "__main__":
    asyncio.run(main())
