"""SRT翻译服务模块

提供SRT字幕文件的优化、翻译和格式恢复功能。
"""

import json
import re
from typing import Dict, Optional, Tuple, Callable, Any

from backend.services.utils import SRTOptimizer, TokenCounter


class SRTTranslator:
    """SRT字幕翻译类

    提供完整的工作流程来优化、翻译和恢复SRT字幕文件，同时节省token消耗
    """

    def __init__(
        self,
        translator_func: Optional[Callable[[str], str]] = None,
        debug: bool = False,
    ):
        """初始化SRT翻译器

        Args:
            translator_func: 可选的翻译函数，接收字符串，返回翻译后的字符串
            debug: 是否启用调试输出
        """
        self.translator_func = translator_func
        self.debug = debug

    def set_translator(self, translator_func: Callable[[str], str]) -> None:
        """设置翻译函数

        Args:
            translator_func: 翻译函数，接收字符串，返回翻译后的字符串
        """
        self.translator_func = translator_func

    def debug_print(self, *args, **kwargs):
        """调试输出

        只有在debug=True时输出
        """
        if self.debug:
            print(*args, **kwargs)

    def extract_translation_data(
        self, optimized_srt: str, format_map: Dict
    ) -> Dict[str, Any]:
        """提取需要翻译的数据，减少token消耗

        Args:
            optimized_srt: 优化后的SRT内容
            format_map: 格式信息映射

        Returns:
            Dict: 需要翻译的数据，JSON格式
        """
        # 拆分SRT内容为单独的条目
        entries = re.split(r"\n\n+", optimized_srt.strip())

        subtitles = []
        processed_ids = set()  # 跟踪已处理的ID

        # 第一步：从优化后的SRT中提取内容
        for entry in entries:
            if not entry.strip():
                continue

            # 解析SRT条目
            index, start_time, end_time, text = SRTOptimizer.parse_srt_entry(
                entry
            )
            if not index or not start_time or not end_time:
                continue

            # 清理文本
            cleaned_text = self._clean_text_for_translation(text)

            # 如果有实质内容，添加到翻译列表
            if cleaned_text:
                subtitle = {"id": index, "text": cleaned_text}
                subtitles.append(subtitle)
                processed_ids.add(index)

                self.debug_print(
                    f"从优化SRT提取字幕 #{index}: {cleaned_text!r}"
                )

        # 第二步：从格式映射中提取未处理的ID
        for idx, tokens in format_map.items():
            # 跳过已处理的ID
            if idx in processed_ids:
                continue

            # 从tokens中提取文本
            text_parts = []
            for token_type, content in tokens:
                if token_type == "text":
                    cleaned = content.strip()
                    if cleaned:
                        text_parts.append(cleaned)

            # 如果找到了有效文本
            if text_parts:
                combined_text = " ".join(text_parts).strip()
                if combined_text:
                    subtitle = {"id": idx, "text": combined_text}
                    subtitles.append(subtitle)
                    processed_ids.add(idx)

                    self.debug_print(
                        f"从格式映射提取字幕 #{idx}: {combined_text!r}"
                    )

        # 排序结果，确保按ID顺序
        subtitles.sort(
            key=lambda s: int(s["id"]) if s["id"].isdigit() else s["id"]
        )

        return {"version": 1, "subtitles": subtitles}

    def _clean_text_for_translation(self, text: str) -> str:
        """清理文本以便于翻译

        去除多余空白但保留重要内容结构

        Args:
            text: 原始文本

        Returns:
            str: 清理后的文本
        """
        if not text:
            return ""

        # 按行分割
        lines = text.split("\n")

        # 清理每一行
        cleaned_lines = []
        for line in lines:
            # 格式控制行保持原样
            if line.strip().startswith("{\\"):
                cleaned_lines.append(line.strip())
            # 内容行去除前后空白
            elif line.strip():
                cleaned_lines.append(line.strip())

        # 重新组合
        result = "\n".join(cleaned_lines)

        return result.strip()

    def restore_from_translation_data(
        self,
        translation_data: Dict[str, Any],
        original_srt: str,
        format_map: Dict,
    ) -> str:
        """从翻译数据恢复SRT内容

        Args:
            translation_data: 翻译后的数据
            original_srt: 原始SRT内容
            format_map: 格式信息映射

        Returns:
            str: 恢复后的SRT内容
        """
        # 解析原始SRT获取时间信息
        entries = re.split(r"\n\n+", original_srt.strip())
        time_map = {}

        for entry in entries:
            if not entry.strip():
                continue

            index, start_time, end_time, _ = SRTOptimizer.parse_srt_entry(
                entry
            )
            if index and start_time and end_time:
                time_map[index] = (start_time, end_time)

        # 构建翻译后的SRT
        translated_srt = []

        # 创建ID到翻译文本的映射
        id_to_text = {
            subtitle["id"]: subtitle["text"]
            for subtitle in translation_data["subtitles"]
        }

        # 处理每个原始条目
        for entry in entries:
            if not entry.strip():
                continue

            index, start_time, end_time, text = SRTOptimizer.parse_srt_entry(
                entry
            )
            if not index or not start_time or not end_time:
                continue

            # 使用翻译后的文本（如果有）
            if index in id_to_text:
                text = id_to_text[index]
                self.debug_print(f"应用翻译 #{index}: {text!r}")
            else:
                # 保留原文
                self.debug_print(f"保留原文 #{index}: {text!r}")

            # 构建字幕条目
            srt_entry = f"{index}\n{start_time} --> {end_time}\n{text}"
            translated_srt.append(srt_entry)

        # 返回用于恢复格式的SRT内容
        return "\n\n".join(translated_srt)

    def translate_json_data(
        self, translation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """翻译JSON格式的数据

        Args:
            translation_data: 需要翻译的数据

        Returns:
            Dict: 翻译后的数据
        """
        if not self.translator_func:
            raise ValueError("未设置翻译函数，请先调用set_translator方法")

        translated = {"version": translation_data["version"], "subtitles": []}

        for subtitle in translation_data["subtitles"]:
            text = subtitle["text"]

            self.debug_print(f"翻译 #{subtitle['id']}: {text!r}")
            translated_text = self.translator_func(text)
            self.debug_print(f"翻译结果: {translated_text!r}")

            translated_subtitle = {
                "id": subtitle["id"],
                "text": translated_text,
            }

            translated["subtitles"].append(translated_subtitle)

        return translated

    def translate_srt(self, srt_content: str) -> Tuple[str, Dict[str, Any]]:
        """翻译SRT内容

        完整流程：优化SRT -> 提取翻译数据 -> 翻译 -> 恢复格式

        Args:
            srt_content: 原始SRT内容

        Returns:
            Tuple[str, Dict]: 翻译后的SRT内容和详细信息
        """
        if not self.translator_func:
            raise ValueError("未设置翻译函数，请先调用set_translator方法")

        self.debug_print("=== 开始翻译SRT内容 ===")

        # 1. 优化SRT
        self.debug_print("\n1. 优化SRT内容")
        optimized_srt, format_map = SRTOptimizer.optimize_srt_content(
            srt_content
        )

        # 输出优化后的内容
        if self.debug:
            self.debug_print("优化后的SRT内容:")
            self.debug_print("-" * 40)
            self.debug_print(optimized_srt)
            self.debug_print("-" * 40)

            self.debug_print("\n格式映射:")
            for idx, tokens in format_map.items():
                self.debug_print(f"字幕 #{idx}:")
                for i, (token_type, content) in enumerate(tokens):
                    content_preview = content.replace("\n", "\\n")
                    if len(content_preview) > 30:
                        content_preview = content_preview[:27] + "..."
                    self.debug_print(
                        f"  {i+1}. [{token_type}] {content_preview}"
                    )

        # 2. 提取翻译数据
        self.debug_print("\n2. 提取翻译数据")
        translation_data = self.extract_translation_data(
            optimized_srt, format_map
        )

        # 3. 翻译数据
        self.debug_print("\n3. 翻译数据")
        translated_data = self.translate_json_data(translation_data)

        # 4. 恢复SRT格式
        self.debug_print("\n4. 恢复SRT格式")
        translated_srt = self.restore_from_translation_data(
            translated_data, srt_content, format_map
        )

        # 输出中间结果
        if self.debug:
            self.debug_print("恢复SRT格式后内容:")
            self.debug_print("-" * 40)
            self.debug_print(translated_srt)
            self.debug_print("-" * 40)

        # 5. 恢复原始格式
        self.debug_print("\n5. 恢复原始格式")
        restored_srt = SRTOptimizer.restore_srt_format(
            translated_srt, format_map
        )

        # 计算token使用信息
        original_tokens = TokenCounter.estimate_tokens(srt_content)
        optimized_tokens = TokenCounter.estimate_tokens(optimized_srt)
        translation_tokens = TokenCounter.estimate_tokens(
            json.dumps(translation_data)
        )

        savings = original_tokens - translation_tokens
        savings_percent = (
            (savings / original_tokens * 100) if original_tokens else 0
        )

        self.debug_print("\n翻译完成!")
        self.debug_print(f"原始Token数: {original_tokens}")
        self.debug_print(f"优化后Token数: {optimized_tokens}")
        self.debug_print(f"翻译数据Token数: {translation_tokens}")
        self.debug_print(f"节省Token数: {savings}")
        self.debug_print(f"节省百分比: {savings_percent:.2f}%")

        # 返回翻译结果和详细信息
        details = {
            "original_tokens": original_tokens,
            "optimized_tokens": optimized_tokens,
            "translation_tokens": translation_tokens,
            "token_savings": savings,
            "savings_percent": savings_percent,
            "translation_data": translation_data,
            "translated_data": translated_data,
        }

        return restored_srt, details

    def translate_srt_file(
        self, input_file: str, output_file: str
    ) -> Dict[str, Any]:
        """翻译SRT文件

        Args:
            input_file: 输入文件路径
            output_file: 输出文件路径

        Returns:
            Dict: 翻译详细信息
        """
        # 读取输入文件
        with open(input_file, "r", encoding="utf-8") as f:
            srt_content = f.read()

        # 翻译SRT内容
        translated_srt, details = self.translate_srt(srt_content)

        # 写入输出文件
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(translated_srt)

        return details
