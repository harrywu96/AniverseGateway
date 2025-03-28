import re
import json


def srt_to_json(srt_text):
    """将SRT格式转换为自定义JSON格式"""
    srt_blocks = re.split(r"\\n\\s*\\n", srt_text.strip())
    subtitles = []

    for block in srt_blocks:
        lines = block.strip().split("\\n")
        if len(lines) < 3:
            continue

        subtitle_id = int(lines[0])
        time_line = lines[1]
        text_content = "\\n".join(lines[2:])

        # 提取纯文本内容，并用占位符替换
        template, text_parts = extract_text_and_template(text_content)

        subtitle = {
            "id": subtitle_id,
            "time": time_line,
            "template": template,
            "text": text_parts,
        }

        subtitles.append(subtitle)

    return {"version": 1, "subtitles": subtitles}


def extract_text_and_template(content):
    """从字幕内容中提取文本和模板"""
    text_parts = []

    # 递归提取文本内容，生成模板
    def process_content(content, tag_stack=None):
        if tag_stack is None:
            tag_stack = []

        # 正则表达式匹配标签和文本
        pattern = r"<([^>]+)>|([^<]+)"
        matches = re.finditer(pattern, content)

        result = ""
        for match in matches:
            tag, text = match.groups()

            if tag:  # 找到标签
                if tag.startswith("/"):  # 关闭标签
                    result += f"<{tag}>"
                else:  # 开放标签
                    result += f"<{tag}>"

            elif text:  # 找到文本内容
                # 检查文本是否包含特殊格式代码如 {\\an8}
                format_codes = re.findall(r"(\\{\\\\[^}]+\\})", text)

                for code in format_codes:
                    code_index = text.find(code)
                    if code_index > 0:
                        if text[:code_index].strip():
                            placeholder = f"{{{len(text_parts)}}}"
                            result += placeholder
                            text_parts.append(text[:code_index].strip())
                        result += code
                        text = text[code_index + len(code) :]

                if text.strip():
                    placeholder = f"{{{len(text_parts)}}}"
                    result += placeholder
                    text_parts.append(text.strip())

        return result

    template = process_content(content)
    return template, text_parts


def json_to_srt(json_data):
    """将自定义JSON格式转换回SRT格式"""
    srt_text = ""

    for subtitle in json_data["subtitles"]:
        # 重建字幕块
        srt_text += str(subtitle["id"]) + "\\n"
        srt_text += subtitle["time"] + "\\n"

        # 将文本部分放回模板
        content = subtitle["template"]
        for i, text_part in enumerate(subtitle["text"]):
            placeholder = f"{{{i}}}"
            content = content.replace(placeholder, text_part)

        srt_text += content + "\\n\\n"

    return srt_text.strip()


def translate_json_subtitles(json_data, translate_func):
    """翻译JSON格式中的字幕文本，保留模板格式"""
    translated = {"version": json_data["version"], "subtitles": []}

    for subtitle in json_data["subtitles"]:
        # 只翻译text部分
        translated_text = [translate_func(text) for text in subtitle["text"]]

        translated_subtitle = {
            "id": subtitle["id"],
            "time": subtitle["time"],
            "template": subtitle["template"],
            "text": translated_text,
        }

        translated["subtitles"].append(translated_subtitle)

    return translated


# 示例使用
if __name__ == "__main__":
    # 示例SRT内容
    srt_example = """298
00:17:27,290 --> 00:17:31,700
<font face="Trebuchet MS" size="24">And ever since, we've been obsessed with
the world of <i>A Tale of Perishing</i>, haven't we?</font>

299
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="20"><font face="Times New Roman"><font color="#8c918d">The Legendary Hero</font></font></font></b></font>

300
00:17:46,000 --> 00:17:49,500
<font face="Trebuchet MS" size="24"><b><font size="18">{\\an8}<font face="Times New Roman"><font color="#8c918d">Burdened
With Despair</font></font></font></b></font>"""

    # 转换为JSON
    json_data = srt_to_json(srt_example)
    print("转换为JSON:")
    print(json.dumps(json_data, indent=2, ensure_ascii=False))

    # 模拟翻译函数（实际项目中可替换为真实的翻译API调用）
    def simple_translator(text):
        # 这里只是示例，将英文转为中文
        translations = {
            "And ever since, we've been obsessed with ": "从那以后，我们一直痴迷于",
            "A Tale of Perishing": "《消亡的故事》",
            ", haven't we?": "，不是吗？",
            "The Legendary Hero": "传奇英雄",
            "Burdened\\nWith Despair": "背负\\n绝望",
        }
        return translations.get(text, text)

    # 翻译JSON中的字幕
    translated_json = translate_json_subtitles(json_data, simple_translator)
    print("\\n翻译后的JSON:")
    print(json.dumps(translated_json, indent=2, ensure_ascii=False))

    # 转换回SRT
    srt_result = json_to_srt(translated_json)
    print("\\n转换回SRT:")
    print(srt_result)
