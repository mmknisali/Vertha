import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import Store from 'electron-store';
import log from 'electron-log';

const isDev = !app.isPackaged;
const store = new Store();

log.initialize();
log.transports.file.level = 'info';
log.info('Vertha starting...');

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});

let mainWindow = null;
let sttProcess = null;
let ttsProcess = null;
let sttPort = 8765;
let ttsPort = 8766;

const DEFAULT_CONFIG = {
  groqApiKey: '',
  zenApiKey: '',
  locationLat: '37.0662',
  locationLon: '37.3833',
  piperVoicePath: '',
  sttPort: 8765,
  ttsPort: 8766,
};

function getConfig() {
  return {
    groqApiKey: store.get('groqApiKey', DEFAULT_CONFIG.groqApiKey),
    zenApiKey: store.get('zenApiKey', DEFAULT_CONFIG.zenApiKey),
    locationLat: store.get('locationLat', DEFAULT_CONFIG.locationLat),
    locationLon: store.get('locationLon', DEFAULT_CONFIG.locationLon),
    piperVoicePath: store.get('piperVoicePath', DEFAULT_CONFIG.piperVoicePath),
    sttPort: store.get('sttPort', DEFAULT_CONFIG.sttPort),
    ttsPort: store.get('ttsPort', DEFAULT_CONFIG.ttsPort),
  };
}

async function saveConfig(config) {
  for (const [key, value] of Object.entries(config)) {
    store.set(key, value);
  }
  return getConfig();
}

async function pollHealth(port, maxAttempts = 30, intervalMs = 500) {
  const { net } = await import('electron');
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = net.connect({ port }, () => {
          req.destroy();
          resolve(true);
        });
        req.on('error', () => reject(false));
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      if (result) {
        log.info(`Service on port ${port} is ready`);
        return true;
      }
    } catch {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  return false;
}

async function findAvailablePort(startPort, maxTries = 5) {
  const { net } = await import('electron');
  
  for (let i = 0; i < maxTries; i++) {
    const port = startPort + i;
    try {
      const available = await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', () => reject(false));
        server.once('listening', () => {
          server.close();
          resolve(true);
        });
        server.listen(port, '127.0.0.1');
      });
      if (available) return port;
    } catch {
      log.warn(`Port ${port} is in use, trying next...`);
    }
  }
  return null;
}

function getServiceBinary(serviceName, baseName) {
  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';
  const resourcePath = process.resourcesPath || path.join(app.getAppPath(), 'resources');
  
  if (platform === 'win32') {
    return path.join(resourcePath, serviceName, `${baseName}.exe`);
  } else if (platform === 'darwin') {
    return path.join(resourcePath, serviceName, baseName);
  } else {
    return path.join(resourcePath, serviceName, baseName);
  }
}

function getPythonCommand() {
  const platform = process.platform;
  if (platform === 'win32') return 'python';
  return 'python3';
}

async function startService(serviceName, serviceType, port) {
  const config = getConfig();
  const userDataPath = app.getPath('userData');
  
  let binaryPath;
  let args;
  let env = {
    ...process.env,
    PORT: String(port),
    ENROLLMENT_DIR: path.join(userDataPath, 'enrollments'),
    PIPER_VOICE_DIR: path.join(userDataPath, 'voices'),
  };
  
  if (isDev) {
    const scriptDir = serviceType === 'stt' ? 'src/stt' : 'src/tts';
    binaryPath = getPythonCommand();
    args = [path.join(app.getAppPath(), scriptDir, 'server.py')];
    
    if (config.groqApiKey) env.GROQ_API_KEY = config.groqApiKey;
    if (config.zenApiKey) env.ZEN_API_KEY = config.zenApiKey;
    if (config.piperVoicePath) env.PIPER_VOICE = config.piperVoicePath;
  } else {
    binaryPath = getServiceBinary(serviceName, serviceType === 'stt' ? 'stt-server' : 'tts-server');
    
    if (config.groqApiKey) env.GROQ_API_KEY = config.groqApiKey;
    if (config.zenApiKey) env.ZEN_API_KEY = config.zenApiKey;
    if (config.piperVoicePath) env.PIPER_VOICE = config.piperVoicePath;
    
    args = ['--port', String(port)];
  }
  
  log.info(`Starting ${serviceName} on port ${port}...`);
  log.info(`Binary: ${binaryPath}`);
  
  const isWindows = process.platform === 'win32';
  const proc = spawn(binaryPath, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    windowsHide: true,
  });
  
  proc.stdout.on('data', (data) => {
    log.info(`[${serviceName}] ${data.toString().trim()}`);
  });
  
  proc.stderr.on('data', (data) => {
    log.error(`[${serviceName}] ${data.toString().trim()}`);
  });
  
  proc.on('error', (err) => {
    log.error(`${serviceName} failed to start:`, err);
  });
  
  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      log.error(`${serviceName} exited with code ${code}`);
    }
  });
  
  return proc;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false,
    backgroundColor: '#000000',
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('Main window ready');
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function startApp() {
  const gotLock = app.requestSingleInstanceLock();
  
  if (!gotLock) {
    log.info('Another instance is running, quitting...');
    app.quit();
    return;
  }
  
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  
  const config = getConfig();
  
  if (!config.groqApiKey || !config.zenApiKey) {
    log.info('No API keys configured, showing setup...');
    await createSetupWindow();
    return;
  }
  
  await startServices();
  await createWindow();
}

async function startServices() {
  const config = getConfig();
  
  sttPort = config.sttPort || 8765;
  ttsPort = config.ttsPort || 8766;
  
  const availableSttPort = await findAvailablePort(sttPort);
  if (!availableSttPort) {
    throw new Error('Could not find available port for STT service');
  }
  sttPort = availableSttPort;
  
  const availableTtsPort = await findAvailablePort(ttsPort);
  if (!availableTtsPort) {
    throw new Error('Could not find available port for TTS service');
  }
  ttsPort = availableTtsPort;
  
  store.set('sttPort', sttPort);
  store.set('ttsPort', ttsPort);
  
  sttProcess = await startService('STT', 'stt', sttPort);
  ttsProcess = await startService('TTS', 'tts', ttsPort);
  
  log.info(`Waiting for STT service on port ${sttPort}...`);
  const sttReady = await pollHealth(sttPort);
  if (!sttReady) {
    throw new Error('STT service failed to start');
  }
  
  log.info(`Waiting for TTS service on port ${ttsPort}...`);
  const ttsReady = await pollHealth(ttsPort);
  if (!ttsReady) {
    throw new Error('TTS service failed to start');
  }
  
  log.info('All services ready');
}

let setupWindow = null;

async function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 500,
    height: 550,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'setup.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#000000',
    parent: null,
    modal: false,
  });
  
  setupWindow.once('ready-to-show', () => {
    setupWindow.show();
  });
  
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
  
  await setupWindow.loadFile(path.join(__dirname, 'setup.html'));
}

async function stopServices() {
  log.info('Stopping services...');
  
  if (sttProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(sttProcess.pid), '/f', '/t']);
      } else {
        sttProcess.kill('SIGTERM');
      }
    } catch (e) {
      log.error('Error stopping STT:', e);
    }
    sttProcess = null;
  }
  
  if (ttsProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(ttsProcess.pid), '/f', '/t']);
      } else {
        ttsProcess.kill('SIGTERM');
      }
    } catch (e) {
      log.error('Error stopping TTS:', e);
    }
    ttsProcess = null;
  }
}

ipcMain.handle('get-config', () => getConfig());

ipcMain.handle('save-config', async (event, config) => {
  await saveConfig(config);
  return getConfig();
});

ipcMain.handle('get-port', (event, service) => {
  if (service === 'stt') return sttPort;
  if (service === 'tts') return ttsPort;
  return null;
});

ipcMain.handle('restart-services', async () => {
  try {
    await stopServices();
    await startServices();
    return { success: true, sttPort, ttsPort };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-urls', () => ({
  sttUrl: `http://127.0.0.1:${sttPort}`,
  ttsUrl: `http://127.0.0.1:${ttsPort}`,
}));

ipcMain.on('setup-complete', async (event, config) => {
  await saveConfig(config);
  
  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }
  
  try {
    await startServices();
    await createWindow();
  } catch (error) {
    log.error('Failed to start services after setup:', error);
    dialog.showErrorBox('Startup Error', `Failed to start services: ${error.message}`);
    app.quit();
  }
});

app.whenReady().then(startApp).catch((error) => {
  log.error('Failed to start app:', error);
  app.exit(1);
});

app.on('before-quit', async (event) => {
  event.preventDefault();
  await stopServices();
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApp();
  }
});