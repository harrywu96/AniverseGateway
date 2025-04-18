"""语音转写 API 路由模块

提供视频和音频文件转写为字幕的功能，使用 faster-whisper 进行语音识别。
"""

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, Optional, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel, Field

from ...core.speech_to_text import (
    SpeechToText,
    TranscriptionParameters,
    WhisperModelSize,
)
from ...schemas.api import APIResponse, ProgressUpdateEvent
from ...schemas.config import SystemConfig, SpeechToTextConfig
from ...core.faster_whisper_config_util import (
    load_faster_whisper_gui_config,
    convert_to_transcription_parameters,
    get_output_format,
    WhisperConfigManager,
)
from ..dependencies import get_system_config
from ..websocket import manager

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter(prefix="/speech-to-text", tags=["语音转写"])

# 创建配置管理器
config_manager = WhisperConfigManager()


# 转写请求模型
class TranscriptionRequest(BaseModel):
    """转写请求模型"""

    model_size: WhisperModelSize = Field(
        default=WhisperModelSize.MEDIUM, description="模型大小"
    )
    language: Optional[str] = Field(default=None, description="语言代码")
    task: str = Field(default="transcribe", description="任务类型")
    initial_prompt: Optional[str] = Field(default=None, description="初始提示")
    vad_filter: bool = Field(default=True, description="是否使用VAD过滤")
    word_timestamps: bool = Field(
        default=True, description="是否生成单词时间戳"
    )
    keep_audio: bool = Field(default=False, description="是否保留音频文件")
    device: Optional[str] = Field(default=None, description="计算设备")
    compute_type: Optional[str] = Field(default=None, description="计算精度")


# 转写响应模型
class TranscriptionResponse(APIResponse):
    """转写响应模型"""

    data: Optional[Dict[str, Any]] = None


# 获取SpeechToText实例
async def get_speech_to_text(
    request: TranscriptionRequest,
    config: SystemConfig = Depends(get_system_config),
) -> SpeechToText:
    """获取配置好的SpeechToText实例

    Args:
        request: 转写请求
        config: 系统配置

    Returns:
        SpeechToText: 配置好的实例
    """
    # 合并系统配置和请求参数
    speech_config = config.speech_to_text or SpeechToTextConfig()

    # 创建转写参数
    params = TranscriptionParameters(
        model_size=request.model_size,
        language=request.language,
        task=request.task,
        initial_prompt=request.initial_prompt,
        vad_filter=request.vad_filter,
        word_timestamps=request.word_timestamps,
        device=request.device or speech_config.device,
        compute_type=request.compute_type or speech_config.compute_type,
        model_dir=speech_config.model_dir,
    )

    return SpeechToText(parameters=params)


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    data: str = Form(...),  # JSON序列化的请求数据
    config: SystemConfig = Depends(get_system_config),
):
    """转写音频或视频文件

    接收上传的音频或视频文件，并使用faster-whisper进行转写。
    转写结果作为SRT字幕文件返回。

    Args:
        background_tasks: 后台任务
        file: 上传的音频或视频文件
        data: JSON序列化的请求数据
        config: 系统配置

    Returns:
        TranscriptionResponse: 包含转写结果信息的响应
    """
    try:
        # 解析请求数据
        import json
        from pydantic import ValidationError

        try:
            request_data = TranscriptionRequest.model_validate(
                json.loads(data)
            )
        except (json.JSONDecodeError, ValidationError) as e:
            raise HTTPException(
                status_code=400, detail=f"请求数据格式错误: {str(e)}"
            )

        # 检查文件类型
        filename = file.filename or ""
        file_ext = Path(filename).suffix.lower()

        # 支持的文件类型
        audio_extensions = [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"]
        video_extensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm"]

        is_audio = file_ext in audio_extensions
        is_video = file_ext in video_extensions

        if not (is_audio or is_video):
            raise HTTPException(
                status_code=400,
                detail="不支持的文件类型，请上传音频或视频文件",
            )

        # 保存上传的文件
        temp_dir = config.temp_dir
        os.makedirs(temp_dir, exist_ok=True)

        task_id = str(uuid.uuid4())
        task_dir = os.path.join(temp_dir, f"transcribe_{task_id}")
        os.makedirs(task_dir, exist_ok=True)

        temp_file_path = os.path.join(task_dir, filename)

        # 读取并保存文件内容
        content = await file.read()
        with open(temp_file_path, "wb") as f:
            f.write(content)

        logger.info(f"文件已保存: {temp_file_path}")

        # 在后台执行转写任务
        background_tasks.add_task(
            process_transcription_task,
            task_id=task_id,
            file_path=temp_file_path,
            request=request_data,
            is_video=is_video,
            task_dir=task_dir,
            config=config,
        )

        # 返回任务ID
        return TranscriptionResponse(
            success=True,
            message="转写任务已提交",
            data={
                "task_id": task_id,
                "filename": filename,
                "status": "processing",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提交转写任务失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"提交转写任务失败: {str(e)}"
        )


@router.get("/task/{task_id}", response_model=TranscriptionResponse)
async def get_task_status(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """获取转写任务状态

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        TranscriptionResponse: 包含任务状态的响应
    """
    # 检查任务目录
    task_dir = os.path.join(config.temp_dir, f"transcribe_{task_id}")
    if not os.path.exists(task_dir):
        raise HTTPException(status_code=404, detail=f"找不到任务: {task_id}")

    # 检查是否有结果文件
    result_file = os.path.join(task_dir, "result.json")
    if os.path.exists(result_file):
        try:
            with open(result_file, "r", encoding="utf-8") as f:
                import json

                result = json.load(f)

            # 检查是否有字幕文件
            srt_files = list(Path(task_dir).glob("*.srt"))
            if srt_files:
                # 提供字幕文件下载链接
                srt_path = srt_files[0]
                result["srt_filename"] = srt_path.name

            return TranscriptionResponse(
                success=True,
                message="转写任务已完成",
                data={
                    "task_id": task_id,
                    "status": "completed",
                    "result": result,
                },
            )
        except Exception as e:
            logger.error(f"读取任务结果失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"读取任务结果失败: {str(e)}"
            )

    # 检查是否有错误文件
    error_file = os.path.join(task_dir, "error.txt")
    if os.path.exists(error_file):
        try:
            with open(error_file, "r", encoding="utf-8") as f:
                error_message = f.read()

            return TranscriptionResponse(
                success=False,
                message="转写任务失败",
                data={
                    "task_id": task_id,
                    "status": "failed",
                    "error": error_message,
                },
            )
        except Exception as e:
            logger.error(f"读取任务错误信息失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"读取任务错误信息失败: {str(e)}"
            )

    # 任务仍在处理中
    return TranscriptionResponse(
        success=True,
        message="转写任务处理中",
        data={
            "task_id": task_id,
            "status": "processing",
        },
    )


@router.delete("/task/{task_id}", response_model=TranscriptionResponse)
async def delete_task(
    task_id: str, config: SystemConfig = Depends(get_system_config)
):
    """删除转写任务及其文件

    Args:
        task_id: 任务ID
        config: 系统配置

    Returns:
        TranscriptionResponse: 操作结果
    """
    # 检查任务目录
    task_dir = os.path.join(config.temp_dir, f"transcribe_{task_id}")
    if not os.path.exists(task_dir):
        raise HTTPException(status_code=404, detail=f"找不到任务: {task_id}")

    try:
        # 删除整个任务目录
        shutil.rmtree(task_dir)
        return TranscriptionResponse(
            success=True,
            message=f"已删除任务: {task_id}",
            data={"task_id": task_id},
        )
    except Exception as e:
        logger.error(f"删除任务失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}")


@router.get("/download/{task_id}/{filename}")
async def download_subtitle(
    task_id: str,
    filename: str,
    config: SystemConfig = Depends(get_system_config),
):
    """下载转写生成的字幕文件

    Args:
        task_id: 任务ID
        filename: 文件名
        config: 系统配置

    Returns:
        StreamingResponse: 文件下载响应
    """
    from fastapi.responses import FileResponse

    task_dir = os.path.join(config.temp_dir, f"transcribe_{task_id}")
    file_path = os.path.join(task_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"找不到文件: {filename}")

    return FileResponse(
        file_path,
        media_type="text/srt",
        filename=filename,
    )


@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket端点，用于实时获取转写进度

    Args:
        websocket: WebSocket连接
        task_id: 任务ID
    """
    await manager.connect(websocket, task_id)
    try:
        # 等待连接关闭
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)


async def process_transcription_task(
    task_id: str,
    file_path: str,
    request: TranscriptionRequest,
    is_video: bool,
    task_dir: str,
    config: SystemConfig,
):
    """处理转写任务

    Args:
        task_id: 任务ID
        file_path: 文件路径
        request: 转写请求
        is_video: 是否为视频文件
        task_dir: 任务目录
        config: 系统配置
    """
    import json

    try:
        # 初始化SpeechToText
        transcriber = await get_speech_to_text(request, config)

        # 进度更新回调
        async def progress_callback(progress: float):
            event = ProgressUpdateEvent(
                task_id=task_id,
                progress=progress,
                status="processing",
            )
            await manager.broadcast_to_group(task_id, event.model_dump())

        # 执行转写
        result = None
        if is_video:
            result = transcriber.transcribe_video(
                video_path=file_path,
                output_dir=task_dir,
                keep_audio=request.keep_audio,
                progress_callback=progress_callback,
            )
        else:
            result = transcriber.transcribe_audio(
                audio_path=file_path,
                output_dir=task_dir,
                progress_callback=progress_callback,
            )

        # 保存结果到JSON文件
        result_dict = result.model_dump()

        # 保存SRT文件路径信息
        if result.subtitle_path:
            result_dict["subtitle_file"] = os.path.basename(
                result.subtitle_path
            )

        with open(
            os.path.join(task_dir, "result.json"), "w", encoding="utf-8"
        ) as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2)

        # 完成通知
        completion_event = ProgressUpdateEvent(
            task_id=task_id,
            progress=1.0,
            status="completed",
        )
        await manager.broadcast_to_group(
            task_id, completion_event.model_dump()
        )

        logger.info(f"任务 {task_id} 转写完成")

    except Exception as e:
        logger.error(f"转写任务 {task_id} 失败: {str(e)}", exc_info=True)

        # 保存错误信息
        with open(
            os.path.join(task_dir, "error.txt"), "w", encoding="utf-8"
        ) as f:
            f.write(str(e))

        # 发送错误通知
        error_event = ProgressUpdateEvent(
            task_id=task_id,
            progress=0,
            status="failed",
            message=str(e),
        )
        await manager.broadcast_to_group(task_id, error_event.model_dump())


# 验证模型请求
class ValidateModelRequest(BaseModel):
    """验证模型请求"""

    model_path: str = Field(..., description="模型路径")


# 验证模型响应
class ValidateModelResponse(APIResponse):
    """验证模型响应"""

    valid: bool = Field(default=False, description="模型是否有效")
    modelInfo: Optional[Dict[str, Any]] = Field(
        default=None, description="模型信息"
    )


@router.post("/validate-model", response_model=ValidateModelResponse)
async def validate_model(
    request: ValidateModelRequest,
):
    """验证Whisper模型路径是否有效

    Args:
        request: 请求内容，包含模型路径

    Returns:
        ValidationModelResponse: 验证结果
    """
    try:
        model_path = request.model_path
        is_valid = config_manager.validate_model_path(model_path)

        model_info = None
        if is_valid:
            # 获取基本模型信息
            model_name = os.path.basename(model_path)
            model_info = {"name": model_name, "path": model_path}

        return ValidateModelResponse(
            success=True,
            valid=is_valid,
            message="模型验证完成",
            modelInfo=model_info,
        )
    except Exception as e:
        logger.error(f"验证模型出错: {str(e)}", exc_info=True)
        return ValidateModelResponse(
            success=False, valid=False, message=f"验证过程中发生错误: {str(e)}"
        )


# GUI配置文件请求
class ConfigFileRequest(BaseModel):
    """配置文件请求"""

    config_path: str = Field(..., description="配置文件路径")


# GUI配置文件响应
class ConfigFileResponse(APIResponse):
    """配置文件响应"""

    config: Optional[Dict[str, Any]] = Field(
        default=None, description="配置内容"
    )


@router.post("/load-gui-config", response_model=ConfigFileResponse)
async def load_gui_config(
    request: ConfigFileRequest,
):
    """加载Faster Whisper GUI配置文件

    Args:
        request: 请求内容，包含配置文件路径

    Returns:
        ConfigFileResponse: 加载结果
    """
    try:
        config_path = request.config_path
        config = load_faster_whisper_gui_config(config_path)

        # 转换为字典以便序列化
        config_dict = config.model_dump()

        return ConfigFileResponse(
            success=True, message="配置文件加载成功", config=config_dict
        )
    except FileNotFoundError as e:
        logger.error(f"配置文件不存在: {str(e)}")
        return ConfigFileResponse(
            success=False, message=f"配置文件不存在: {str(e)}"
        )
    except Exception as e:
        logger.error(f"加载配置文件出错: {str(e)}", exc_info=True)
        return ConfigFileResponse(
            success=False, message=f"加载配置文件出错: {str(e)}"
        )


@router.post("/get-config-params", response_model=APIResponse)
async def get_config_params(
    request: ConfigFileRequest,
):
    """获取配置文件对应的转写参数

    Args:
        request: 请求内容，包含配置文件路径

    Returns:
        APIResponse: 转写参数
    """
    try:
        config_path = request.config_path

        # 从GUI配置转换为转写参数
        params = config_manager.from_gui_config(config_path)

        # 转换为字典以便序列化
        params_dict = params.model_dump()

        return APIResponse(
            success=True,
            message="参数提取成功",
            data={"parameters": params_dict},
        )
    except Exception as e:
        logger.error(f"提取参数出错: {str(e)}", exc_info=True)
        return APIResponse(success=False, message=f"提取参数出错: {str(e)}")


# 使用GUI配置转写请求
class TranscribeWithConfigRequest(BaseModel):
    """使用GUI配置转写请求"""

    video_path: str = Field(..., description="视频路径")
    config_path: str = Field(..., description="配置文件路径")
    output_dir: Optional[str] = Field(default=None, description="输出目录")


@router.post(
    "/transcribe-with-gui-config", response_model=TranscriptionResponse
)
async def transcribe_with_gui_config(
    request: TranscribeWithConfigRequest,
    background_tasks: BackgroundTasks,
    config: SystemConfig = Depends(get_system_config),
):
    """使用Faster Whisper GUI配置文件转写视频

    Args:
        request: 请求内容
        background_tasks: 后台任务
        config: 系统配置

    Returns:
        TranscriptionResponse: 转写响应
    """
    try:
        # 检查视频文件是否存在
        video_path = Path(request.video_path)
        if not video_path.exists():
            raise HTTPException(
                status_code=404, detail=f"视频文件不存在: {request.video_path}"
            )

        # 检查配置文件是否存在
        config_path = Path(request.config_path)
        if not config_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"配置文件不存在: {request.config_path}",
            )

        # 创建任务ID和任务目录
        task_id = str(uuid.uuid4())
        task_dir = os.path.join(config.temp_dir, f"transcribe_{task_id}")
        os.makedirs(task_dir, exist_ok=True)

        # 设置输出目录
        output_dir = request.output_dir
        if not output_dir:
            output_dir = task_dir
        else:
            os.makedirs(output_dir, exist_ok=True)

        # 在后台执行转写任务
        background_tasks.add_task(
            process_transcription_with_gui_config,
            task_id=task_id,
            video_path=str(video_path),
            config_path=str(config_path),
            task_dir=task_dir,
            output_dir=output_dir,
            config=config,
        )

        # 返回任务ID
        return TranscriptionResponse(
            success=True,
            message="转写任务已提交",
            data={
                "task_id": task_id,
                "filename": video_path.name,
                "status": "processing",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提交GUI配置转写任务失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"提交GUI配置转写任务失败: {str(e)}"
        )


async def process_transcription_with_gui_config(
    task_id: str,
    video_path: str,
    config_path: str,
    task_dir: str,
    output_dir: str,
    config: SystemConfig,
):
    """使用GUI配置处理转写任务

    Args:
        task_id: 任务ID
        video_path: 视频路径
        config_path: 配置文件路径
        task_dir: 任务临时目录
        output_dir: 输出目录
        config: 系统配置
    """
    status_file = os.path.join(task_dir, "status.json")
    output_file = os.path.join(task_dir, "output.json")
    subtitle_file = None

    try:
        # 更新状态
        with open(status_file, "w", encoding="utf-8") as f:
            import json

            json.dump(
                {
                    "status": "processing",
                    "progress": 0,
                    "message": "开始处理转写任务...",
                },
                f,
                ensure_ascii=False,
            )

        # 定义进度回调函数
        async def progress_callback(progress: float):
            # 更新状态文件
            with open(status_file, "w", encoding="utf-8") as f:
                import json

                json.dump(
                    {
                        "status": "processing",
                        "progress": progress,
                        "message": f"正在处理... {progress:.0%}",
                    },
                    f,
                    ensure_ascii=False,
                )

            # 通过WebSocket发送进度更新
            update = ProgressUpdateEvent(
                task_id=task_id,
                progress=progress,
                status="processing",
                message=f"正在处理... {progress:.0%}",
            )
            await manager.send_message(task_id, update.model_dump())

        # 创建SpeechToText实例
        speech_to_text = SpeechToText.from_gui_config(config_path)

        # 执行转写
        result = await speech_to_text.transcribe_video(
            video_path=video_path,
            output_dir=output_dir,
            progress_callback=progress_callback,
        )

        # 保存转写结果
        with open(output_file, "w", encoding="utf-8") as f:
            import json

            json.dump(
                {
                    "text": result.text,
                    "segments": result.segments,
                    "language": result.language,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )

        # 保存字幕文件路径
        subtitle_file = result.subtitle_path

        # 更新最终状态
        with open(status_file, "w", encoding="utf-8") as f:
            import json

            json.dump(
                {
                    "status": "completed",
                    "progress": 1.0,
                    "message": "转写任务已完成",
                    "subtitle_file": (
                        str(subtitle_file) if subtitle_file else None
                    ),
                },
                f,
                ensure_ascii=False,
            )

        # 通过WebSocket发送完成通知
        update = ProgressUpdateEvent(
            task_id=task_id,
            progress=1.0,
            status="completed",
            message="转写任务已完成",
        )
        await manager.send_message(task_id, update.model_dump())

    except Exception as e:
        logger.error(f"转写任务处理失败: {str(e)}", exc_info=True)

        # 更新错误状态
        with open(status_file, "w", encoding="utf-8") as f:
            import json

            json.dump(
                {
                    "status": "failed",
                    "progress": 0,
                    "message": f"转写失败: {str(e)}",
                },
                f,
                ensure_ascii=False,
            )

        # 通过WebSocket发送错误通知
        update = ProgressUpdateEvent(
            task_id=task_id,
            progress=0,
            status="failed",
            message=f"转写失败: {str(e)}",
        )
        await manager.send_message(task_id, update.model_dump())
