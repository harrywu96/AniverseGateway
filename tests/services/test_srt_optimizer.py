"""SRT 优化器测试

测试 SRTOptimizer 类的功能
"""

import pytest
from src.subtranslate.services.utils import SRTOptimizer


def test_extract_text_and_format():
    """测试从字幕文本中提取纯文本和格式信息"""
    # 测试基本 HTML 标签
    text = (
        '<font face="Trebuchet MS" size="24">And ever since, '
        "we've been obsessed with the world of "
        "<i>A Tale of Perishing</i>, haven't we?</font>"
    )

    clean_text, format_info = SRTOptimizer.extract_text_and_format(text)

    # 验证纯文本中不包含任何 HTML 标签
    assert "<" not in clean_text
    assert ">" not in clean_text

    # 验证纯文本内容正确
    assert (
        "And ever since, we've been obsessed with the world of " in clean_text
    )
    assert "A Tale of Perishing" in clean_text
    assert ", haven't we?" in clean_text

    # 验证格式信息被正确提取
    assert len(format_info) > 0

    # 恢复格式后应与原文相同
    restored_text = SRTOptimizer.restore_format(clean_text, format_info)
    assert restored_text == text


def test_optimize_srt_content():
    """测试 SRT 内容优化"""
    # 创建测试 SRT 内容
    sample_srt = """1
00:00:01,000 --> 00:00:05,000
<font color="white">Hello <i>world</i>!</font>

2
00:00:06,000 --> 00:00:10,000
<b>This is a test</b>
"""

    # 优化 SRT 内容
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(sample_srt)

    # 验证优化后的内容不包含 HTML 标签
    assert "<" not in optimized_srt
    assert ">" not in optimized_srt

    # 验证索引和时间码保持不变
    assert "1" in optimized_srt
    assert "00:00:01,000 --> 00:00:05,000" in optimized_srt
    assert "2" in optimized_srt
    assert "00:00:06,000 --> 00:00:10,000" in optimized_srt

    # 验证纯文本内容正确
    assert "Hello world!" in optimized_srt
    assert "This is a test" in optimized_srt

    # 验证格式映射信息
    assert "1" in format_map
    assert len(format_map["1"]) > 0
    assert "2" in format_map
    assert len(format_map["2"]) > 0


def test_restore_srt_format():
    """测试恢复 SRT 格式"""
    # 创建测试 SRT 内容
    sample_srt = """1
00:00:01,000 --> 00:00:05,000
<font color="white">Hello <i>world</i>!</font>

2
00:00:06,000 --> 00:00:10,000
<b>This is a test</b>
"""

    # 优化后再恢复格式
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(sample_srt)

    # 模拟翻译（将文本转换为大写）
    translated_lines = []
    for line in optimized_srt.split("\n"):
        if line and not line.isdigit() and "-->" not in line:
            translated_lines.append(line.upper())
        else:
            translated_lines.append(line)

    translated_srt = "\n".join(translated_lines)

    # 恢复格式
    restored_srt = SRTOptimizer.restore_srt_format(translated_srt, format_map)

    # 验证结果包含 HTML 标签
    assert '<font color="white">' in restored_srt
    assert "<i>" in restored_srt
    assert "</i>" in restored_srt
    assert "<b>" in restored_srt

    # 验证翻译后的文本被正确保留（大写）
    assert "HELLO WORLD!" in restored_srt
    assert "THIS IS A TEST" in restored_srt


def test_complete_workflow():
    """测试完整的工作流程：优化 -> 翻译 -> 恢复"""
    # 创建一个更复杂的 SRT 示例
    complex_srt = """298
00:17:27,290 --> 00:17:31,700
<font face="Trebuchet MS" size="24">And ever since, we've been obsessed with
the world of <i>A Tale of Perishing</i>, haven't we?</font>

299
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="20"><font face="Times New Roman"><font color="#8c918d">The Legendary Hero</font></font></font></b></font>

300
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="18">{\an8}<font face="Times New Roman"><font color="#8c918d">Burdened
With Despair</font></font></font></b></font>
"""

    # 1. 优化 SRT 内容
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(complex_srt)

    # 2. 模拟翻译过程（添加 "[翻译]" 前缀）
    translated_lines = []
    for line in optimized_srt.split("\n"):
        if line and not line.isdigit() and "-->" not in line and line.strip():
            translated_lines.append(f"[翻译] {line}")
        else:
            translated_lines.append(line)

    translated_srt = "\n".join(translated_lines)

    # 3. 恢复格式
    restored_srt = SRTOptimizer.restore_srt_format(translated_srt, format_map)

    # 验证恢复的 SRT 包含翻译文本和原始格式
    assert "[翻译]" in restored_srt
    assert "<font face=" in restored_srt
    assert "<i>" in restored_srt
    assert "<b>" in restored_srt
    assert "{\an8}" in restored_srt

    # 验证所有原始的行号和时间码都存在
    assert "298" in restored_srt
    assert "00:17:27,290 --> 00:17:31,700" in restored_srt
    assert "299" in restored_srt
    assert "00:17:46,000 --> 00:17:49,500" in restored_srt
    assert "300" in restored_srt
