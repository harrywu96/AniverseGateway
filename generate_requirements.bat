@echo off
echo Generating requirements files using UV...
python generate_requirements.py
if %ERRORLEVEL% NEQ 0 (
    echo Failed to generate requirements files with error code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)
echo Requirements files generated successfully.
pause 