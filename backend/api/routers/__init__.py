"""API路由模块

包含所有API路由器。
"""

from . import subtitles
from . import videos
from . import translate  # 统一的翻译路由，已修复依赖注入问题
from . import test_translation  # 添加测试翻译路由
from . import tasks
from . import export
from . import templates
from . import config
from . import providers  # 添加新的providers路由
from . import speech_to_text  # 添加speech_to_text路由
from . import models  # 添加models路由
