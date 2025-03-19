# Schema 驱动开发指南 - SubTranslate 项目

本文档详细介绍了在 SubTranslate 项目中采用的 Schema 驱动开发方法，包括原则、实践和具体示例。所有开发人员都应遵循这些指南，确保系统的一致性和可维护性。

## 什么是 Schema 驱动开发

Schema 驱动开发是一种"契约先行"的开发方法，通过优先定义数据结构和接口规范，在实现具体功能之前先建立系统的"骨架"。在 Python 中，我们使用 Pydantic 实现这一方法，通过强类型定义和自动验证确保数据完整性。

## 核心原则

1. **数据模型优先**：首先定义系统中所有数据实体的结构和关系
2. **接口契约明确**：API 和函数签名应通过 Schema 精确定义输入和输出
3. **验证自动化**：利用 Pydantic 自动验证而非手写验证代码
4. **类型安全**：使用完整的类型注解，启用静态类型检查
5. **文档集成**：Schema 应包含完善的文档注释，作为自动生成文档的基础

## 项目实施步骤

### 1. 核心模型定义

所有核心数据模型都应在 `src/subtranslate/schemas/` 目录下定义：

```python
# src/subtranslate/schemas/video.py
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List


class ProcessingStatus(str, Enum):
    """视频处理状态枚举"""
    PENDING = "pending"
    EXTRACTING = "extracting"
    TRANSLATING = "translating"
    MERGING = "merging"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoFormat(str, Enum):
    """支持的视频格式枚举"""
    MP4 = "mp4"
    MKV = "mkv"
    AVI = "avi"
    WEBM = "webm"
    OTHER = "other"


class VideoInfo(BaseModel):
    """视频信息模型"""
    id: str = Field(..., description="视频唯一标识符")
    filename: str = Field(..., description="视频文件名")
    path: str = Field(..., description="视频文件路径")
    duration: Optional[float] = Field(None, description="视频时长（秒）")
    has_embedded_subtitle: bool = Field(False, description="是否包含内嵌字幕")
    format: VideoFormat = Field(..., description="视频格式")
    status: ProcessingStatus = Field(default=ProcessingStatus.PENDING, description="处理状态")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "vid_12345",
                "filename": "movie.mp4",
                "path": "/videos/movie.mp4",
                "duration": 3600.5,
                "has_embedded_subtitle": True,
                "format": "mp4",
                "status": "pending",
                "created_at": "2023-05-20T14:30:00Z"
            }
        }
```

### 2. 任务和配置模型

同样定义处理任务和配置相关的模型：

```python
# src/subtranslate/schemas/task.py
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class TaskStatus(str, Enum):
    """任务状态枚举"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TranslationStyle(str, Enum):
    """翻译风格枚举"""
    LITERAL = "literal"  # 直译
    NATURAL = "natural"  # 自然流畅
    COLLOQUIAL = "colloquial"  # 口语化
    FORMAL = "formal"  # 正式


class TranslationConfig(BaseModel):
    """翻译配置模型"""
    style: TranslationStyle = Field(default=TranslationStyle.NATURAL, description="翻译风格")
    preserve_formatting: bool = Field(default=True, description="保留原格式")
    handle_cultural_references: bool = Field(default=True, description="处理文化差异")
    glossary: Dict[str, str] = Field(default_factory=dict, description="术语表")
    context_preservation: bool = Field(default=True, description="保持上下文一致性")
    
    class Config:
        json_schema_extra = {
            "example": {
                "style": "natural",
                "preserve_formatting": True,
                "handle_cultural_references": True,
                "glossary": {"AI": "人工智能", "ML": "机器学习"},
                "context_preservation": True
            }
        }


class SubtitleTask(BaseModel):
    """字幕处理任务模型"""
    id: str = Field(..., description="任务唯一标识符")
    video_id: str = Field(..., description="关联视频ID")
    source_language: str = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    status: TaskStatus = Field(default=TaskStatus.QUEUED, description="任务状态")
    progress: float = Field(default=0.0, description="进度百分比")
    source_path: str = Field(..., description="源字幕路径")
    result_path: Optional[str] = Field(None, description="结果字幕路径")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    config: TranslationConfig = Field(default_factory=TranslationConfig, description="翻译配置")
```

### 3. API 请求/响应模型

为 API 接口定义请求和响应模型：

```python
# src/subtranslate/schemas/api.py
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from .video import VideoInfo
from .task import SubtitleTask


class APIResponse(BaseModel):
    """API 通用响应模型"""
    success: bool = Field(..., description="请求是否成功")
    message: str = Field(default="", description="响应消息")
    data: Optional[Any] = Field(None, description="响应数据")


class VideoUploadRequest(BaseModel):
    """视频上传请求模型"""
    filename: str = Field(..., description="文件名")
    content_type: str = Field(..., description="内容类型")
    

class TaskCreateRequest(BaseModel):
    """任务创建请求模型"""
    video_id: str = Field(..., description="视频ID")
    source_language: Optional[str] = Field(default="en", description="源语言")
    target_language: str = Field(default="zh", description="目标语言")
    translation_config: Optional[Dict[str, Any]] = Field(None, description="翻译配置")


class VideoListResponse(APIResponse):
    """视频列表响应模型"""
    data: List[VideoInfo]


class TaskListResponse(APIResponse):
    """任务列表响应模型"""
    data: List[SubtitleTask]
```

### 4. 配置和系统模型

定义系统配置模型：

```python
# src/subtranslate/schemas/config.py
from pydantic import BaseModel, Field, SecretStr
from typing import Optional, List


class OpenAIConfig(BaseModel):
    """OpenAI 配置模型"""
    api_key: SecretStr = Field(..., description="OpenAI API 密钥")
    model: str = Field(default="gpt-4", description="使用的模型")
    max_tokens: int = Field(default=4096, description="最大 token 数")
    temperature: float = Field(default=0.3, description="温度参数")


class FFmpegConfig(BaseModel):
    """FFmpeg 配置模型"""
    ffmpeg_path: Optional[str] = Field(None, description="FFmpeg 可执行文件路径")
    ffprobe_path: Optional[str] = Field(None, description="FFprobe 可执行文件路径")
    threads: int = Field(default=4, description="使用的线程数")


class SystemConfig(BaseModel):
    """系统配置模型"""
    openai: OpenAIConfig
    ffmpeg: FFmpegConfig = Field(default_factory=FFmpegConfig)
    max_concurrent_tasks: int = Field(default=2, description="最大并发任务数")
    output_dir: Optional[str] = Field(None, description="默认输出目录")
    allowed_formats: List[str] = Field(default=["mp4", "mkv"], description="允许的视频格式")
```

## Schema 使用规范

### 1. 模型实例化与验证

所有核心功能都应使用已定义的 Schema 模型来接收和返回数据：

```python
# 示例：创建新任务
def create_subtitle_task(video_id: str, config_data: dict) -> SubtitleTask:
    # 使用模型实例化并自动验证
    config = TranslationConfig(**config_data)
    task = SubtitleTask(
        id=generate_id(),
        video_id=video_id,
        source_path=get_video_path(video_id),
        config=config
    )
    # 存储任务...
    return task
```

### 2. API 实现

FastAPI 接口应直接使用已定义的 Schema：

```python
# 示例：API 路由
from fastapi import APIRouter, Depends
from ..schemas.api import TaskCreateRequest, APIResponse
from ..schemas.task import SubtitleTask

router = APIRouter()

@router.post("/tasks", response_model=APIResponse)
async def create_task(request: TaskCreateRequest):
    # 实现创建任务逻辑
    task = create_subtitle_task(request.video_id, request.translation_config or {})
    return APIResponse(
        success=True,
        message="任务创建成功",
        data=task
    )
```

### 3. 模型转换与扩展

使用模型方法处理转换而非临时逻辑：

```python
# src/subtranslate/schemas/video.py
# 在 VideoInfo 类中添加方法
def to_dict(self) -> dict:
    """转换为字典表示"""
    return self.model_dump()

def to_api_representation(self) -> dict:
    """转换为 API 表示形式"""
    data = self.to_dict()
    # 修改特定字段或格式
    data["created_at"] = self.created_at.isoformat()
    return data

@classmethod
def from_file_info(cls, filepath: str):
    """从文件信息创建视频信息模型"""
    # 实现从文件路径创建模型的逻辑
    # ...
    return cls(id=generate_id(), filename=filename, path=filepath, format=format)
```

## 模式验证和测试

### 1. 单元测试

为所有 Schema 模型编写单元测试：

```python
# tests/schemas/test_video.py
import pytest
from subtranslate.schemas.video import VideoInfo, ProcessingStatus, VideoFormat

def test_video_info_create():
    """测试 VideoInfo 模型创建"""
    video = VideoInfo(
        id="test_id",
        filename="test.mp4",
        path="/videos/test.mp4",
        format=VideoFormat.MP4
    )
    assert video.id == "test_id"
    assert video.filename == "test.mp4"
    assert video.status == ProcessingStatus.PENDING
    assert video.has_embedded_subtitle is False

def test_video_info_validation():
    """测试模型验证"""
    with pytest.raises(ValueError):
        # 缺少必要字段应引发错误
        VideoInfo()
    
    with pytest.raises(ValueError):
        # 无效枚举值应引发错误
        VideoInfo(
            id="test_id",
            filename="test.mp4",
            path="/videos/test.mp4",
            format="invalid_format"  # 无效格式
        )
```

### 2. API 测试

使用已定义的 Schema 测试 API：

```python
# tests/api/test_task_api.py
from fastapi.testclient import TestClient
from subtranslate.main import app

client = TestClient(app)

def test_create_task():
    """测试创建任务 API"""
    response = client.post(
        "/api/tasks",
        json={
            "video_id": "test_video_id",
            "target_language": "zh",
            "translation_config": {
                "style": "natural",
                "preserve_formatting": True
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "id" in data["data"]
```

## 使用 Pydantic 优势

1. **自动验证**：数据验证由 Pydantic 自动处理，减少手动验证代码
2. **类型安全**：完整的类型注解和静态类型检查，减少运行时错误
3. **文档生成**：基于 Schema 自动生成 OpenAPI 文档
4. **序列化/反序列化**：内置的数据转换功能，无需额外编写
5. **IDE 支持**：提供代码补全和类型提示，提高开发效率

## 最佳实践总结

1. 在实现功能前，先定义完整的 Schema
2. 所有数据模型必须包含类型注解和字段描述
3. 使用枚举类型定义有限选项
4. 模型应包含默认值以简化实例化
5. 使用模型方法而非临时逻辑处理数据转换
6. 为所有 Schema 编写单元测试
7. 使用 Pydantic 的高级特性，如验证器和约束

---

遵循本指南将确保 SubTranslate 项目采用一致的 Schema 驱动开发方法，提高代码质量和可维护性。 