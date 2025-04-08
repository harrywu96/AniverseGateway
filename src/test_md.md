# uv环境api服务启动
uvicorn src.subtranslate.api.app:app --reload
# 运行测试文件（也要在新的powershell中在uv环境执行）
python src/test_api_uv.py