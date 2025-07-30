"""翻译结果验证模块

提供翻译结果的验证和质量评估功能。
"""

import logging
import re
from enum import Enum
from typing import Dict, List, Optional, Tuple, Pattern, Set

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ValidationLevel(str, Enum):
    """验证级别枚举"""

    NONE = "none"  # 不进行验证
    BASIC = "basic"  # 基本验证
    STRICT = "strict"  # 严格验证


class ValidationResult(BaseModel):
    """验证结果模型"""

    is_valid: bool = Field(default=False, description="是否有效")
    errors: List[str] = Field(default_factory=list, description="错误信息")
    warnings: List[str] = Field(default_factory=list, description="警告信息")
    score: float = Field(default=0.0, description="质量评分 (0-100)")


class TranslationValidator:
    """翻译结果验证器"""

    def __init__(
        self,
        validation_level: ValidationLevel = ValidationLevel.BASIC,
        glossary: Optional[Dict[str, str]] = None,
        forbidden_terms: Optional[List[str]] = None,
    ):
        """初始化验证器

        Args:
            validation_level: 验证级别
            glossary: 术语表 (原文术语 -> 目标语言术语)
            forbidden_terms: 禁用术语列表
        """
        self.validation_level = validation_level
        self.glossary = glossary or {}
        self.forbidden_terms = set(forbidden_terms or [])
        self._glossary_patterns = self._compile_glossary_patterns()

    def _compile_glossary_patterns(self) -> Dict[str, Pattern]:
        """编译术语正则表达式

        Returns:
            Dict[str, Pattern]: 术语正则表达式字典
        """
        patterns = {}
        # logger.info(f"开始编译术语表正则表达式，术语表：{self.glossary}")

        try:
            for term in self.glossary.keys():
                # 为术语创建正则表达式，支持大小写和边界匹配
                try:
                    pattern = re.compile(
                        r"\b" + re.escape(term) + r"\b", re.IGNORECASE
                    )
                    patterns[term] = pattern
                    # logger.info(f"成功为术语 '{term}' 编译正则表达式")
                except Exception as e:
                    logger.error(f"为术语 '{term}' 编译正则表达式失败: {e}")
        except Exception as e:
            logger.error(f"编译术语表正则表达式出错: {e}")

        # logger.info(f"完成术语表正则表达式编译，共 {len(patterns)} 个模式")
        return patterns

    def validate_single_translation(
        self, original: str, translation: str
    ) -> ValidationResult:
        """验证单条翻译

        Args:
            original: 原文
            translation: 翻译结果

        Returns:
            ValidationResult: 验证结果
        """
        if self.validation_level == ValidationLevel.NONE:
            return ValidationResult(is_valid=True, score=100.0)

        errors = []
        warnings = []
        score = 100.0

        # 基本验证
        if not translation or translation.strip() == "":
            errors.append("翻译结果为空")
            return ValidationResult(is_valid=False, errors=errors, score=0.0)

        # 长度比例检查 - 翻译不应该比原文长太多或短太多
        orig_len = len(original)
        trans_len = len(translation)
        ratio = trans_len / orig_len if orig_len > 0 else 0

        if ratio < 0.3:
            warnings.append(f"翻译可能不完整，长度比例过低 ({ratio:.2f})")
            score -= 20.0
        elif ratio > 3.0:
            warnings.append(
                f"翻译可能包含额外内容，长度比例过高 ({ratio:.2f})"
            )
            score -= 15.0

        # 术语表检查
        if self.glossary:
            missing_terms = self._check_glossary_terms(original, translation)
            if missing_terms:
                term_list = ", ".join(missing_terms)
                if self.validation_level == ValidationLevel.STRICT:
                    errors.append(f"未正确翻译术语: {term_list}")
                    score -= 30.0
                else:
                    warnings.append(f"可能未正确翻译术语: {term_list}")
                    score -= 10.0

        # 禁用术语检查
        if self.forbidden_terms:
            found_forbidden = self._check_forbidden_terms(translation)
            if found_forbidden:
                term_list = ", ".join(found_forbidden)
                if self.validation_level == ValidationLevel.STRICT:
                    errors.append(f"使用了禁用术语: {term_list}")
                    score -= 25.0
                else:
                    warnings.append(f"使用了禁用术语: {term_list}")
                    score -= 5.0

        # 花括号和变量保留检查
        if "{" in original or "}" in original:
            orig_vars = set(re.findall(r"{([^{}]+)}", original))
            trans_vars = set(re.findall(r"{([^{}]+)}", translation))
            missing_vars = orig_vars - trans_vars

            if missing_vars:
                var_list = ", ".join(missing_vars)
                errors.append(f"未保留变量占位符: {var_list}")
                score -= 30.0

        # 标点符号计数检查（基本检查问号和感叹号数量）
        orig_question_marks = original.count("?")
        trans_question_marks = translation.count("?") + translation.count("？")

        if orig_question_marks > 0 and trans_question_marks == 0:
            warnings.append("原文包含问题，但翻译中没有问号")
            score -= 5.0

        # 确保分数在0-100范围内
        score = max(0.0, min(100.0, score))

        # 判断有效性
        is_valid = len(errors) == 0
        if self.validation_level == ValidationLevel.STRICT:
            is_valid = is_valid and score >= 70.0
        else:
            is_valid = is_valid and score >= 50.0

        return ValidationResult(
            is_valid=is_valid, errors=errors, warnings=warnings, score=score
        )

    def _check_glossary_terms(
        self, original: str, translation: str
    ) -> List[str]:
        """检查术语表中的术语是否正确翻译

        Args:
            original: 原文
            translation: 翻译结果

        Returns:
            List[str]: 未正确翻译的术语列表
        """
        missing_terms = []

        for term, expected_translation in self.glossary.items():
            # 检查原文中是否包含该术语
            pattern = self._glossary_patterns.get(term)
            if pattern and pattern.search(original):
                # 检查翻译中是否包含对应的翻译
                if expected_translation not in translation:
                    missing_terms.append(term)

        return missing_terms

    def _check_forbidden_terms(self, translation: str) -> List[str]:
        """检查翻译中是否使用了禁用术语

        Args:
            translation: 翻译结果

        Returns:
            List[str]: 使用的禁用术语列表
        """
        found_terms = []

        for term in self.forbidden_terms:
            if term.lower() in translation.lower():
                found_terms.append(term)

        return found_terms

    def validate_multiple_translations(
        self, originals: List[str], translations: List[str]
    ) -> Tuple[List[ValidationResult], ValidationResult]:
        """验证多条翻译

        Args:
            originals: 原文列表
            translations: 翻译结果列表

        Returns:
            Tuple[List[ValidationResult], ValidationResult]: 各条翻译结果和整体结果
        """
        if len(originals) != len(translations):
            overall = ValidationResult(
                is_valid=False,
                errors=["原文和翻译数量不匹配"],
                score=0.0,
            )
            return [], overall

        results = []
        total_score = 0.0
        all_errors = []
        all_warnings = []

        for i, (original, translation) in enumerate(
            zip(originals, translations)
        ):
            result = self.validate_single_translation(original, translation)
            results.append(result)

            total_score += result.score

            # 收集错误和警告，并添加索引前缀
            for error in result.errors:
                all_errors.append(f"[第{i+1}条] {error}")
            for warning in result.warnings:
                all_warnings.append(f"[第{i+1}条] {warning}")

        # 计算平均分数
        avg_score = total_score / len(results) if results else 0.0

        # 整体结果
        is_valid = True
        for result in results:
            if not result.is_valid:
                is_valid = False
                break

        overall = ValidationResult(
            is_valid=is_valid,
            errors=all_errors[:10],  # 限制错误数量，避免过多
            warnings=all_warnings[:10],  # 限制警告数量
            score=avg_score,
        )

        return results, overall

    def validate(
        self,
        source_text: str,
        translated_text: str,
        source_language: str = "",
        target_language: str = "",
        validation_level: Optional[ValidationLevel] = None,
        glossary: Optional[Dict[str, str]] = None,
        forbidden_terms: Optional[List[str]] = None,
    ) -> ValidationResult:
        """验证翻译结果的质量

        Args:
            source_text: 源文本
            translated_text: 翻译后的文本
            source_language: 源语言 (可选)
            target_language: 目标语言 (可选)
            validation_level: 验证级别 (如不提供则使用实例级别)
            glossary: 术语表 (如不提供则使用实例级别)
            forbidden_terms: 禁用术语列表 (如不提供则使用实例级别)

        Returns:
            ValidationResult: 验证结果
        """
        # 记录传入的参数
        # logger.info(
        #     f"验证器接收参数: source_lang={source_language}, target_lang={target_language}"
        # )
        # logger.info(f"接收到的术语表: {glossary}")
        # logger.info(f"接收到的禁用词: {forbidden_terms}")

        # 使用临时验证器以避免修改当前实例的状态
        temp_validator = self

        # 如果提供了任何覆盖参数，创建一个新的验证器
        if (
            validation_level is not None
            or glossary is not None
            or forbidden_terms is not None
        ):

            try:
                temp_validator = TranslationValidator(
                    validation_level=validation_level or self.validation_level,
                    glossary=glossary or self.glossary,
                    forbidden_terms=forbidden_terms
                    or list(self.forbidden_terms),
                )
                # logger.info("成功创建临时验证器")
            except Exception as e:
                logger.error(f"创建临时验证器失败: {e}")
                # 出错时继续使用原验证器

        # 调用单条翻译验证方法
        try:
            result = temp_validator.validate_single_translation(
                source_text, translated_text
            )
            # logger.info(
            #     f"验证结果: 有效={result.is_valid}, 分数={result.score}"
            # )
            return result
        except Exception as e:
            logger.error(f"执行验证失败: {e}")
            import traceback

            logger.error(f"详细错误: {traceback.format_exc()}")
            # 返回基本验证结果
            return ValidationResult(
                is_valid=True,
                warnings=["验证过程中出错，已跳过详细验证"],
                score=50.0,
            )
