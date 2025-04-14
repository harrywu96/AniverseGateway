#!/bin/bash
# 环境设置脚本 - 用于Linux/macOS系统

# 确保脚本目录存在
mkdir -p scripts

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 运行环境设置脚本
echo "正在设置项目环境..."
python3 scripts/setup_environment.py "$@"

if [ $? -ne 0 ]; then
    echo "环境设置失败"
    exit 1
fi

echo "环境设置脚本执行完成" 