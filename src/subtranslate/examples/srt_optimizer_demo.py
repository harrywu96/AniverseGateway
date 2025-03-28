"""SRT 优化器演示

展示如何使用 SRTOptimizer 来优化字幕文件，减少 token 消耗
"""

import sys
import json
import re
from pathlib import Path

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from subtranslate.services.utils import SRTOptimizer, TokenCounter


def print_tokens(tokens):
    """打印令牌列表，方便调试"""
    print("  令牌列表：")
    for i, (token_type, content) in enumerate(tokens):
        content_display = content.replace("\n", "\\n")
        if len(content_display) > 30:
            content_display = content_display[:27] + "..."
        print(f"  {i+1}. [{token_type}] {content_display}")


def extract_translation_data(optimized_srt, format_map):
    """提取仅需要翻译的数据，以便发送给API

    Args:
        optimized_srt: 优化后的SRT内容
        format_map: 格式映射信息

    Returns:
        dict: 包含必要翻译数据的JSON格式
    """
    # 拆分SRT内容为单独的条目
    entries = re.split(r"\n\n+", optimized_srt.strip())

    subtitles = []

    for entry in entries:
        if not entry.strip():
            continue

        # 解析SRT条目
        index, start_time, end_time, text = SRTOptimizer.parse_srt_entry(entry)
        if not index or not start_time or not end_time:
            continue

        # 构建翻译数据
        subtitle = {"id": index, "text": text.strip()}

        subtitles.append(subtitle)

    return {"version": 1, "subtitles": subtitles}


def restore_from_translation_data(translation_data, original_srt, format_map):
    """从翻译数据恢复完整SRT

    Args:
        translation_data: 翻译后的数据
        original_srt: 原始SRT内容
        format_map: 格式映射

    Returns:
        str: 恢复后的SRT内容
    """
    # 解析原始SRT获取时间信息
    entries = re.split(r"\n\n+", original_srt.strip())
    time_map = {}

    for entry in entries:
        if not entry.strip():
            continue

        index, start_time, end_time, _ = SRTOptimizer.parse_srt_entry(entry)
        if index and start_time and end_time:
            time_map[index] = (start_time, end_time)

    # 构建翻译后的SRT
    translated_srt = []

    for subtitle in translation_data["subtitles"]:
        index = subtitle["id"]
        text = subtitle["text"]

        if index in time_map:
            start_time, end_time = time_map[index]
            entry = f"{index}\n{start_time} --> {end_time}\n{text}"
            translated_srt.append(entry)

    # 返回用于恢复格式的SRT内容
    return "\n\n".join(translated_srt)


def main():
    """运行 SRTOptimizer 演示"""
    print("SRT 优化器演示 - 字幕翻译 Token 优化")
    print("=" * 50)

    # 示例SRT内容，注意拆分长行
    srt_sample = """298
00:17:27,290 --> 00:17:31,700
<font face="Trebuchet MS" size="24">And ever since, we've been obsessed with
the world of <i>A Tale of Perishing</i>, haven't we?</font>

299
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="20">
<font face="Times New Roman"><font color="#8c918d">The Legendary Hero
</font></font></font></b></font>

300
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="18">{\\an8}
<font face="Times New Roman"><font color="#8c918d">Burdened
With Despair</font></font></font></b></font>"""

    # 1. 显示原始SRT内容和token估算
    print("\n1. 原始SRT内容:")
    print("-" * 50)
    print(srt_sample)
    print("-" * 50)

    original_tokens = TokenCounter.estimate_tokens(srt_sample)
    print(f"原始内容预估Token数: {original_tokens}")

    # 2. SRTOptimizer优化处理
    print("\n2. SRT优化处理:")
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(srt_sample)

    print("优化后SRT内容:")
    print("-" * 50)
    print(optimized_srt)
    print("-" * 50)

    optimized_tokens = TokenCounter.estimate_tokens(optimized_srt)
    print(f"优化后内容预估Token数: {optimized_tokens}")
    token_savings = original_tokens - optimized_tokens
    savings_percent = token_savings / original_tokens * 100
    print(f"节约Token数: {token_savings} ({savings_percent:.2f}%)")

    # 3. 提取仅需翻译的数据
    print("\n3. 提取API翻译所需数据:")
    translation_data = extract_translation_data(optimized_srt, format_map)

    print("API翻译数据 (JSON):")
    print("-" * 50)
    translation_json = json.dumps(
        translation_data, indent=2, ensure_ascii=False
    )
    print(translation_json)
    print("-" * 50)

    translation_tokens = TokenCounter.estimate_tokens(
        json.dumps(translation_data)
    )
    print(f"翻译数据预估Token数: {translation_tokens}")
    api_savings = original_tokens - translation_tokens
    api_percent = api_savings / original_tokens * 100
    print(f"相比原始内容节约: {api_savings} ({api_percent:.2f}%)")

    # 4. 模拟翻译过程
    print("\n4. 模拟翻译过程:")

    # 模拟翻译函数
    def mock_translate(translation_data):
        translated = {"version": translation_data["version"], "subtitles": []}

        translations = {
            "And ever since, we've been obsessed with\n"
            "the world of A Tale of Perishing, haven't we?": "从那以后，我们一直痴迷于\n《消亡的故事》的世界，不是吗？",
            "The Legendary Hero": "传奇英雄",
            "Burdened\nWith Despair": "背负\n绝望",
        }

        for subtitle in translation_data["subtitles"]:
            text = subtitle["text"]
            translated_text = translations.get(text, f"[翻译] {text}")

            translated_subtitle = {
                "id": subtitle["id"],
                "text": translated_text,
            }

            translated["subtitles"].append(translated_subtitle)

        return translated

    # 执行模拟翻译
    translated_data = mock_translate(translation_data)
    print("翻译后数据:")
    print("-" * 50)
    print(json.dumps(translated_data, indent=2, ensure_ascii=False))
    print("-" * 50)

    # 5. 从翻译数据恢复SRT格式
    print("\n5. 恢复SRT格式:")
    # 从翻译数据重建SRT内容
    translated_srt = restore_from_translation_data(
        translated_data, srt_sample, format_map
    )
    print("重建的SRT内容:")
    print("-" * 50)
    print(translated_srt)
    print("-" * 50)

    # 6. 恢复原始格式
    print("\n6. 恢复原始格式:")
    restored_srt = SRTOptimizer.restore_srt_format(translated_srt, format_map)
    print("最终SRT内容:")
    print("-" * 50)
    print(restored_srt)
    print("-" * 50)

    # 7. 比较token使用情况
    print("\n7. Token使用总结:")
    print("-" * 50)
    print(f"原始SRT: {original_tokens} tokens")
    print(f"优化后SRT: {optimized_tokens} tokens")
    print(f"仅翻译数据: {translation_tokens} tokens")
    final_percent = (
        (original_tokens - translation_tokens) / original_tokens * 100
    )
    print(f"节约比例: {final_percent:.2f}%")
    print("-" * 50)


if __name__ == "__main__":
    main()
