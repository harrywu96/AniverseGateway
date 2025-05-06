"""服务集成模块

包含与外部服务和API的集成功能。"""

from backend.services.ai_service import AIService, AIServiceFactory
from backend.services.translator import SubtitleTranslator

__all__ = ["AIService", "AIServiceFactory", "SubtitleTranslator"]
