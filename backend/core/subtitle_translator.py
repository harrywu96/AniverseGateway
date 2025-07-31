"""异世界语桥字幕翻译模块

提供将从动漫视频中提取的字幕翻译为目标语言的功能。
"""

import logging
import os
from typing import Callable, Optional, Dict

from backend.schemas.config import SystemConfig
from backend.schemas.task import SubtitleTask, PromptTemplate
from backend.services.translator import SubtitleTranslator as ServiceTranslator
from backend.services.subtitle_export import SubtitleExporter


logger = logging.getLogger(__name__)


class SubtitleTranslator:
    """字幕翻译器，负责将字幕翻译为目标语言"""

    def __init__(self, config: SystemConfig):
        """初始化字幕翻译器

        Args:
            config: 系统配置
        """
        self.config = config
        # 默认模板目录在临时目录下的templates子目录
        self.template_dir = os.path.join(config.temp_dir, "templates")
        if not os.path.exists(self.template_dir):
            try:
                os.makedirs(self.template_dir, exist_ok=True)
            except Exception as e:
                logger.warning(f"创建模板目录失败: {e}")
                self.template_dir = None

        self.service_translator = ServiceTranslator(
            ai_service_config=config.ai_service,
            template_dir=self.template_dir,
            max_requests_per_minute=config.max_requests_per_minute,
        )

    async def translate_task(
        self, task: SubtitleTask, progress_callback: Optional[Callable] = None
    ) -> bool:
        """执行字幕翻译任务

        Args:
            task: 字幕任务
            progress_callback: 进度回调函数

        Returns:
            bool: 翻译是否成功
        """
        try:
            # 更新任务状态
            task.status = "processing"

            # 执行翻译
            result = await self.service_translator.translate_file(
                task=task, progress_callback=progress_callback
            )

            # 获取翻译结果和格式映射
            translated_content = result.get("translated_content", "")
            format_map = result.get("format_map", {})

            # 导出到原视频目录
            output_path = SubtitleExporter.auto_export(
                task=task,
                translated_content=translated_content,
                format_map=format_map,
                use_original_dir=True,
            )

            # 更新任务状态
            task.mark_completed(output_path)
            return True
        except Exception as e:
            logger.error(f"翻译任务 {task.id} 失败: {e}")
            # 更新任务状态
            task.mark_failed(str(e))
            return False

    def get_available_templates(self) -> Dict[str, PromptTemplate]:
        """获取可用的提示模板

        Returns:
            Dict[str, PromptTemplate]: 可用模板字典
        """
        templates = {}
        # 获取内置模板
        templates.update(self.service_translator.default_templates)
        # 获取自定义模板
        templates.update(self.service_translator.custom_templates)
        return templates

    def save_custom_template(self, template: PromptTemplate) -> bool:
        """保存自定义提示模板

        Args:
            template: 提示模板

        Returns:
            bool: 保存是否成功
        """
        if not self.template_dir:
            logger.error("模板目录不存在")
            return False

        try:
            # 确保模板目录存在
            os.makedirs(self.template_dir, exist_ok=True)

            # 保存模板文件
            template_path = os.path.join(
                self.template_dir, f"{template.name}.json"
            )
            with open(template_path, "w", encoding="utf-8") as f:
                f.write(template.model_dump_json(indent=2))

            # 重新加载自定义模板
            self.service_translator.custom_templates = (
                self.service_translator._load_custom_templates()
            )
            return True
        except Exception as e:
            logger.error(f"保存自定义模板失败: {e}")
            return False

    def delete_custom_template(self, template_name: str) -> bool:
        """删除自定义提示模板

        Args:
            template_name: 模板名称

        Returns:
            bool: 删除是否成功
        """
        if not self.template_dir:
            logger.error("模板目录不存在")
            return False

        try:
            # 检查模板是否存在
            template_path = os.path.join(
                self.template_dir, f"{template_name}.json"
            )
            if not os.path.exists(template_path):
                logger.error(f"模板 {template_name} 不存在")
                return False

            # 删除模板文件
            os.remove(template_path)

            # 重新加载自定义模板
            self.service_translator.custom_templates = (
                self.service_translator._load_custom_templates()
            )
            return True
        except Exception as e:
            logger.error(f"删除自定义模板失败: {e}")
            return False

    @staticmethod
    def create_task(
        video_id: str,
        source_path: str,
        source_language: str = "en",
        target_language: str = "zh",
        result_path: Optional[str] = None,
        **config_kwargs,
    ) -> SubtitleTask:
        """创建字幕翻译任务

        Args:
            video_id: 视频ID
            source_path: 源字幕路径
            source_language: 源语言
            target_language: 目标语言
            result_path: 结果文件路径
            **config_kwargs: 翻译配置参数

        Returns:
            SubtitleTask: 创建的任务
        """
        # 创建任务
        task = SubtitleTask(
            video_id=video_id,
            source_path=source_path,
            source_language=source_language,
            target_language=target_language,
            result_path=result_path,
        )

        # 更新配置参数
        if config_kwargs:
            task_dict = task.model_dump()
            config_dict = task_dict.get("config", {})
            config_dict.update(config_kwargs)
            task.config = task.config.model_validate(config_dict)

        return task
