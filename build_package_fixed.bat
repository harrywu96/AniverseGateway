@echo off
chcp 936 >nul
echo ========================================
echo SubTranslate Optimized Packaging Script
echo (With asar enabled and timestamp directories)
echo ========================================

echo.
echo [1/5] Cleaning up processes and old builds...
echo Stopping related processes...
powershell -Command "Get-Process electron,SubTranslate,node,python -ErrorAction SilentlyContinue | Stop-Process -Force"

echo Waiting for processes to terminate...
timeout /t 3 >nul

echo.
echo [2/5] Activating Python virtual environment...
if not exist ".venv\Scripts\activate.bat" (
    echo Error: Python virtual environment not found
    echo Please run: python -m venv .venv
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo Error: Failed to activate Python virtual environment
    pause
    exit /b 1
)

echo.
echo [3/5] Packaging Python backend with PyInstaller...
if not exist "backend_build.spec" (
    echo Error: backend_build.spec not found
    pause
    exit /b 1
)
pyinstaller backend_build.spec --distpath frontend\electron-app\resources --workpath build\pyinstaller --clean
if %errorlevel% neq 0 (
    echo Error: Python backend packaging failed
    pause
    exit /b 1
)

echo.
echo [4/5] Updating Electron output directory with timestamp...
cd frontend\electron-app
powershell -Command "$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'; $json = Get-Content package.json | ConvertFrom-Json; $json.build.directories.output = \"dist-electron-$timestamp\"; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"

echo.
echo [5/5] Building and packaging Electron application...
call npm run build:electron
if %errorlevel% neq 0 (
    echo Error: Electron application packaging failed
    cd ..\..
    pause
    exit /b 1
)

cd ..\..
echo.
echo ========================================
echo Packaging completed successfully!
echo ========================================

echo Searching for generated files...
for /d %%i in ("frontend\electron-app\dist-electron-*") do (
    echo.
    echo Output directory: %%i
    if exist "%%i\*.exe" (
        for %%j in ("%%i\*.exe") do echo Installer: %%j
    )
    if exist "%%i\win-unpacked\SubTranslate.exe" (
        echo Portable: %%i\win-unpacked\SubTranslate.exe
    )
)

echo.
pause
