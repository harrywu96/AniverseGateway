# 设置编码和执行环境
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

# 在运行之前先设置控制台代码页为UTF-8
chcp 65001 | Out-Null

# 显示彩色文本简化函数
function Write-Color {
    param (
        [string]$Message = $(throw "需要消息文本"),
        [string]$Color = "White"
    )
    
    Write-Host $Message -ForegroundColor $Color
}

# 显示标题和分隔线
Write-Color "====================================" "Cyan"
Write-Color "    SubTranslate 应用启动脚本" "Cyan" 
Write-Color "====================================" "Cyan"
Write-Color " " "White"

# 检查是否有虚拟环境
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    Write-Color "正在激活Python虚拟环境..." "Yellow"
    & ".\.venv\Scripts\Activate.ps1"
    Write-Color "虚拟环境已激活 ✓" "Green"
} else {
    Write-Color "警告: 未找到Python虚拟环境!" "Red"
    Write-Color "将尝试创建虚拟环境..." "Yellow"
    
    # 检查并安装UV
    if (!(Get-Command uv -ErrorAction SilentlyContinue)) {
        Write-Color "未找到UV包管理器, 请先安装: pip install uv" "Red"
        exit 1
    }
    
    # 创建虚拟环境
    Write-Color "创建虚拟环境..." "Yellow"
    uv venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Color "创建虚拟环境失败!" "Red"
        exit 1
    }
    
    # 激活虚拟环境
    & ".\.venv\Scripts\Activate.ps1"
    Write-Color "虚拟环境已创建并激活 ✓" "Green"
}

# 安装缺失的依赖
Write-Color "检查Python依赖..." "Yellow"
uv pip install click uvicorn
if ($LASTEXITCODE -ne 0) {
    Write-Color "依赖安装失败!" "Red"
} else {
    Write-Color "依赖安装成功 ✓" "Green"
}

# 为Electron应用程序设置环境变量
$env:ELECTRON_FORCE_IS_PACKAGED = $false
$env:NODE_ENV = "development"
$env:CHCP = "65001"

# 启动应用
Write-Color "`n开始启动应用程序..." "Magenta"
Write-Color "编码设置: UTF-8" "DarkGray"
Write-Color "工作目录: $(Get-Location)" "DarkGray"
Write-Color " " "White"

cd ./src
Write-Color "启动pnpm开发服务器..." "Cyan"
pnpm dev 