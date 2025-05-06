"""工具函数兼容层

此模块作为兼容层，从实际的实现位置导入工具函数和类，
以保持向后兼容性，避免在迁移过程中修改大量导入语句。
"""

# 从 backend.services.utils 导入工具函数和类
from backend.services.utils import async_retry, sync_retry, TokenCounter

# 从 backend.utils.srt_optimizer 导入 SRT 优化器
from backend.utils.srt_optimizer import SRTOptimizer

# 导出的符号
__all__ = [
    "async_retry",
    "sync_retry",
    "TokenCounter",
    "SRTOptimizer",
]
