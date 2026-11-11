import { useState, useEffect, useRef, useCallback } from 'react';
import { serviceUrl } from '../utils/endpoints.js';

import { getSttUrl } from '../utils/config.js';

const SILENCE_THRESHOLD = parseInt(import.meta.env.VITE_SILENCE_THRESHOLD || '10', 10) || 10;
const SILENCE_DURATION = parseInt(import.meta.env.VITE_SILENCE_DURATION || '1500', 10) || 1500;
const MAX_RECORDING_DURATION = parseInt(import.meta.env.VITE_MAX_RECORDING_DURATION || '15000', 10) || 15000;
const MIN_RECORDING_DURATION = 500;
const NOISE_WORDS = ['um', 'uhhm', 'uh', 'hmm', 'mm'];

// Names the app shows for the speech engine that is active.
export const ENGINE_LABELS = {
  groq: 'Groq Whisper',
  openai: 'OpenAI Whisper',
  browser: 'browser speech',
};

const BrowserSpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function stripNoiseWords(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => !NOISE_WORDS.includes(w));
  return words.join(' ');
}

function getMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export default function useSTT({ onTranscript, onError }) {
  const [status, setStatus] = useState('monitoring');
  const [interimVolume, setInterimVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [sttUrl, setSttUrl] = useState(() => serviceUrl('stt'));
  const [transcribeUrl, setTranscribeUrl] = useState(null);
  // The engine that answered the last request, or the one the server will try first.
  // 'browser' is the last resort when the server has no speech key at all.
  const [engine, setEngine] = useState('browser');
  const serverEnginesRef = useRef(null); // null = not checked yet

  const configRef = useRef({ onTranscript, onError });
  useEffect(() => {
    configRef.current = { onTranscript, onError };
  }, [onTranscript, onError]);

  useEffect(() => {
    async function initSttUrl() {
      const url = await getSttUrl();
      setSttUrl(url);
      setTranscribeUrl(`${url}/transcribe`);
      try {
        const res = await fetch(`${url}/health`);
        const data = res.ok ? await res.json() : {};
        serverEnginesRef.current = Array.isArray(data.speech_engines) ? data.speech_engines : [];
      } catch (_) {
        serverEnginesRef.current = [];
      }
      setEngine(serverEnginesRef.current[0] || 'browser');
    }
    initSttUrl();
  }, []);

  const ref = useRef({
    stream: null,
    recorder: null,
    audioCtx: null,
    analyser: null,
    dataArray: null,
    mimeType: '',
    rafId: null,
    noSpeechTimer: null,
    recordingStart: null,
    silenceStart: null,
    hasSpeechStarted: false,
    listeningChunks: [],
  });

  const cleanup = useCallback(() => {
    const r = ref.current;
    if (r.rafId) { cancelAnimationFrame(r.rafId); r.rafId = null; }
    if (r.noSpeechTimer) { clearTimeout(r.noSpeechTimer); r.noSpeechTimer = null; }
    if (r.browserRec) { try { r.browserRec.abort(); } catch (_) {} r.browserRec = null; }
    if (r.recorder && r.recorder.state !== 'inactive') {
      try { r.recorder.stop(); } catch (_) {}
    }
    if (r.audioCtx?.state !== 'closed') {
      try { r.audioCtx.close(); } catch (_) {}
    }
    if (r.stream) { r.stream.getTracks().forEach(t => t.stop()); }
    r.stream = null;
    r.recorder = null;
    r.audioCtx = null;
    r.analyser = null;
    r.dataArray = null;
    r.listeningChunks = [];
  }, []);

  const stopListening = useCallback(() => {
    const r = ref.current;
    if (r.rafId) { cancelAnimationFrame(r.rafId); r.rafId = null; }
    if (r.noSpeechTimer) { clearTimeout(r.noSpeechTimer); r.noSpeechTimer = null; }
    if (r.recorder && r.recorder.state !== 'inactive') {
      try { r.recorder.stop(); } catch (_) {}
    }
  }, []);

  const playBeep = useCallback((type) => {
    const r = ref.current;
    if (!r.audioCtx || r.audioCtx.state === 'closed') return;
    const osc = r.audioCtx.createOscillator();
    const gain = r.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(r.audioCtx.destination);
    if (type === 'activation') {
      osc.frequency.value = 880;
      osc.type = 'sine';
      const t = r.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'deactivation') {
      osc.frequency.value = 440;
      osc.type = 'sine';
      const t = r.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'error') {
      osc.frequency.value = 220;
      osc.type = 'square';
      const t = r.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }, []);

  const setupAudio = useCallback(async () => {
    const r = ref.current;
    if (r.stream) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    r.stream = stream;

    const mime = getMimeType();
    r.mimeType = mime;

    const audioCtx = new AudioContext();
    r.audioCtx = audioCtx;
    if (audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (_) {}
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    r.analyser = analyser;
    r.dataArray = new Uint8Array(analyser.frequencyBinCount);

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
  }, []);

  const transcribe = useCallback(async (blob) => {
    const fd = new FormData();
    // The blob keeps the browser's own type (webm/opus here), so the server sends it on unchanged.
    fd.append('file', blob, blob.type.startsWith('audio/mp4') ? 'audio.mp4' : 'audio.webm');
    const url = transcribeUrl || `${serviceUrl('stt')}/transcribe`;
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
      // The speech server answers a missing or rejected key with a readable message.
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Speech in failed (${res.status})`);
    }
    const data = await res.json();
    if (data.engine) setEngine(data.engine);
    return (data.text || '').trim();
  }, [transcribeUrl]);

  const startVolumeMonitoring = useCallback(() => {
    const r = ref.current;
    if (!r.analyser || !r.dataArray) return;

    r.silenceStart = null;
    r.hasSpeechStarted = false;

    const loop = () => {
      if (ref.current.mode !== 'listening') return;

      r.analyser.getByteFrequencyData(r.dataArray);
      let sum = 0;
      for (let i = 0; i < r.dataArray.length; i++) {
        sum += r.dataArray[i] * r.dataArray[i];
      }
      const rms = Math.sqrt(sum / r.dataArray.length);
      setInterimVolume(rms);

      const now = Date.now();
      const elapsed = now - r.recordingStart;

      if (rms > SILENCE_THRESHOLD) {
        r.hasSpeechStarted = true;
        r.silenceStart = null;
      } else if (r.hasSpeechStarted) {
        if (r.silenceStart === null) {
          r.silenceStart = now;
        } else if (now - r.silenceStart > SILENCE_DURATION) {
          if (elapsed > MIN_RECORDING_DURATION) {
            if (r.recorder && r.recorder.state !== 'inactive') {
              try { r.recorder.stop(); } catch (_) {}
            }
            return;
          }
        }
      }

      if (elapsed > MAX_RECORDING_DURATION) {
        if (r.recorder && r.recorder.state !== 'inactive') {
          try { r.recorder.stop(); } catch (_) {}
        }
        return;
      }

      r.rafId = requestAnimationFrame(loop);
    };

    r.rafId = requestAnimationFrame(loop);
  }, []);

  const finalizeListening = useCallback((chunks) => {
    const r = ref.current;
    if (r.rafId) { cancelAnimationFrame(r.rafId); r.rafId = null; }
    if (r.noSpeechTimer) { clearTimeout(r.noSpeechTimer); r.noSpeechTimer = null; }

    if (!chunks || !chunks.length) {
      setStatus('monitoring');
      ref.current.mode = 'monitoring';
      return;
    }

    setStatus('processing');

    const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });

    transcribe(blob).then((text) => {
      setStatus('monitoring');
      ref.current.mode = 'monitoring';
      setTranscript(text);
      const stripped = stripNoiseWords(text);
      if (!text || stripped.split(/\s+/).filter(w => w.length > 0).length < 2) {
        playBeep('deactivation');
        return;
      }
      configRef.current.onTranscript?.(text);
    }).catch((err) => {
      setStatus('monitoring');
      ref.current.mode = 'monitoring';
      if (err.name !== 'AbortError') {
        playBeep('error');
        configRef.current.onError?.(err.message);
      }
    });
  }, [transcribe, playBeep]);

  // Last resort: the browser's own recognition, used only when the server holds no speech key.
  const startBrowserListening = useCallback(() => {
    const r = ref.current;
    if (!BrowserSpeechRecognition) {
      configRef.current.onError?.('Speech in is off: no speech key on the server, and this browser has no built-in speech recognition');
      return;
    }
    const rec = new BrowserSpeechRecognition();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    r.browserRec = rec;
    r.mode = 'listening';
    setEngine('browser');
    setStatus('listening');
    playBeep('activation');

    let gotResult = false;
    rec.onresult = (e) => {
      gotResult = true;
      const text = (e.results[0]?.[0]?.transcript || '').trim();
      r.browserRec = null;
      r.mode = 'monitoring';
      setStatus('monitoring');
      setTranscript(text);
      if (text) configRef.current.onTranscript?.(text);
      else playBeep('deactivation');
    };
    rec.onerror = (e) => {
      r.browserRec = null;
      r.mode = 'monitoring';
      setStatus('monitoring');
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        playBeep('error');
        configRef.current.onError?.(`Browser speech failed: ${e.error}`);
      }
    };
    rec.onend = () => {
      if (!gotResult && r.browserRec === rec) {
        r.browserRec = null;
        r.mode = 'monitoring';
        setStatus('monitoring');
      }
    };
    try {
      rec.start();
    } catch (err) {
      r.browserRec = null;
      r.mode = 'monitoring';
      setStatus('monitoring');
      configRef.current.onError?.(`Browser speech failed: ${err.message}`);
    }
  }, [playBeep]);

  // Asks the speech server which engines hold a key. An unreachable server counts as none.
  const probeEngines = useCallback(async () => {
    const base = (transcribeUrl || `${serviceUrl('stt')}/transcribe`).replace(/\/transcribe$/, '');
    try {
      const res = await fetch(`${base}/health`);
      const data = res.ok ? await res.json() : {};
      serverEnginesRef.current = Array.isArray(data.speech_engines) ? data.speech_engines : [];
    } catch (_) {
      serverEnginesRef.current = [];
    }
    return serverEnginesRef.current;
  }, [transcribeUrl]);

  const startListeningMode = useCallback(async () => {
    const r = ref.current;
    // Checked on every listen, so a server that came up late is used without a reload.
    const engines = await probeEngines();
    if (engines.length === 0) {
      // Last resort: the browser's own recognition, when the server holds no speech key.
      startBrowserListening();
      return;
    }
    setEngine(engines[0]);
    try {
      await setupAudio();
    } catch (err) {
      configRef.current.onError?.(err.message);
      return;
    }

    r.mode = 'listening';
    r.recordingStart = Date.now();
    r.listeningChunks = [];
    r.silenceStart = null;
    r.hasSpeechStarted = false;

    setStatus('listening');
    playBeep('activation');

    // Native quality: the browser's own encoding at a high bitrate, sent without resampling.
    const recorderOptions = { audioBitsPerSecond: 128000 };
    if (r.mimeType) recorderOptions.mimeType = r.mimeType;
    const recorder = new MediaRecorder(r.stream, recorderOptions);
    r.recorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) r.listeningChunks.push(e.data);
    };

    recorder.onstop = () => {
      finalizeListening(r.listeningChunks);
    };

    recorder.start(100);
    startVolumeMonitoring();

    r.noSpeechTimer = setTimeout(() => {
      if (r.mode === 'listening' && !r.hasSpeechStarted) {
        if (r.recorder && r.recorder.state !== 'inactive') {
          try { r.recorder.stop(); } catch (_) {}
        }
        playBeep('deactivation');
      }
    }, 8000);
  }, [setupAudio, startVolumeMonitoring, finalizeListening, playBeep]);

  const startMonitoring = useCallback(async () => {
    ref.current.mode = 'monitoring';
    setStatus('monitoring');
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus('monitoring');
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    transcript,
    interimVolume,
    startListening: () => startListeningMode(),
    engine,
    startMonitoring,
    stopListening,
    stop,
    isSupported: !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
  };
}
