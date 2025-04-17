@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

echo ==================================================
echo        API服务器诊断与修复工具
echo ==================================================
echo.

:: 设置UTF-8编码
set PYTHONIOENCODING=utf-8

:: 检查Python是否可用
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 找不到Python命令，请确保Python已安装并添加到PATH环境变量中
    goto :EOF
)

:: 检查虚拟环境
if exist ..\.venv\Scripts\activate.bat (
    echo [信息] 发现Python虚拟环境，正在激活...
    call ..\.venv\Scripts\activate.bat
) else (
    echo [警告] 未找到虚拟环境（..\.venv），将使用系统Python
)

:: 检查端口占用
echo [信息] 检查端口占用情况...
netstat -ano | findstr ":8000" | findstr "LISTENING" > temp_port.txt
if %ERRORLEVEL% equ 0 (
    echo [警告] 端口8000已被占用，尝试释放端口...
    for /f "tokens=5" %%a in (temp_port.txt) do (
        echo [信息] 正在终止进程 PID: %%a
        taskkill /F /PID %%a /T
        if !ERRORLEVEL! equ 0 (
            echo [成功] 已成功终止占用端口的进程
        ) else (
            echo [错误] 无法终止占用端口的进程，可能需要管理员权限
        )
    )
) else (
    echo [信息] 端口8000可用
)
del temp_port.txt >nul 2>nul

:: 运行诊断脚本
echo.
echo [信息] 运行API服务器诊断脚本...
python check_api_server.py
if %ERRORLEVEL% neq 0 (
    echo [错误] 诊断脚本执行失败
) else (
    echo [信息] 诊断脚本执行完成
)

echo.
echo ==================================================
echo 是否要启动API服务器? (Y/N)
set /p choice="> "
if /i "%choice%"=="Y" (
    echo.
    echo [信息] 正在启动API服务器...
    python run_api_server.py
) else (
    echo [信息] 已取消启动API服务器
)

pause 