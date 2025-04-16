# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

Write-Host "开始修复 Node.js 类型声明冲突..." -ForegroundColor Green

# 进入src目录
cd src

# 记录当前版本的 @types/node
$nodeTypesVersion = "18.19.86"
Write-Host "将使用 @types/node 版本 $nodeTypesVersion" -ForegroundColor Cyan

# 删除所有旧的 node_modules
Write-Host "清理 node_modules..." -ForegroundColor Yellow
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules
}

# 重新安装依赖
Write-Host "正在重新安装依赖..." -ForegroundColor Yellow
pnpm install

# 安装指定版本的 @types/node 作为开发依赖
Write-Host "安装统一版本的 @types/node..." -ForegroundColor Yellow
pnpm add -D @types/node@$nodeTypesVersion --ignore-workspace-root-check

# 如果有工作区配置，对所有工作区包重置 @types/node 版本
Write-Host "对所有工作区包设置统一版本的 @types/node..." -ForegroundColor Yellow
pnpm -r exec -- pnpm add -D @types/node@$nodeTypesVersion

# 清理 pnpm 缓存中的类型声明包
Write-Host "清理 pnpm 缓存中的类型声明包..." -ForegroundColor Yellow
pnpm store prune

# 回到项目根目录
cd ..

Write-Host "修复完成！请重新运行 pnpm dev 命令" -ForegroundColor Green 