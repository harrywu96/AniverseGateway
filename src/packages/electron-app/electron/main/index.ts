import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// 瀹氫箟鍏ㄥ眬鍙橀噺
let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcessWithoutNullStreams | null = null;
let isBackendStarted = false;

// 鏄惁鏄紑鍙戠幆澧?
const isDev = process.env.NODE_ENV === 'development';

/**
 * 鍒涘缓涓荤獥鍙?
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

  // 鏍规嵁鐜鍔犺浇椤甸潰
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 绐楀彛鍑嗗濂藉悗鏄剧ず锛岄伩鍏嶇櫧灞?
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 绐楀彛鍏抽棴鏃堕噴鏀惧紩鐢?
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 鍚姩Python鍚庣鏈嶅姟
 */
function startPythonBackend() {
  try {
    // 璁＄畻Python鍚庣璺緞
    let pythonPath: string;
    let scriptPath: string;

    if (isDev) {
      // 寮€鍙戠幆澧冭矾寰?
      pythonPath = 'python';
      scriptPath = join(__dirname, '../../../../run_api_server.py');
    } else {
      // 鐢熶骇鐜璺緞
      const resourcesPath = process.resourcesPath;
      pythonPath = join(resourcesPath, 'backend', 'python.exe');
      scriptPath = join(resourcesPath, 'backend', 'run_api_server.py');
    }

    console.log('鍚姩Python鍚庣...');
    console.log(`Python璺緞: ${pythonPath}`);
    console.log(`鑴氭湰璺緞: ${scriptPath}`);

    // 鍚姩Python杩涚▼
    pythonProcess = spawn(pythonPath, [scriptPath]);

    // 鐩戝惉鏍囧噯杈撳嚭
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python鍚庣杈撳嚭: ${data}`);
      
      // 妫€娴嬪悗绔槸鍚﹀凡缁忓惎鍔?
      if (data.toString().includes('Application startup complete')) {
        isBackendStarted = true;
        mainWindow?.webContents.send('backend-started');
      }
    });

    // 鐩戝惉閿欒杈撳嚭
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python鍚庣閿欒: ${data}`);
    });

    // 杩涚▼閫€鍑烘椂鐨勫鐞?
    pythonProcess.on('close', (code) => {
      console.log(`Python鍚庣宸查€€鍑猴紝閫€鍑虹爜: ${code}`);
      pythonProcess = null;
      isBackendStarted = false;
      
      if (mainWindow) {
        mainWindow.webContents.send('backend-stopped', { code });
      }
    });
  } catch (error) {
    console.error('鍚姩Python鍚庣鏃跺嚭閿?', error);
  }
}

/**
 * 娉ㄥ唽IPC澶勭悊绋嬪簭
 */
function registerIpcHandlers() {
  // 閫夋嫨瑙嗛鏂囦欢
  ipcMain.handle('select-video', async () => {
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '瑙嗛鏂囦欢', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });

  // 涓婁紶鏈湴瑙嗛鏂囦欢
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
      console.error('涓婁紶瑙嗛鏃跺嚭閿?', error);
      return { success: false, error: error.message };
    }
  });

  // 妫€鏌ュ悗绔姸鎬?
  ipcMain.handle('check-backend-status', () => {
    return isBackendStarted;
  });
}

// 搴旂敤鍚姩瀹屾垚鏃?
app.whenReady().then(() => {
  createWindow();
  startPythonBackend();
  registerIpcHandlers();

  // macOS鐗规€э紝鐐瑰嚮dock鍥炬爣閲嶆柊鍒涘缓绐楀彛
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 鎵€鏈夌獥鍙ｅ叧闂椂閫€鍑哄簲鐢紝macOS闄ゅ
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 鍏抽棴Python鍚庣
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }

    app.quit();
  }
});

// 搴旂敤閫€鍑哄墠娓呯悊璧勬簮
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}); 
