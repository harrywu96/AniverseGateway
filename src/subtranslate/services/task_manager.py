"""任务管理模块

该模块提供任务管理相关功能，用于管理翻译任务的生命周期。
"""

import logging
from typing import Dict, List, Optional, Any
from uuid import uuid4

from ..schemas.config import SystemConfig
from ..schemas.task import TaskStatus, TranslationTask

logger = logging.getLogger("subtranslate.services.task_manager")


class TaskManager:
    """任务管理器基类"""

    def __init__(self, config: SystemConfig):
        """初始化任务管理器

        Args:
            config: 系统配置
        """
        self.config = config
        self.tasks: Dict[str, Any] = {}

    def get_task(self, task_id: str) -> Optional[Any]:
        """获取任务

        Args:
            task_id: 任务ID

        Returns:
            Optional[Any]: 任务对象，如果不存在返回None
        """
        return self.tasks.get(task_id)

    def list_tasks(self) -> List[Any]:
        """列出所有任务

        Returns:
            List[Any]: 任务列表
        """
        return list(self.tasks.values())


class TranslationTaskManager(TaskManager):
    """翻译任务管理器"""

    def __init__(self, config: SystemConfig):
        """初始化翻译任务管理器

        Args:
            config: 系统配置
        """
        super().__init__(config)
        self.tasks: Dict[str, TranslationTask] = {}

    def create_task(self, **task_data) -> TranslationTask:
        """创建翻译任务

        Args:
            **task_data: 任务数据

        Returns:
            TranslationTask: 创建的翻译任务
        """
        task_id = str(uuid4())
        task = TranslationTask(
            id=task_id, status=TaskStatus.PENDING, **task_data
        )
        self.tasks[task_id] = task
        logger.info(f"创建翻译任务: {task_id}")
        return task

    def update_task_status(
        self, task_id: str, status: TaskStatus, message: Optional[str] = None
    ) -> Optional[TranslationTask]:
        """更新任务状态

        Args:
            task_id: 任务ID
            status: 新状态
            message: 状态消息

        Returns:
            Optional[TranslationTask]: 更新后的任务，如果不存在返回None
        """
        task = self.tasks.get(task_id)
        if not task:
            logger.warning(f"尝试更新不存在的任务: {task_id}")
            return None

        task.status = status
        if message:
            task.message = message

        logger.info(f"更新任务 {task_id} 状态为 {status.value}")
        return task

    def get_task(self, task_id: str) -> Optional[TranslationTask]:
        """获取翻译任务

        Args:
            task_id: 任务ID

        Returns:
            Optional[TranslationTask]: 翻译任务，如果不存在返回None
        """
        return self.tasks.get(task_id)

    def list_tasks(self) -> List[TranslationTask]:
        """列出所有翻译任务

        Returns:
            List[TranslationTask]: 翻译任务列表
        """
        return list(self.tasks.values())
