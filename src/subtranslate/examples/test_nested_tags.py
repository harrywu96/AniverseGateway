"""嵌套标签处理测试

专门测试SRTOptimizer处理复杂嵌套标签的功能
"""

import sys
from pathlib import Path

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from subtranslate.services.utils import SRTOptimizer


def main():
    """测试复杂嵌套标签处理"""
    # 复杂嵌套标签示例
    complex_tags = """306
00:18:34,170 --> 00:18:36,050
<font face="Trebuchet MS" size="24"><i>This </i>whole<i> time...</i></font>
"""

    print("原始内容:")
    print("-" * 50)
    print(complex_tags)
    print("-" * 50)

    # 提取令牌
    _, start_time, end_time, text = SRTOptimizer.parse_srt_entry(complex_tags)
    tokens = SRTOptimizer.tokenize_html(text)

    print("令牌列表:")
    for i, (token_type, content) in enumerate(tokens):
        content_display = content.replace("\n", "\\n")
        if len(content_display) > 50:
            content_display = content_display[:47] + "..."
        print(f"{i+1}. [{token_type}] {content_display}")

    # 提取纯文本
    clean_text = "".join(
        content for token_type, content in tokens if token_type == "text"
    )
    print("\n提取的纯文本:")
    print(repr(clean_text))

    # 模拟翻译
    translated_text = clean_text.replace(
        "The Legendary Hero", "[翻译] The Legendary Hero"
    )
    print("\n翻译后的文本:")
    print(repr(translated_text))

    # 手动构建开闭标签列表
    opening_tags = []
    closing_tags = []

    for token_type, content in tokens:
        if token_type == "tag":
            if content.startswith("</"):
                closing_tags.append(content)
            else:
                opening_tags.append(content)

    print("\n开标签:")
    for tag in opening_tags:
        print(f"- {tag}")

    print("\n闭标签:")
    for tag in closing_tags:
        print(f"- {tag}")

    # 手动构造结果
    result = []
    for tag in opening_tags:
        result.append(tag)

    result.append(translated_text)

    for tag in closing_tags:
        result.append(tag)

    manual_result = "".join(result)

    print("\n手动构造结果:")
    print("-" * 50)
    print(manual_result)
    print("-" * 50)

    # 使用apply_translation_to_tokens
    auto_result = SRTOptimizer.apply_translation_to_tokens(
        tokens, translated_text
    )

    print("\n自动处理结果:")
    print("-" * 50)
    print(auto_result)
    print("-" * 50)


if __name__ == "__main__":
    main()
