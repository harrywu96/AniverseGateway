@echo off
echo Starting force clean and build...
powershell -ExecutionPolicy Bypass -File "force_clean_and_build.ps1" -Force
pause
