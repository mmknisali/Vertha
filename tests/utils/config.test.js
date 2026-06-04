import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig, getSttUrl, getTtsUrl, saveConfig, isElectron } from '../../src/utils/config.js';

describe('config.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config from window.vertha when in electron context', async () => {
      const originalGetConfig = window.vertha.getConfig;
      window.vertha.getConfig = vi.fn().mockResolvedValue({
        groqApiKey: 'test-key',
        zenApiKey: 'test-key',
        locationLat: '37.0662',
        locationLon: '37.3833',
        piperVoicePath: '/path/to/voice.onnx',
        sttPort: 8765,
        ttsPort: 8766,
      });

      const result = await getConfig();
      expect(window.vertha.getConfig).toHaveBeenCalled();
      expect(result.groqApiKey).toBe('test-key');
      window.vertha.getConfig = originalGetConfig;
    });
  });

  describe('getSttUrl', () => {
    it('should return sttUrl from window.vertha when available', async () => {
      const originalVertha = window.vertha;
      window.vertha = {
        ...originalVertha,
        sttUrl: 'http://localhost:8765',
      };
      const result = await getSttUrl();
      expect(result).toBe('http://localhost:8765');
      window.vertha = originalVertha;
    });

    it('should fallback to dev default when not in electron', async () => {
      const originalVertha = window.vertha;
      window.vertha = undefined;
      const result = await getSttUrl();
      expect(result).toBe('http://localhost:8765');
      window.vertha = originalVertha;
    });
  });

  describe('getTtsUrl', () => {
    it('should return ttsUrl from window.vertha when available', async () => {
      const originalVertha = window.vertha;
      window.vertha = {
        ...originalVertha,
        ttsUrl: 'http://localhost:8766',
      };
      const result = await getTtsUrl();
      expect(result).toBe('http://localhost:8766');
      window.vertha = originalVertha;
    });

    it('should fallback to dev default when not in electron', async () => {
      const originalVertha = window.vertha;
      window.vertha = undefined;
      const result = await getTtsUrl();
      expect(result).toBe('http://localhost:8766');
      window.vertha = originalVertha;
    });
  });

  describe('saveConfig', () => {
    it('should call window.vertha.saveConfig when in electron context', async () => {
      const originalSaveConfig = window.vertha.saveConfig;
      window.vertha.saveConfig = vi.fn().mockResolvedValue({});
      const config = { groqApiKey: 'new-key' };
      await saveConfig(config);
      expect(window.vertha.saveConfig).toHaveBeenCalledWith(config);
      window.vertha.saveConfig = originalSaveConfig;
    });
  });

  describe('isElectron', () => {
    it('should return truthy value when window.vertha exists', () => {
      expect(isElectron()).toBeTruthy();
    });

    it('should return falsy when window.vertha does not exist', () => {
      const originalVertha = window.vertha;
      window.vertha = undefined;
      expect(isElectron()).toBeFalsy();
      window.vertha = originalVertha;
    });
  });
});