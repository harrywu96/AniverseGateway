# 修复依赖问题脚本

# 设置PowerShell编码为UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001

Write-Host "已将终端编码设置为UTF-8"

# 安装关键依赖
Write-Host "安装关键依赖..."
uv pip install starlette==0.31.1 --link-mode=copy
uv pip install fastapi uvicorn --link-mode=copy

# 更新所有依赖
Write-Host "同步所有依赖..."
uv pip sync requirements.txt --link-mode=copy

Write-Host "依赖安装完成！现在您应该可以正常运行应用程序了"
Write-Host "如需启动应用，请使用以下命令:"
Write-Host "  cd src"
Write-Host "  pnpm dev" 