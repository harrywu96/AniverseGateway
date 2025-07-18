"""任务取消管理器模块

该模块提供任务取消管理功能，用于跟踪和管理需要取消的翻译任务。
"""

import logging
from typing import Set
import threading

logger = logging.getLogger("subtranslate.services.task_cancellation_manager")


class TaskCancellationManager:
    """任务取消管理器，用于管理需要取消的任务"""

    def __init__(self):
        """初始化任务取消管理器"""
        self._cancelled_tasks: Set[str] = set()
        self._lock = threading.Lock()

    def cancel_task(self, task_id: str) -> bool:
        """标记任务为取消状态

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功标记为取消状态
        """
        with self._lock:
            if task_id not in self._cancelled_tasks:
                self._cancelled_tasks.add(task_id)
                logger.info(f"任务 {task_id} 已标记为取消")
                return True
            else:
                logger.warning(f"任务 {task_id} 已经被标记为取消")
                return False

    def is_cancelled(self, task_id: str) -> bool:
        """检查任务是否被取消

        Args:
            task_id: 任务ID

        Returns:
            bool: 任务是否被取消
        """
        with self._lock:
            return task_id in self._cancelled_tasks

    def remove_task(self, task_id: str) -> bool:
        """从取消列表中移除任务

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功移除
        """
        with self._lock:
            if task_id in self._cancelled_tasks:
                self._cancelled_tasks.remove(task_id)
                logger.info(f"任务 {task_id} 已从取消列表中移除")
                return True
            else:
                logger.warning(f"任务 {task_id} 不在取消列表中")
                return False

    def clear_all(self) -> int:
        """清空所有取消的任务

        Returns:
            int: 清空的任务数量
        """
        with self._lock:
            count = len(self._cancelled_tasks)
            self._cancelled_tasks.clear()
            logger.info(f"已清空 {count} 个取消的任务")
            return count

    def get_cancelled_tasks(self) -> Set[str]:
        """获取所有被取消的任务ID

        Returns:
            Set[str]: 被取消的任务ID集合
        """
        with self._lock:
            return self._cancelled_tasks.copy()

    def get_cancelled_count(self) -> int:
        """获取被取消的任务数量

        Returns:
            int: 被取消的任务数量
        """
        with self._lock:
            return len(self._cancelled_tasks)


# 全局任务取消管理器实例
cancellation_manager = TaskCancellationManager()
