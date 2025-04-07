@echo off
echo 重置虚拟环境...

echo 停止可能使用虚拟环境的进程...
taskkill /F /IM python.exe >nul 2>&1

echo 移除现有虚拟环境...
if exist .venv (
    echo 尝试删除 .venv 目录...
    rd /s /q .venv >nul 2>&1
) 

if exist .venv (
    echo 无法删除目录，尝试重命名...
    ren .venv .venv_old >nul 2>&1
)

echo 检查 UV 是否已安装...
uv --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 未安装 UV，请先安装 UV: pip install --user uv
    goto :EOF
)

echo 创建新的虚拟环境...
uv venv

if %ERRORLEVEL% NEQ 0 (
    echo 创建虚拟环境失败，请检查错误信息
    goto :EOF
)

echo.
echo 虚拟环境已重置！
echo.
echo 要激活虚拟环境:
echo  - 在 CMD 中运行:      .venv\Scripts\activate.bat
echo  - 在 PowerShell 中运行: .venv\Scripts\Activate.ps1
echo.
echo 要安装依赖，请激活环境后运行: uv pip sync requirements.txt
echo.
echo 按任意键退出...
pause >nul 