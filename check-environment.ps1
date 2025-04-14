# check-environment.ps1
# 脚本用于检查项目环境和修复常见问题

# 输出彩色提示信息
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "正在检查项目环境..."

# 设置执行策略
Write-ColorOutput Yellow "1. 设置PowerShell执行策略为RemoteSigned..."
try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
    Write-ColorOutput Green "✓ 执行策略设置成功"
} catch {
    Write-ColorOutput Red "✗ 执行策略设置失败: $_"
}

# 检查虚拟环境
Write-ColorOutput Yellow "2. 检查虚拟环境..."
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    Write-ColorOutput Green "✓ 虚拟环境已存在"
    try {
        .\.venv\Scripts\Activate.ps1
        Write-ColorOutput Green "✓ 虚拟环境已激活"
    } catch {
        Write-ColorOutput Red "✗ 虚拟环境激活失败: $_"
        exit 1
    }
} else {
    Write-ColorOutput Yellow "虚拟环境不存在，正在创建..."
    try {
        uv venv .venv
        .\.venv\Scripts\Activate.ps1
        Write-ColorOutput Green "✓ 虚拟环境创建并激活成功"
    } catch {
        Write-ColorOutput Red "✗ 虚拟环境创建失败: $_"
        Write-ColorOutput Yellow "提示: 请确保已安装 UV 工具。如未安装，请访问 https://github.com/astral-sh/uv 查看安装指南。"
        exit 1
    }
}

# 修复 pyproject.toml 中的 UV 配置问题
Write-ColorOutput Yellow "3. 检查 pyproject.toml 文件中的 UV 配置..."
$pyprojectContent = Get-Content -Path "pyproject.toml" -Raw -ErrorAction SilentlyContinue
if ($pyprojectContent -match "pip-compile-options\s*=") {
    Write-ColorOutput Yellow "发现不兼容的 UV 配置选项，正在修复..."
    $pyprojectContent = $pyprojectContent -replace '(?ms)(\[tool\.uv\]\s*)pip-compile-options\s*=\s*\[[^\]]*\]', '$1index-url = "https://pypi.org/simple/"'
    Set-Content -Path "pyproject.toml" -Value $pyprojectContent
    Write-ColorOutput Green "✓ pyproject.toml 文件已修复"
} else {
    Write-ColorOutput Green "✓ pyproject.toml 文件配置正常"
}

# 检查并修复 requirements.txt 中的火山引擎SDK包名
Write-ColorOutput Yellow "4. 检查 requirements.txt 中的火山引擎SDK包名..."
$requirementsContent = Get-Content -Path "requirements.txt" -Raw -ErrorAction SilentlyContinue
if ($requirementsContent -match "volc-sdk-python") {
    Write-ColorOutput Yellow "发现错误的火山引擎SDK包名，正在修复..."
    $requirementsContent = $requirementsContent -replace 'volc-sdk-python([>=<][^#\r\n]*)', 'volcengine$1'
    Set-Content -Path "requirements.txt" -Value $requirementsContent
    Write-ColorOutput Green "✓ requirements.txt 文件已修复"
} else {
    Write-ColorOutput Green "✓ requirements.txt 文件配置正常"
}

# 同步依赖
Write-ColorOutput Yellow "5. 正在同步项目依赖..."
try {
    Write-ColorOutput Cyan "执行: uv pip sync requirements.txt"
    uv pip sync requirements.txt
    Write-ColorOutput Green "✓ 依赖同步成功"
} catch {
    Write-ColorOutput Red "✗ 依赖同步失败: $_"
    
    # 特殊处理火山引擎SDK
    Write-ColorOutput Yellow "正在尝试安装火山引擎SDK..."
    try {
        uv pip install volcengine
        Write-ColorOutput Green "✓ 火山引擎SDK安装成功"
    } catch {
        Write-ColorOutput Red "✗ 火山引擎SDK安装失败: $_"
        Write-ColorOutput Yellow "提示: 可以尝试执行 'pip install volcengine' 手动安装"
    }
}

# 环境检查完成
Write-ColorOutput Green "`n环境检查和修复完成!"
Write-ColorOutput Cyan "虚拟环境已激活，可以开始工作了。"
Write-ColorOutput Cyan "如需使用火山引擎SDK，请确保设置了正确的访问凭证。"
Write-ColorOutput Cyan "例如设置环境变量:"
Write-ColorOutput Yellow '$env:VOLC_ACCESSKEY="您的AK"'
Write-ColorOutput Yellow '$env:VOLC_SECRETKEY="您的SK"'
Write-ColorOutput Yellow '$env:VOLC_REGION="cn-beijing"' 