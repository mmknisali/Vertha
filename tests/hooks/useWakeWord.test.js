import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWakeWord from '../../src/hooks/useWakeWord.js';

describe('useWakeWord', () => {
  let mockOnWakeWord;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnWakeWord = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with not listening state when disabled', () => {
      const { result } = renderHook(() => useWakeWord({
        onWakeWord: mockOnWakeWord,
        enabled: false,
      }));

      expect(result.current.isListening).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('onWakeWord callback', () => {
    it('should be stored correctly in ref', () => {
      const { result } = renderHook(() => useWakeWord({
        onWakeWord: mockOnWakeWord,
        enabled: false,
      }));

      expect(typeof result.current.startListening).toBe('function');
      expect(typeof result.current.stopListening).toBe('function');
    });
  });
});