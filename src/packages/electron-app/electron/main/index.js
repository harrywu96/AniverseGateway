var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn } from 'child_process';
// 定义全局变量
var mainWindow = null;
var pythonProcess = null;
var isBackendStarted = false;
// 是否是开发环境
var isDev = process.env.NODE_ENV === 'development';
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
            preload: join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });
    // 根据环境加载页面
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
    // 窗口准备好后显示，避免白屏
    mainWindow.on('ready-to-show', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
    });
    // 窗口关闭时释放引用
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
/**
 * 启动Python后端服务
 */
function startPythonBackend() {
    try {
        // 计算Python后端路径
        let pythonPath;
        let scriptPath;
        if (isDev) {
            // 开发环境路径
            pythonPath = 'python';
            scriptPath = join(__dirname, '../../../../run_api_server.py');
        }
        else {
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
        pythonProcess.stdout.on('data', function (data) {
            console.log(`Python后端输出: ${data}`);
            // 检测后端是否已经启动
            if (data.toString().includes('Application startup complete')) {
                isBackendStarted = true;
                mainWindow?.webContents.send('backend-started');
            }
        });

        // 监听错误输出
        pythonProcess.stderr.on('data', function (data) {
            console.error(`Python后端错误: ${data}`);

            // 检查是否是依赖错误，并发送到前端
            if (data.toString().includes('ImportError') || data.toString().includes('ModuleNotFoundError')) {
                const errorMsg = data.toString();
                if (mainWindow) {
                    mainWindow.webContents.send('backend-error', {
                        type: 'dependency-error',
                        message: errorMsg
                    });
                }
            }
        });

        // 进程退出时的处理
        pythonProcess.on('close', function (code) {
            console.log(`Python后端已退出，退出码: ${code}`);
            pythonProcess = null;
            isBackendStarted = false;

            // 如果是非正常退出，通知前端
            if (code !== 0 && mainWindow) {
                mainWindow.webContents.send('backend-stopped', {
                    code: code,
                    error: true,
                    message: '后端服务异常退出，请检查依赖是否正确安装'
                });
            }
        });
    }
    catch (error) {
        console.error('启动Python后端时出错:', error);
        if (mainWindow) {
            mainWindow.webContents.send('backend-error', {
                type: 'startup-error',
                message: error.toString()
            });
        }
    }
}
/**
 * 注册IPC处理程序
 */
function registerIpcHandlers() {
    var _this = this;
    // 选择视频文件
    ipcMain.handle('select-video', function () { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!mainWindow)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv'] }
                            ]
                        })];
                case 1:
                    result = _a.sent();
                    if (result.canceled || result.filePaths.length === 0) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, result.filePaths[0]];
            }
        });
    }); });
    // 上传本地视频文件
    ipcMain.handle('upload-video', function (_event, filePath, options) { return __awaiter(_this, void 0, void 0, function () {
        var requestData, jsonBody, response, responseText, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    // 构建请求数据，包含前端ID
                    requestData = {
                        file_path: filePath,
                        auto_extract_subtitles: true
                    };

                    // 如果提供了选项，合并到请求数据中
                    if (options && typeof options === 'object') {
                        if (options.frontendId) {
                            requestData.frontend_id = options.frontendId;
                        }
                        // 可以添加其他选项
                    }

                    jsonBody = JSON.stringify(requestData);

                    // 打印请求体以便调试
                    console.log('正在发送视频上传请求:', {
                        url: 'http://127.0.0.1:8000/api/videos/upload-local',
                        body: jsonBody,
                        filePath: filePath,
                        options: options
                    });
                    return [4 /*yield*/, fetch('http://127.0.0.1:8000/api/videos/upload-local', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: jsonBody,
                        })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    responseText = _a.sent();
                    console.error('上传视频请求失败:', response.status, responseText);
                    return [2 /*return*/, {
                        success: false,
                        error: "请求失败: " + response.status + " " + response.statusText,
                        details: responseText
                    }];
                case 3: return [2 /*return*/, response.json()];
                case 4:
                    error_1 = _a.sent();
                    console.error('上传视频时出错:', error_1);
                    return [2 /*return*/, { success: false, error: error_1.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    // 检查后端状态
    ipcMain.handle('check-backend-status', function () {
        return isBackendStarted;
    });
}
// 应用启动完成时
app.whenReady().then(function () {
    createWindow();
    startPythonBackend();
    registerIpcHandlers();
    // macOS特性，点击dock图标重新创建窗口
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// 所有窗口关闭时退出应用，macOS除外
app.on('window-all-closed', function () {
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
app.on('before-quit', function () {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
});
