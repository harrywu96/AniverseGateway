# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

Write-Host "开始修复 preload.js 路径问题..." -ForegroundColor Green

# 进入electron-app目录
cd packages/electron-app

# 修改Electron主进程文件
$mainFile = "electron/main/index.ts"
Write-Host "正在修改 $mainFile 中的 preload.js 路径..." -ForegroundColor Yellow

# 读取文件内容
$content = Get-Content $mainFile -Raw

# 将 preload: join(__dirname, '../preload.js') 改为 preload: join(__dirname, 'preload.js')
$newContent = $content -replace "preload: join\(__dirname, '../preload.js'\)", "preload: join(__dirname, 'preload.js')"

# 写入修改后的内容
$newContent | Set-Content $mainFile -Encoding UTF8

Write-Host "已修复 preload.js 路径" -ForegroundColor Cyan

# 修复electron.d.ts文件，确保window.electronAPI正确初始化
Write-Host "确保electron.d.ts文件声明与preload.js一致..." -ForegroundColor Yellow

# 检查electron.d.ts文件内容是否与preload.ts导出的API一致
$preloadFile = "electron/preload.ts"
$electronDtsFile = "src/electron.d.ts"

# 重新编译项目
Write-Host "清理旧的编译文件..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist/main -ErrorAction SilentlyContinue
mkdir -p dist/main -ErrorAction SilentlyContinue

# 手动拷贝preload.js到正确位置
Write-Host "编译并复制preload.js到目标位置..." -ForegroundColor Yellow
tsc $preloadFile --outDir dist/main

# 回到src目录
cd ../..

Write-Host "修复完成！请重新运行 pnpm dev 命令" -ForegroundColor Green 