import { useState, useRef, useCallback } from 'react';

const TTS_URL = import.meta.env.VITE_TTS_URL || 'http://localhost:8766';

function cleanTextForSpeech(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/–/g, ',')
    .replace(/\(([^)]*)\)/g, (_, inner) => inner.trim())
    .replace(/(\d+)\.\s*/g, (_, num) => `${num}. `)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef(null);
  const onEndRef = useRef(null);
  const onErrorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const playbackTimeoutRef = useRef(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playAudio = useCallback((url, timeoutMs) => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (playbackTimeoutRef.current) {
          clearTimeout(playbackTimeoutRef.current);
          playbackTimeoutRef.current = null;
        }
        audio.src = '';
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      playbackTimeoutRef.current = setTimeout(() => {
        console.warn('[useTTS] Playback timeout after', timeoutMs, 'ms');
        cleanup();
        resolve();
      }, timeoutMs);

      audio.onended = () => {
        console.log('[useTTS] Audio playback completed');
        cleanup();
        resolve();
      };

      audio.onerror = (e) => {
        console.error('[useTTS] Audio playback error:', e);
        cleanup();
        resolve();
      };

      const tryPlay = async () => {
        try {
          const ctx = getAudioCtx();
          if (ctx.state === 'suspended') {
            console.log('[useTTS] Resuming suspended AudioContext');
            await ctx.resume();
          }
          console.log('[useTTS] Starting audio playback');
          await audio.play();
        } catch (err) {
          console.error('[useTTS] play() failed:', err);
          cleanup();
          resolve();
        }
      };

      tryPlay();
    });
  }, [getAudioCtx]);

  const getAudioDuration = useCallback((blob) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration * 1000);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      const onEnd = onEndRef.current;
      onEndRef.current = null;
      onEnd?.();
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const { text, estimatedDurationMs } = queueRef.current.shift();
    const cleanedText = cleanTextForSpeech(text);
    console.log('[useTTS] Processing queue, text length:', cleanedText.length);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await fetch(`${TTS_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText }),
        signal: ctrl.signal,
      });
      abortRef.current = null;

      if (!res.ok) {
        throw new Error(`TTS request failed: ${res.status}`);
      }

      const blob = await res.blob();
      console.log('[useTTS] Received audio blob:', blob.size, 'bytes');

      const actualDuration = await getAudioDuration(blob);
      const durationToUse = actualDuration || estimatedDurationMs;
      const timeoutMs = durationToUse + 5000;

      console.log('[useTTS] Duration:', durationToUse.toFixed(0), 'ms, timeout:', timeoutMs, 'ms');

      const url = URL.createObjectURL(blob);
      await playAudio(url, timeoutMs);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[useTTS] TTS error:', err.message);
        onErrorRef.current?.(err.message);
      }
      isPlayingRef.current = false;
      setIsSpeaking(false);
      onEndRef.current = null;
      return;
    }

    if (isPlayingRef.current) {
      await processQueue();
    }
  }, [playAudio, getAudioDuration]);

  const speak = useCallback((text, { onEnd, onError } = {}) => {
    if (!text) return;

    const estimatedDurationMs = (text.length * 1000) / 15;

    onEndRef.current = onEnd;
    onErrorRef.current = onError || null;
    queueRef.current.push({ text, estimatedDurationMs });
    console.log('[useTTS] speak() called, queue length:', queueRef.current.length);

    if (!isPlayingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    isPlayingRef.current = false;
    setIsSpeaking(false);
    onEndRef.current = null;
    onErrorRef.current = null;
  }, []);

  return { speak, stop, isSpeaking };
}