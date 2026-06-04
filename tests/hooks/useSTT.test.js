import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSTT from '../../src/hooks/useSTT.js';

describe('useSTT', () => {
  let mockOnTranscript;
  let mockOnError;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnTranscript = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with monitoring status', () => {
      const { result } = renderHook(() => useSTT({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      }));

      expect(result.current.status).toBe('monitoring');
      expect(result.current.transcript).toBe('');
      expect(result.current.interimVolume).toBe(0);
    });

    it('should report isSupported based on browser capabilities', () => {
      const { result } = renderHook(() => useSTT({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      }));

      expect(typeof result.current.isSupported).toBe('boolean');
    });
  });

  describe('startMonitoring', () => {
    it('should set status to monitoring when called', () => {
      const { result } = renderHook(() => useSTT({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      }));

      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.status).toBe('monitoring');
    });
  });

  describe('stop', () => {
    it('should reset status to monitoring when stopped', () => {
      const { result } = renderHook(() => useSTT({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      }));

      act(() => {
        result.current.stop();
      });

      expect(result.current.status).toBe('monitoring');
    });
  });
});