import { describe, it, expect } from 'vitest';
import { serviceUrl } from '../../src/utils/endpoints.js';

const page = (hostname) => ({ hostname });

describe('serviceUrl', () => {
  it('defaults to localhost for local development', () => {
    expect(serviceUrl('tts', {}, page('localhost'))).toBe('http://localhost:8766');
    expect(serviceUrl('stt', {}, page('localhost'))).toBe('http://localhost:8765');
  });

  it('uses the page host, so a laptop reaches the servers on the server', () => {
    expect(serviceUrl('tts', {}, page('vertha.example.net'))).toBe('http://vertha.example.net:8766');
    expect(serviceUrl('stt', {}, page('192.168.1.20'))).toBe('http://192.168.1.20:8765');
  });

  it('falls back to localhost when the page has no host (Electron file page)', () => {
    expect(serviceUrl('tts', {}, page(''))).toBe('http://localhost:8766');
    expect(serviceUrl('tts', {}, undefined)).toBe('http://localhost:8766');
  });

  it('takes a full URL from env and drops a trailing slash', () => {
    expect(serviceUrl('tts', { VITE_TTS_URL: 'https://api.example.net/' }, page('x'))).toBe('https://api.example.net');
    expect(serviceUrl('stt', { VITE_STT_URL: 'http://10.0.0.5:9000' }, page('x'))).toBe('http://10.0.0.5:9000');
  });

  it('takes only a port from env when the host should stay the page host', () => {
    expect(serviceUrl('tts', { VITE_TTS_PORT: '9766' }, page('my-server'))).toBe('http://my-server:9766');
    expect(serviceUrl('stt', { VITE_STT_PORT: '9765' }, page('my-server'))).toBe('http://my-server:9765');
  });
});
