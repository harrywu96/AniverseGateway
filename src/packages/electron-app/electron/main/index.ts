import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

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
      nodeIntegration: true,
      contextIsolation: false,
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
      pythonPath = 'python';
      scriptPath = join(__dirname, '../../../../run_api_server.py');
    } else {
      // 生产环境路径
      const resourcesPath = process.resourcesPath;
      pythonPath = join(resourcesPath, 'backend', 'python.exe');
      scriptPath = join(resourcesPath, 'backend', 'run_api_server.py');
    }

    console.log('启动Python后端...');
    console.log(`Python路径: ${pythonPath}`);
    console.log(`脚本路径: ${scriptPath}`);

    // 启动Python进程
    pythonProcess = spawn(pythonPath, [scriptPath]);

    // 监听标准输出
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python后端输出: ${data}`);
      
      // 检测后端是否已经启动
      if (data.toString().includes('Application startup complete')) {
        isBackendStarted = true;
        mainWindow?.webContents.send('backend-started');
      }
    });

    // 监听错误输出
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python后端错误: ${data}`);
    });

    // 进程退出时的处理
    pythonProcess.on('close', (code) => {
      console.log(`Python后端已退出，退出码: ${code}`);
      pythonProcess = null;
      isBackendStarted = false;
      
      if (mainWindow) {
        mainWindow.webContents.send('backend-stopped', { code });
      }
    });
  } catch (error) {
    console.error('启动Python后端时出错:', error);
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
      const response = await fetch('http://127.0.0.1:8000/api/videos/upload-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_path: filePath, auto_extract_subtitles: true }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('上传视频时出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 检查后端状态
  ipcMain.handle('check-backend-status', () => {
    return isBackendStarted;
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