import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';

// 定义全局变量
let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcessWithoutNullStreams | null = null;
let isBackendStarted = false;

// 是否是开发环境
const isDev = process.env.NODE_ENV === 'development';

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // 根据环境加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备好后显示，避免白屏
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 窗口关闭时释放引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 启动Python后端服务
 */
function startPythonBackend() {
  try {
    // 计算Python后端路径
    let pythonPath: string;
    let scriptPath: string;

    if (isDev) {
      // 开发环境路径
      // 尝试使用虚拟环境中的Python
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        // 首先尝试查找.venv环境
        const venvPythonPath = join(process.cwd(), '..', '..', '.venv', 'Scripts', 'python.exe');
        if (fs.existsSync(venvPythonPath)) {
          console.log(`使用虚拟环境Python: ${venvPythonPath}`);
          pythonPath = venvPythonPath;
        } else {
          console.log('未找到虚拟环境，使用系统Python');
          pythonPath = 'python';
        }
      } else {
        pythonPath = 'python';
      }
      
      // 确保脚本路径是绝对路径
      const possiblePaths = [
        join(process.cwd(), '..', '..', 'run_api_server.py'),
        join(__dirname, '../../../../run_api_server.py'),
        join(process.cwd(), 'run_api_server.py')
      ];
      
      console.log('搜索API服务器脚本路径...');
      console.log(`当前工作目录: ${process.cwd()}`);
      
      scriptPath = '';
      for (const path of possiblePaths) {
        console.log(`检查路径: ${path}`);
        if (fs.existsSync(path)) {
          scriptPath = path;
          console.log(`找到API服务器脚本: ${scriptPath}`);
          break;
        }
      }
      
      if (!scriptPath) {
        console.error('错误: 无法找到API服务器脚本');
        scriptPath = join(__dirname, '../../../../run_api_server.py');
        console.log(`使用默认路径: ${scriptPath}`);
      }
    } else {
      // 生产环境路径
      const resourcesPath = process.resourcesPath;
      pythonPath = join(resourcesPath, 'backend', 'python.exe');
      scriptPath = join(resourcesPath, 'backend', 'run_api_server.py');
    }

    console.log('启动Python后端...');
    console.log(`Python路径: ${pythonPath}`);
    console.log(`脚本路径: ${scriptPath}`);

    // 设置环境变量确保UTF-8编码
    const env: NodeJS.ProcessEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };
    
    // 启动Python进程 - 使用低级端口以避免权限问题
    const port = process.env.API_PORT || '8000';
    env.API_PORT = port;
    
    // 启动Python进程
    pythonProcess = spawn(pythonPath, [scriptPath], { 
      env,
      windowsHide: false // 确保在Windows上显示控制台窗口以便调试
    });

    let startupTimeout = setTimeout(() => {
      if (!isBackendStarted) {
        console.error('后端启动超时');
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', { 
            message: '后端启动超时，请检查日志以获取详细信息'
          });
        }
      }
    }, 30000); // 30秒超时

    // 监听标准输出
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python后端输出: ${data}`);
      
      // 检测后端是否已经启动
      if (data.toString().includes('Application startup complete')) {
        isBackendStarted = true;
        clearTimeout(startupTimeout);
        mainWindow?.webContents.send('backend-started');
      }
    });

    // 监听错误输出
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python后端错误: ${data}`);
      
      // 如果检测到端口已被占用
      if (data.toString().includes('address already in use') || 
          data.toString().includes('Address already in use')) {
        console.error(`错误: 端口${port}已被占用，请确保没有其他API服务器实例正在运行`);
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', {
            message: `端口${port}已被占用，请确保没有其他API服务器实例正在运行`
          });
        }
      }
    });

    // 进程退出时的处理
    pythonProcess.on('close', (code) => {
      console.log(`Python后端已退出，退出码: ${code}`);
      clearTimeout(startupTimeout);
      pythonProcess = null;
      isBackendStarted = false;
      
      if (mainWindow) {
        mainWindow.webContents.send('backend-stopped', { code });
      }
    });
    
    // 处理错误
    pythonProcess.on('error', (err) => {
      console.error(`启动Python进程时出错: ${err.message}`);
      clearTimeout(startupTimeout);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', { 
          message: `启动Python进程失败: ${err.message}` 
        });
      }
    });
  } catch (error) {
    console.error('启动Python后端时出错', error);
    if (mainWindow) {
      mainWindow.webContents.send('backend-error', { 
        message: `启动Python后端出错: ${error.message}` 
      });
    }
  }
}

/**
 * 注册IPC处理程序
 */
function registerIpcHandlers() {
  // 选择视频文件
  ipcMain.handle('select-video', async () => {
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });

  // 上传本地视频文件
  ipcMain.handle('upload-video', async (_event, filePath) => {
    try {
      const port = process.env.API_PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/videos/upload-local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_path: filePath, auto_extract_subtitles: true }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('上传视频时出错', error);
      return { success: false, error: error.message };
    }
  });

  // 检查后端状态
  ipcMain.handle('check-backend-status', () => {
    return isBackendStarted;
  });
  
  // 尝试重启后端
  ipcMain.handle('restart-backend', () => {
    try {
      if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
      }
      startPythonBackend();
      return { success: true };
    } catch (error) {
      console.error('重启后端时出错', error);
      return { success: false, error: error.message };
    }
  });
}

// 应用启动完成时
app.whenReady().then(() => {
  createWindow();
  startPythonBackend();
  registerIpcHandlers();

  // macOS特性，点击dock图标重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用，macOS除外
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 关闭Python后端
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }

    app.quit();
  }
});

// 应用退出前清理资源
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}); 
