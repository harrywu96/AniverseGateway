"""字幕导出测试

演示如何使用字幕导出功能
"""

import os
import sys
import asyncio
from pathlib import Path

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from subtranslate.schemas.config import SystemConfig, AIServiceConfig
from subtranslate.schemas.task import SubtitleTask
from subtranslate.core.subtitle_translator import SubtitleTranslator
from subtranslate.services.utils import SRTOptimizer
from subtranslate.services.subtitle_export import SubtitleExporter


async def test_subtitle_export():
    """测试字幕导出功能"""
    print("=== 字幕导出功能测试 ===")

    # 示例SRT内容
    sample_srt = """1
00:00:01,000 --> 00:00:05,000
<font face="Arial">Hello, welcome to the test!</font>

2
00:00:05,500 --> 00:00:10,000
<i>This is a subtitle with <b>formatting</b></i>

3
00:00:10,500 --> 00:00:15,000
<font color="yellow">Testing the export system</font>
"""

    # 创建测试文件
    test_dir = Path("./test_exports")
    os.makedirs(test_dir, exist_ok=True)

    source_file = test_dir / "source.srt"
    with open(source_file, "w", encoding="utf-8") as f:
        f.write(sample_srt)

    # 优化SRT内容
    optimized_srt, format_map = SRTOptimizer.optimize_srt_content(sample_srt)
    print(f"原始SRT已优化，提取格式映射包含 {len(format_map)} 个条目")

    # 模拟翻译后的内容
    translated_content = """1
00:00:01,000 --> 00:00:05,000
你好，欢迎来到测试！

2
00:00:05,500 --> 00:00:10,000
这是一个带有格式的字幕

3
00:00:10,500 --> 00:00:15,000
正在测试导出系统
"""

    # 创建字幕任务
    task = SubtitleTask(
        video_id="test_video",
        source_path=str(source_file),
        source_language="en",
        target_language="zh",
    )

    # 直接使用导出器
    output_path = SubtitleExporter.get_output_path(task)
    print(f"计算的输出路径: {output_path}")

    # 导出翻译后的字幕
    exported_path = SubtitleExporter.export_subtitle(
        translated_content=translated_content,
        format_map=format_map,
        output_path=output_path,
        source_content=sample_srt,
    )

    print(f"字幕已导出到: {exported_path}")

    # 读取导出的内容进行验证
    with open(exported_path, "r", encoding="utf-8") as f:
        exported_content = f.read()

    print("\n导出的字幕内容:")
    print("-" * 50)
    print(exported_content)
    print("-" * 50)

    print("\n测试自动导出功能...")
    auto_path = SubtitleExporter.auto_export(
        task=task, translated_content=translated_content, format_map=format_map
    )

    print(f"自动导出路径: {auto_path}")
    print("测试完成！")


if __name__ == "__main__":
    asyncio.run(test_subtitle_export())
