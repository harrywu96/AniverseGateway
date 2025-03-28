"""工具函数模块

提供公共工具函数和装饰器，用于字幕翻译服务。
"""

import asyncio
import functools
import logging
import time
import re
from typing import Any, Callable, Type, TypeVar, Optional, List, Union

logger = logging.getLogger(__name__)

T = TypeVar("T")


def async_retry(
    max_retries: int = 3,
    retry_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Union[Type[Exception], List[Type[Exception]]] = Exception,
    retry_on_result: Optional[Callable[[Any], bool]] = None,
):
    """异步函数重试装饰器

    Args:
        max_retries: 最大重试次数
        retry_delay: 初始重试延迟（秒）
        backoff_factor: 退避因子，用于计算下一次重试延迟
        exceptions: 需要重试的异常类型
        retry_on_result: 根据返回值决定是否重试的函数

    Returns:
        decorator: 装饰器函数
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            retry_count = 0
            delay = retry_delay

            while retry_count < max_retries:
                try:
                    result = await func(*args, **kwargs)

                    # 如果提供了retry_on_result函数并且返回True，则重试
                    if retry_on_result and retry_on_result(result):
                        retry_count += 1
                        logger.warning(
                            f"{func.__name__} 返回值需要重试 "
                            f"(尝试 {retry_count}/{max_retries})"
                        )
                        if retry_count < max_retries:
                            await asyncio.sleep(delay)
                            delay *= backoff_factor
                            continue

                    return result
                except exceptions as e:
                    retry_count += 1
                    last_exception = e
                    logger.warning(
                        f"{func.__name__} 失败，准备重试 "
                        f"(尝试 {retry_count}/{max_retries}): {e}"
                    )

                    if retry_count >= max_retries:
                        break

                    await asyncio.sleep(delay)
                    delay *= backoff_factor

            # 超过最大重试次数，抛出最后一个异常
            logger.error(
                f"{func.__name__} 失败，已达最大重试次数: {last_exception}"
            )
            raise last_exception or Exception("达到最大重试次数")

        return wrapper

    return decorator


def sync_retry(
    max_retries: int = 3,
    retry_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Union[Type[Exception], List[Type[Exception]]] = Exception,
    retry_on_result: Optional[Callable[[Any], bool]] = None,
):
    """同步函数重试装饰器

    Args:
        max_retries: 最大重试次数
        retry_delay: 初始重试延迟（秒）
        backoff_factor: 退避因子，用于计算下一次重试延迟
        exceptions: 需要重试的异常类型
        retry_on_result: 根据返回值决定是否重试的函数

    Returns:
        decorator: 装饰器函数
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            retry_count = 0
            delay = retry_delay

            while retry_count < max_retries:
                try:
                    result = func(*args, **kwargs)

                    # 如果提供了retry_on_result函数并且返回True，则重试
                    if retry_on_result and retry_on_result(result):
                        retry_count += 1
                        logger.warning(
                            f"{func.__name__} 返回值需要重试 "
                            f"(尝试 {retry_count}/{max_retries})"
                        )
                        if retry_count < max_retries:
                            time.sleep(delay)
                            delay *= backoff_factor
                            continue

                    return result
                except exceptions as e:
                    retry_count += 1
                    last_exception = e
                    logger.warning(
                        f"{func.__name__} 失败，准备重试 "
                        f"(尝试 {retry_count}/{max_retries}): {e}"
                    )

                    if retry_count >= max_retries:
                        break

                    time.sleep(delay)
                    delay *= backoff_factor

            # 超过最大重试次数，抛出最后一个异常
            logger.error(
                f"{func.__name__} 失败，已达最大重试次数: {last_exception}"
            )
            raise last_exception or Exception("达到最大重试次数")

        return wrapper

    return decorator


class TokenCounter:
    """Token计数器，用于估算和限制API请求的token使用量"""

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """估算文本的token数量

        简单估算方法，中文字符按1个token，英文和其他字符按1/4个token计算。
        这只是粗略估计，不同模型的实际token计算方式会有所不同。

        Args:
            text: 需要估算的文本

        Returns:
            int: 估算的token数量
        """
        if not text:
            return 0

        # 中文字符数量
        chinese_chars = sum(1 for char in text if "\u4e00" <= char <= "\u9fff")
        # 非中文字符数量
        non_chinese_chars = len(text) - chinese_chars

        # 估算token：中文一个字符一个token，非中文平均4个字符一个token
        return (
            chinese_chars
            + (non_chinese_chars // 4)
            + (1 if non_chinese_chars % 4 else 0)
        )

    @staticmethod
    def check_token_limit(text: str, limit: int) -> bool:
        """检查文本是否超过token限制

        Args:
            text: 需要检查的文本
            limit: token限制

        Returns:
            bool: 是否在限制范围内
        """
        estimated_tokens = TokenCounter.estimate_tokens(text)
        return estimated_tokens <= limit


class SRTOptimizer:
    """SRT 格式优化器

    在翻译前优化 SRT 文本内容，减少不必要的 token 消耗，
    处理 HTML 标签和格式化内容，然后在翻译后重新合并恢复原格式。
    """

    @staticmethod
    def tokenize_html(text: str) -> list:
        """将HTML文本分解为标签和文本内容的令牌列表

        Args:
            text: 原始HTML文本

        Returns:
            list: 令牌列表，每个令牌是(类型, 内容)的元组
        """
        tokens = []
        last_end = 0

        # 匹配所有HTML标签
        for match in re.finditer(r"<[^>]+>", text):
            start, end = match.span()

            # 添加标签前的文本（如果有）
            if start > last_end:
                tokens.append(("text", text[last_end:start]))

            # 添加标签
            tokens.append(("tag", match.group(0)))

            last_end = end

        # 添加最后一段文本（如果有）
        if last_end < len(text):
            tokens.append(("text", text[last_end:]))

        return tokens

    @staticmethod
    def extract_text_and_format(text: str) -> tuple[str, list]:
        """从字幕文本中提取纯文本内容和格式信息

        Args:
            text: 原始字幕文本，可能包含 HTML 标签

        Returns:
            tuple[str, list]: 包含提取出的纯文本和格式令牌的元组
        """
        tokens = SRTOptimizer.tokenize_html(text)

        # 提取纯文本
        clean_text = "".join(
            content for token_type, content in tokens if token_type == "text"
        )

        return clean_text, tokens

    @staticmethod
    def apply_translation_to_tokens(tokens: list, translated_text: str) -> str:
        """将翻译后的文本应用到原始标记结构中，
        特别处理复杂的嵌套HTML标签情况

        Args:
            tokens: 原始令牌列表
            translated_text: 翻译后的纯文本

        Returns:
            str: 恢复格式后的文本
        """
        # 检查输入
        if not tokens:
            return translated_text

        # 分离文本和标签令牌
        text_tokens = []
        tag_tokens = []

        # 提取实质性文本内容（忽略只有空白字符的文本）
        for i, (token_type, content) in enumerate(tokens):
            if token_type == "text":
                if content.strip():  # 只处理非空内容
                    text_tokens.append((i, content))

            elif token_type == "tag":
                tag_tokens.append((i, content))

        # 如果没有实质性文本内容但有标签，采用简单嵌套策略
        if not text_tokens and tag_tokens:
            # 分类为开标签和闭标签
            opening_tags = [
                tag for i, tag in tag_tokens if not tag.startswith("</")
            ]
            closing_tags = [
                tag for i, tag in tag_tokens if tag.startswith("</")
            ]

            # 确保有效的HTML结构
            if opening_tags and closing_tags:
                # 直接构造包含原始标签的结果
                result = []

                # 添加所有开标签
                for tag in opening_tags:
                    result.append(tag)

                # 在中间添加翻译文本
                result.append(translated_text)

                # 添加所有闭标签
                for tag in closing_tags:
                    result.append(tag)

                return "".join(result)

        # 如果有实质性文本内容，采用位置映射策略
        if text_tokens:
            # 复制一份令牌列表
            new_tokens = list(tokens)

            # 单个文本段的情况
            if len(text_tokens) == 1:
                idx, _ = text_tokens[0]
                new_tokens[idx] = ("text", translated_text)
                return "".join(content for _, content in new_tokens)

            # 多个文本段的情况
            # 按行分割翻译文本
            translated_lines = translated_text.strip().split("\n")

            # 单行翻译文本
            if len(translated_lines) == 1:
                # 将翻译放在第一个实质性文本处
                idx, _ = text_tokens[0]
                new_tokens[idx] = ("text", translated_text)

                # 清除其他文本位置
                for i, _ in text_tokens[1:]:
                    new_tokens[i] = ("text", "")

            # 多行翻译文本
            else:
                # 处理的行数
                current_line = 0

                # 为每个实质性文本段落分配翻译行
                for idx, (i, content) in enumerate(text_tokens):
                    # 是否为多行文本
                    is_multiline = "\n" in content

                    if current_line < len(translated_lines):
                        if is_multiline:
                            # 计算原始文本的行数
                            lines_count = content.count("\n") + 1
                            # 分配对应数量的行
                            end_line = min(
                                current_line + lines_count,
                                len(translated_lines),
                            )

                            if current_line < end_line:
                                assigned_text = "\n".join(
                                    translated_lines[current_line:end_line]
                                )
                                new_tokens[i] = ("text", assigned_text)
                                current_line = end_line
                            else:
                                new_tokens[i] = ("text", "")
                        else:
                            # 单行文本，分配一行
                            new_tokens[i] = (
                                "text",
                                translated_lines[current_line],
                            )
                            current_line += 1
                    else:
                        # 没有更多翻译行，清空
                        new_tokens[i] = ("text", "")

            return "".join(content for _, content in new_tokens)

        # 其他情况，返回原始翻译
        return translated_text

    @staticmethod
    def parse_srt_entry(entry: str) -> tuple[str, str, str, str]:
        """解析单个SRT条目

        Args:
            entry: 单个SRT字幕条目

        Returns:
            tuple: (字幕索引, 开始时间, 结束时间, 文本内容)
        """
        lines = entry.strip().split("\n")
        if len(lines) < 3:
            return "", "", "", ""

        index = lines[0]
        time_line = lines[1]
        text = "\n".join(lines[2:])

        # 解析时间
        time_parts = time_line.split(" --> ")
        if len(time_parts) != 2:
            return index, "", "", text

        start_time, end_time = time_parts

        return index, start_time, end_time, text

    @staticmethod
    def optimize_srt_content(srt_content: str) -> tuple[str, dict]:
        """优化 SRT 内容，提取纯文本并保存格式信息

        Args:
            srt_content: 完整的 SRT 字幕内容

        Returns:
            tuple[str, dict]: 优化后的 SRT 内容和格式信息映射
        """
        # 拆分SRT内容为单独的条目
        entries = re.split(r"\n\n+", srt_content.strip())

        # 存储格式信息的字典
        format_map = {}

        # 优化后的 SRT 条目
        optimized_entries = []

        for entry in entries:
            if not entry.strip():
                continue

            # 解析SRT条目
            index, start_time, end_time, text = SRTOptimizer.parse_srt_entry(
                entry
            )
            if not index or not start_time or not end_time:
                continue

            # 提取纯文本和格式信息
            clean_text, tokens = SRTOptimizer.extract_text_and_format(text)

            # 如果存在格式信息，保存到映射中
            if any(token_type == "tag" for token_type, _ in tokens):
                format_map[index] = tokens

            # 构建优化后的字幕条目
            optimized_entry = (
                f"{index}\n{start_time} --> {end_time}\n{clean_text}\n"
            )
            optimized_entries.append(optimized_entry)

        return "\n".join(optimized_entries), format_map

    @staticmethod
    def restore_srt_format(srt_content: str, format_map: dict) -> str:
        """恢复优化后的 SRT 内容为原始格式

        Args:
            srt_content: 翻译后的 SRT 内容
            format_map: 格式信息映射

        Returns:
            str: 恢复格式后的 SRT 内容
        """
        # 拆分SRT内容为单独的条目
        entries = re.split(r"\n\n+", srt_content.strip())

        # 恢复格式后的 SRT 条目
        restored_entries = []

        for entry in entries:
            if not entry.strip():
                continue

            # 解析SRT条目
            index, start_time, end_time, text = SRTOptimizer.parse_srt_entry(
                entry
            )
            if not index or not start_time or not end_time:
                continue

            # 如果索引在格式映射中，恢复格式
            if index in format_map:
                text = SRTOptimizer.apply_translation_to_tokens(
                    format_map[index], text
                )

            # 构建恢复后的字幕条目
            restored_entry = f"{index}\n{start_time} --> {end_time}\n{text}"
            restored_entries.append(restored_entry)

        return "\n\n".join(restored_entries)
