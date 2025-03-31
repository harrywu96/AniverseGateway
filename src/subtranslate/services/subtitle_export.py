"""字幕导出服务

提供将翻译后的字幕导出为SRT文件的功能，并按照约定格式命名和存储。
"""

import os
import logging
from pathlib import Path
from typing import Dict, Optional, Union

from ..schemas.task import SubtitleTask
from .utils import SRTOptimizer


logger = logging.getLogger(__name__)


class SubtitleExporter:
    """字幕导出器，负责将翻译后的字幕保存为文件"""

    @staticmethod
    def get_output_path(
        task: SubtitleTask, output_dir: Optional[str] = None
    ) -> str:
        """计算输出文件路径

        根据任务信息生成输出文件路径，格式为 "原文件名.语言类型.srt"

        Args:
            task: 字幕任务对象
            output_dir: 可选的输出目录，如果为None则使用原视频目录

        Returns:
            str: 输出文件路径
        """
        # 获取源文件路径和文件名
        source_path = Path(task.source_path)
        source_dir = source_path.parent
        source_stem = source_path.stem

        # 确定输出目录
        target_dir = Path(output_dir) if output_dir else source_dir

        # 生成输出文件名: 原文件名.语言类型.srt
        output_filename = f"{source_stem}.{task.target_language}.srt"

        # 组合完整路径
        output_path = target_dir / output_filename

        return str(output_path)

    @staticmethod
    def export_subtitle(
        translated_content: str,
        format_map: Dict,
        output_path: str,
        source_content: Optional[str] = None,
    ) -> str:
        """导出字幕到文件

        Args:
            translated_content: 翻译后的字幕内容
            format_map: 格式映射信息
            output_path: 输出文件路径
            source_content: 原始字幕内容（可选，用于格式恢复）

        Returns:
            str: 成功导出的文件路径
        """
        try:
            # 目录不存在则创建
            output_dir = os.path.dirname(output_path)
            os.makedirs(output_dir, exist_ok=True)

            # 恢复格式
            restored_content = SRTOptimizer.restore_srt_format(
                translated_content, format_map
            )

            # 写入文件
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(restored_content)

            logger.info(f"字幕成功导出到: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"字幕导出失败: {e}")
            raise

    @staticmethod
    def auto_export(
        task: SubtitleTask,
        translated_content: str,
        format_map: Dict,
        use_original_dir: bool = True,
    ) -> str:
        """自动导出字幕文件

        根据任务信息自动确定输出路径并导出翻译后的字幕

        Args:
            task: 字幕任务
            translated_content: 翻译后的内容
            format_map: 格式映射
            use_original_dir: 是否使用原视频目录，默认为True

        Returns:
            str: 导出的文件路径
        """
        # 确定输出目录
        output_dir = (
            None if use_original_dir else task.config.get("output_dir")
        )

        # 获取输出路径
        output_path = SubtitleExporter.get_output_path(task, output_dir)

        # 读取源文件内容(如果需要)
        source_content = None
        if os.path.exists(task.source_path):
            try:
                with open(task.source_path, "r", encoding="utf-8") as f:
                    source_content = f.read()
            except Exception as e:
                logger.warning(f"无法读取源文件内容: {e}")

        # 导出字幕
        return SubtitleExporter.export_subtitle(
            translated_content, format_map, output_path, source_content
        )
