import { useRef, useEffect } from 'react';
import Orb from './Orb.jsx';
import FrequencyVisualizer from './FrequencyVisualizer.jsx';
import ConversationLog from './ConversationLog.jsx';
import { ENGINE_LABELS } from '../hooks/useSTT.js';

const VOICE_LABELS = { piper: 'Piper', groq: 'Groq speech' };

const STATUS_CONFIG = {
  monitoring: { color: '#3b82f6', text: 'MONITORING' },
  listening: { color: '#22c55e', text: 'LISTENING FOR COMMAND' },
  thinking: { color: '#eab308', text: 'PROCESSING' },
  speaking: { color: '#06b6d4', text: 'SPEAKING' },
  error: { color: '#ef4444', text: 'ERROR' },
};

export default function CenterPanel({
  status,
  interimText,
  messages,
  analyser,
  onManualTrigger,
  taskProgress,
  wakeMode = 'push',
  wakePhrase = 'jarvis',
  voiceOutOn = true,
  voiceEngine = null,
  speechEngine = null,
  aiReady = true,
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.monitoring;
  const busy = ['listening', 'processing', 'thinking', 'speaking'].includes(status);
  const buttonLabel = {
    listening: 'LISTENING...',
    processing: 'TRANSCRIBING...',
    thinking: 'THINKING...',
    speaking: 'SPEAKING...',
  }[status] || (wakeMode === 'push' ? 'PUSH TO TALK' : 'CLICK TO SPEAK');
  const wakeChip = wakeMode === 'model'
    ? 'Wake word: "Hey Vertha"'
    : wakeMode === 'keyword'
      ? `Wake phrase: "${wakePhrase}"`
      : 'Push to talk only';
  const chips = [
    speechEngine
      ? { ok: true, text: `Speech in: ${ENGINE_LABELS[speechEngine] || speechEngine}` }
      : { ok: false, text: 'Speech in: not ready (see the message at the top)' },
    voiceOutOn
      ? { ok: true, text: `Voice out: ${VOICE_LABELS[voiceEngine] || 'ready'}` }
      : { ok: false, text: 'Text only: voice out is not set up' },
    { ok: true, text: wakeChip },
    aiReady
      ? { ok: true, text: 'AI answers: ready' }
      : { ok: false, text: 'AI answers: need ZEN_API_KEY on the server' },
  ];

  return (
    <div
      className="h-full flex flex-col items-center justify-center"
      style={{ width: '50%', position: 'relative' }}
    >
      <div className="relative" style={{ marginBottom: 24 }}>
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${config.color}15 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
        <div className="relative" style={{ width: 300, height: 300 }}>
          <Orb status={status} interimText={interimText} taskProgress={taskProgress} />
          <FrequencyVisualizer analyser={analyser} isActive={status === 'listening'} />
        </div>
      </div>

      <div
        className="mb-4 px-6 py-2 rounded-full"
        style={{
          border: `1px solid ${config.color}`,
          color: config.color,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 12,
          letterSpacing: '0.2em',
          boxShadow: `0 0 20px ${config.color}30`,
        }}
      >
        {config.text}
      </div>

      {interimText && (
        <div
          className="mb-4 text-center"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 14,
            color: '#00ff9d',
            maxWidth: 400,
          }}
        >
          {interimText}<span className="animate-pulse">▌</span>
        </div>
      )}

      <button
        type="button"
        onClick={onManualTrigger}
        disabled={busy}
        aria-label={buttonLabel}
        style={{
          marginBottom: 12,
          padding: '10px 28px',
          borderRadius: 999,
          border: `1px solid ${config.color}`,
          background: busy ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 212, 255, 0.08)',
          color: busy ? 'rgba(224, 247, 255, 0.5)' : '#e0f7ff',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 12,
          letterSpacing: '0.16em',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {buttonLabel}
      </button>

      <div className="flex flex-wrap justify-center gap-2 mb-4" style={{ maxWidth: 560 }}>
        {chips.map((chip) => (
          <span
            key={chip.text}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 999,
              border: `1px solid ${chip.ok ? 'rgba(0, 212, 255, 0.18)' : 'rgba(251, 191, 36, 0.5)'}`,
              background: 'rgba(0, 0, 0, 0.35)',
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: 12,
              color: chip.ok ? 'rgba(224, 247, 255, 0.8)' : '#fbbf24',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: chip.ok ? '#22c55e' : '#fbbf24',
              }}
            />
            {chip.text}
          </span>
        ))}
      </div>

      <div
        className="flex-1 w-full max-w-xl"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          borderRadius: 8,
          padding: 16,
          maxHeight: 300,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: 'rgba(224, 247, 255, 0.3)',
            letterSpacing: '0.2em',
            marginBottom: 12,
            fontFamily: 'Orbitron, sans-serif',
          }}
        >
          CONVERSATION LOG
        </div>
        <ConversationLog messages={messages} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}