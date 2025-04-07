@echo off
echo =====================================================
echo SubTranslate API测试 (UV环境)
echo =====================================================

REM 切换到脚本所在目录
cd /d %~dp0

echo 启动API服务器...
echo =====================================================
start cmd /k "python -m uvicorn subtranslate.api.app:app --reload"

echo 等待服务器启动...
timeout /t 5 /nobreak > nul

echo 运行API测试...
echo =====================================================
python test_api_uv.py

echo 测试完成！
pause 