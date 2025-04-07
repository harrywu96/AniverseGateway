@echo off
echo Installing SubTranslate with UV...

set INSTALL_DEV=
set RECREATE_VENV=

:parse_args
if "%~1"=="" goto run_install
if /i "%~1"=="--dev" set INSTALL_DEV=--dev
if /i "%~1"=="--recreate-venv" set RECREATE_VENV=--recreate-venv
shift
goto parse_args

:run_install
python uv_install.py %INSTALL_DEV% %RECREATE_VENV%

if %ERRORLEVEL% NEQ 0 (
    echo Installation failed with error code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo Installation completed successfully!
echo You can activate the environment with: .\scripts\activate.bat
echo.

pause 