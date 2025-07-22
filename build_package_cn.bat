@echo off
chcp 936 >nul
echo ========================================
echo SubTranslate 应用打包脚本
echo ========================================

echo.
echo [1/4] 激活Python虚拟环境...
if not exist ".venv\Scripts\activate.bat" (
    echo 错误：找不到Python虚拟环境
    echo 请运行：python -m venv .venv
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo 错误：无法激活Python虚拟环境
    pause
    exit /b 1
)

echo.
echo [2/4] 使用PyInstaller打包Python后端...
if not exist "backend_build.spec" (
    echo 错误：找不到backend_build.spec文件
    pause
    exit /b 1
)
pyinstaller backend_build.spec --distpath frontend\electron-app\resources --workpath build\pyinstaller --clean
if %errorlevel% neq 0 (
    echo 错误：Python后端打包失败
    pause
    exit /b 1
)

echo.
echo [3/4] 构建Electron前端...
if not exist "frontend\electron-app\package.json" (
    echo 错误：找不到frontend\electron-app\package.json文件
    pause
    exit /b 1
)
cd frontend\electron-app
call npm run build
if %errorlevel% neq 0 (
    echo 错误：Electron前端构建失败
    cd ..\..
    pause
    exit /b 1
)

echo.
echo [4/4] 使用electron-builder打包完整应用...
call npm run build:electron
if %errorlevel% neq 0 (
    echo 错误：Electron应用打包失败
    cd ..\..
    pause
    exit /b 1
)

cd ..\..
echo.
echo ========================================
echo 打包完成！
echo ========================================
echo 安装包位置：frontend\electron-app\dist-electron\SubTranslate Setup 1.0.0.exe
echo 解压版位置：frontend\electron-app\dist-electron\win-unpacked\SubTranslate.exe
echo.
pause
