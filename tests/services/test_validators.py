"""测试翻译结果验证器"""

import pytest

from subtranslate.services.validators import (
    TranslationValidator,
    ValidationLevel,
    ValidationResult,
)


class TestTranslationValidator:
    """测试翻译验证器类"""

    def test_basic_validation(self):
        """测试基本验证功能"""
        validator = TranslationValidator(validation_level=ValidationLevel.BASIC)

        # 空翻译
        result = validator.validate_single_translation("Hello world", "")
        assert not result.is_valid
        assert "翻译结果为空" in result.errors[0]
        assert result.score == 0.0

        # 有效翻译
        result = validator.validate_single_translation("Hello world", "你好世界")
        assert result.is_valid
        assert not result.errors
        assert result.score > 90.0

        # 翻译过短
        result = validator.validate_single_translation(
            "This is a very long sentence that should be properly translated.", "短句"
        )
        assert result.is_valid  # BASIC级别下警告不影响有效性
        assert "长度比例过低" in result.warnings[0]
        assert result.score < 90.0

        # 翻译过长
        result = validator.validate_single_translation(
            "Hi", "你好，这是一个非常长的翻译，原文只有很短的问候语，但是翻译却非常冗长"
        )
        assert result.is_valid  # BASIC级别下警告不影响有效性
        assert "长度比例过高" in result.warnings[0]
        assert result.score < 90.0

    def test_strict_validation(self):
        """测试严格验证功能"""
        validator = TranslationValidator(validation_level=ValidationLevel.STRICT)

        # 合格的翻译
        result = validator.validate_single_translation("Hello world", "你好世界")
        assert result.is_valid
        assert result.score > 90.0

        # 长度比例不合适
        result = validator.validate_single_translation(
            "Hello", "你好你好你好你好你好你好你好你好你好你好你好你好你好你好"
        )
        assert not result.is_valid  # STRICT级别下，分数低会影响有效性
        assert result.score < 70.0

    def test_no_validation(self):
        """测试无验证模式"""
        validator = TranslationValidator(validation_level=ValidationLevel.NONE)

        # 空翻译在无验证模式下也视为有效
        result = validator.validate_single_translation("Hello world", "")
        assert result.is_valid
        assert result.score == 100.0

    def test_glossary_validation(self):
        """测试术语表验证"""
        glossary = {
            "AI": "人工智能",
            "Machine Learning": "机器学习",
            "Python": "Python",  # 保持不变的术语
        }

        validator = TranslationValidator(
            validation_level=ValidationLevel.BASIC,
            glossary=glossary,
        )

        # 正确使用了术语
        result = validator.validate_single_translation(
            "AI and Machine Learning in Python", "Python中的人工智能和机器学习"
        )
        assert result.is_valid
        assert not result.warnings
        assert result.score > 90.0

        # 未正确翻译术语
        result = validator.validate_single_translation(
            "AI and Machine Learning in Python", "Python中的AI和机器学习"  # AI未翻译
        )
        assert result.is_valid  # BASIC级别下只是警告
        assert "可能未正确翻译术语" in result.warnings[0]
        assert "AI" in result.warnings[0]
        assert result.score < 90.0

        # 严格模式下
        validator_strict = TranslationValidator(
            validation_level=ValidationLevel.STRICT,
            glossary=glossary,
        )

        result = validator_strict.validate_single_translation(
            "AI and Machine Learning in Python", "Python中的AI和机器学习"  # AI未翻译
        )
        assert not result.is_valid  # STRICT级别下是错误
        assert "未正确翻译术语" in result.errors[0]
        assert result.score < 70.0

    def test_forbidden_terms(self):
        """测试禁用术语验证"""
        forbidden_terms = ["机械", "人造", "电子"]

        validator = TranslationValidator(
            validation_level=ValidationLevel.BASIC,
            forbidden_terms=forbidden_terms,
        )

        # 不包含禁用术语
        result = validator.validate_single_translation(
            "Artificial Intelligence", "人工智能"
        )
        assert result.is_valid
        assert not result.warnings

        # 包含禁用术语
        result = validator.validate_single_translation(
            "Artificial Intelligence", "人造智能"  # 使用了禁用词"人造"
        )
        assert result.is_valid  # BASIC级别下只是警告
        assert "使用了禁用术语" in result.warnings[0]

        # 严格模式下
        validator_strict = TranslationValidator(
            validation_level=ValidationLevel.STRICT,
            forbidden_terms=forbidden_terms,
        )

        result = validator_strict.validate_single_translation(
            "Artificial Intelligence", "人造智能"  # 使用了禁用词"人造"
        )
        assert not result.is_valid  # STRICT级别下是错误
        assert "使用了禁用术语" in result.errors[0]

    def test_variable_preservation(self):
        """测试变量占位符保留验证"""
        validator = TranslationValidator()

        # 正确保留了变量
        result = validator.validate_single_translation(
            "Hello {name}, welcome to {place}!", "你好{name}，欢迎来到{place}！"
        )
        assert result.is_valid
        assert not result.errors

        # 丢失了变量
        result = validator.validate_single_translation(
            "Hello {name}, welcome to {place}!", "你好，欢迎光临！"  # 丢失了所有变量
        )
        assert not result.is_valid
        assert "未保留变量占位符" in result.errors[0]
        assert "name" in result.errors[0]
        assert "place" in result.errors[0]

        # 丢失部分变量
        result = validator.validate_single_translation(
            "Hello {name}, welcome to {place}!",
            "你好{name}，欢迎光临！",  # 只丢失了place变量
        )
        assert not result.is_valid
        assert "未保留变量占位符" in result.errors[0]
        assert "place" in result.errors[0]
        assert "name" not in result.errors[0]

    def test_multiple_translations(self):
        """测试多条翻译验证"""
        validator = TranslationValidator()

        originals = [
            "Hello world",
            "How are you?",
            "Welcome to Python programming",
        ]

        # 全部有效的翻译
        translations = [
            "你好世界",
            "你好吗？",
            "欢迎学习Python编程",
        ]

        results, overall = validator.validate_multiple_translations(
            originals, translations
        )

        assert len(results) == 3
        assert all(r.is_valid for r in results)
        assert overall.is_valid
        assert overall.score > 90.0

        # 包含无效翻译
        translations = [
            "你好世界",
            "",  # 空翻译，无效
            "欢迎学习Python编程",
        ]

        results, overall = validator.validate_multiple_translations(
            originals, translations
        )

        assert len(results) == 3
        assert not results[1].is_valid  # 第二条翻译无效
        assert not overall.is_valid  # 整体结果无效
        assert "[第2条]" in overall.errors[0]  # 错误信息包含索引前缀

        # 数量不匹配
        translations = ["你好世界", "你好吗？"]  # 少了一条

        results, overall = validator.validate_multiple_translations(
            originals, translations
        )

        assert len(results) == 0
        assert not overall.is_valid
        assert "原文和翻译数量不匹配" in overall.errors[0]
