@echo off
chcp 936 >nul
echo ========================================
echo Build Cleanup Script
echo ========================================

echo.
echo Killing all related processes...
taskkill /f /im electron.exe 2>nul || echo No Electron processes found
taskkill /f /im SubTranslate.exe 2>nul || echo No SubTranslate processes found
taskkill /f /im backend.exe 2>nul || echo No backend processes found
taskkill /f /im node.exe 2>nul || echo No Node.js processes found
taskkill /f /im python.exe 2>nul || echo No Python processes found

echo.
echo Waiting for processes to terminate...
timeout /t 3 >nul

echo.
echo Cleaning up build directories...

if exist "frontend\electron-app\dist-electron" (
    echo Removing Electron build directory...
    rmdir /s /q "frontend\electron-app\dist-electron" 2>nul || (
        echo Warning: Some files are still in use, forcing removal...
        timeout /t 2 >nul
        for /d %%i in ("frontend\electron-app\dist-electron\*") do rmdir /s /q "%%i" 2>nul
        del /f /q "frontend\electron-app\dist-electron\*.*" 2>nul
        rmdir /q "frontend\electron-app\dist-electron" 2>nul
    )
)

if exist "frontend\electron-app\dist" (
    echo Removing frontend dist directory...
    rmdir /s /q "frontend\electron-app\dist" 2>nul
)

if exist "frontend\electron-app\resources" (
    echo Removing resources directory...
    rmdir /s /q "frontend\electron-app\resources" 2>nul
)

if exist "build\pyinstaller" (
    echo Removing PyInstaller build cache...
    rmdir /s /q "build\pyinstaller" 2>nul
)

echo.
echo Cleaning up temporary files...
del /f /q "frontend\electron-app\*.log" 2>nul
del /f /q "frontend\electron-app\nul" 2>nul
del /f /q "*.log" 2>nul

echo.
echo ========================================
echo Cleanup completed!
echo ========================================
echo You can now run build_package.bat safely.
echo.
pause
