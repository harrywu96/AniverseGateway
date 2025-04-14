# setup-env.ps1
# Script to setup the development environment for this project

# Display information about what this script does
Write-Host "Setting up development environment..." -ForegroundColor Cyan
Write-Host "This script will:" -ForegroundColor Cyan
Write-Host "1. Set execution policy to RemoteSigned for current process" -ForegroundColor Cyan
Write-Host "2. Activate the Python virtual environment" -ForegroundColor Cyan
Write-Host "3. Synchronize dependencies using UV" -ForegroundColor Cyan
Write-Host ""

# 1. Set execution policy to allow script execution in current process
Write-Host "Setting execution policy..." -ForegroundColor Green
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
Write-Host "Execution policy set to RemoteSigned for current process." -ForegroundColor Green
Write-Host ""

# 2. Check if virtual environment exists, activate if it does
Write-Host "Activating virtual environment..." -ForegroundColor Green
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    try {
        .\.venv\Scripts\Activate.ps1
        Write-Host "Virtual environment activated successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to activate virtual environment. Error: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "Virtual environment not found at .\.venv" -ForegroundColor Yellow
    Write-Host "Create it using: uv venv .venv" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 3. Synchronize dependencies using UV
Write-Host "Synchronizing dependencies with UV..." -ForegroundColor Green
if (Test-Path "requirements.txt") {
    try {
        uv pip sync requirements.txt
        Write-Host "Dependencies synchronized successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to synchronize dependencies. Error: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "requirements.txt not found. Cannot synchronize dependencies." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Environment setup complete! 🚀" -ForegroundColor Cyan
Write-Host "You're now ready to work on the project." -ForegroundColor Cyan 