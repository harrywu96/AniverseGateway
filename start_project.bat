@echo off
echo 正在设置编码...
chcp 65001

echo 正在激活虚拟环境...
call .venv\Scripts\activate.bat

echo 正在安装关键依赖...
uv pip install starlette fastapi uvicorn --link-mode=copy

echo 正在进入src目录...
cd src

echo 正在启动项目...
pnpm dev

pause 