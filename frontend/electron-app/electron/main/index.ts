import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';

import fetch from 'node-fetch';
import treeKill from 'tree-kill';

// 日志文件路径
const logFilePath = join(__dirname, '..', '..', 'cleanup.log');

// 日志函数
function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logMessage);
    console.log(message); // 同时输出到控制台（开发环境可见）
  } catch (error) {
    console.error('写入日志文件失败:', error);
    console.log(message); // 至少输出到控制台
  }
}

// 定义全局变量
let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcessWithoutNullStreams | null = null;
let isBackendStarted = false;
let apiCheckInterval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;
let isCleaningUp = false; // 防止重复清理的标志

// 是否是开发环境 - 使用app.isPackaged来区分
const isDev = !app.isPackaged;

// 统一临时目录路径配置 - 确保与后端配置一致
const getTempDirPath = () => {
  if (isDev) {
    // 开发环境：使用项目根目录下的temp
    return join(__dirname, '..', '..', '..', '..', 'temp');
  } else {
    // 生产环境：使用应用数据目录下的temp
    return join(app.getPath('userData'), 'temp');
  }
};

const tempDirPath = getTempDirPath();

/**
 * 强力终止Python进程及其子进程树
 * @param process Python进程对象
 * @param timeout 超时时间（毫秒）
 * @returns Promise<boolean> 是否成功终止
 */
async function killPythonProcessTree(process: ChildProcessWithoutNullStreams, timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!process || process.killed) {
      console.log('Python进程已经终止或不存在');
      resolve(true);
      return;
    }

    console.log(`正在强力终止Python进程 (PID: ${process.pid})...`);

    // 设置超时
    const timeoutId = setTimeout(() => {
      console.warn('强力终止Python进程超时');
      resolve(false);
    }, timeout);

    // 监听进程关闭事件
    const onClose = () => {
      clearTimeout(timeoutId);
      console.log('Python进程已成功终止');
      resolve(true);
    };

    process.once('close', onClose);

    // 使用tree-kill强力终止进程树
    if (process.pid) {
      treeKill(process.pid, 'SIGKILL', (err) => {
        if (err) {
          console.error('tree-kill执行失败:', err);
          // 如果tree-kill失败，尝试使用原生kill
          try {
            process.kill('SIGKILL');
          } catch (killErr) {
            console.error('原生kill也失败:', killErr);
          }
        } else {
          console.log('tree-kill执行成功');
        }
      });
    } else {
      // 如果没有PID，直接使用原生kill
      try {
        process.kill('SIGKILL');
      } catch (killErr) {
        console.error('原生kill失败:', killErr);
        clearTimeout(timeoutId);
        resolve(false);
      }
    }
  });
}

/**
 * 按进程名称强力终止进程（Windows特定）
 * @param processName 进程名称
 * @returns Promise<boolean> 是否成功终止
 */
async function killProcessByName(processName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');

    logToFile(`[KILL] 正在按名称终止进程: ${processName}`);

    // 首先检查进程是否存在
    exec(`tasklist /FI "IMAGENAME eq ${processName}"`, (checkError: any, checkStdout: any) => {
      if (checkError) {
        logToFile(`[KILL] 检查进程 ${processName} 时出错: ${checkError.message}`);
        resolve(false);
        return;
      }

      if (checkStdout.includes(processName)) {
        logToFile(`[KILL] 发现进程 ${processName}，正在终止...`);

        // 使用Windows的taskkill命令强制终止进程
        exec(`taskkill /F /IM "${processName}" /T`, (error: any, stdout: any, stderr: any) => {
          if (error) {
            logToFile(`[KILL] 终止进程 ${processName} 失败: ${error.message}`);
            if (stderr) logToFile(`[KILL] stderr: ${stderr}`);
            resolve(false);
          } else {
            logToFile(`[KILL] 成功终止进程 ${processName}`);
            if (stdout) logToFile(`[KILL] stdout: ${stdout.trim()}`);
            resolve(true);
          }
        });
      } else {
        logToFile(`[KILL] 进程 ${processName} 不存在，跳过`);
        resolve(true); // 进程不存在也算成功
      }
    });
  });
}

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
      webSecurity: false, // 允许加载本地资源
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
 * 检查API服务是否可用
 * 增加了重试机制和更长的超时时间
 */
async function checkApiHealth(retries: number = 3): Promise<boolean> {
  try {
    const port = process.env.API_PORT || '8000';
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 增加超时时间到3秒
    });

    if (response.ok) {
      console.log('API健康检查成功');
      return true;
    }
    return false;
  } catch (error) {
    console.log(`API健康检查失败 (剩余重试次数: ${retries}):`, error.message);

    // 如果还有重试次数，则等待一秒后重试
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return checkApiHealth(retries - 1);
    }

    return false;
  }
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

      // 获取项目根目录（根据实际项目结构可能需要调整）
      const projectRoot = join(process.cwd(), '..', '..');

      if (isWindows) {
        // 首先尝试查找.venv环境
        const venvPythonPath = join(projectRoot, '.venv', 'Scripts', 'python.exe');

        console.log(`尝试查找虚拟环境路径: ${venvPythonPath}`);
        if (fs.existsSync(venvPythonPath)) {
          console.log(`使用虚拟环境Python: ${venvPythonPath}`);
          pythonPath = venvPythonPath;
        } else {
          // 尝试查找相对于当前目录的虚拟环境
          const altVenvPath = join(process.cwd(), '.venv', 'Scripts', 'python.exe');
          console.log(`尝试备选虚拟环境路径: ${altVenvPath}`);

          if (fs.existsSync(altVenvPath)) {
            console.log(`使用备选虚拟环境Python: ${altVenvPath}`);
            pythonPath = altVenvPath;
          } else {
            console.log('未找到虚拟环境，使用系统Python');
            pythonPath = 'python';
          }
        }
      } else {
        pythonPath = 'python';
      }

      // 确保脚本路径是绝对路径
      const possiblePaths = [
        // 开发环境路径 - 新的前后端分离结构
        join(process.cwd(), '..', '..', 'backend', 'run_api_server.py'),
        join(process.cwd(), '..', '..', 'backend', 'main.py'),
        join(__dirname, '../../../backend/run_api_server.py'),
        join(__dirname, '../../../backend/main.py'),
        // 相对于项目根目录的路径
        join(projectRoot, 'backend', 'run_api_server.py'),
        join(projectRoot, 'backend', 'main.py')
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
        scriptPath = join(__dirname, '../../../backend/run_api_server.py');
        console.log(`使用默认路径: ${scriptPath}`);
      }
    } else {
      // 生产环境路径 - 使用打包的Python可执行文件
      const resourcesPath = process.resourcesPath;
      pythonPath = join(resourcesPath, 'aniverseGatewayBackend.exe');
      scriptPath = ''; // 不需要脚本路径，因为已经打包到可执行文件中

      // 验证aniverseGatewayBackend.exe是否存在
      if (!fs.existsSync(pythonPath)) {
        console.error(`错误: 找不到后端可执行文件: ${pythonPath}`);
        console.log(`资源路径: ${resourcesPath}`);
        console.log('资源目录内容:');
        try {
          const files = fs.readdirSync(resourcesPath);
          files.forEach(file => console.log(`  - ${file}`));
        } catch (err) {
          console.error('无法读取资源目录:', err);
        }
        throw new Error(`后端可执行文件不存在: ${pythonPath}`);
      }
    }

    console.log('启动Python后端...');
    console.log(`Python路径: ${pythonPath}`);
    console.log(`脚本路径: ${scriptPath}`);

    // 设置环境变量确保UTF-8编码
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      TEMP_DIR: tempDirPath, // 统一临时目录路径
    };

    // 启动Python进程 - 使用低级端口以避免权限问题
    const port = process.env.API_PORT || '8000';
    env.API_PORT = port;

    // 启动Python进程
    const args = scriptPath ? [scriptPath] : []; // 生产环境不需要脚本参数

    // 设置工作目录 - 对于生产环境，使用资源目录作为工作目录
    const cwd = isDev ? process.cwd() : process.resourcesPath;

    console.log(`工作目录: ${cwd}`);
    console.log(`启动参数: ${JSON.stringify(args)}`);

    pythonProcess = spawn(pythonPath, args, {
      env,
      cwd, // 设置正确的工作目录
      windowsHide: !isDev // 开发环境显示控制台，生产环境隐藏
    });

    // 清除之前的超时和间隔
    if (startupTimeout) {
      clearTimeout(startupTimeout);
    }
    if (apiCheckInterval) {
      clearInterval(apiCheckInterval);
    }

    // 设置新的超时 - 给PyInstaller打包的应用更多启动时间
    const timeoutDuration = isDev ? 30000 : 60000; // 开发环境30秒，生产环境60秒
    startupTimeout = setTimeout(() => {
      if (!isBackendStarted) {
        console.error(`后端启动超时 (${timeoutDuration/1000}秒)`);
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', {
            message: `后端启动超时 (${timeoutDuration/1000}秒)，请检查aniverseGatewayBackend.exe是否能正常运行`
          });
        }
      }
    }, timeoutDuration);

    // 启动定期检查API是否可访问
    const checkInterval = isDev ? 2000 : 5000; // 开发环境2秒，生产环境5秒
    apiCheckInterval = setInterval(async () => {
      if (isBackendStarted) {
        clearInterval(apiCheckInterval);
        return;
      }

      console.log('执行API健康检查...');
      // 使用改进的checkApiHealth函数，带重试机制
      const isHealthy = await checkApiHealth(1); // 减少重试次数以避免过度请求
      if (isHealthy) {
        isBackendStarted = true;
        if (startupTimeout) {
          clearTimeout(startupTimeout);
        }
        console.log('API服务已启动并可访问');
        mainWindow?.webContents.send('backend-started');
        clearInterval(apiCheckInterval);
      }
    }, checkInterval);

    // 监听标准输出
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Python后端stdout: ${output.trim()}`);

      // 检测后端是否已经启动 - 保留原有检测，但增加了其他启动信息的检测
      if (output.includes('Application startup complete') ||
          output.includes('Uvicorn running on') ||
          output.includes('Started server process') ||
          output.includes('运行在PyInstaller打包环境中') ||
          output.includes('运行在开发环境中')) {
        console.log('检测到API服务启动关键信息');

        // 如果检测到PyInstaller环境信息，给更多时间让服务完全启动
        if (output.includes('运行在PyInstaller打包环境中')) {
          console.log('检测到PyInstaller环境，延长启动检测时间');
          setTimeout(() => {
            if (!isBackendStarted) {
              console.log('延迟检测API健康状态...');
            }
          }, 3000);
        }
      }
    });

    // 监听错误输出
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`Python后端stderr: ${output}`);

      // 检查是否是真正的错误，还是只是日志输出
      if (output.includes('ERROR:') ||
          output.includes('CRITICAL:') ||
          output.includes('Exception:') ||
          output.includes('Error:') ||
          output.includes('Traceback')) {
        console.error(`Python后端错误: ${output}`);

        // 如果是严重错误，通知前端
        if (mainWindow && (output.includes('CRITICAL:') || output.includes('Exception:') || output.includes('Traceback'))) {
          mainWindow.webContents.send('backend-error', {
            message: `后端启动错误: ${output}`
          });
        }
      } else if (output.includes('INFO:') || output.includes('DEBUG:') || output.includes('WARNING:')) {
        // 这些实际上是日志输出，不是真正的错误
        console.log(`Python后端日志: ${output}`);

        // 检测启动完成信息
        if (output.includes('Application startup complete') ||
            output.includes('Uvicorn running on')) {
          console.log('从stderr检测到API服务启动完成');
          isBackendStarted = true;
          if (startupTimeout) {
            clearTimeout(startupTimeout);
          }
          mainWindow?.webContents.send('backend-started');
        }
      }

      // 如果检测到端口已被占用
      if (output.includes('address already in use') ||
          output.includes('Address already in use')) {
        console.error(`错误: 端口${port}已被占用，请确保没有其他API服务器实例正在运行`);
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', {
            message: `端口${port}已被占用，请确保没有其他API服务器实例正在运行`
          });
        }
      }
    });

    // 进程退出时的处理
    pythonProcess.on('close', (code, signal) => {
      console.log(`Python后端已退出，退出码: ${code}, 信号: ${signal}`);
      console.log(`Python路径: ${pythonPath}`);
      console.log(`工作目录: ${cwd}`);

      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
      if (apiCheckInterval) {
        clearInterval(apiCheckInterval);
      }
      pythonProcess = null;
      isBackendStarted = false;

      if (mainWindow) {
        const errorMessage = code !== 0 ?
          `后端进程异常退出 (退出码: ${code}, 信号: ${signal})` :
          '后端进程正常退出';

        mainWindow.webContents.send('backend-stopped', {
          code,
          signal,
          message: errorMessage
        });

        // 如果是异常退出，发送错误信息
        if (code !== 0) {
          mainWindow.webContents.send('backend-error', {
            message: `${errorMessage}\n请检查aniverseGatewayBackend.exe是否能正常运行`
          });
        }
      }
    });

    // 处理错误
    pythonProcess.on('error', (err) => {
      console.error(`启动Python进程时出错: ${err.message}`);
      console.error(`错误详情:`, err);
      console.error(`Python路径: ${pythonPath}`);
      console.error(`工作目录: ${cwd}`);
      console.error(`环境变量: ${JSON.stringify(env, null, 2)}`);

      if (startupTimeout) {
        clearTimeout(startupTimeout);
      }
      if (apiCheckInterval) {
        clearInterval(apiCheckInterval);
      }
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', {
          message: `启动Python进程失败: ${err.message}\n路径: ${pythonPath}\n工作目录: ${cwd}`
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

  // 清除缓存
  ipcMain.handle('clear-cache', async () => {
    try {
      const port = process.env.API_PORT || '8000';
      const url = `http://127.0.0.1:${port}/api/videos/clear-cache`;

      console.log('正在发送清除缓存请求:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // 检查响应状态
      if (!response.ok) {
        const responseText = await response.text();
        console.error('清除缓存请求失败:', response.status, responseText);
        return {
          success: false,
          error: `请求失败: ${response.status} ${response.statusText}`,
          details: responseText
        };
      }

      return await response.json();
    } catch (error) {
      console.error('清除缓存时出错', error);
      return { success: false, error: error.message };
    }
  });

  // 上传本地视频文件
  ipcMain.handle('upload-video', async (_event, filePath) => {
    try {
      const port = process.env.API_PORT || '8000';
      const url = `http://127.0.0.1:${port}/api/videos/upload-local`;

      // 构建请求体
      const jsonBody = JSON.stringify({
        request: {
          file_path: filePath,
          auto_extract_subtitles: true
        }
      });

      // 打印请求体以便调试
      console.log('正在发送视频上传请求:', {
        url,
        body: jsonBody,
        filePath
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonBody
      });

      // 检查响应状态
      if (!response.ok) {
        const responseText = await response.text();
        console.error('上传视频请求失败:', response.status, responseText);
        return {
          success: false,
          error: `请求失败: ${response.status} ${response.statusText}`,
          details: responseText
        };
      }

      return await response.json();
    } catch (error) {
      console.error('上传视频时出错', error);
      return { success: false, error: error.message };
    }
  });

  // 检查后端状态
  ipcMain.handle('check-backend-status', async () => {
    // 如果已知后端已启动，直接返回
    if (isBackendStarted) {
      return true;
    }

    // 否则主动检查健康状态
    const isHealthy = await checkApiHealth(3); // 使用改进的检查函数，最多重试3次
    if (isHealthy) {
      isBackendStarted = true;
      console.log('手动检查: API服务已启动并可访问');
      mainWindow?.webContents.send('backend-started');
    }

    return isHealthy;
  });

  // 尝试重启后端
  ipcMain.handle('restart-backend', async () => {
    try {
      if (pythonProcess) {
        console.log('正在强力终止现有Python进程...');
        const killed = await killPythonProcessTree(pythonProcess);
        if (!killed) {
          console.warn('无法完全终止Python进程，但将继续重启');
        }
        pythonProcess = null;
        isBackendStarted = false;
      }

      // 等待一小段时间确保端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));

      startPythonBackend();
      return { success: true };
    } catch (error) {
      console.error('重启后端时出错', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==== 设置相关处理程序 ====
  // 获取设置
  ipcMain.handle('get-settings', async () => {
    try {
      const settings = loadSettings();
      return settings;
    } catch (error) {
      console.error('获取设置时出错:', error);
      throw error;
    }
  });

  // 保存设置
  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      saveSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('保存设置时出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 打开目录选择对话框
  ipcMain.handle('open-directory-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      ...options
    });
  });

  // 打开文件选择对话框
  ipcMain.handle('open-file-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      ...options
    });
  });

  // 验证模型
  ipcMain.handle('validate-model', async (event, modelPath) => {
    try {
      const port = process.env.API_PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/speech-to-text/validate-model`, {
        method: 'POST',
        body: JSON.stringify({ model_path: modelPath }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('验证模型出错:', error);
      return {
        valid: false,
        message: `请求失败: ${error.message}`
      };
    }
  });

  // 加载Faster Whisper GUI配置文件
  ipcMain.handle('load-faster-whisper-config', async (event, configPath) => {
    try {
      const port = process.env.API_PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/speech-to-text/load-gui-config`, {
        method: 'POST',
        body: JSON.stringify({ config_path: configPath }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // 保存配置文件路径到设置
      if (result.success) {
        await saveSettings({ fasterWhisperConfigPath: configPath });
      }

      return result;
    } catch (error) {
      console.error('加载Faster Whisper配置文件出错:', error);
      return {
        success: false,
        message: `请求失败: ${error.message}`
      };
    }
  });

  // 应用Faster Whisper配置进行语音转写
  ipcMain.handle('transcribe-with-gui-config', async (event, { videoPath, configPath, outputDir }) => {
    try {
      const port = process.env.API_PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/speech-to-text/transcribe-with-gui-config`, {
        method: 'POST',
        body: JSON.stringify({
          video_path: videoPath,
          config_path: configPath,
          output_dir: outputDir || null
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('使用GUI配置进行转写出错:', error);
      return {
        success: false,
        message: `请求失败: ${error.message}`,
        task_id: null
      };
    }
  });

  // 获取Faster Whisper配置参数
  ipcMain.handle('get-faster-whisper-params', async (event, configPath) => {
    try {
      const port = process.env.API_PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/speech-to-text/get-config-params`, {
        method: 'POST',
        body: JSON.stringify({ config_path: configPath }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取配置参数出错:', error);
      return {
        success: false,
        message: `请求失败: ${error.message}`,
        parameters: null
      };
    }
  });

  // ==== AI提供商相关处理程序 ====
  // 获取提供商列表
  ipcMain.handle('get-providers', () => {
    try {
      return getProviderList();
    } catch (error) {
      console.error('获取提供商列表出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取提供商详情
  ipcMain.handle('get-provider-details', (event, providerId) => {
    try {
      const details = getProviderDetails(providerId);
      return { success: true, data: details };
    } catch (error) {
      console.error('获取提供商详情出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取提供商模型列表
  ipcMain.handle('get-provider-models', (event, providerId) => {
    try {
      return getProviderModels(providerId);
    } catch (error) {
      console.error('获取提供商模型列表出错:', error);
      return { success: false, error: error.message, models: [] };
    }
  });

  // 更新提供商配置
  ipcMain.handle('update-provider', (event, providerId, apiKey, defaultModel, baseUrl) => {
    try {
      return updateProvider(providerId, apiKey, defaultModel, baseUrl);
    } catch (error) {
      console.error('更新提供商配置出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 测试提供商连接
  ipcMain.handle('test-provider', async (event, providerId, apiKey, baseUrl, model, formatType) => {
    try {
      // 如果是自定义提供商，将请求发送到后端进行测试
      const port = process.env.API_PORT || '8000';

      // 如果API密钥为空，从已保存的配置中获取实际的API密钥
      let actualApiKey = apiKey;
      if (!actualApiKey || actualApiKey.trim() === '') {
        // 如果是自定义提供商
        if (providerId.startsWith('custom-')) {
          const realProviderId = providerId.substring(7); // 去除'custom-'前缀
          const providersData = loadProviders();
          const provider = providersData.providers[realProviderId];
          if (provider && provider.api_key) {
            actualApiKey = provider.api_key;
            console.log(`使用已保存的自定义提供商API密钥进行测试: ${providerId}`);
          }
        }
        // 如果是硬基流动提供商
        else if (providerId === 'siliconflow') {
          const settings = loadSettings();
          if (settings.siliconflowApiKey) {
            actualApiKey = settings.siliconflowApiKey;
            console.log('使用已保存的硬基流动API密钥进行测试');
          }
        }
      }

      console.log(`测试提供商连接: ${providerId}, 模型: ${model || '未指定'}`);

      const response = await fetch(`http://127.0.0.1:${port}/api/providers/test`, {
        method: 'POST',
        body: JSON.stringify({
          provider: providerId.startsWith('custom-') ? 'custom' : providerId,
          api_key: actualApiKey,
          base_url: baseUrl,
          model: model,
          format_type: formatType || 'openai'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('测试提供商连接出错:', error);
      return { success: false, message: `测试失败: ${error.message}` };
    }
  });

  // 创建自定义提供商
  ipcMain.handle('create-custom-provider', (event, name, apiKey, baseUrl, defaultModel, formatType, models) => {
    try {
      return createCustomProvider(name, apiKey, baseUrl, defaultModel, formatType, models);
    } catch (error) {
      console.error('创建自定义提供商出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 删除自定义提供商
  ipcMain.handle('delete-custom-provider', (event, providerId) => {
    try {
      return deleteCustomProvider(providerId);
    } catch (error) {
      console.error('删除自定义提供商出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 激活提供商
  ipcMain.handle('activate-provider', (event, providerId) => {
    try {
      return activateProvider(providerId);
    } catch (error) {
      console.error('激活提供商出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 新增：加载完整配置数据（应用启动时调用）
  ipcMain.handle('load-complete-config', async () => {
    try {
      const settings = loadSettings();
      const providersData = loadProviders();
      const providersList = getProviderList();

      return {
        success: true,
        data: {
          settings,
          providers: providersList.providers,
          currentProvider: providersList.current_provider,
        }
      };
    } catch (error) {
      console.error('加载完整配置失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 新增：同步配置到文件（运行时调用）
  ipcMain.handle('sync-config-to-files', async (event, configData) => {
    try {
      const { providers, currentProviderId, currentModelId } = configData;

      // 分离标准提供商和自定义提供商
      const customProviders = providers.filter((p: any) => p.id.startsWith('custom-'));
      const standardProviders = providers.filter((p: any) => !p.id.startsWith('custom-'));

      // 更新settings.json（包含选中的提供商和模型）
      const currentSettings = loadSettings();
      const updatedSettings = {
        ...currentSettings,
        selectedProvider: currentProviderId,
        selectedModel: currentModelId,
      };
      saveSettings(updatedSettings);

      // 更新providers.json（只包含自定义提供商）
      const providersData = loadProviders();

      // 重建自定义提供商数据
      const newProvidersData: any = {
        providers: {},
        active_provider: null
      };

      // 检查当前激活的提供商
      let activeProviderFound = false;

      customProviders.forEach((provider: any) => {
        const realId = provider.id.startsWith('custom-') ? provider.id.substring(7) : provider.id;
        newProvidersData.providers[realId] = {
          name: provider.name,
          api_key: provider.apiKey || '',
          base_url: provider.apiHost || '',
          model: provider.models?.[0]?.id || 'default',
          format_type: 'openai',
          models: provider.models || []
        };

        if (provider.is_active) {
          newProvidersData.active_provider = realId;
          activeProviderFound = true;
        }
      });

      // 如果当前激活的提供商是标准提供商，也要设置到active_provider
      if (!activeProviderFound && currentProviderId) {
        if (currentProviderId === 'siliconflow') {
          newProvidersData.active_provider = 'siliconflow';
        }
      }

      console.log('同步自定义提供商到文件:', {
        customProvidersCount: customProviders.length,
        activeProvider: newProvidersData.active_provider,
        currentProviderId,
        activeProviderFound
      });

      saveProviders(newProvidersData);

      console.log('配置已同步到文件:', {
        settingsUpdated: !!updatedSettings,
        customProvidersCount: customProviders.length,
        activeProvider: newProvidersData.active_provider
      });

      return { success: true };
    } catch (error) {
      console.error('同步配置到文件失败:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 设置存储路径
 */
const userDataPath = app.getPath('userData');
const settingsPath = join(userDataPath, 'settings.json');
const providersPath = join(userDataPath, 'providers.json');

/**
 * 加载设置
 */
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      console.log('已加载设置:', settings);
      return settings;
    }
    return {};
  } catch (error) {
    console.error('加载设置出错:', error);
    return {};
  }
}

/**
 * 保存设置
 */
function saveSettings(newSettings) {
  try {
    // 合并现有设置
    const existingSettings = loadSettings();
    const settings = { ...existingSettings, ...newSettings };

    // 确保目录存在
    const dir = join(userDataPath, '..');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存设置
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('设置已保存:', settings);
  } catch (error) {
    console.error('保存设置出错:', error);
    throw error;
  }
}

/**
 * 加载AI服务提供商配置
 */
function loadProviders() {
  try {
    if (fs.existsSync(providersPath)) {
      const data = fs.readFileSync(providersPath, 'utf8');
      const providers = JSON.parse(data);
      // console.log('已加载提供商配置:', providers);
      return providers;
    }
    return {
      providers: {},
      active_provider: null
    };
  } catch (error) {
    console.error('加载提供商配置出错:', error);
    return {
      providers: {},
      active_provider: null
    };
  }
}

/**
 * 保存AI服务提供商配置
 */
function saveProviders(providersData) {
  try {
    // 确保目录存在
    const dir = join(userDataPath, '..');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存提供商配置
    fs.writeFileSync(providersPath, JSON.stringify(providersData, null, 2));
    console.log('提供商配置已保存:', providersData);
  } catch (error) {
    console.error('保存提供商配置出错:', error);
    throw error;
  }
}

/**
 * 获取提供商列表
 */
function getProviderList() {
  const providersData = loadProviders();
  const settings = loadSettings();

  console.log('获取提供商列表，原始数据:', {
    activeProvider: providersData.active_provider,
    providersCount: Object.keys(providersData.providers || {}).length
  });

  const providers = [];

  // 添加硅基流动提供商（从Redux状态获取API Key）
  providers.push({
    id: 'siliconflow',
    name: 'SiliconFlow',
    api_key: '', // 标准提供商的API Key存储在Redux中，这里为空
    base_url: 'https://api.siliconflow.cn/v1',
    is_active: providersData.active_provider === 'siliconflow',
    is_configured: true, // 假设标准提供商已配置
    model_count: 0,
    models: [], // 模型列表需要从API获取
    description: 'SiliconFlow AI服务提供商',
    logo_url: '',
    provider_type: 'openai',
    format_type: 'openai'
  });

  console.log('标准提供商处理完成:', {
    siliconflowActive: providersData.active_provider === 'siliconflow',
    activeProvider: providersData.active_provider
  });

  // 添加自定义提供商
  if (providersData.providers) {
    console.log('自定义提供商IDs:', Object.keys(providersData.providers));

    for (const [providerId, provider] of Object.entries(providersData.providers)) {
      const providerData = provider as any; // 类型断言

      console.log(`处理提供商 ${providerId}:`, {
        name: providerData.name,
        isActive: providersData.active_provider === providerId,
        modelCount: providerData.models ? providerData.models.length : 0,
        hasApiKey: !!providerData.api_key
      });

      const customProviderId = `custom-${providerId}`;
      const isActive = providersData.active_provider === providerId;
      const isConfigured = !!providerData.api_key;

      console.log(`自定义提供商 ${customProviderId}:`, {
        originalId: providerId,
        isActive,
        isConfigured,
        activeProviderInFile: providersData.active_provider
      });

      providers.push({
        id: customProviderId,
        name: providerData.name,
        api_key: providerData.api_key || '',
        base_url: providerData.base_url || '',
        is_active: isActive,
        is_configured: isConfigured,
        model_count: providerData.models ? providerData.models.length : 0,
        models: providerData.models || [],
        description: providerData.description || '',
        logo_url: providerData.logo_url || '',
        provider_type: providerData.provider_type || 'openai',
        format_type: providerData.format_type || 'openai'
      });
    }
  }

  console.log('返回提供商列表:', {
    count: providers.length,
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      is_active: p.is_active,
      is_configured: p.is_configured
    }))
  });

  return {
    providers,
    current_provider: providersData.active_provider
  };
}

/**
 * 获取提供商详情
 */
function getProviderDetails(providerId) {
  // 如果是自定义提供商
  if (providerId.startsWith('custom-')) {
    const realProviderId = providerId.substring(7); // 去除'custom-'前缀
    const providersData = loadProviders();
    const provider = providersData.providers[realProviderId];

    if (provider) {
      return {
        id: providerId,
        name: provider.name,
        base_url: provider.base_url,
        api_key: provider.api_key ? '********' : '', // 掩码API密钥
        default_model: provider.model,
        format_type: provider.format_type
      };
    }
  }
  // 如果是硬基流动提供商
  else if (providerId === 'siliconflow') {
    const settings = loadSettings();
    return {
      id: 'siliconflow',
      name: 'SiliconFlow',
      base_url: settings.siliconflowBaseUrl || 'https://api.siliconflow.cn/v1',
      api_key: settings.siliconflowApiKey ? '********' : '',
      default_model: settings.siliconflowModel || 'deepseek-ai/DeepSeek-V2.5'
    };
  }

  return null;
}

/**
 * 更新提供商配置
 */
function updateProvider(providerId, apiKey, defaultModel, baseUrl) {
  // 如果是自定义提供商
  if (providerId.startsWith('custom-')) {
    const realProviderId = providerId.substring(7); // 去除'custom-'前缀
    const providersData = loadProviders();
    const provider = providersData.providers[realProviderId];

    if (provider) {
      // 只更新提供的字段
      if (apiKey) provider.api_key = apiKey;
      if (defaultModel) provider.model = defaultModel;
      if (baseUrl !== undefined) provider.base_url = baseUrl;

      saveProviders(providersData);
      return { success: true };
    }
  }
  // 如果是硬基流动提供商
  else if (providerId === 'siliconflow') {
    const settings = loadSettings();
    const newSettings = { ...settings };

    // 只更新提供的字段
    if (apiKey) newSettings.siliconflowApiKey = apiKey;
    if (defaultModel) newSettings.siliconflowModel = defaultModel;
    if (baseUrl !== undefined) newSettings.siliconflowBaseUrl = baseUrl;

    saveSettings(newSettings);
    return { success: true };
  }

  return { success: false, message: '未找到提供商' };
}

/**
 * 创建自定义提供商
 */
function createCustomProvider(name, apiKey, baseUrl, defaultModel, formatType, models = []) {
  console.log('创建自定义提供商:', { name, baseUrl, defaultModel, formatType, modelsCount: Array.isArray(models) ? models.length : 0 });

  const providersData = loadProviders();
  const providerId = Date.now().toString(); // 使用时间戳作为ID

  // 处理模型数据
  const processedModels = Array.isArray(models) ? models.map(model => ({
    id: model.id,
    name: model.name,
    context_window: model.context_window || model.contextWindow || 4096,
    capabilities: model.capabilities || ['chat']
  })) : [];

  console.log('处理后的模型数据:', processedModels);

  providersData.providers[providerId] = {
    name,
    api_key: apiKey,
    base_url: baseUrl,
    model: defaultModel || 'default',
    format_type: formatType || 'openai',
    models: processedModels
  };

  // 如果没有激活的提供商，将新提供商设为激活
  if (!providersData.active_provider) {
    providersData.active_provider = providerId;
  }

  console.log('保存提供商数据，ID:', providerId);
  saveProviders(providersData);

  // 验证保存后的数据
  const savedData = loadProviders();
  console.log('验证保存的提供商数据:', {
    providerId,
    exists: !!savedData.providers[providerId],
    modelCount: savedData.providers[providerId]?.models?.length || 0
  });

  return { success: true, provider_id: providerId };
}

/**
 * 删除自定义提供商
 */
function deleteCustomProvider(providerId) {
  if (providerId.startsWith('custom-')) {
    const realProviderId = providerId.substring(7); // 去除'custom-'前缀
    const providersData = loadProviders();

    if (providersData.providers[realProviderId]) {
      delete providersData.providers[realProviderId];

      // 如果删除的是当前激活的提供商，重置激活的提供商
      if (providersData.active_provider === realProviderId) {
        // 如果还有其他提供商，选择第一个作为激活的提供商
        const providerIds = Object.keys(providersData.providers);
        providersData.active_provider = providerIds.length > 0 ? providerIds[0] : null;
      }

      saveProviders(providersData);
      return { success: true };
    }
  }

  return { success: false, message: '未找到提供商' };
}

/**
 * 激活提供商
 */
function activateProvider(providerId) {
  console.log('尝试激活提供商:', providerId);

  if (providerId === 'siliconflow') {
    console.log('激活硬基流动提供商');
    const providersData = loadProviders();
    providersData.active_provider = 'siliconflow';
    saveProviders(providersData);
    return { success: true };
  }
  else if (providerId.startsWith('custom-')) {
    const realProviderId = providerId.substring(7); // 去除'custom-'前缀
    console.log('激活自定义提供商, 实际ID:', realProviderId);

    const providersData = loadProviders();
    console.log('当前提供商数据:', {
      activeProvider: providersData.active_provider,
      availableProviders: Object.keys(providersData.providers || {})
    });

    if (providersData.providers && providersData.providers[realProviderId]) {
      console.log('找到提供商，设置为活跃');
      providersData.active_provider = realProviderId;
      saveProviders(providersData);

      // 验证保存后的数据
      const savedData = loadProviders();
      console.log('验证激活后的提供商数据:', {
        activeProvider: savedData.active_provider,
        isActive: savedData.active_provider === realProviderId
      });

      return { success: true };
    } else {
      console.log('未找到提供商:', realProviderId);
    }
  } else {
    console.log('提供商ID格式不正确，需要以custom-开头');
  }

  return { success: false, message: '未找到提供商' };
}

/**
 * 获取提供商模型列表
 */
function getProviderModels(providerId) {
  if (providerId.startsWith('custom-')) {
    const realProviderId = providerId.substring(7); // 去除'custom-'前缀
    const providersData = loadProviders();
    const provider = providersData.providers[realProviderId];

    if (provider && provider.models) {
      return {
        success: true,
        models: provider.models.map(model => ({
          id: model.id,
          name: model.name,
          context_window: model.context_window || 4096,
          capabilities: model.capabilities || ['chat'],
          is_default: model.id === provider.model
        }))
      };
    }

    return { success: true, models: [] };
  }
  else if (providerId === 'siliconflow') {
    // 硬基流动的默认模型
    const settings = loadSettings();
    const defaultModel = settings.siliconflowModel || 'deepseek-ai/DeepSeek-V2.5';

    return {
      success: true,
      models: [
        {
          id: 'deepseek-ai/DeepSeek-V2.5',
          name: 'DeepSeek-V2.5',
          context_window: 8192,
          capabilities: ['chat'],
          is_default: defaultModel === 'deepseek-ai/DeepSeek-V2.5'
        },
        {
          id: 'deepseek-ai/deepseek-coder',
          name: 'DeepSeek Coder',
          context_window: 16384,
          capabilities: ['chat'],
          is_default: defaultModel === 'deepseek-ai/deepseek-coder'
        }
      ]
    };
  }

  return { success: false, models: [] };
}

// 应用启动完成时
app.whenReady().then(() => {
  // 清理旧的日志文件
  try {
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  } catch (error) {
    console.error('清理旧日志文件失败:', error);
  }

  logToFile('[STARTUP] 应用启动完成');
  logToFile(`[STARTUP] 平台: ${process.platform}`);
  logToFile(`[STARTUP] 是否打包: ${app.isPackaged}`);

  // 确保临时目录存在
  try {
    if (!fs.existsSync(tempDirPath)) {
      fs.mkdirSync(tempDirPath, { recursive: true });
      logToFile(`[STARTUP] 创建临时目录: ${tempDirPath}`);
    } else {
      logToFile(`[STARTUP] 临时目录已存在: ${tempDirPath}`);
    }
  } catch (error) {
    logToFile(`[STARTUP] 创建临时目录失败: ${error}`);
  }

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

/**
 * 执行应用清理逻辑
 * 集中处理所有清理任务，防止重复执行
 */
async function performAppCleanup(): Promise<void> {
  // 防止重入：如果已经在清理中，直接返回
  if (isCleaningUp) {
    logToFile('[CLEANUP] 清理已在进行中，跳过重复执行');
    return;
  }

  // 设置清理标志
  isCleaningUp = true;
  logToFile('[CLEANUP] 开始应用清理流程...');

  try {
    // 1. 清理定时器
    logToFile('[CLEANUP] 清理定时器...');
    if (startupTimeout) {
      clearTimeout(startupTimeout);
      startupTimeout = null;
    }
    if (apiCheckInterval) {
      clearInterval(apiCheckInterval);
      apiCheckInterval = null;
    }

    // 2. 强力终止Python进程
    if (pythonProcess) {
      logToFile('[CLEANUP] 正在强力终止Python后端进程...');
      try {
        const killed = await killPythonProcessTree(pythonProcess, 5000);
        logToFile(`[CLEANUP] Python后端进程终止结果: ${killed}`);
      } catch (error) {
        logToFile(`[CLEANUP] Python进程终止异常: ${error}`);
      }
      pythonProcess = null;
      isBackendStarted = false;
    }

    // 3. 按进程名称终止所有相关进程
    logToFile('[CLEANUP] 正在按名称终止所有相关进程...');
    try {
      await Promise.all([
        killProcessByName('aniverseGatewayBackend.exe'),
        killProcessByName('AniVerse Gateway.exe'),
        killProcessByName('backend.exe') // 兼容旧版本
      ]);
    } catch (error) {
      logToFile(`[CLEANUP] 按名称终止进程异常: ${error}`);
    }

    // 注意：临时目录不在应用退出时自动清理
    // 只有用户在设置界面中主动点击清理缓存时才会清理临时目录
    logToFile('[CLEANUP] 跳过临时目录清理（仅在用户主动清理缓存时执行）');

    logToFile('[CLEANUP] 应用清理流程完成');
  } catch (error) {
    logToFile(`[CLEANUP] 清理过程中发生异常: ${error}`);
  } finally {
    // 确保清理标志被重置（虽然应用即将退出）
    isCleaningUp = false;
  }
}

// 应用退出前清理资源 - 统一清理入口
app.on('before-quit', async (event) => {
  logToFile('[CLEANUP] before-quit 事件触发');

  // 如果已经在清理中，直接允许退出
  if (isCleaningUp) {
    logToFile('[CLEANUP] before-quit: 清理已在进行中，允许退出');
    return;
  }

  // 阻止默认退出行为，等待我们完成清理
  event.preventDefault();

  // 执行统一的清理逻辑
  await performAppCleanup();

  logToFile('[CLEANUP] before-quit: 清理完成，现在允许应用退出');

  // 直接退出，不再调用app.quit()避免循环
  app.exit(0);
});

// 所有窗口关闭时的简化处理 - 只负责退出决策
app.on('window-all-closed', () => {
  logToFile(`[CLEANUP] window-all-closed 事件触发，平台: ${process.platform}`);

  // macOS的应用程序不会自动退出，其他平台直接退出
  // 清理逻辑将在 before-quit 中统一处理
  if (process.platform !== 'darwin') {
    logToFile('[CLEANUP] window-all-closed: 所有窗口已关闭，触发应用退出');
    app.quit(); // 这将触发 before-quit 事件，在那里进行清理
  }
});
