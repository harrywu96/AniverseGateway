@echo off
echo 正在启动SubTranslate API服务器...

REM 在新的cmd窗口中启动API服务器
start cmd /k "cd %~dp0 && python -m uvicorn subtranslate.api.app:app --reload"

echo 等待API服务器启动...
timeout /t 5 /nobreak > nul

echo 开始运行API测试...
python %~dp0\test_api.py

echo 测试完成！
pause 