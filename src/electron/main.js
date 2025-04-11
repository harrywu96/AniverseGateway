const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

function startPythonBackend() {
    // 启动 FastAPI 服务
    const pythonPath = path.join(process.resourcesPath, 'backend', 'python.exe');
    const scriptPath = path.join(process.resourcesPath, 'backend', 'main.py');
    
    pythonProcess = spawn(pythonPath, [scriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Backend: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Backend Error: ${data}`);
    });
}

app.whenReady().then(() => {
    createWindow();
    startPythonBackend();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (pythonProcess) {
            pythonProcess.kill();
        }
        app.quit();
    }
});

// 处理文件上传
ipcMain.handle('upload-video', async (event, filePath) => {
    // 通过 HTTP 请求发送到 FastAPI 后端
    const response = await fetch('http://localhost:8000/api/videos/upload-local', {
        method: 'POST',
        body: JSON.stringify({ 
            file_path: filePath,
            auto_extract_subtitles: true
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return await response.json();
}); 