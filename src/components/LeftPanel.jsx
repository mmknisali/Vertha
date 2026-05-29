import { useState, useEffect } from 'react';
import StatusIndicator from './StatusIndicator.jsx';

export default function LeftPanel({ systemStatus, memoryCount, pinnedMemories, activeTools, onSettingsClick }) {
  const [sessionTime, setSessionTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const memoryPercent = Math.min(100, (memoryCount / 50000) * 100);

  return (
    <div
      className="h-full flex flex-col p-4 panel"
      style={{
        width: '20%',
        minWidth: 220,
        background: 'rgba(0, 212, 255, 0.03)',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: 'linear-gradient(90deg, #00d4ff, #7b2fff, transparent)',
        }}
      />

      <div
        className="corner-accent absolute top-2 left-2 w-3 h-3"
        style={{ borderTop: '2px solid rgba(0, 212, 255, 0.4)', borderLeft: '2px solid rgba(0, 212, 255, 0.4)' }}
      />
      <div
        className="corner-accent absolute top-2 right-2 w-3 h-3"
        style={{ borderTop: '2px solid rgba(0, 212, 255, 0.4)', borderRight: '2px solid rgba(0, 212, 255, 0.4)' }}
      />
      <div
        className="corner-accent absolute bottom-2 left-2 w-3 h-3"
        style={{ borderBottom: '2px solid rgba(0, 212, 255, 0.4)', borderLeft: '2px solid rgba(0, 212, 255, 0.4)' }}
      />
      <div
        className="corner-accent absolute bottom-2 right-2 w-3 h-3"
        style={{ borderBottom: '2px solid rgba(0, 212, 255, 0.4)', borderRight: '2px solid rgba(0, 212, 255, 0.4)' }}
      />

      <button onClick={onSettingsClick} className="self-start mb-4 cursor-pointer hover:opacity-80 transition-opacity">
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00d4ff', letterSpacing: '0.3em', lineHeight: 1.2 }}>
          <div>V</div>
          <div>E</div>
          <div>R</div>
          <div>T</div>
          <div>H</div>
          <div>A</div>
        </div>
      </button>

      <div className="space-y-1 mb-6">
        <StatusIndicator label="STT" status={systemStatus.stt} detail="whisper-v3" />
        <StatusIndicator label="BIG PICKLE" status={systemStatus.llm} detail="opencode" />
        <StatusIndicator label="TTS" status={systemStatus.tts} detail="orpheus" />
        <StatusIndicator label="MEMORY" status={systemStatus.memory} detail={`${memoryCount?.toLocaleString() || 0} vectors`} />
        <StatusIndicator label="PC CTRL" status={systemStatus.pcControl ? 'online' : 'disabled'} detail={systemStatus.pcControl ? (systemStatus.pcDangerous ? 'enabled+dangerous' : 'enabled') : 'off'} />
        <StatusIndicator label="WEB" status={systemStatus.web} detail="search" />
      </div>

      <div className="mb-6">
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 4 }}>MEMORY USAGE</div>
        <div style={{ height: 4, background: 'rgba(0, 212, 255, 0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${memoryPercent}%`,
              height: '100%',
              background: memoryPercent > 80 ? '#ff2d6b' : memoryPercent > 60 ? '#ffaa00' : '#00d4ff',
              transition: 'width 0.5s ease, background 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', marginTop: 2 }}>
          {memoryCount?.toLocaleString() || 0} / 50,000
        </div>
      </div>

      <div className="mb-6">
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 4 }}>ACTIVE TOOLS</div>
        <div className="flex flex-wrap gap-1">
          {activeTools.map((tool) => (
            <span
              key={tool}
              style={{
                fontSize: 9,
                padding: '2px 6px',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 2,
                color: '#00d4ff',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {tool}
            </span>
          ))}
          {activeTools.length === 0 && (
            <span style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.3)', fontStyle: 'italic' }}>none</span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 4 }}>SESSION</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: '#e0f7ff' }}>
          {formatTime(elapsed)}
        </div>
      </div>

      <div className="flex-1">
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 6 }}>PINNED</div>
        <div className="space-y-2">
          {pinnedMemories?.slice(0, 3).map((mem, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: '#e0f7ff',
                padding: '4px 8px',
                background: 'rgba(0, 255, 157, 0.05)',
                borderLeft: '2px solid #00ff9d',
                fontFamily: 'Rajdhani, sans-serif',
              }}
            >
              {mem.content}
            </div>
          ))}
          {(!pinnedMemories || pinnedMemories.length === 0) && (
            <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.3)', fontStyle: 'italic' }}>no pinned memories</div>
          )}
        </div>
      </div>
    </div>
  );
}