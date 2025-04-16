# 设置PowerShell编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# 设置控制台代码页为UTF-8
chcp 65001 | Out-Null

# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

Write-Host "===== SubTranslate 开发环境启动脚本 =====" -ForegroundColor Cyan
Write-Host "已配置UTF-8编码环境" -ForegroundColor Green

# 激活虚拟环境
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    Write-Host "正在激活Python虚拟环境..." -ForegroundColor Yellow
    & ".\.venv\Scripts\Activate.ps1"
    Write-Host "虚拟环境已激活" -ForegroundColor Green
} else {
    Write-Host "未找到虚拟环境，请先创建: uv venv .venv" -ForegroundColor Red
    exit 1
}

# 确保Python依赖项已安装
Write-Host "正在安装必要的Python依赖..." -ForegroundColor Yellow
uv pip install click uvicorn httpx
Write-Host "Python依赖安装完成" -ForegroundColor Green

# 设置环境变量
$env:ELECTRON_FORCE_IS_PACKAGED = $false
$env:NODE_ENV = "development"

# 启动Electron应用
Write-Host "正在启动Electron应用..." -ForegroundColor Magenta
cd .\src
pnpm dev:win 