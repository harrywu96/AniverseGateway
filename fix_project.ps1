# 修复项目依赖和编码问题的全面脚本

# 设置PowerShell编码为UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001

Write-Host "已将PowerShell终端编码设置为UTF-8"

# 检查并激活虚拟环境
Write-Host "检查虚拟环境..."
if (-not (Test-Path ".\.venv\Scripts\activate.ps1")) {
    Write-Host "虚拟环境不存在，正在创建..."
    uv venv .venv
}

# 激活虚拟环境
Write-Host "激活虚拟环境..."
try {
    & ".\.venv\Scripts\Activate.ps1"
    Write-Host "虚拟环境已激活"
} catch {
    Write-Host "激活虚拟环境失败: $_"
    exit 1
}

# 安装关键依赖
Write-Host "安装关键依赖..."
uv pip install starlette==0.31.1 --link-mode=copy
uv pip install fastapi uvicorn --link-mode=copy

# 同步所有依赖
Write-Host "同步所有依赖..."
uv pip sync requirements.txt --link-mode=copy

# 检查pnpm是否已安装
$pnpmInstalled = $null
try {
    $pnpmInstalled = Get-Command pnpm -ErrorAction SilentlyContinue
} catch {
    # 忽略错误
}

if (-not $pnpmInstalled) {
    Write-Host "没有找到pnpm，请确保已安装Node.js和pnpm"
    Write-Host "可以使用以下命令安装pnpm: npm install -g pnpm"
} else {
    Write-Host "pnpm已安装，可以使用'cd src && pnpm dev'启动应用"
}

Write-Host "`n===== 项目修复完成 ====="
Write-Host "1. 已修复编码问题"
Write-Host "2. 已安装/更新所有依赖"
Write-Host "3. 现在您应该可以正常运行应用程序了"
Write-Host "`n如需启动应用，请使用以下命令:"
Write-Host "  cd src"
Write-Host "  pnpm dev"
Write-Host "`n按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 