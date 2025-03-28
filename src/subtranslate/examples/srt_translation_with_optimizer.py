"""SRT 翻译优化器示例

演示如何在翻译流程中使用 SRT 优化器提高效率
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, List, Optional

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from src.subtranslate.schemas.config import AIServiceConfig
from src.subtranslate.schemas.task import SubtitleTask, TranslationStyle
from src.subtranslate.services.ai_service import AIServiceFactory
from src.subtranslate.services.utils import SRTOptimizer


async def translate_with_optimization(
    input_file: str,
    output_file: str,
    api_key: str,
    source_language: str = "en",
    target_language: str = "zh",
    chunk_size: int = 3,
) -> None:
    """使用优化器翻译 SRT 文件

    Args:
        input_file: 输入文件路径
        output_file: 输出文件路径
        api_key: API 密钥
        source_language: 源语言代码
        target_language: 目标语言代码
        chunk_size: 翻译块大小
    """
    print(f"开始翻译: {input_file} -> {output_file}")

    # 检查文件是否存在
    if not os.path.exists(input_file):
        print(f"错误: 输入文件不存在: {input_file}")
        return

    try:
        # 读取源 SRT 文件内容
        with open(input_file, "r", encoding="utf-8") as f:
            srt_content = f.read()

        print(f"原始 SRT 内容长度: {len(srt_content)} 字符")

        # 使用 SRTOptimizer 优化内容
        print("优化 SRT 内容...")
        optimized_srt, format_map = SRTOptimizer.optimize_srt_content(
            srt_content
        )
        print(f"优化后内容长度: {len(optimized_srt)} 字符")
        print(f"节省: {len(srt_content) - len(optimized_srt)} 字符")

        # 初始化 AI 服务
        print("初始化 AI 服务...")
        ai_config = AIServiceConfig(
            provider="openai",
            api_key=api_key,
            model="gpt-3.5-turbo",
        )
        ai_service = AIServiceFactory.create_service(ai_config)

        # 构建提示模板
        system_prompt = (
            f"你是一个专业的视频字幕翻译助手，精通{source_language}和{target_language}。"
            f"你的任务是将字幕从{source_language}翻译成流畅、自然的{target_language}。"
            "翻译时应当符合目标语言的表达习惯，保持原文的意思和风格。"
        )

        user_prompt = (
            f"请将以下字幕从{source_language}翻译成{target_language}，"
            "保持流畅自然的风格。请只翻译内容部分，保持原始格式。\n\n"
            f"需要翻译的字幕：\n{optimized_srt}"
        )

        # 调用 AI 服务进行翻译
        print("正在翻译...")
        response = await ai_service.chat_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # 假设返回的是翻译好的 SRT 内容
        translated_srt = response

        # 恢复格式
        print("恢复格式...")
        restored_srt = SRTOptimizer.restore_srt_format(
            translated_srt, format_map
        )

        # 写入结果文件
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(restored_srt)

        print(f"翻译完成，已保存到: {output_file}")

    except Exception as e:
        print(f"翻译过程中发生错误: {e}")


async def main():
    """主函数"""
    # 设置参数
    input_file = "example.srt"  # 替换为实际的输入文件路径
    output_file = "example.zh.srt"  # 替换为实际的输出文件路径
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key:
        print("错误: 未设置 OPENAI_API_KEY 环境变量")
        return

    # 测试用的示例 SRT 内容
    demo_srt = """1
00:00:01,000 --> 00:00:05,000
<font face="Arial" size="24">Welcome to <b>our</b> demo!</font>

2
00:00:05,500 --> 00:00:10,000
<i>This is a subtitle with formatting</i>

3
00:00:10,500 --> 00:00:15,000
<font color="yellow">Please translate this text while
preserving all the HTML tags</font>
"""

    # 如果没有测试文件，创建一个
    if not os.path.exists(input_file):
        with open(input_file, "w", encoding="utf-8") as f:
            f.write(demo_srt)
        print(f"已创建示例文件: {input_file}")

    # 执行翻译
    await translate_with_optimization(
        input_file=input_file,
        output_file=output_file,
        api_key=api_key,
        source_language="en",
        target_language="zh",
    )


if __name__ == "__main__":
    asyncio.run(main())
