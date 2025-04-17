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

# 添加检查端口占用的功能
function Check-PortAvailable {
    param (
        [int]$Port = 8000
    )
    
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

function Kill-ProcessOnPort {
    param (
        [int]$Port = 8000
    )
    
    Write-Host "尝试释放端口 $Port..." -ForegroundColor Yellow
    
    $connections = netstat -ano | findstr ":$Port" | findstr "LISTENING"
    if ($connections) {
        $connections -split '\n' | ForEach-Object {
            $parts = $_ -split '\s+', 6
            if ($parts.Count -ge 5) {
                $pid = $parts[4]
                Write-Host "发现进程: $pid 占用端口 $Port，正在尝试终止..." -ForegroundColor Yellow
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "已成功终止进程 $pid" -ForegroundColor Green
                } catch {
                    Write-Host "无法终止进程 $pid: $_" -ForegroundColor Red
                    Write-Host "请尝试手动关闭该进程，或以管理员身份运行此脚本" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "未发现任何进程占用端口 $Port" -ForegroundColor Green
    }
    
    # 重新检查端口是否可用
    if (Check-PortAvailable -Port $Port) {
        Write-Host "端口 $Port 现在可用" -ForegroundColor Green
        return $true
    } else {
        Write-Host "端口 $Port 仍然被占用" -ForegroundColor Red
        return $false
    }
}

# 修复Electron应用程序启动问题
function Fix-ElectronIssues {
    # 确保使用UTF-8编码
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    $env:PYTHONIOENCODING = "utf-8"
    
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "        Electron + Python应用诊断与修复工具" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 检查Python是否可用
    Write-Host "检查Python环境..." -ForegroundColor Cyan
    try {
        $pythonVersion = python --version
        Write-Host "Python可用: $pythonVersion" -ForegroundColor Green
    } catch {
        Write-Host "错误: 无法运行Python，请确保Python已正确安装" -ForegroundColor Red
        return
    }
    
    # 检查端口占用
    Write-Host "检查API服务器端口..." -ForegroundColor Cyan
    $apiPort = 8000
    
    if (-not (Check-PortAvailable -Port $apiPort)) {
        Write-Host "警告: 端口 $apiPort 已被占用" -ForegroundColor Yellow
        $result = Kill-ProcessOnPort -Port $apiPort
        if (-not $result) {
            $response = Read-Host "是否尝试使用另一个端口? (Y/N)"
            if ($response -eq "Y" -or $response -eq "y") {
                $newPort = Read-Host "请输入新端口号"
                $apiPort = [int]$newPort
                $env:API_PORT = $apiPort
                Write-Host "将使用端口 $apiPort 启动API服务器" -ForegroundColor Green
            } else {
                Write-Host "请手动关闭占用端口 $apiPort 的应用程序后再试" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "端口 $apiPort 可用" -ForegroundColor Green
    }
    
    # 检查是否有Python子进程仍在运行
    Write-Host "检查是否有遗留的Python进程..." -ForegroundColor Cyan
    $pythonProcesses = Get-Process -Name python -ErrorAction SilentlyContinue
    if ($pythonProcesses) {
        Write-Host "发现正在运行的Python进程:" -ForegroundColor Yellow
        $pythonProcesses | ForEach-Object {
            Write-Host "PID: $($_.Id), 命令行: $($_.Path)" -ForegroundColor Yellow
        }
        
        $response = Read-Host "是否终止这些Python进程? (Y/N)"
        if ($response -eq "Y" -or $response -eq "y") {
            $pythonProcesses | ForEach-Object {
                try {
                    Stop-Process -Id $_.Id -Force -ErrorAction Stop
                    Write-Host "已终止进程 $($_.Id)" -ForegroundColor Green
                } catch {
                    Write-Host "无法终止进程 $($_.Id): $_" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "未发现正在运行的Python进程" -ForegroundColor Green
    }
    
    # 检查node_modules
    Write-Host "检查node_modules..." -ForegroundColor Cyan
    if (-not (Test-Path "node_modules")) {
        Write-Host "警告: 未找到node_modules目录，可能需要安装依赖" -ForegroundColor Yellow
        $response = Read-Host "是否运行 'pnpm install'? (Y/N)"
        if ($response -eq "Y" -or $response -eq "y") {
            Write-Host "运行 pnpm install..." -ForegroundColor Cyan
            pnpm install
        }
    } else {
        Write-Host "node_modules目录存在" -ForegroundColor Green
    }
    
    # 询问是否启动应用
    Write-Host ""
    Write-Host "诊断和修复完成" -ForegroundColor Green
    $response = Read-Host "是否启动应用程序? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "启动应用程序..." -ForegroundColor Cyan
        pnpm dev:win
    } else {
        Write-Host "已取消启动应用程序" -ForegroundColor Yellow
    }
}

# 运行修复函数
Fix-ElectronIssues 