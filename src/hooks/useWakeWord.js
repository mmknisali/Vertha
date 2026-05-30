import { useState, useEffect, useRef, useCallback } from 'react';

import { getSttUrl } from '../utils/config.js';

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_MS = 1000;

export default function useWakeWord({ onWakeWord, enabled = true }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const [sttUrl, setSttUrl] = useState('http://localhost:8765');
  const [wakewordUrl, setWakewordUrl] = useState(null);

  const ref = useRef({
    stream: null,
    audioCtx: null,
    scriptProcessor: null,
    monitorInterval: null,
    pcmBuffer: [],
    mediaStreamSource: null,
  });

  useEffect(() => {
    async function initSttUrl() {
      const url = await getSttUrl();
      setSttUrl(url);
      setWakewordUrl(`${url}/wakeword`);
    }
    initSttUrl();
  }, []);

  const cleanup = useCallback(() => {
    const r = ref.current;
    if (r.scriptProcessor) {
      try { r.scriptProcessor.disconnect(); } catch (_) {}
      r.scriptProcessor = null;
    }
    if (r.mediaStreamSource) {
      try { r.mediaStreamSource.disconnect(); } catch (_) {}
      r.mediaStreamSource = null;
    }
    if (r.monitorInterval) {
      clearInterval(r.monitorInterval);
      r.monitorInterval = null;
    }
    if (r.audioCtx?.state !== 'closed') {
      try { r.audioCtx.close(); } catch (_) {}
      r.audioCtx = null;
    }
    if (r.stream) {
      r.stream.getTracks().forEach(t => t.stop());
      r.stream = null;
    }
    r.pcmBuffer = [];
  }, []);

  const onWakeWordRef = useRef(onWakeWord);
  onWakeWordRef.current = onWakeWord;

  const startListening = useCallback(async () => {
    const r = ref.current;
    if (r.stream) return;

    try {
      r.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      r.audioCtx = new AudioContext();
      const nativeRate = r.audioCtx.sampleRate;
      console.log('[WakeWord] Native AudioContext sample rate:', nativeRate);

      if (r.audioCtx.state === 'suspended') {
        await r.audioCtx.resume();
      }

      r.mediaStreamSource = r.audioCtx.createMediaStreamSource(r.stream);

      const bufferSize = 4096;
      r.scriptProcessor = r.audioCtx.createScriptProcessor(bufferSize, 1, 1);
      r.scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
          r.pcmBuffer.push(inputData[i]);
        }
      };

      r.mediaStreamSource.connect(r.scriptProcessor);
      r.scriptProcessor.connect(r.audioCtx.destination);

      const samplesPerChunk = Math.floor(nativeRate * (CHUNK_MS / 1000));
      console.log('[WakeWord] Expected samples per chunk:', samplesPerChunk);

      r.monitorInterval = setInterval(async () => {
        if (r.pcmBuffer.length < samplesPerChunk) {
          return;
        }

        let samples = new Float32Array(r.pcmBuffer.splice(0, samplesPerChunk));

        if (nativeRate !== TARGET_SAMPLE_RATE) {
          const ratio = nativeRate / TARGET_SAMPLE_RATE;
          const targetLength = Math.floor(samples.length / ratio);
          const resampled = new Float32Array(targetLength);
          for (let i = 0; i < targetLength; i++) {
            const srcIdx = Math.floor(i * ratio);
            resampled[i] = samples[srcIdx];
          }
          samples = resampled;
          console.log(`[WakeWord] Resampled from ${nativeRate} to ${TARGET_SAMPLE_RATE}: ${resampled.length} samples`);
        }

        const wavBuffer = encodeWAV(samples, TARGET_SAMPLE_RATE);

        try {
          const response = await fetch(wakewordUrl || 'http://localhost:8765/wakeword', {
            method: 'POST',
            body: wavBuffer,
            headers: { 'Content-Type': 'audio/wav' },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('[WakeWord] Response:', data);
            if (data.detected) {
              console.log('[WakeWord] DETECTED!');
              onWakeWordRef.current?.();
            }
          } else {
            const text = await response.text().catch(() => '');
            console.error(`Wake word endpoint error: ${response.status} ${text}`);
          }
        } catch (err) {
          console.error('Wake word detection error:', err);
        }
      }, CHUNK_MS);

      setIsListening(true);
      setError(null);
      console.log('[WakeWord] Started successfully');
    } catch (err) {
      console.error('Wake word initialization error:', err);
      setError(err.message);
      cleanup();
    }
  }, [cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
    setIsListening(false);
  }, [cleanup]);

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return cleanup;
  }, [enabled, startListening, stopListening, cleanup]);

  return {
    isListening,
    error,
    startListening,
    stopListening,
  };
}

function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}