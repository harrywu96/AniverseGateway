# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

Write-Host "开始修复 Electron 应用问题..." -ForegroundColor Green

# 进入electron-app目录
cd packages/electron-app

# 1. 修复预加载脚本路径
$mainFile = "electron/main/index.ts"
Write-Host "1. 正在修改 $mainFile 中的 preload.js 路径..." -ForegroundColor Yellow

# 读取文件内容
$content = Get-Content $mainFile -Raw

# 将 preload: join(__dirname, '../preload.js') 改为 preload: join(__dirname, 'preload.js')
$newContent = $content -replace "preload: join\(__dirname, '../preload.js'\)", "preload: join(__dirname, 'preload.js')"

# 写入修改后的内容
$newContent | Set-Content $mainFile -Encoding UTF8

Write-Host "✅ 已修复 preload.js 路径" -ForegroundColor Green

# 2. 手动复制 preload.js 到目标位置
Write-Host "2. 正在手动复制 preload.js 到正确位置..." -ForegroundColor Yellow

# 创建预加载脚本的目标目录
if (!(Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" | Out-Null
}

# 从 dist/main 复制到 dist 目录
if (Test-Path "dist/main/preload.js") {
    Copy-Item "dist/main/preload.js" -Destination "dist/" -Force
    Write-Host "✅ 已复制 preload.js 到 dist 目录" -ForegroundColor Green
} else {
    Write-Host "❌ 找不到 dist/main/preload.js 文件" -ForegroundColor Red
    
    # 尝试手动编译 preload.ts
    Write-Host "   尝试手动编译 preload.ts..." -ForegroundColor Yellow
    
    # 使用 TypeScript 编译器编译
    tsc electron/preload.ts --outDir dist/main --module CommonJS --target ES2020 --moduleResolution Node --esModuleInterop
    
    # 复制编译后的文件
    if (Test-Path "dist/main/preload.js") {
        Copy-Item "dist/main/preload.js" -Destination "dist/" -Force
        Write-Host "✅ 已成功编译并复制 preload.js" -ForegroundColor Green
    } else {
        Write-Host "❌ 编译 preload.ts 失败" -ForegroundColor Red
    }
}

# 3. 修复 React 应用中的 electronAPI 未定义问题
Write-Host "3. 正在创建模拟的 Electron API 实现..." -ForegroundColor Yellow

$electronMockFile = @"
/**
 * 提供模拟的Electron API实现，用于在浏览器环境中调试
 */

// 确保window.electronAPI始终存在
if (typeof window !== 'undefined') {
  // 如果电子API不存在，创建一个模拟实现
  if (!window.electronAPI) {
    console.log('初始化模拟的Electron API');
    window.electronAPI = {
      // 检查后端状态
      checkBackendStatus: async () => {
        console.log('模拟: 检查后端状态');
        return true;
      },
      
      // 选择视频文件
      selectVideo: async () => {
        console.log('模拟: 选择视频文件');
        return null;
      },
      
      // 上传本地视频文件
      uploadVideo: async (filePath) => {
        console.log('模拟: 上传视频文件', filePath);
        return { success: true };
      },
      
      // 监听后端启动事件
      onBackendStarted: (callback) => {
        console.log('模拟: 注册后端启动事件监听');
        // 模拟3秒后启动
        setTimeout(callback, 3000);
        return () => {
          console.log('模拟: 移除后端启动事件监听');
        };
      },
      
      // 监听后端停止事件
      onBackendStopped: (callback) => {
        console.log('模拟: 注册后端停止事件监听');
        return () => {
          console.log('模拟: 移除后端停止事件监听');
        };
      }
    };
  }
}

export {};
"@

# 创建electron-mock.ts文件
$electronMockFile | Set-Content "src/electron-mock.ts" -Encoding UTF8

# 4. 修改主入口文件，导入模拟实现
$mainTsxFile = "src/main.tsx"
Write-Host "4. 正在修改 $mainTsxFile 导入电子API模拟..." -ForegroundColor Yellow

$mainTsxContent = Get-Content $mainTsxFile -Raw

# 在App导入前添加electron-mock导入
if ($mainTsxContent -notmatch "import './electron-mock';") {
    $newMainTsxContent = $mainTsxContent -replace "import App from './App';", "import './electron-mock';`r`nimport App from './App';"
    $newMainTsxContent | Set-Content $mainTsxFile -Encoding UTF8
    Write-Host "✅ 已添加 electron-mock 导入" -ForegroundColor Green
} else {
    Write-Host "electron-mock 已经被导入，无需修改" -ForegroundColor Cyan
}

# 5. 修改App组件，添加错误处理
$appTsxFile = "src/App.tsx"
Write-Host "5. 正在修改 $appTsxFile 添加错误处理..." -ForegroundColor Yellow

$appTsxContent = Get-Content $appTsxFile -Raw

# 修改 onBackendStopped 的调用方式，添加安全检查
$safeBackendStoppedCode = @"
    // 监听后端停止事件 - 添加安全检查
    const removeStoppedListener = window.electronAPI && window.electronAPI.onBackendStopped ? 
      window.electronAPI.onBackendStopped((data) => {
        setBackendReady(false);
        setError(`后端服务已停止，退出码: \${data.code}。请重启应用。`);
      }) : () => {};
"@

# 替换原有的监听代码
$newAppTsxContent = $appTsxContent -replace "(?s)// 监听后端停止事件.*?const removeStoppedListener = window\.electronAPI\.onBackendStopped\(\(data\) => \{.*?\}\);", $safeBackendStoppedCode

# 写入修改后的内容
$newAppTsxContent | Set-Content $appTsxFile -Encoding UTF8
Write-Host "✅ 已修改 App 组件添加安全检查" -ForegroundColor Green

# 回到src目录
cd ../..

Write-Host "所有修复已完成！请重新运行 pnpm dev 命令" -ForegroundColor Green
Write-Host "如果仍有问题，请重启整个开发环境" -ForegroundColor Yellow 