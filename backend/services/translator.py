"""字幕翻译服务

提供字幕翻译的核心功能，包括字幕分块处理、上下文一致性维护和翻译质量优化。
"""

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any

from pydantic import BaseModel

from backend.schemas.config import AIServiceConfig
from backend.schemas.task import PromptTemplate, SubtitleTask, TranslationStyle
from backend.services.ai_service import AIServiceFactory
from backend.services.validators import (
    TranslationValidator,
    ValidationLevel,
    ValidationResult,
)
from backend.services.utils import RateLimiter
from backend.utils.srt_optimizer import SRTOptimizer
from backend.core.logging_utils import get_logger

logger = get_logger("aniversegateway.services.translator")

# 全局请求频率限制器实例（将在初始化时设置）
global_rate_limiter = None


# 添加语言代码到名称的映射
def get_language_name(language_code: str) -> str:
    """将语言代码转换为可读语言名称

    Args:
        language_code: 语言代码，如'en', 'zh'

    Returns:
        str: 语言名称，如'英语', '中文'
    """
    language_map = {
        # 常用语言
        "en": "英语",
        "zh": "中文",
        "fr": "法语",
        "de": "德语",
        "es": "西班牙语",
        "it": "意大利语",
        "ja": "日语",
        "ko": "韩语",
        "ru": "俄语",
        "pt": "葡萄牙语",
        "ar": "阿拉伯语",
        "hi": "印地语",
        "bn": "孟加拉语",
        "nl": "荷兰语",
        "sv": "瑞典语",
        "vi": "越南语",
        "th": "泰语",
        "tr": "土耳其语",
        "id": "印度尼西亚语",
        "ms": "马来语",
        "fa": "波斯语",
        "pl": "波兰语",
        "uk": "乌克兰语",
        "ro": "罗马尼亚语",
        "cs": "捷克语",
        "hu": "匈牙利语",
        "fi": "芬兰语",
        "no": "挪威语",
        "da": "丹麦语",
        "he": "希伯来语",
        "el": "希腊语",
        "bg": "保加利亚语",
        "ca": "加泰罗尼亚语",
        "hr": "克罗地亚语",
        "sr": "塞尔维亚语",
        "sk": "斯洛伐克语",
        "sl": "斯洛文尼亚语",
        # 如需添加更多语言，请在此处扩展
    }
    return language_map.get(language_code, language_code)


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
        self,
        ai_service_config: AIServiceConfig,
        template_dir: Optional[str] = None,
        max_requests_per_minute: int = 45,
    ):
        """初始化字幕翻译器

        Args:
            ai_service_config: AI服务配置
            template_dir: 提示模板目录，默认为None
            max_requests_per_minute: 每分钟最大请求数
        """
        # 初始化全局频率限制器
        global global_rate_limiter
        if global_rate_limiter is None:
            global_rate_limiter = RateLimiter(max_requests_per_minute)
        # 根据配置的提供商类型获取相应的配置对象
        provider_type = ai_service_config.provider.value
        provider_config = ai_service_config.get_provider_config()

        if not provider_config:
            raise ValueError(f"未找到提供商 {provider_type} 的配置")

        self.ai_service = AIServiceFactory.create_service(
            provider_type, provider_config
        )
        logger.info(
            f"SubtitleTranslator创建的AI服务类型: {type(self.ai_service).__name__}"
        )
        logger.info(f"提供商类型: {provider_type}")
        if hasattr(provider_config, "base_url"):
            logger.info(f"API地址: {provider_config.base_url}")
        self.template_dir = template_dir
        self.default_templates: Dict[str, PromptTemplate] = (
            self._load_default_templates()
        )
        self.custom_templates: Dict[str, PromptTemplate] = (
            self._load_custom_templates() if template_dir else {}
        )
        # 使用基本验证级别初始化验证器
        self.validator = TranslationValidator(
            validation_level=ValidationLevel.BASIC
        )

    def _load_default_templates(self) -> Dict[str, PromptTemplate]:
        """加载默认提示模板

        Returns:
            Dict[str, PromptTemplate]: 默认提示模板字典
        """
        # 预定义的默认模板
        templates = {
            "standard": PromptTemplate(
                name="专业动漫字幕翻译",
                description="适用于动漫、游戏等场景的高质量字幕翻译，注重上下文和角色风格",
                system_prompt=(
                    "你是一名优秀的本地化翻译专家，专门负责将日本动漫视频字幕翻译成{target_language}。你同时精通{source_language}和{target_language}和日语，对日本的文化、俚语、网络用语以及动漫粉丝圈的文化和表达方式有深入的理解。"
                    "你的核心任务是产出“信、达、雅”的译文，即：忠实原意（信）、流畅易懂（达）、保留神韵（雅）。"
                    "在翻译时，请遵循以下核心准则："
                    "1. **风格优先**: 优先确保译文自然、生动，完全符合{target_language}的口语习惯，读起来就像是{target_language}母语者说出的话。避免任何翻译腔。"
                    "2. **神韵传达**: 在不偏离原意的基础上，精准传达出角色的情感、语气和性格。例如，傲娇角色的口是心非，热血角色的激昂，沉稳角色的简洁等。"
                    "3. **术语一致**: 严格参考提供的上下文和术语表，确保专有名词和特定说法在全文中保持统一。"
                ),
                user_prompt=(
                    "### 任务：将下面的字幕从 {source_language} 翻译成 {target_language}\n\n"
                    # "### 风格要求:\n"
                    # "- **风格**: {style} (例如：自然、口语化、保留动漫感)\n"
                    "- **具体体现**: 请使用生活化的口语进行表达，可以适当使用一些增强语气的词，如“啦、嘛、哦、呢”，但不要过度。让译文听起来像真实的对话，而不是书面语。\n\n"
                    "### 格式保留规则 (非常重要):\n"
                    "- **严格保留序号和时间戳**: 不要翻译或删除原文的序号、开始时间和结束时间。\n"
                    "- **保留样式标签**: 遇到如 `{{\\an8}}`、`{{\\k34}}` 等ASS/SSA格式标签，必须原封不动地保留在原文位置。\n"
                    "- **输出格式**: 严格按照“序号. 译文内容”的格式进行输出，每条字幕后保留换行。\n\n"
                    "### 上下文参考信息:\n"
                    "# 如果提供了前序字幕，请务必仔细阅读，理解对话的衔接和剧情发展。\n"
                    "# 如果提供了术语表，请严格按照其中的定义进行翻译。\n"
                    "前序字幕参考: \n{context}\n\n"
                    # "术语表: \n{glossary}\n\n"
                    "### 待翻译的字幕:\n"
                    "```\n"
                    "{subtitle_text}\n"
                    "```"
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
                    "如果遇到如{{\\an8}}、{{\\an1}}等字段，"
                    "请不要翻译，这是字幕的格式控制手段。"
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
                    "如果遇到如{{\\an8}}、{{\\an1}}等字段，"
                    "请不要翻译，这是字幕的格式控制手段。"
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
                    "如果遇到如{{\\an8}}、{{\\an1}}等字段，"
                    "请不要翻译，这是字幕的格式控制手段。"
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
        # 准备字幕文本 - 简化为只包含序号和文本内容
        subtitle_text = "\n\n".join(
            [f"{line.index}. {line.text}" for line in chunk.lines]
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
        if task.config.glossary and len(task.config.glossary) > 0:
            glossary_items = [
                f"{term} -> {translation}"
                for term, translation in task.config.glossary.items()
            ]
            glossary_text = "\n".join(glossary_items)
        else:
            # 确保 glossary 参数存在，即使为空
            glossary_text = "无特定术语"

        # 返回格式化参数
        return {
            "source_language": get_language_name(task.source_language),
            "target_language": get_language_name(task.target_language),
            "style": style_name,
            "subtitle_text": subtitle_text,
            "context": context
            or "无上下文",  # 确保 context 参数存在，即使为空
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
        style_display_name = {
            TranslationStyle.LITERAL: "直译",
            TranslationStyle.NATURAL: "自然流畅",
            TranslationStyle.COLLOQUIAL: "口语化",
            TranslationStyle.FORMAL: "正式",
        }.get(task.config.style, "自然流畅")

        # 准备翻译参数
        params = self._prepare_translation_parameters(
            chunk, task, style_display_name
        )

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
            template_name = style_template_map.get(
                task.config.style, "standard"
            )
            template = self.get_template(template_name)

        print("!!!!!template:", template)

        # 格式化提示
        system_prompt = template.format_system_prompt(**params)
        user_prompt = template.format_user_prompt(**params)

        print("!!!system_prompt:", system_prompt)
        print("!!!user_prompt:", user_prompt)

        # 翻译重试 - 优化重试逻辑，减少重复请求
        max_retries = task.config.max_retries
        last_error = None

        for attempt in range(max_retries):
            try:
                # 应用全局请求频率限制
                await global_rate_limiter.acquire()

                logger.info(f"开始翻译chunk，尝试 {attempt + 1}/{max_retries}")

                # 调用AI服务进行翻译
                response = await self.ai_service.chat_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    examples=template.examples,
                )

                print("翻译后的结果response", response)

                # 解析翻译结果
                translated_lines = self._parse_translation_response(
                    response, chunk.lines
                )

                # 更新字幕行的翻译
                for i, line in enumerate(chunk.lines):
                    if i < len(translated_lines):
                        line.translated_text = translated_lines[i]

                        # 验证翻译质量
                        validation_result = None
                        if task.config.validate_translations:
                            try:
                                # 使用主验证器进行验证
                                validation_result = self.validator.validate(
                                    source_text=line.text,
                                    translated_text=line.translated_text,
                                    source_language=task.source_language,
                                    target_language=task.target_language,
                                    validation_level=(
                                        ValidationLevel.STRICT
                                        if task.config.strict_validation
                                        else ValidationLevel.BASIC
                                    ),
                                    glossary=task.config.glossary,
                                    forbidden_terms=task.config.forbidden_terms,
                                )
                            except Exception as e:
                                logger.warning(f"翻译验证失败: {e}")

                        line.validation_result = validation_result

                # 返回翻译后的行
                return chunk.lines

            except Exception as e:
                last_error = e
                error_msg = str(e).lower()

                # 区分不同类型的错误，决定是否重试
                should_retry = True
                retry_delay = 2**attempt  # 指数退避

                # 检查是否是频率限制错误
                if any(
                    keyword in error_msg
                    for keyword in [
                        "rate limit",
                        "too many requests",
                        "429",
                        "quota",
                    ]
                ):
                    logger.warning(f"检测到频率限制错误，延长等待时间: {e}")
                    retry_delay = max(retry_delay, 60)  # 至少等待60秒
                # 检查是否是认证错误（不应重试）
                elif any(
                    keyword in error_msg
                    for keyword in [
                        "unauthorized",
                        "401",
                        "invalid api key",
                        "authentication",
                    ]
                ):
                    logger.error(f"认证错误，停止重试: {e}")
                    should_retry = False
                # 检查是否是网络超时（可以重试）
                elif any(
                    keyword in error_msg
                    for keyword in ["timeout", "connection", "network"]
                ):
                    logger.warning(f"网络错误，将重试: {e}")
                    retry_delay = min(retry_delay, 30)  # 网络错误不需要等太久
                else:
                    logger.warning(
                        f"翻译尝试 {attempt+1}/{max_retries} 失败: {e}"
                    )

                # 如果不应该重试或已达最大重试次数，跳出循环
                if not should_retry or attempt >= max_retries - 1:
                    break

                # 等待后重试
                logger.info(f"等待 {retry_delay} 秒后重试...")
                await asyncio.sleep(retry_delay)

        # 超过最大重试次数，抛出异常
        if last_error:
            raise Exception(
                f"翻译失败，达到最大重试次数 ({max_retries}): {last_error}"
            )
        else:
            raise Exception(f"翻译失败，达到最大重试次数 ({max_retries})")

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
            if response.strip().startswith("{") and response.strip().endswith(
                "}"
            ):
                try:
                    data = json.loads(response)
                    if "translations" in data and isinstance(
                        data["translations"], list
                    ):
                        return data["translations"]
                except json.JSONDecodeError:
                    pass

            # 主要解析方式：匹配编号格式: "1. 翻译文本"
            number_pattern = r"(\d+)\.\s*(.*(?:\n(?!\d+\.).*)*)"
            matches = re.findall(number_pattern, response)

            # 创建结果字典，以确保按正确顺序匹配原始行
            result_dict = {}
            for match in matches:
                index = int(match[0])
                text = match[1].strip()
                result_dict[index] = text

            # 按照原始行顺序整理结果
            result = []
            for line in original_lines:
                if line.index in result_dict:
                    result.append(result_dict[line.index])
                else:
                    # 如果没有找到对应的翻译，使用原文
                    logger.warning(f"未找到行 {line.index} 的翻译，使用原文")
                    result.append(line.text)

            # 如果结果不为空，返回
            if result:
                return result

            # 如果以上解析失败，简单地按行拆分并过滤空行
            lines = [
                line.strip() for line in response.split("\n") if line.strip()
            ]

            # 如果行数匹配，直接返回
            if len(lines) == len(original_lines):
                return lines

            # 最后的后备方案，返回原始响应作为单一翻译
            logger.warning("解析翻译响应失败，返回原始响应")
            return [response] + [""] * (len(original_lines) - 1)

        except Exception as e:
            logger.error(f"解析翻译响应失败: {e}")
            # 返回原始响应作为单一翻译
            return [response] + [""] * (len(original_lines) - 1)

    async def translate_file(
        self, task: SubtitleTask, progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """翻译字幕文件

        Args:
            task: 字幕任务
            progress_callback: 进度回调函数

        Returns:
            Dict[str, Any]: 包含翻译结果和格式映射的字典
        """
        try:
            # 导入任务取消管理器
            from backend.services.task_cancellation_manager import (
                cancellation_manager,
            )

            # 读取源文件内容
            with open(task.source_path, "r", encoding="utf-8") as f:
                srt_content = f.read()

            # 优化SRT内容
            optimized_srt, format_map = SRTOptimizer.optimize_srt_content(
                srt_content
            )

            # 解析优化后的SRT
            lines = self.parse_srt(optimized_srt)

            # 分块处理
            chunks = self.split_into_chunks(
                lines, task.config.chunk_size, task.config.context_window
            )

            # 设置进度跟踪
            total_chunks = len(chunks)
            task.total_chunks = total_chunks

            # 逐块翻译
            translated_lines = []
            for i, chunk in enumerate(chunks):
                # 检查任务是否被取消
                if cancellation_manager.is_cancelled(task.id):
                    logger.info(f"任务 {task.id} 被用户取消，停止翻译")
                    # 从取消列表中移除任务
                    cancellation_manager.remove_task(task.id)
                    # 抛出取消异常
                    raise Exception("翻译任务被用户取消")

                # 翻译当前块
                chunk_result = await self.translate_chunk(chunk, task)
                translated_lines.extend(chunk_result)

                # 更新进度
                task.update_chunk_progress(i + 1)
                if progress_callback:
                    await progress_callback(
                        task.progress,
                        "processing",
                        f"正在翻译第 {i + 1}/{total_chunks} 块",
                    )

            # 生成翻译后的SRT内容
            translated_srt = self._generate_translated_content(
                translated_lines
            )

            # 返回翻译结果和格式映射
            return {
                "translated_content": translated_srt,
                "format_map": format_map,
                "result_path": self._generate_result_file(
                    task, translated_lines
                ),
            }

        except Exception as e:
            logger.error(f"文件翻译失败: {e}")
            import traceback

            logger.error(f"详细错误堆栈: {traceback.format_exc()}")
            raise

    def _generate_translated_content(
        self, translated_lines: List[SubtitleLine]
    ) -> str:
        """根据翻译后的字幕行生成SRT内容

        Args:
            translated_lines: 翻译后的字幕行列表

        Returns:
            str: 生成的SRT内容
        """
        result = []
        for line in translated_lines:
            srt_entry = (
                f"{line.index}\n"
                f"{line.start_time} --> {line.end_time}\n"
                f"{line.translated_text or line.text}\n"
            )
            result.append(srt_entry)

        return "\n".join(result)

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
            lines.append(
                f"{line.translated_text or line.text}"
            )  # 如果没有翻译使用原文
            lines.append("")  # 空行分隔

        # 写入文件
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return output_path
