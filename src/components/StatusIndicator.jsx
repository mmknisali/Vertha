export default function StatusIndicator({ label, status, detail }) {
  const getState = () => {
    switch (status) {
      case 'online':
      case 'ready':
      case 'connected':
        return { color: '#00ff9d', animation: 'pulse' };
      case 'loading':
        return { color: '#ffaa00', animation: 'blink' };
      case 'error':
        return { color: '#ff2d6b', animation: 'none' };
      default:
        return { color: 'rgba(224, 247, 255, 0.4)', animation: 'none' };
    }
  };

  const state = getState();

  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: state.color,
          boxShadow: status !== 'disabled' ? `0 0 8px ${state.color}` : 'none',
          animation: state.animation === 'pulse' ? 'statusPulse 2s ease-in-out infinite' :
                    state.animation === 'blink' ? 'statusBlink 1s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', fontFamily: 'Rajdhani, sans-serif' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#e0f7ff', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
        {detail || status}
      </span>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
        @keyframes statusBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}