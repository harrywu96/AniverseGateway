"""字幕翻译服务

提供字幕翻译的核心功能，包括字幕分块处理、上下文一致性维护和翻译质量优化。
"""

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union, Any, Callable

from pydantic import BaseModel

from ..schemas.config import AIServiceConfig
from ..schemas.task import PromptTemplate, SubtitleTask, TranslationStyle
from .ai_service import AIService, AIServiceFactory
from .validators import TranslationValidator, ValidationLevel, ValidationResult

logger = logging.getLogger(__name__)


class SubtitleLine(BaseModel):
    """字幕行模型"""

    index: int
    start_time: str
    end_time: str
    text: str
    translated_text: Optional[str] = None
    validation_result: Optional[ValidationResult] = None


class SubtitleChunk(BaseModel):
    """字幕分块模型"""

    lines: List[SubtitleLine]
    context_before: List[SubtitleLine] = []
    context_after: List[SubtitleLine] = []


class SubtitleTranslator:
    """字幕翻译器，负责将SRT字幕翻译为目标语言"""

    def __init__(
        self, ai_service_config: AIServiceConfig, template_dir: Optional[str] = None
    ):
        """初始化字幕翻译器

        Args:
            ai_service_config: AI服务配置
            template_dir: 提示模板目录，默认为None
        """
        self.ai_service = AIServiceFactory.create_service(ai_service_config)
        self.template_dir = template_dir
        self.default_templates: Dict[str, PromptTemplate] = (
            self._load_default_templates()
        )
        self.custom_templates: Dict[str, PromptTemplate] = (
            self._load_custom_templates() if template_dir else {}
        )
        self.validator = TranslationValidator(validation_level=ValidationLevel.BASIC)

    def _load_default_templates(self) -> Dict[str, PromptTemplate]:
        """加载默认提示模板

        Returns:
            Dict[str, PromptTemplate]: 默认提示模板字典
        """
        # 预定义的默认模板
        templates = {
            "standard": PromptTemplate(
                name="标准字幕翻译",
                description="适用于一般场景的字幕翻译",
                system_prompt=(
                    "你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。"
                    "你的任务是将字幕从{source_language}翻译成流畅、自然的{target_language}。"
                    "翻译时应当符合目标语言的表达习惯，保持原文的意思和风格。"
                ),
                user_prompt=(
                    "请将以下字幕从{source_language}翻译成{target_language}，"
                    "保持{style}风格。\n\n"
                    "如果有特定术语或专有名词，请按照以下对照表进行翻译：\n{glossary}\n\n"
                    "请保持字幕的格式，只翻译内容部分。"
                    "上下文信息（如有）：\n{context}\n\n"
                    "需要翻译的字幕：\n{subtitle_text}"
                ),
                is_default=True,
            ),
            "literal": PromptTemplate(
                name="直译风格",
                description="忠实原文的字幕翻译",
                system_prompt=(
                    "你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。"
                    "你的任务是将字幕从{source_language}直译成{target_language}，"
                    "尽量保持原文的结构和表达方式。"
                ),
                user_prompt=(
                    "请将以下字幕从{source_language}直译成{target_language}，"
                    "尽可能忠实原文，保持原文的句式结构。\n\n"
                    "如果有特定术语或专有名词，请按照以下对照表进行翻译：\n{glossary}\n\n"
                    "请保持字幕的格式，只翻译内容部分。"
                    "上下文信息（如有）：\n{context}\n\n"
                    "需要翻译的字幕：\n{subtitle_text}"
                ),
            ),
            "colloquial": PromptTemplate(
                name="口语化风格",
                description="适合日常对话的口语化翻译",
                system_prompt=(
                    "你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。"
                    "你的任务是将字幕从{source_language}翻译成口语化的{target_language}，"
                    "使用日常交流中的表达方式，自然、生动、符合口语习惯。"
                ),
                user_prompt=(
                    "请将以下字幕从{source_language}翻译成口语化的{target_language}，"
                    "使用常见的口语表达，就像人们日常交谈那样。\n\n"
                    "如果有特定术语或专有名词，请按照以下对照表进行翻译：\n{glossary}\n\n"
                    "请保持字幕的格式，只翻译内容部分。"
                    "上下文信息（如有）：\n{context}\n\n"
                    "需要翻译的字幕：\n{subtitle_text}"
                ),
            ),
            "formal": PromptTemplate(
                name="正式风格",
                description="适合正式场合的庄重翻译",
                system_prompt=(
                    "你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。"
                    "你的任务是将字幕从{source_language}翻译成正式、庄重的{target_language}，"
                    "使用书面语和正式表达，适合学术、新闻、演讲等正式场合。"
                ),
                user_prompt=(
                    "请将以下字幕从{source_language}翻译成正式的{target_language}，"
                    "使用规范、庄重的表达方式，避免口语化和俚语表达。\n\n"
                    "如果有特定术语或专有名词，请按照以下对照表进行翻译：\n{glossary}\n\n"
                    "请保持字幕的格式，只翻译内容部分。"
                    "上下文信息（如有）：\n{context}\n\n"
                    "需要翻译的字幕：\n{subtitle_text}"
                ),
            ),
        }
        return templates

    def _load_custom_templates(self) -> Dict[str, PromptTemplate]:
        """从模板目录加载自定义提示模板

        Returns:
            Dict[str, PromptTemplate]: 自定义提示模板字典
        """
        templates = {}
        if not self.template_dir or not os.path.exists(self.template_dir):
            return templates

        try:
            for file_path in Path(self.template_dir).glob("*.json"):
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    try:
                        template = PromptTemplate(**data)
                        templates[template.name] = template
                        logger.info(f"加载自定义模板: {template.name}")
                    except Exception as e:
                        logger.error(f"加载模板 {file_path} 失败: {e}")
        except Exception as e:
            logger.error(f"从目录加载模板失败: {e}")

        return templates

    def get_template(self, name: Optional[str] = None) -> PromptTemplate:
        """获取指定名称的提示模板

        Args:
            name: 模板名称，如果为None则返回默认模板

        Returns:
            PromptTemplate: 提示模板

        Raises:
            ValueError: 指定的模板不存在时抛出
        """
        # 如果没有指定名称，返回默认模板
        if not name:
            # 在自定义模板中查找默认模板
            for template in self.custom_templates.values():
                if template.is_default:
                    return template
            # 在内置模板中查找默认模板
            for template in self.default_templates.values():
                if template.is_default:
                    return template
            # 如果没有找到默认模板，返回标准模板
            return self.default_templates["standard"]

        # 先在自定义模板中查找
        if name in self.custom_templates:
            return self.custom_templates[name]
        # 再在内置模板中查找
        if name in self.default_templates:
            return self.default_templates[name]

        # 没有找到指定的模板
        raise ValueError(f"提示模板 '{name}' 不存在")

    @staticmethod
    def parse_srt(srt_content: str) -> List[SubtitleLine]:
        """解析SRT格式的字幕内容

        Args:
            srt_content: SRT格式的字幕内容

        Returns:
            List[SubtitleLine]: 解析后的字幕行列表
        """
        lines = []
        pattern = r"(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:.+\n)+)"
        matches = re.findall(pattern, srt_content + "\n")

        for match in matches:
            index = int(match[0])
            start_time = match[1]
            end_time = match[2]
            text = match[3].strip()
            lines.append(
                SubtitleLine(
                    index=index,
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                )
            )

        return lines

    def split_into_chunks(
        self, lines: List[SubtitleLine], chunk_size: int, context_window: int
    ) -> List[SubtitleChunk]:
        """将字幕行分割成带上下文的块

        Args:
            lines: 字幕行列表
            chunk_size: 每块的字幕行数
            context_window: 上下文窗口大小

        Returns:
            List[SubtitleChunk]: 分块后的字幕块列表
        """
        chunks = []
        for i in range(0, len(lines), chunk_size):
            chunk_lines = lines[i : min(i + chunk_size, len(lines))]

            # 添加前文上下文
            context_before = []
            if i > 0:
                context_start = max(0, i - context_window)
                context_before = lines[context_start:i]

            # 添加后文上下文
            context_after = []
            if i + chunk_size < len(lines):
                context_end = min(len(lines), i + chunk_size + context_window)
                context_after = lines[i + chunk_size : context_end]

            chunks.append(
                SubtitleChunk(
                    lines=chunk_lines,
                    context_before=context_before,
                    context_after=context_after,
                )
            )

        return chunks

    def _prepare_translation_parameters(
        self,
        chunk: SubtitleChunk,
        task: SubtitleTask,
        style_name: str,
    ) -> Dict[str, str]:
        """准备翻译参数

        Args:
            chunk: 字幕块
            task: 字幕任务
            style_name: 翻译风格名称

        Returns:
            Dict[str, str]: 翻译参数字典
        """
        # 准备字幕文本
        subtitle_text = "\n\n".join(
            [
                f"{line.index}. {line.start_time} --> {line.end_time}\n{line.text}"
                for line in chunk.lines
            ]
        )

        # 准备上下文信息
        context_texts = []
        if chunk.context_before and len(chunk.context_before) > 0:
            before_text = "\n".join(
                [f"[前文] {line.text}" for line in chunk.context_before]
            )
            context_texts.append(before_text)

        if chunk.context_after and len(chunk.context_after) > 0:
            after_text = "\n".join(
                [f"[后文] {line.text}" for line in chunk.context_after]
            )
            context_texts.append(after_text)

        context = "\n".join(context_texts)

        # 准备术语表
        glossary_text = ""
        if task.config.glossary:
            glossary_items = [
                f"{term} -> {translation}"
                for term, translation in task.config.glossary.items()
            ]
            glossary_text = "\n".join(glossary_items)

        # 返回格式化参数
        return {
            "source_language": task.source_language,
            "target_language": task.target_language,
            "style": style_name,
            "subtitle_text": subtitle_text,
            "context": context,
            "glossary": glossary_text,
        }

    async def translate_chunk(
        self, chunk: SubtitleChunk, task: SubtitleTask
    ) -> List[SubtitleLine]:
        """翻译单个字幕块

        Args:
            chunk: 字幕块
            task: 字幕任务

        Returns:
            List[SubtitleLine]: 翻译后的字幕行列表

        Raises:
            Exception: 翻译失败时抛出异常
        """
        # 获取翻译风格名称
        style_name = task.config.style.value
        style_names = {
            TranslationStyle.LITERAL: "直译",
            TranslationStyle.NATURAL: "自然流畅",
            TranslationStyle.COLLOQUIAL: "口语化",
            TranslationStyle.FORMAL: "正式",
        }
        style_display_name = style_names.get(task.config.style, "自然流畅")

        # 准备翻译参数
        params = self._prepare_translation_parameters(chunk, task, style_display_name)

        # 获取提示模板
        template = None
        if task.config.prompt_template:
            template = task.config.prompt_template
        elif task.config.prompt_template_name:
            try:
                template = self.get_template(task.config.prompt_template_name)
            except ValueError:
                template = self.get_template()
        else:
            # 根据风格选择内置模板
            style_template_map = {
                TranslationStyle.LITERAL: "literal",
                TranslationStyle.NATURAL: "standard",
                TranslationStyle.COLLOQUIAL: "colloquial",
                TranslationStyle.FORMAL: "formal",
            }
            template_name = style_template_map.get(task.config.style, "standard")
            template = self.get_template(template_name)

        # 格式化提示
        system_prompt = template.format_system_prompt(**params)
        user_prompt = template.format_user_prompt(**params)

        # 翻译重试
        max_retries = task.config.max_retries
        last_error = None

        for attempt in range(max_retries):
            try:
                # 调用AI服务进行翻译
                response = await self.ai_service.chat_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    examples=template.examples,
                )

                # 解析翻译结果
                translated_lines = self._parse_translation_response(
                    response, chunk.lines
                )

                # 更新字幕行的翻译
                for i, line in enumerate(chunk.lines):
                    if i < len(translated_lines):
                        line.translated_text = translated_lines[i]

                return chunk.lines

            except Exception as e:
                logger.error(f"翻译失败 (尝试 {attempt+1}/{max_retries}): {e}")
                last_error = e
                # 最后一次尝试失败时抛出异常
                if attempt == max_retries - 1:
                    raise Exception(f"翻译失败，已达最大重试次数: {e}") from last_error

                # 简单的退避策略，等待一段时间后重试
                await asyncio.sleep(2**attempt)  # 指数退避

        # 不应该到达这里，但为了代码完整性
        raise Exception("翻译失败，未知错误") from last_error

    def _parse_translation_response(
        self, response: str, original_lines: List[SubtitleLine]
    ) -> List[str]:
        """解析翻译响应，提取翻译后的文本

        Args:
            response: AI服务的响应
            original_lines: 原始字幕行

        Returns:
            List[str]: 翻译后的文本列表
        """
        # 尝试解析结构化返回
        try:
            if response.startswith("```") and response.endswith("```"):
                response = response.strip("```")

            # 尝试解析JSON格式
            if response.strip().startswith("{") and response.strip().endswith("}"):
                try:
                    data = json.loads(response)
                    if "translations" in data and isinstance(
                        data["translations"], list
                    ):
                        return data["translations"]
                except json.JSONDecodeError:
                    pass

            # 首先尝试匹配编号格式: "1. 翻译文本"
            number_pattern = r"(\d+)\.\s*(.*(?:\n(?!\d+\.).*)*)"
            matches = re.findall(number_pattern, response)
            if matches and len(matches) == len(original_lines):
                return [match[1].strip() for match in matches]

            # 尝试匹配时间码格式: "00:00:00,000 --> 00:00:00,000"
            timecode_pattern = r"\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n((?:.+\n?)+?)(?=\n\d{2}:\d{2}:\d{2},\d{3}|\Z)"
            matches = re.findall(timecode_pattern, response)
            if matches and len(matches) == len(original_lines):
                return [match.strip() for match in matches]

            # 如果以上都失败，简单地按行拆分并过滤空行
            lines = [line.strip() for line in response.split("\n") if line.strip()]
            # 如果行数匹配，直接返回
            if len(lines) == len(original_lines):
                return lines

            # 如果行数不匹配但内容合理，进行简单的分组
            # 这是一个后备方案，可能不太准确
            result = []
            current_text = ""
            for line in lines:
                # 跳过可能的元数据行
                if (
                    line.startswith("-")
                    or line.startswith("*")
                    or re.match(r"^\d+\.", line)
                ):
                    if current_text:
                        result.append(current_text.strip())
                        current_text = ""
                    line = re.sub(r"^\d+\.\s*", "", line)
                    line = re.sub(r"^[-*]\s*", "", line)
                    current_text = line
                else:
                    if current_text:
                        current_text += " " + line
                    else:
                        current_text = line

            if current_text:
                result.append(current_text.strip())

            # 如果解析结果合理，使用它
            if result and len(result) == len(original_lines):
                return result

            # 最后的后备方案，尽可能合理地分配翻译文本
            if lines:
                # 平均分配行
                result = []
                avg_lines = max(1, len(lines) // len(original_lines))
                for i in range(0, len(original_lines)):
                    start_idx = i * avg_lines
                    end_idx = min(start_idx + avg_lines, len(lines))
                    if start_idx < len(lines):
                        result.append(" ".join(lines[start_idx:end_idx]))
                    else:
                        result.append("")
                return result

            # 如果所有方法都失败，返回原始响应作为单一翻译
            return [response] + [""] * (len(original_lines) - 1)

        except Exception as e:
            logger.error(f"解析翻译响应失败: {e}")
            # 返回原始响应作为单一翻译
            return [response] + [""] * (len(original_lines) - 1)

    async def translate_file(
        self, task: SubtitleTask, progress_callback: Optional[Callable] = None
    ) -> str:
        """翻译字幕文件

        Args:
            task: 字幕任务
            progress_callback: 进度回调函数，接受任务ID和进度百分比

        Returns:
            str: 翻译后的字幕文件路径

        Raises:
            Exception: 翻译失败时抛出异常
        """
        try:
            # 读取源字幕文件
            with open(task.source_path, "r", encoding="utf-8") as f:
                srt_content = f.read()

            # 解析字幕
            subtitle_lines = self.parse_srt(srt_content)

            # 分块
            chunks = self.split_into_chunks(
                subtitle_lines,
                task.config.chunk_size,
                task.config.context_window,
            )

            # 更新任务总块数
            task.total_chunks = len(chunks)
            task.completed_chunks = 0

            # 翻译各块
            translated_lines = []
            for i, chunk in enumerate(chunks):
                # 更新状态
                logger.info(f"翻译块 {i+1}/{len(chunks)}")

                # 翻译当前块
                translated_chunk = await self.translate_chunk(chunk, task)
                translated_lines.extend(translated_chunk)

                # 更新进度
                task.completed_chunks += 1
                if progress_callback:
                    # 计算进度百分比
                    progress = (task.completed_chunks / task.total_chunks) * 100
                    task.update_chunk_progress(task.completed_chunks)
                    await progress_callback(task.id, progress)

            # 生成结果文件
            result_path = self._generate_result_file(task, translated_lines)

            return result_path

        except Exception as e:
            logger.error(f"翻译文件失败: {e}")
            raise

    def _generate_result_file(
        self, task: SubtitleTask, translated_lines: List[SubtitleLine]
    ) -> str:
        """生成翻译结果文件

        Args:
            task: 字幕任务
            translated_lines: 翻译后的字幕行列表

        Returns:
            str: 结果文件路径
        """
        # 确定输出路径
        source_file = Path(task.source_path)
        if task.result_path:
            output_path = task.result_path
        else:
            # 在源文件所在目录创建输出文件
            filename = f"{source_file.stem}.{task.target_language}{source_file.suffix}"
            output_path = str(source_file.parent / filename)

        # 生成SRT内容
        lines = []
        for line in translated_lines:
            lines.append(f"{line.index}")
            lines.append(f"{line.start_time} --> {line.end_time}")
            lines.append(f"{line.translated_text or line.text}")  # 如果没有翻译使用原文
            lines.append("")  # 空行分隔

        # 写入文件
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return output_path
