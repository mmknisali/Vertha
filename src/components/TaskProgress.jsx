import { useState, useEffect } from 'react';

const STEP_STATUS_ICONS = {
  pending: '○',
  running: '◐',
  done: '✓',
  error: '✗',
};

const STEP_STATUS_COLORS = {
  pending: '#4a5568',
  running: '#00d4ff',
  done: '#00ff88',
  error: '#ff6b6b',
};

export default function TaskProgress({ task, onAbort, isSpeaking }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  if (!task) return null;

  const toggleStep = (n) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(n)) {
      newExpanded.delete(n);
    } else {
      newExpanded.add(n);
    }
    setExpandedSteps(newExpanded);
  };

  const progress = task.progress || 0;
  const elapsed = task.elapsed || 0;
  const elapsedStr = elapsed < 60 ? `${elapsed.toFixed(0)}s` : `${Math.floor(elapsed / 60)}m ${(elapsed % 60).toFixed(0)}s`;

  return (
    <div
      style={{
        background: 'rgba(0, 20, 40, 0.8)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>
            TASK
          </span>
          <span style={{ color: '#e0f7ff', fontSize: 13, fontWeight: 600 }}>
            {task.goal || 'Executing task...'}
          </span>
        </div>
        {onAbort && (
          <button
            onClick={onAbort}
            style={{
              background: 'rgba(255, 107, 107, 0.2)',
              border: '1px solid rgba(255, 107, 107, 0.5)',
              borderRadius: 4,
              color: '#ff6b6b',
              fontSize: 10,
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: 'Orbitron, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            ABORT
          </button>
        )}
      </div>

      <div
        style={{
          height: 4,
          background: 'rgba(0, 212, 255, 0.1)',
          borderRadius: 2,
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
            transition: 'width 0.3s ease',
            borderRadius: 2,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#4a90a4', fontSize: 11 }}>
          {task.steps?.length || 0} steps
        </span>
        <span style={{ color: '#00d4ff', fontSize: 11 }}>
          {progress.toFixed(0)}% • {elapsedStr}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {task.steps?.map((step) => {
          const status = step.status || 'pending';
          const icon = STEP_STATUS_ICONS[status];
          const color = STEP_STATUS_COLORS[status];
          const isExpanded = expandedSteps.has(step.n);

          return (
            <div
              key={step.n}
              style={{
                background: status === 'running' ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                border: `1px solid ${color}40`,
                borderRadius: 4,
                padding: '8px 10px',
                cursor: step.result ? 'pointer' : 'default',
              }}
              onClick={() => step.result && toggleStep(step.n)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    color: color,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    animation: status === 'running' ? 'pulse 1s infinite' : 'none',
                  }}
                >
                  {icon}
                </span>
                <span style={{ color: '#e0f7ff', fontSize: 12, flex: 1 }}>
                  {step.label || `Step ${step.n}`}
                </span>
                <span style={{ color: '#4a90a4', fontSize: 10 }}>
                  {step.tool || ''}
                </span>
                {step.result && (
                  <span style={{ color: '#4a90a4', fontSize: 10 }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                )}
              </div>

              {isExpanded && step.result && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: status === 'error' ? '#ff6b6b' : '#00ff88',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 150,
                    overflow: 'auto',
                  }}
                >
                  {typeof step.result === 'object'
                    ? JSON.stringify(step.result, null, 2)
                    : String(step.result)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {task.status === 'failed' && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: 4,
            color: '#ff6b6b',
            fontSize: 11,
          }}
        >
          <strong>Task failed:</strong> {task.issues?.join(', ') || 'Unknown error'}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}