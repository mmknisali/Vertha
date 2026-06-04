import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useTTS from '../../src/hooks/useTTS.js';

describe('useTTS', () => {
  let mockOnEnd;
  let mockOnError;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOnEnd = vi.fn();
    mockOnError = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio data'], { type: 'audio/wav' })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with not speaking state', () => {
      const { result } = renderHook(() => useTTS());

      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('speak', () => {
    it('should queue text when speak is called', () => {
      const { result } = renderHook(() => useTTS());

      act(() => {
        result.current.speak('Hello world', { onEnd: mockOnEnd, onError: mockOnError });
      });

      expect(result.current.isSpeaking).toBe(true);
    });

    it('should not queue empty text', () => {
      const { result } = renderHook(() => useTTS());

      act(() => {
        result.current.speak('', { onEnd: mockOnEnd, onError: mockOnError });
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('stop', () => {
    it('should clear queue and reset speaking state when stopped', () => {
      const { result } = renderHook(() => useTTS());

      act(() => {
        result.current.speak('Hello', { onEnd: mockOnEnd, onError: mockOnError });
      });

      expect(result.current.isSpeaking).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });
});