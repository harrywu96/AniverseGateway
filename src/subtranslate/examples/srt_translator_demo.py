"""SRT翻译器演示

展示如何使用SRTTranslator类进行字幕翻译，同时节省token消耗
"""

import sys
import json
from pathlib import Path

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from subtranslate.services.srt_translator import SRTTranslator


def main():
    """运行SRT翻译器演示"""
    print("SRT翻译器演示 - 高效字幕翻译")
    print("=" * 50)

    # 示例SRT内容
    srt_sample = """287
00:16:31,580 --> 00:16:33,210
<font face="Trebuchet MS" size="24">He's having fun.</font>

288
00:16:33,210 --> 00:16:35,490
<font face="Trebuchet MS" size="24">And he just seems so happy.</font>

289
00:16:35,970 --> 00:16:39,010
<font face="Trebuchet MS" size="24">I've never seen Luke like that.</font>

290
00:16:40,390 --> 00:16:44,280
<font face="Trebuchet MS" size="24">Your drawings are what's saving Luke.</font>"""

    # 定义翻译函数（实际项目中可替换为API调用）
    def mock_translator(text: str) -> str:
        """模拟翻译函数"""
        # 清理输入文本，去除前后空白
        text = text.strip()

        translations = {
            "He's having fun.": "他玩得很开心。",
            "And he just seems so happy.": "他看起来很开心。",
            "I've never seen Luke like that.": "我从没见过卢克那样。",
            "Your drawings are what's saving Luke.": "你的画是卢克活下去的原因。",
        }

        # 处理特殊情况：包含格式控制标记的文本
        if "{\\" in text:
            # 分离格式标记和实际内容
            format_parts = []
            content_parts = []

            # 简单拆分文本
            lines = text.split("\n")
            for line in lines:
                if line.strip().startswith("{\\"):
                    format_parts.append(line.strip())
                else:
                    content_parts.append(line.strip())

            # 如果有实际内容，翻译内容部分
            if content_parts:
                content_text = "\n".join(content_parts)
                translated_content = translations.get(
                    content_text, f"[翻译] {content_text}"
                )

                # 合并回格式标记
                result = []
                for part in format_parts:
                    result.append(part)
                result.append(translated_content)

                return "\n".join(result)

        # 常规翻译查找
        return translations.get(text, f"[翻译] {text}")

    # 创建SRT翻译器实例
    translator = SRTTranslator(debug=True)
    translator.set_translator(mock_translator)

    # 1. 显示原始SRT内容
    print("\n1. 原始SRT内容:")
    print("-" * 50)
    print(srt_sample)
    print("-" * 50)

    # 2. 翻译SRT内容
    print("\n2. 开始翻译...")
    translated_srt, details = translator.translate_srt(srt_sample)

    # 3. 显示翻译结果
    print("\n3. 翻译结果:")
    print("-" * 50)
    print(translated_srt)
    print("-" * 50)

    # 4. 显示翻译详情
    print("\n4. 翻译详情:")
    print("-" * 50)
    print(f"原始内容Token数: {details['original_tokens']}")
    print(f"优化后Token数: {details['optimized_tokens']}")
    print(f"翻译数据Token数: {details['translation_tokens']}")
    print(f"节省Token数: {details['token_savings']}")
    print(f"节省百分比: {details['savings_percent']:.2f}%")
    print("-" * 50)

    # 5. 显示翻译过程中的数据结构
    print("\n5. 翻译数据结构:")
    print("5.1 用于翻译的数据:")
    print("-" * 50)
    print(
        json.dumps(details["translation_data"], indent=2, ensure_ascii=False)
    )
    print("-" * 50)

    print("\n5.2 翻译后的数据:")
    print("-" * 50)
    print(json.dumps(details["translated_data"], indent=2, ensure_ascii=False))
    print("-" * 50)

    # 6. 实用提示
    print("\n6. 实用提示:")
    print("-" * 50)
    print("1. 使用SRTTranslator可大幅节省翻译API的token消耗")
    print("2. 翻译函数可以是任何文本翻译实现，如GPT API、DeepL等")
    print("3. 通过translate_srt_file方法可直接处理文件")
    print("4. 可以通过调整优化策略进一步减少token使用")
    print("-" * 50)


if __name__ == "__main__":
    main()
