@echo off
chcp 936 >nul
echo ========================================
echo Backend.exe Debug Script
echo ========================================

echo.
echo [1/4] Environment Check...
echo Current directory: %CD%
echo PATH: %PATH%

echo.
echo [2/4] Checking backend.exe...
if not exist "frontend\electron-app\resources\backend.exe" (
    echo ERROR: backend.exe not found!
    echo Expected location: frontend\electron-app\resources\backend.exe
    pause
    exit /b 1
)

echo backend.exe found at: frontend\electron-app\resources\backend.exe
for %%i in ("frontend\electron-app\resources\backend.exe") do echo File size: %%~zi bytes

echo.
echo [3/4] Testing backend.exe directly...
echo Changing to resources directory...
cd frontend\electron-app\resources

echo Current directory: %CD%
echo Directory contents:
dir /b

echo.
echo Starting backend.exe with verbose output...
echo (This will show all startup messages)
echo Press Ctrl+C to stop the backend when you see "Application startup complete"
echo.

set API_PORT=8000
set PYTHONIOENCODING=utf-8
backend.exe

echo.
echo [4/4] Backend process ended
echo Exit code: %ERRORLEVEL%

cd ..\..\..
pause
