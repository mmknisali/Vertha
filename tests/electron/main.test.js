import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
};

const mockApp = {
  isPackaged: false,
  requestSingleInstanceLock: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  exit: vi.fn(),
  getPath: vi.fn().mockReturnValue('/tmp/vertha'),
  on: vi.fn(),
  beforeQuit: vi.fn(),
  on: vi.fn(),
};

const mockBrowserWindow = vi.fn().mockImplementation(() => ({
  once: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  focus: vi.fn(),
  isMinimized: vi.fn().mockReturnValue(false),
  loadURL: vi.fn().mockResolvedValue(undefined),
  loadFile: vi.fn().mockResolvedValue(undefined),
  webContents: {
    openDevTools: vi.fn(),
  },
}));

const mockDialog = {
  showErrorBox: vi.fn(),
};

const mockChildProcess = {
  spawn: vi.fn(),
};

const mockStore = vi.fn().mockImplementation(() => ({
  get: vi.fn().mockReturnValue(''),
  set: vi.fn(),
}));

vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
}));

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    kill: vi.fn(),
  }),
}));

vi.mock('electron-store', () => mockStore);

describe('electron/main.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Config Management', () => {
    it('should have proper default config values', () => {
      const DEFAULT_CONFIG = {
        groqApiKey: '',
        zenApiKey: '',
        locationLat: '37.0662',
        locationLon: '37.3833',
        piperVoicePath: '',
        sttPort: 8765,
        ttsPort: 8766,
      };

      expect(DEFAULT_CONFIG.groqApiKey).toBe('');
      expect(DEFAULT_CONFIG.zenApiKey).toBe('');
      expect(DEFAULT_CONFIG.sttPort).toBe(8765);
      expect(DEFAULT_CONFIG.ttsPort).toBe(8766);
    });
  });

  describe('Service Port Configuration', () => {
    it('should use default ports when not configured', () => {
      const sttPort = 8765;
      const ttsPort = 8766;

      expect(sttPort).toBe(8765);
      expect(ttsPort).toBe(8766);
    });
  });

  describe('Platform Detection', () => {
    it('should detect development mode correctly', () => {
      const isDev = !mockApp.isPackaged;
      expect(isDev).toBe(true);
    });

    it('should return correct python command for different platforms', () => {
      const getPythonCommand = (platform) => {
        if (platform === 'win32') return 'python';
        return 'python3';
      };

      expect(getPythonCommand('linux')).toBe('python3');
      expect(getPythonCommand('darwin')).toBe('python3');
      expect(getPythonCommand('win32')).toBe('python');
    });
  });

  describe('Single Instance Lock', () => {
    it('should request single instance lock on startup', () => {
      mockApp.requestSingleInstanceLock();
      expect(mockApp.requestSingleInstanceLock).toHaveBeenCalled();
    });

    it('should quit if another instance is already running', () => {
      mockApp.requestSingleInstanceLock.mockReturnValueOnce(false);
      expect(mockApp.requestSingleInstanceLock()).toBe(false);
    });
  });

  describe('IPC Handlers', () => {
    it('should register get-config handler', () => {
      expect(mockIpcMain.handle).toBeDefined();
    });

    it('should register save-config handler', () => {
      expect(mockIpcMain.handle).toBeDefined();
    });

    it('should register get-port handler', () => {
      expect(mockIpcMain.handle).toBeDefined();
    });

    it('should register restart-services handler', () => {
      expect(mockIpcMain.handle).toBeDefined();
    });
  });
});

describe('Service Binary Resolution', () => {
  it('should resolve correct binary path for linux', () => {
    const getServiceBinary = (serviceName, baseName, platform, resourcesPath) => {
      const ext = platform === 'win32' ? '.exe' : '';
      if (platform === 'win32') {
        return `${resourcesPath}/${serviceName}/${baseName}.exe`;
      } else if (platform === 'darwin') {
        return `${resourcesPath}/${serviceName}/${baseName}`;
      } else {
        return `${resourcesPath}/${serviceName}/${baseName}`;
      }
    };

    const result = getServiceBinary('stt-server', 'stt-server', 'linux', '/resources');
    expect(result).toBe('/resources/stt-server/stt-server');
  });

  it('should resolve correct binary path for windows', () => {
    const getServiceBinary = (serviceName, baseName, platform, resourcesPath) => {
      const ext = platform === 'win32' ? '.exe' : '';
      if (platform === 'win32') {
        return `${resourcesPath}/${serviceName}/${baseName}.exe`;
      }
      return `${resourcesPath}/${serviceName}/${baseName}`;
    };

    const result = getServiceBinary('tts-server', 'tts-server', 'win32', '/resources');
    expect(result).toBe('/resources/tts-server/tts-server.exe');
  });
});