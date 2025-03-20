"""工具函数模块

提供公共工具函数和装饰器，用于字幕翻译服务。
"""

import asyncio
import functools
import logging
import time
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
            logger.error(f"{func.__name__} 失败，已达最大重试次数: {last_exception}")
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
            logger.error(f"{func.__name__} 失败，已达最大重试次数: {last_exception}")
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
