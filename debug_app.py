"""最小可复现环境 - 调试视频字幕翻译接口问题"""

import logging
import uuid
from typing import Optional, Dict, Any
from enum import Enum

from fastapi import FastAPI, APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# 复制基础的Pydantic模型
class TranslationStyle(str, Enum):
    """翻译风格枚举"""

    NATURAL = "natural"
    LITERAL = "literal"
    CREATIVE = "creative"


class APIResponse(BaseModel):
    """API响应基础模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="操作成功", description="响应消息")
    data: Optional[Dict[str, Any]] = Field(
        default=None, description="响应数据"
    )


# 复制视频字幕翻译请求模型
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


# 复制响应模型
class VideoSubtitleTranslateResponse(APIResponse):
    """视频字幕翻译响应模型"""

    pass


# 创建虚拟的系统配置
class MockSystemConfig:
    """虚拟系统配置"""

    def __init__(self):
        self.temp_dir = "./temp"


# 创建虚拟的视频存储服务
class MockVideoStorageService:
    """虚拟视频存储服务"""

    def get_video(self, video_id: str):
        # 返回虚拟视频信息
        if video_id == "test-video-id":
            return type(
                "VideoInfo",
                (),
                {"subtitle_tracks": [{"index": 0, "language": "zh"}]},
            )()
        return None


# 创建虚拟的字幕翻译器
class MockSubtitleTranslator:
    """虚拟字幕翻译器"""

    def __init__(self, config):
        self.config = config


# 虚拟依赖项函数
def get_mock_system_config() -> MockSystemConfig:
    """获取虚拟系统配置"""
    return MockSystemConfig()


def get_mock_video_storage() -> MockVideoStorageService:
    """获取虚拟视频存储服务"""
    return MockVideoStorageService()


def get_mock_subtitle_translator(
    config: MockSystemConfig = Depends(get_mock_system_config),
) -> MockSubtitleTranslator:
    """获取虚拟字幕翻译器"""
    return MockSubtitleTranslator(config)


# 创建路由器
router = APIRouter()


@router.post(
    "/video-subtitle",
    response_model=VideoSubtitleTranslateResponse,
    tags=["视频字幕翻译"],
)
async def translate_video_subtitle(
    request: VideoSubtitleTranslateRequest,
    background_tasks: BackgroundTasks,
    config: MockSystemConfig = Depends(get_mock_system_config),
    video_storage: MockVideoStorageService = Depends(get_mock_video_storage),
    translator: MockSubtitleTranslator = Depends(get_mock_subtitle_translator),
):
    """翻译视频字幕轨道 - 调试版本"""
    try:
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

        logger.info(
            f"调试：开始翻译视频字幕，视频ID: {request.video_id}, 轨道索引: {request.track_index}"
        )

        # 返回任务信息
        return VideoSubtitleTranslateResponse(
            success=True,
            message="视频字幕翻译任务已提交（调试版本）",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style.value,
            },
        )

    except Exception as e:
        logger.error(f"调试：提交视频字幕翻译任务失败: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"提交翻译任务失败: {str(e)}"
        )


# 创建简化版本（无依赖项）
@router.post(
    "/video-subtitle-simple",
    response_model=VideoSubtitleTranslateResponse,
    tags=["视频字幕翻译"],
)
async def translate_video_subtitle_simple(
    request: VideoSubtitleTranslateRequest,
):
    """翻译视频字幕轨道 - 简化版本（无依赖项）"""
    try:
        # 生成任务ID
        task_id = str(uuid.uuid4())

        logger.info(
            f"调试简化版：开始翻译视频字幕，视频ID: {request.video_id}, 轨道索引: {request.track_index}"
        )

        # 返回任务信息
        return VideoSubtitleTranslateResponse(
            success=True,
            message="视频字幕翻译任务已提交（简化版本）",
            data={
                "task_id": task_id,
                "video_id": request.video_id,
                "track_index": request.track_index,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "style": request.style.value,
            },
        )

    except Exception as e:
        logger.error(
            f"调试简化版：提交视频字幕翻译任务失败: {e}", exc_info=True
        )
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500, detail=f"提交翻译任务失败: {str(e)}"
        )


# 创建应用
app = FastAPI(
    title="Debug AniVerse Gateway API",
    description="调试视频字幕翻译接口问题",
    version="0.1.0-debug",
)

# 注册路由
app.include_router(router, prefix="/api/translate")

if __name__ == "__main__":
    import uvicorn

    print("启动调试服务器...")
    print("测试URL:")
    print(
        "- 完整版本: POST http://localhost:8001/api/translate/video-subtitle"
    )
    print(
        "- 简化版本: POST http://localhost:8001/api/translate/video-subtitle-simple"
    )
    uvicorn.run(app, host="0.0.0.0", port=8001)
