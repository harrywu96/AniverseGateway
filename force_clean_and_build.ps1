# 强力清理和构建脚本
param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"
Write-Host "========================================" -ForegroundColor Red
Write-Host "Force Clean and Build Script" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red

function Force-KillProcesses {
    Write-Host "`nForce killing all related processes..." -ForegroundColor Yellow
    
    # 更全面的进程列表
    $processes = @(
        "electron", "SubTranslate", "backend", "node", "npm", "pnpm", 
        "python", "pyinstaller", "vite", "tsc", "typescript"
    )
    
    foreach ($proc in $processes) {
        try {
            $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
            if ($running) {
                Write-Host "Force stopping $proc processes..." -ForegroundColor Gray
                Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
            }
        } catch {
            # Ignore errors
        }
    }
    
    # 额外等待时间
    Write-Host "Waiting for processes to fully terminate..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

function Force-RemoveDirectories {
    Write-Host "`nForce removing build directories..." -ForegroundColor Yellow
    
    $directories = @(
        "frontend\electron-app\dist-electron",
        "frontend\electron-app\dist",
        "frontend\electron-app\resources",
        "build\pyinstaller"
    )
    
    foreach ($dir in $directories) {
        if (Test-Path $dir) {
            Write-Host "Force removing $dir..." -ForegroundColor Gray
            try {
                # 先尝试修改权限
                & icacls $dir /grant Everyone:F /T /C /Q 2>$null
                
                # 强制删除
                & cmd /c "rmdir /s /q `"$dir`"" 2>$null
                
                # 如果还存在，逐个删除文件
                if (Test-Path $dir) {
                    Get-ChildItem -Path $dir -Recurse -Force | ForEach-Object {
                        try {
                            $_.Delete()
                        } catch {
                            # 忽略错误
                        }
                    }
                    Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
                }
                
                Start-Sleep -Milliseconds 500
            } catch {
                Write-Host "Warning: Could not completely remove $dir" -ForegroundColor Yellow
            }
        }
    }
}

function Use-AlternativeOutputDir {
    Write-Host "`nUsing alternative output directory..." -ForegroundColor Yellow
    
    # 修改package.json使用时间戳目录
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $packageJsonPath = "frontend\electron-app\package.json"
    
    if (Test-Path $packageJsonPath) {
        $content = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $content.build.directories.output = "dist-electron-$timestamp"
        $content | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath -Encoding UTF8
        Write-Host "Updated output directory to: dist-electron-$timestamp" -ForegroundColor Green
    }
}

function Build-WithRetry {
    Write-Host "`nStarting build process with retry logic..." -ForegroundColor Green
    
    $maxRetries = 5
    $retryCount = 0
    $success = $false
    
    while ($retryCount -lt $maxRetries -and -not $success) {
        try {
            Write-Host "`n--- Build Attempt $($retryCount + 1) ---" -ForegroundColor Cyan
            
            if ($retryCount -gt 0) {
                Write-Host "Retry $retryCount - Additional cleanup..." -ForegroundColor Yellow
                Force-KillProcesses
                Force-RemoveDirectories
                Start-Sleep -Seconds 3
            }
            
            # Step 1: Python backend
            Write-Host "Building Python backend..." -ForegroundColor Green
            & cmd /c ".venv\Scripts\activate.bat && pyinstaller backend_build.spec --distpath frontend\electron-app\resources --workpath build\pyinstaller --clean"
            if ($LASTEXITCODE -ne 0) {
                throw "Python backend build failed"
            }
            
            # Step 2: Electron frontend
            Write-Host "Building Electron frontend..." -ForegroundColor Green
            Set-Location "frontend\electron-app"
            & npm run build
            if ($LASTEXITCODE -ne 0) {
                Set-Location "..\..\"
                throw "Electron frontend build failed"
            }
            
            # Step 3: Final packaging with extra cleanup
            Write-Host "Final packaging..." -ForegroundColor Green
            
            # 额外的清理步骤
            Force-KillProcesses
            Start-Sleep -Seconds 2
            
            & npm run build:electron
            if ($LASTEXITCODE -eq 0) {
                $success = $true
                Write-Host "Build successful!" -ForegroundColor Green
            } else {
                throw "electron-builder failed"
            }
            
        } catch {
            $retryCount++
            Set-Location "..\..\" -ErrorAction SilentlyContinue
            
            if ($retryCount -lt $maxRetries) {
                Write-Host "Build failed: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "Retrying in 10 seconds..." -ForegroundColor Yellow
                Start-Sleep -Seconds 10
            }
        }
    }
    
    Set-Location "..\..\" -ErrorAction SilentlyContinue
    
    if (-not $success) {
        throw "Build failed after $maxRetries attempts"
    }
}

# Main execution
try {
    Force-KillProcesses
    Force-RemoveDirectories
    
    if ($Force) {
        Use-AlternativeOutputDir
    }
    
    Build-WithRetry
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    # 查找生成的文件
    $outputDirs = Get-ChildItem -Path "frontend\electron-app" -Directory -Name "dist-electron*"
    foreach ($dir in $outputDirs) {
        $setupFile = Get-ChildItem -Path "frontend\electron-app\$dir" -Name "*.exe" | Where-Object { $_ -like "*Setup*" }
        $portableFile = "frontend\electron-app\$dir\win-unpacked\SubTranslate.exe"
        
        if ($setupFile) {
            Write-Host "Installer: frontend\electron-app\$dir\$setupFile" -ForegroundColor Cyan
        }
        if (Test-Path $portableFile) {
            Write-Host "Portable: $portableFile" -ForegroundColor Cyan
        }
    }
    
} catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
