"""服务集成模块

包含与外部服务和API的集成功能。"""

from .ai_service import AIService, AIServiceFactory
from .translator import SubtitleTranslator

__all__ = ["AIService", "AIServiceFactory", "SubtitleTranslator"]
