@echo off
REM 环境设置脚本 - 用于Windows系统

REM 确保脚本目录存在
if not exist "scripts" mkdir scripts

REM 检查Python是否安装
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误: 未找到Python，请先安装Python
    exit /b 1
)

REM 运行环境设置脚本
echo 正在设置项目环境...
python scripts\setup_environment.py %*

if %ERRORLEVEL% neq 0 (
    echo 环境设置失败
    exit /b 1
)

echo 环境设置脚本执行完成 