#!/usr/bin/env python3
"""测试翻译验证器修复的脚本"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath('.'))

def test_translation_validator_import():
    """测试翻译验证器导入"""
    print("=== 测试翻译验证器导入 ===")
    
    try:
        # 测试从 backend.services.validators 导入
        from backend.services.validators import (
            TranslationValidator,
            ValidationLevel,
            ValidationResult,
        )
        print("✅ 从 backend.services.validators 导入成功")
        
        # 创建验证器实例
        validator = TranslationValidator(validation_level=ValidationLevel.BASIC)
        print("✅ 创建验证器实例成功")
        
        # 检查是否有 validate 方法
        if hasattr(validator, 'validate'):
            print("✅ 验证器有 validate 方法")
        else:
            print("❌ 验证器没有 validate 方法")
            return False
            
        # 测试 validate 方法
        result = validator.validate(
            source_text="Hello world",
            translated_text="你好世界",
            source_language="en",
            target_language="zh"
        )
        print(f"✅ validate 方法调用成功，结果: {result.is_valid}")
        
        return True
        
    except Exception as e:
        print(f"❌ 导入或测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_utils_validators_import():
    """测试 utils 中的验证器导入"""
    print("\n=== 测试 utils 验证器导入 ===")
    
    try:
        # 测试从 backend.utils.validators 导入
        from backend.utils.validators import (
            TranslationValidator as UtilsValidator,
            ValidationLevel,
            ValidationResult,
        )
        print("✅ 从 backend.utils.validators 导入成功")
        
        # 创建验证器实例
        validator = UtilsValidator(validation_level=ValidationLevel.BASIC)
        print("✅ 创建验证器实例成功")
        
        # 检查是否有 validate 方法
        if hasattr(validator, 'validate'):
            print("✅ utils 验证器有 validate 方法")
        else:
            print("❌ utils 验证器没有 validate 方法")
            
        # 检查是否有 validate_single_translation 方法
        if hasattr(validator, 'validate_single_translation'):
            print("✅ utils 验证器有 validate_single_translation 方法")
        else:
            print("❌ utils 验证器没有 validate_single_translation 方法")
        
        return True
        
    except Exception as e:
        print(f"❌ 导入或测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_translator_import():
    """测试翻译器导入"""
    print("\n=== 测试翻译器导入 ===")
    
    try:
        from backend.services.translator import SubtitleTranslator
        from backend.schemas.config import AIServiceConfig, AIProviderType, OpenAIConfig
        from pydantic import SecretStr
        
        print("✅ 翻译器导入成功")
        
        # 创建一个简单的AI服务配置
        ai_config = AIServiceConfig(
            provider=AIProviderType.OPENAI,
            openai=OpenAIConfig(
                api_key=SecretStr("test-key"),
                model="gpt-3.5-turbo"
            )
        )
        
        # 创建翻译器实例
        translator = SubtitleTranslator(ai_config)
        print("✅ 创建翻译器实例成功")
        
        # 检查验证器是否正确初始化
        if hasattr(translator, 'validator'):
            print("✅ 翻译器有验证器属性")
            if hasattr(translator.validator, 'validate'):
                print("✅ 翻译器的验证器有 validate 方法")
                return True
            else:
                print("❌ 翻译器的验证器没有 validate 方法")
                return False
        else:
            print("❌ 翻译器没有验证器属性")
            return False
        
    except Exception as e:
        print(f"❌ 翻译器测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主函数"""
    print("🧪 开始测试翻译验证器修复...")
    
    # 测试各种导入
    services_validator_ok = test_translation_validator_import()
    utils_validator_ok = test_utils_validators_import()
    translator_ok = test_translator_import()
    
    # 总结
    print("\n" + "="*50)
    print("📊 测试结果总结:")
    print(f"services 验证器: {'✅ 通过' if services_validator_ok else '❌ 失败'}")
    print(f"utils 验证器: {'✅ 通过' if utils_validator_ok else '❌ 失败'}")
    print(f"翻译器集成: {'✅ 通过' if translator_ok else '❌ 失败'}")
    
    if services_validator_ok and translator_ok:
        print("\n🎉 翻译验证器修复成功！")
        sys.exit(0)
    else:
        print("\n❌ 部分测试失败，需要进一步修复")
        sys.exit(1)

if __name__ == "__main__":
    main()
