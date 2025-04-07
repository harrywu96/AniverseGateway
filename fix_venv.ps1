# PowerShell script to fix virtual environment issues
Write-Host "重置虚拟环境..." -ForegroundColor Cyan

# Stop processes that might be using the virtual environment
Write-Host "停止可能使用虚拟环境的进程..." -ForegroundColor Yellow
try {
    Stop-Process -Name python -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} catch {
    # Ignore errors if no Python processes are running
}

# Check if .venv exists
if (Test-Path -Path ".venv") {
    Write-Host "发现现有 .venv 目录，尝试重命名..." -ForegroundColor Yellow
    # Generate a timestamp for the backup
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $backupName = ".venv_old_$timestamp"
    
    try {
        # Try to rename the directory
        Rename-Item -Path ".venv" -NewName $backupName -ErrorAction Stop
        Write-Host "✅ 旧的虚拟环境已重命名为 $backupName" -ForegroundColor Green
    } catch {
        Write-Host "❌ 无法重命名 .venv 目录: $_" -ForegroundColor Red
        Write-Host "请关闭所有使用虚拟环境的应用并手动删除 .venv 目录后重试" -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "✅ 没有找到现有虚拟环境" -ForegroundColor Green
}

# Check if UV is installed
Write-Host "检查 UV 是否已安装..." -ForegroundColor Yellow
try {
    $null = uv --version
    Write-Host "✅ UV 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ UV 未安装，请安装 UV: pip install --user uv" -ForegroundColor Red
    Exit 1
}

# Create a new virtual environment
Write-Host "📦 创建新的虚拟环境..." -ForegroundColor Yellow
try {
    uv venv
    Write-Host "✅ 新虚拟环境创建成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 创建虚拟环境失败: $_" -ForegroundColor Red
    Exit 1
}

# Print activation instructions
Write-Host "`n🚀 要激活虚拟环境，请运行以下命令：" -ForegroundColor Cyan
Write-Host "PowerShell: .venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host "CMD: .venv\Scripts\activate.bat" -ForegroundColor Yellow

Write-Host "`n📦 要安装依赖，请激活环境后运行：" -ForegroundColor Cyan
Write-Host "uv pip sync requirements.txt" -ForegroundColor Yellow

Write-Host "`n✨ 虚拟环境重置完成！" -ForegroundColor Green 