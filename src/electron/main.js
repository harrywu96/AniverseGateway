const { 
    app, 
    BrowserWindow, 
    ipcMain, 
    dialog 
} = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

let mainWindow;
let pythonProcess;
let appSettings = {};

// 设置文件路径
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// 加载应用设置
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            appSettings = JSON.parse(data);
            console.log('已加载设置:', appSettings);
        }
    } catch (error) {
        console.error('加载设置出错:', error);
    }
}

// 保存应用设置
function saveSettings(settings) {
    try {
        // 合并现有设置和新设置
        appSettings = { ...appSettings, ...settings };
        
        // 确保目录存在
        if (!fs.existsSync(path.dirname(settingsPath))) {
            fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        }
        
        // 写入文件
        fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
        console.log('设置已保存:', appSettings);
    } catch (error) {
        console.error('保存设置出错:', error);
        throw error;
    }
}

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
    
    // 开发环境下开启开发者工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

function startPythonBackend() {
    // 启动 FastAPI 服务
    const pythonPath = process.env.NODE_ENV === 'development' 
        ? 'python' 
        : path.join(process.resourcesPath, 'backend', 'python.exe');
    const scriptPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '..', 'run_api_server.py')
        : path.join(process.resourcesPath, 'backend', 'main.py');
    
    console.log('启动Python后端:', pythonPath, scriptPath);
    
    pythonProcess = spawn(pythonPath, [scriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Backend: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Backend Error: ${data}`);
    });
}

app.whenReady().then(() => {
    // 加载设置
    loadSettings();
    
    // 创建窗口
    createWindow();
    
    // 启动后端
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

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// 处理设置相关的IPC消息
ipcMain.handle('get-settings', (event) => {
    return appSettings;
});

ipcMain.handle('save-settings', (event, settings) => {
    try {
        saveSettings(settings);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 处理文件选择对话框
ipcMain.handle('open-directory-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        ...options
    });
});

ipcMain.handle('open-file-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        ...options
    });
});

// 验证模型
ipcMain.handle('validate-model', async (event, modelPath) => {
    try {
        const response = await fetch('http://localhost:8000/api/speech-to-text/validate-model', {
            method: 'POST',
            body: JSON.stringify({ model_path: modelPath }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error('验证模型出错:', error);
        return {
            valid: false,
            message: `请求失败: ${error.message}`
        };
    }
});

// 处理媒体文件处理
ipcMain.handle('process-media', async (event, filePath, options) => {
    try {
        // 构建请求参数
        const requestParams = {
            file_path: filePath,
            engine: options.engine || 'default'
        };
        
        // 如果使用Faster-Whisper，添加相关配置
        if (options.engine === 'faster-whisper') {
            requestParams.faster_whisper_options = {
                model_path: appSettings.modelPath,
                language: options.language,
                use_config_file: options.useConfig,
                config_path: options.useConfig ? appSettings.configPath : null,
                device: appSettings.device || 'auto',
                compute_type: appSettings.computeType || 'auto'
            };
        }
        
        console.log('发送处理请求:', requestParams);
        
        // 发送到后端API
        const response = await fetch('http://localhost:8000/api/speech-to-text/process', {
            method: 'POST',
            body: JSON.stringify(requestParams),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error('处理媒体文件出错:', error);
        return {
            success: false,
            message: `处理失败: ${error.message}`
        };
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