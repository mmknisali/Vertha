import { useRef, useEffect } from 'react';
import Orb from './Orb.jsx';
import FrequencyVisualizer from './FrequencyVisualizer.jsx';
import ConversationLog from './ConversationLog.jsx';

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
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.monitoring;

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
          <Orb status={status} interimText={interimText} />
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

      <div
        className="flex items-center gap-3 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onManualTrigger}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: status === 'listening' ? '#22c55e' : status === 'monitoring' ? '#3b82f6' : '#666',
            boxShadow: `0 0 10px ${status === 'listening' ? '#22c55e' : status === 'monitoring' ? '#3b82f6' : '#666'}50`,
            animation: status === 'listening' ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 11,
            color: 'rgba(224, 247, 255, 0.5)',
            letterSpacing: '0.1em',
          }}
        >
          Say "Hey Vertha" or click to speak
        </span>
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