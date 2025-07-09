"""修复版翻译API路由模块

这个模块修复了原始translate.py中的422错误问题。
主要修复：
1. 移除有问题的依赖项注入
2. 使用直接实例化的方式获取服务
3. 保持与原始接口的完全兼容性
"""

import logging
import os
import uuid
from typing import Optional, Dict, List, Any

from fastapi import (
    APIRouter,
    HTTPException,
    BackgroundTasks,
)
from pydantic import BaseModel, Field

from backend.schemas.api import APIResponse, ProgressUpdateEvent
from backend.schemas.task import (
    TranslationConfig,
    TranslationStyle,
    SubtitleTask,
)
from backend.schemas.config import SystemConfig, AIProviderType
from backend.core.subtitle_translator import SubtitleTranslator
from backend.services.utils import SRTOptimizer
from backend.services.video_storage import VideoStorageService

# 配置日志
logger = logging.getLogger("subtranslate.api.translate_fixed")

# 创建路由器
router = APIRouter()

# 复用原始的请求和响应模型
class VideoSubtitleTranslateRequest(BaseModel):
    """视频字幕翻译请求模型"""
    
    video_id: str = Field(..., description="视频ID")
    track_index: int = Field(..., description="字幕轨道索引")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    style: TranslationStyle = Field(
        default=TranslationStyle.NATURAL, description="翻译风格"
    )
    # 提供商配置信息
    provider_config: Dict[str, Any] = Field(..., description="提供商配置信息")
    model_id: str = Field(..., description="模型ID")
    # 翻译参数
    chunk_size: int = Field(default=30, description="字幕分块大小（单位：条）")
    context_window: int = Field(
        default=3, description="上下文窗口大小（单位：条）"
    )
    context_preservation: bool = Field(
        default=True, description="保持上下文一致性"
    )
    preserve_formatting: bool = Field(default=True, description="保留原格式")

class VideoSubtitleTranslateResponse(APIResponse):
    """视频字幕翻译响应模型"""
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "字幕翻译任务已提交",
                "data": {
                    "task_id": "uuid-string",
                    "video_id": "video-id",
                    "track_index": 0,
                    "source_language": "en",
                    "target_language": "zh",
                    "style": "natural",
                },
            }
        }

# 修复版的服务获取函数（不使用依赖注入）
def get_fixed_system_config() -> SystemConfig:
    """获取系统配置（修复版）"""
    try:
        return SystemConfig.from_env()
    except Exception as e:
        logger.error(f"加载系统配置失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"加载系统配置失败: {str(e)}"
        )

def get_fixed_video_storage() -> VideoStorageService:
    """获取视频存储服务（修复版）"""
    try:
        config = get_fixed_system_config()
        return VideoStorageService(config.temp_dir)
    except Exception as e:
        logger.error(f"创建视频存储服务失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"创建视频存储服务失败: {str(e)}"
        )

def get_fixed_subtitle_translator() -> SubtitleTranslator:
    """获取字幕翻译器（修复版）"""
    try:
        config = get_fixed_system_config()
        return SubtitleTranslator(config)
    except Exception as e:
        logger.error(f"创建字幕翻译器失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"创建字幕翻译器失败: {str(e)}"
        )

# 辅助函数：配置AI服务
async def _configure_ai_service_from_provider_config_fixed(
    config: SystemConfig,
    provider_config: Dict[str, Any],
    model_id: str,
):
    """根据提供商配置设置AI服务（修复版）"""
    try:
        # 根据提供商类型设置配置
        provider_type = provider_config.get("type", "openai")
        
        if provider_type == "openai":
            config.ai_service.provider = AIProviderType.OPENAI
            if "api_key" in provider_config:
                config.ai_service.openai.api_key = provider_config["api_key"]
            if "base_url" in provider_config:
                config.ai_service.openai.base_url = provider_config["base_url"]
            config.ai_service.openai.model = model_id
            
        elif provider_type == "custom":
            config.ai_service.provider = AIProviderType.OPENAI  # 使用OpenAI兼容接口
            if "api_key" in provider_config:
                config.ai_service.openai.api_key = provider_config["api_key"]
            if "base_url" in provider_config:
                config.ai_service.openai.base_url = provider_config["base_url"]
            config.ai_service.openai.model = model_id
            
        elif provider_type == "ollama":
            config.ai_service.provider = AIProviderType.OLLAMA
            if "base_url" in provider_config:
                config.ai_service.ollama.base_url = provider_config["base_url"]
            config.ai_service.ollama.model = model_id
            
        else:
            raise ValueError(f"不支持的提供商类型: {provider_type}")
            
        logger.info(f"AI服务配置完成（修复版）: {provider_type}, 模型: {model_id}")
        
    except Exception as e:
        logger.error(f"配置AI服务失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=400, 
            detail=f"配置AI服务失败: {str(e)}"
        )

@router.post(
    "/video-subtitle-fixed-v2",
    response_model=VideoSubtitleTranslateResponse,
    tags=["视频字幕翻译修复版"],
)
async def translate_video_subtitle_fixed(
    request: VideoSubtitleTranslateRequest,
    background_tasks: BackgroundTasks,
):
    """翻译视频字幕轨道（修复版）
    
    这是原始video-subtitle-fixed接口的修复版本，解决了422错误问题。
    修复方法：移除依赖注入，使用直接实例化。
    
    Args:
        request: 视频字幕翻译请求
        background_tasks: FastAPI后台任务
        
    Returns:
        VideoSubtitleTranslateResponse: 翻译响应
    """
    try:
        # 记录请求信息
        logger.info(f"收到视频字幕翻译请求（修复版）: video_id={request.video_id}, track_index={request.track_index}")
        
        # 获取服务实例（不使用依赖注入）
        config = get_fixed_system_config()
        video_storage = get_fixed_video_storage()
        translator = get_fixed_subtitle_translator()
        
        # 验证视频是否存在
        video_info = video_storage.get_video(request.video_id)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")

        # 验证字幕轨道是否存在
        if (
            not video_info.subtitle_tracks
            or len(video_info.subtitle_tracks) <= request.track_index
        ):
            raise HTTPException(status_code=404, detail="字幕轨道不存在")

        # 生成任务ID
        task_id = str(uuid.uuid4())

        # 创建临时目录
        temp_dir = config.temp_dir
        os.makedirs(temp_dir, exist_ok=True)

        logger.info(
            f"开始翻译视频字幕（修复版），视频ID: {request.video_id}, 轨道索引: {request.track_index}, 任务ID: {task_id}"
        )

        # 定义进度回调函数
        async def callback(progress: float, status: str, message: str):
            """进度回调函数"""
            try:
                logger.info(f"任务 {task_id} 进度: {progress}%, 状态: {status}, 消息: {message}")
            except Exception as e:
                logger.error(f"进度回调失败: {e}")

        # 后台翻译任务
        async def process_video_subtitle_translation():
            """处理视频字幕翻译的后台任务"""
            try:
                # 获取字幕轨道
                subtitle_track = video_info.subtitle_tracks[request.track_index]
                subtitle_path = subtitle_track.file_path

                if not subtitle_path or not os.path.exists(str(subtitle_path)):
                    raise Exception("提取字幕内容失败")

                # 创建翻译任务
                task = SubtitleTranslator.create_task(
                    video_id=task_id,
                    source_path=str(subtitle_path),
                    source_language=request.source_language,
                    target_language=request.target_language,
                    style=request.style,
                    preserve_formatting=request.preserve_formatting,
                    context_preservation=request.context_preservation,
                    chunk_size=request.chunk_size,
                    context_window=request.context_window,
                )

                # 使用提供商配置创建临时AI服务配置
                original_provider = config.ai_service.provider

                try:
                    # 根据提供商配置设置AI服务
                    await _configure_ai_service_from_provider_config_fixed(
                        config,
                        request.provider_config,
                        request.model_id,
                    )

                    # 执行翻译任务
                    success = await translator.translate_task(task, callback)

                    if success:
                        await callback(100.0, "completed", "翻译完成")
                    else:
                        await callback(
                            task.progress,
                            "failed",
                            task.error_message or "翻译失败",
                        )

                finally:
                    # 恢复原始提供商配置
                    config.ai_service.provider = original_provider

            except Exception as e:
                logger.error(
                    f"视频字幕翻译任务 {task_id} 异常: {e}", exc_info=True
                )
                await callback(0.0, "failed", f"任务失败: {str(e)}")

        # 添加到后台任务
        background_tasks.add_task(process_video_subtitle_translation)

        # 返回任务信息
        return VideoSubtitleTranslateResponse(
            success=True,
            message="字幕翻译任务已提交（修复版）",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style.value,
                "version": "fixed",
            },
        )

    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"提交视频字幕翻译任务失败（修复版）: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"提交翻译任务失败: {str(e)}"
        )

# 健康检查端点
@router.get("/health-fixed", response_model=APIResponse, tags=["健康检查修复版"])
async def health_check_fixed():
    """健康检查端点（修复版）"""
    return APIResponse(
        success=True,
        message="翻译服务修复版健康状态正常",
        data={"status": "healthy", "version": "fixed"},
    )
