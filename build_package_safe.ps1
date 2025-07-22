# SubTranslate Safe Packaging Script
# PowerShell version with better error handling

param(
    [switch]$Force,
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Continue"
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SubTranslate Safe Packaging Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Stop-RelatedProcesses {
    Write-Host "`n[0/5] Stopping related processes..." -ForegroundColor Yellow
    
    $processes = @("electron", "SubTranslate", "backend", "node")
    foreach ($proc in $processes) {
        try {
            $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
            if ($running) {
                Write-Host "Stopping $proc processes..." -ForegroundColor Gray
                Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
        } catch {
            # Ignore errors
        }
    }
    
    Write-Host "Waiting for processes to terminate..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

function Remove-BuildDirectories {
    Write-Host "Cleaning build directories..." -ForegroundColor Gray
    
    $directories = @(
        "frontend\electron-app\dist-electron",
        "frontend\electron-app\dist",
        "frontend\electron-app\resources",
        "build\pyinstaller"
    )
    
    foreach ($dir in $directories) {
        if (Test-Path $dir) {
            Write-Host "Removing $dir..." -ForegroundColor Gray
            try {
                Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            } catch {
                Write-Host "Warning: Could not remove $dir completely" -ForegroundColor Yellow
            }
        }
    }
}

function Test-VirtualEnvironment {
    if (-not (Test-Path ".venv\Scripts\activate.bat")) {
        Write-Host "Error: Python virtual environment not found" -ForegroundColor Red
        Write-Host "Please run: python -m venv .venv" -ForegroundColor Yellow
        exit 1
    }
}

function Test-BackendSpec {
    if (-not (Test-Path "backend_build.spec")) {
        Write-Host "Error: backend_build.spec not found" -ForegroundColor Red
        exit 1
    }
}

function Test-FrontendPackage {
    if (-not (Test-Path "frontend\electron-app\package.json")) {
        Write-Host "Error: frontend\electron-app\package.json not found" -ForegroundColor Red
        exit 1
    }
}

# Main execution
try {
    if (-not $SkipCleanup) {
        Stop-RelatedProcesses
        Remove-BuildDirectories
    }
    
    # Step 1: Activate Python environment
    Write-Host "`n[1/5] Activating Python virtual environment..." -ForegroundColor Green
    Test-VirtualEnvironment
    
    # Step 2: Package Python backend
    Write-Host "`n[2/5] Packaging Python backend with PyInstaller..." -ForegroundColor Green
    Test-BackendSpec
    
    & cmd /c ".venv\Scripts\activate.bat && pyinstaller backend_build.spec --distpath frontend\electron-app\resources --workpath build\pyinstaller --clean"
    if ($LASTEXITCODE -ne 0) {
        throw "Python backend packaging failed"
    }
    
    # Step 3: Build Electron frontend
    Write-Host "`n[3/5] Building Electron frontend..." -ForegroundColor Green
    Test-FrontendPackage
    
    Set-Location "frontend\electron-app"
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Set-Location "..\..\"
        throw "Electron frontend build failed"
    }
    
    # Step 4: Clean before final packaging
    Write-Host "`n[4/5] Preparing for final packaging..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    
    # Step 5: Package complete application
    Write-Host "`n[5/5] Packaging complete application with electron-builder..." -ForegroundColor Green
    
    $retryCount = 0
    $maxRetries = 3
    $success = $false
    
    while ($retryCount -lt $maxRetries -and -not $success) {
        try {
            if ($retryCount -gt 0) {
                Write-Host "Retry attempt $retryCount..." -ForegroundColor Yellow
                Stop-RelatedProcesses
                if (Test-Path "dist-electron") {
                    Remove-Item -Path "dist-electron" -Recurse -Force -ErrorAction SilentlyContinue
                }
                Start-Sleep -Seconds 3
            }
            
            & npm run build:electron
            if ($LASTEXITCODE -eq 0) {
                $success = $true
            } else {
                throw "electron-builder failed"
            }
        } catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Host "Packaging failed, retrying in 5 seconds..." -ForegroundColor Yellow
                Start-Sleep -Seconds 5
            }
        }
    }
    
    Set-Location "..\..\"
    
    if (-not $success) {
        throw "Electron application packaging failed after $maxRetries attempts"
    }
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Packaging completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Installer: frontend\electron-app\dist-electron\SubTranslate Setup 1.0.0.exe" -ForegroundColor Cyan
    Write-Host "Portable: frontend\electron-app\dist-electron\win-unpacked\SubTranslate.exe" -ForegroundColor Cyan
    
} catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Packaging failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
