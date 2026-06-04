import { vi } from 'vitest';

global.process = {
  ...process,
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
  resourcesPath: '/resources',
};

global.app = {
  isPackaged: false,
  requestSingleInstanceLock: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  exit: vi.fn(),
  getPath: vi.fn().mockReturnValue('/tmp/vertha'),
  on: vi.fn(),
  beforeQuit: vi.fn().mockImplementation((cb) => cb()),
};

global.BrowserWindow = vi.fn().mockImplementation(() => ({
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

global.ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
};

global.dialog = {
  showErrorBox: vi.fn(),
};

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation((event, cb) => {
      if (event === 'error') cb(new Error('spawn error'));
      if (event === 'close') cb(0);
      return this;
    }),
    kill: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  }),
}));

vi.mock('electron-store', () => {
  return vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(''),
    set: vi.fn(),
  }));
});