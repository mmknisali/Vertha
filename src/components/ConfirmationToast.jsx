import { useState, useEffect } from 'react';

export default function ConfirmationToast({ toast, onConfirm, onCancel, isSpeaking = false }) {
  const [progress, setProgress] = useState(100);
  const isDangerous = toast?.tier === 'dangerous';

  useEffect(() => {
    if (!toast || isDangerous || isSpeaking) return;

    const duration = toast.duration || 8000;
    const interval = 50;
    const decrement = (100 / duration) * interval;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onCancel();
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast, isDangerous, isSpeaking, onCancel]);

  if (!toast) return null;

  if (isDangerous) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ background: 'rgba(0, 0, 0, 0.8)' }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.95)',
            border: '2px solid #ff2d6b',
            borderRadius: 8,
            padding: 32,
            maxWidth: 500,
            animation: 'dangerPulse 1s ease-in-out infinite',
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: '#ff2d6b',
              marginBottom: 16,
              fontFamily: 'Orbitron, sans-serif',
            }}
          >
            ⚠ AUTHORIZATION REQUIRED
          </div>

          <div
            style={{
              fontSize: 18,
              color: '#ff2d6b',
              marginBottom: 16,
              fontFamily: 'Rajdhani, sans-serif',
              textAlign: 'center',
            }}
          >
            {toast.message}
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'rgba(255, 45, 107, 0.8)',
              marginBottom: 24,
              fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'center',
            }}
          >
            {toast.action}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={onConfirm}
              className="px-8 py-3 text-sm font-bold cursor-pointer transition-all hover:scale-105"
              style={{
                background: '#ff2d6b',
                border: 'none',
                borderRadius: 4,
                color: '#000',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
              }}
            >
              CONFIRM
            </button>
            <button
              onClick={onCancel}
              className="px-8 py-3 text-sm cursor-pointer transition-all hover:scale-105"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 45, 107, 0.5)',
                borderRadius: 4,
                color: '#ff2d6b',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
              }}
            >
              CANCEL
            </button>
          </div>
        </div>

        <style>{`
          @keyframes dangerPulse {
            0%, 100% { boxShadow: 0 0 20px rgba(255, 45, 107, 0.5); }
            50% { boxShadow: 0 0 40px rgba(255, 45, 107, 0.8); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 320,
        background: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderLeft: '4px solid #00d4ff',
        borderRadius: 4,
        padding: 16,
        backdropFilter: 'blur(10px)',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: '#00d4ff',
            fontFamily: 'Orbitron, sans-serif',
          }}
        >
          ACTION REQUIRED
        </span>
      </div>

      <div
        style={{
          fontSize: 12,
          color: '#e0f7ff',
          marginBottom: 4,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {toast.message}
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'rgba(224, 247, 255, 0.5)',
          marginBottom: 16,
          fontFamily: 'Rajdhani, sans-serif',
        }}
      >
        {toast.action}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 text-xs cursor-pointer transition-all hover:bg-cyan-500/20"
          style={{
            background: '#00d4ff',
            border: 'none',
            borderRadius: 2,
            color: '#000',
            fontFamily: 'Orbitron, sans-serif',
            letterSpacing: '0.1em',
          }}
        >
          YES
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-xs cursor-pointer transition-all hover:bg-white/10"
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 2,
            color: '#e0f7ff',
            fontFamily: 'Orbitron, sans-serif',
            letterSpacing: '0.1em',
          }}
        >
          NO
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'rgba(0, 212, 255, 0.1)',
          borderRadius: '0 0 4px 4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: '#00d4ff',
            transition: 'width 0.05s linear',
          }}
        />
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}