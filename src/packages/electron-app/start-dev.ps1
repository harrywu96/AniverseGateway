# 设置PowerShell编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

Write-Host "正在启动开发环境..."
Write-Host "已设置编码为UTF-8"

# 如果用到了虚拟环境，确保激活
if (Test-Path "../../.venv/Scripts/Activate.ps1") {
    Write-Host "激活Python虚拟环境..."
    & "../../.venv/Scripts/Activate.ps1"
}

# 启动开发服务器
Write-Host "启动Electron应用..."
cd ..
cd ..
pnpm dev 