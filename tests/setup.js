import '@testing-library/jest-dom';
import { vi } from 'vitest';

global.fetch = vi.fn();

window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

window.AudioContext = vi.fn().mockImplementation(() => ({
  state: 'running',
  sampleRate: 48000,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 256,
    smoothingTimeConstant: 0.3,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
  }),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  createScriptProcessor: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  }),
  createOscillator: vi.fn().mockReturnValue({
    frequency: { value: 440 },
    type: 'sine',
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  }),
  destination: {},
  currentTime: 0,
}));

window.webkitAudioContext = window.AudioContext;

navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: vi.fn().mockReturnValue([]),
  }),
};

Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost:5173', origin: 'http://localhost:5173' },
  writable: true,
});

window.vertha = {
  sttUrl: 'http://localhost:8765',
  ttsUrl: 'http://localhost:8766',
  platform: 'linux',
  getConfig: vi.fn().mockResolvedValue({
    groqApiKey: 'test-key',
    zenApiKey: 'test-key',
    locationLat: '37.0662',
    locationLon: '37.3833',
    piperVoicePath: '/path/to/voice.onnx',
    sttPort: 8765,
    ttsPort: 8766,
  }),
  saveConfig: vi.fn().mockResolvedValue({}),
  getPort: vi.fn().mockResolvedValue(8765),
  restartServices: vi.fn().mockResolvedValue({ success: true }),
  getUrls: vi.fn().mockResolvedValue({
    sttUrl: 'http://127.0.0.1:8765',
    ttsUrl: 'http://127.0.0.1:8766',
  }),
  onSetupComplete: vi.fn(),
};