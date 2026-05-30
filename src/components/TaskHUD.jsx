import { useState, useEffect } from 'react';

const STATUS_STYLES = {
  pending: { icon: '○', color: '#4a5568' },
  running: { icon: '◐', color: '#00d4ff' },
  done: { icon: '✓', color: '#00ff88' },
  error: { icon: '✗', color: '#ff6b6b' },
};

export default function TaskHUD({ task, onAbort }) {
  const [currentStep, setCurrentStep] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandedArtifacts, setExpandedArtifacts] = useState(false);

  useEffect(() => {
    if (!task) return;
    const runningStep = task.steps?.find(s => s.status === 'running');
    setCurrentStep(runningStep);
  }, [task]);

  useEffect(() => {
    if (!task || task.status === 'done' || task.status === 'failed') return;
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [task]);

  useEffect(() => {
    if (task) setElapsed(0);
  }, [task?.task_id]);

  if (!task) return null;

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const doneSteps = task.steps?.filter(s => s.status === 'done').length || 0;
  const totalSteps = task.steps?.length || 0;
  const progress = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.95) 0%, rgba(10, 0, 30, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        boxShadow: '0 0 30px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: task.status === 'failed' ? '#ff6b6b' : '#00ff88',
              boxShadow: `0 0 10px ${task.status === 'failed' ? '#ff6b6b' : '#00ff88'}`,
              animation: task.status === 'running' ? 'hudPulse 1.5s infinite' : 'none',
            }}
          />
          <span
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              color: '#00d4ff',
              letterSpacing: '0.15em',
            }}
          >
            TASK ENGINE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, color: '#00ff88' }}>
            {doneSteps}/{totalSteps}
          </span>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#00d4ff' }}>
            {formatTime(elapsed)}
          </span>
          {onAbort && task.status === 'running' && (
            <button
              onClick={onAbort}
              className="px-2 py-1 rounded text-xs cursor-pointer transition-all hover:bg-red-500/20"
              style={{
                background: 'rgba(255, 107, 107, 0.2)',
                border: '1px solid rgba(255, 107, 107, 0.5)',
                color: '#ff6b6b',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.05em',
              }}
            >
              ABORT
            </button>
          )}
        </div>
      </div>

      <div
        className="h-1"
        style={{
          background: 'rgba(0, 212, 255, 0.1)',
        }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: task.status === 'failed'
              ? 'linear-gradient(90deg, #ff6b6b, #ff2d6b)'
              : 'linear-gradient(90deg, #00d4ff, #00ff88)',
            boxShadow: `0 0 10px ${task.status === 'failed' ? '#ff6b6b' : '#00d4ff'}`,
          }}
        />
      </div>

      <div className="px-4 py-3">
        <div
          className="mb-3 truncate"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 13,
            color: '#e0f7ff',
            fontWeight: 600,
          }}
        >
          {task.goal || 'Executing task...'}
        </div>

        <div className="space-y-2">
          {task.steps?.map((step) => {
            const style = STATUS_STYLES[step.status] || STATUS_STYLES.pending;
            return (
              <div
                key={step.n}
                className="flex items-center gap-3 p-2 rounded transition-all"
                style={{
                  background: step.status === 'running'
                    ? 'rgba(0, 212, 255, 0.1)'
                    : step.status === 'done'
                      ? 'rgba(0, 255, 136, 0.05)'
                      : step.status === 'error'
                        ? 'rgba(255, 107, 107, 0.1)'
                        : 'transparent',
                  borderLeft: `2px solid ${style.color}`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: style.color,
                    width: 16,
                    textAlign: 'center',
                    animation: step.status === 'running' ? 'stepPulse 0.8s infinite' : 'none',
                  }}
                >
                  {style.icon}
                </span>

                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 12,
                    color: step.status === 'done' ? 'rgba(224, 247, 255, 0.6)' : '#e0f7ff',
                  }}
                >
                  {step.label || `Step ${step.n}`}
                </span>

                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    color: 'rgba(74, 144, 164, 0.8)',
                  }}
                >
                  {step.tool}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(task.artifacts?.length > 0 || task.issues?.length > 0) && (
        <div
          className="px-4 py-2 border-t"
          style={{ borderColor: 'rgba(0, 212, 255, 0.2)' }}
        >
          <button
            onClick={() => setExpandedArtifacts(!expandedArtifacts)}
            className="w-full flex items-center justify-between text-xs"
            style={{ color: 'rgba(224, 247, 255, 0.5)' }}
          >
            <span>{expandedArtifacts ? '▼' : '▶'} DETAILS</span>
            <span>{task.artifacts?.length || 0} artifacts, {task.issues?.length || 0} issues</span>
          </button>

          {expandedArtifacts && (
            <div className="mt-2 space-y-2">
              {task.artifacts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#00ff88', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: 4 }}>
                    ARTIFACTS
                  </div>
                  {task.artifacts.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        color: 'rgba(224, 247, 255, 0.7)',
                        padding: '2px 0',
                      }}
                    >
                      • {a}
                    </div>
                  ))}
                </div>
              )}
              {task.issues?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#ff6b6b', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: 4 }}>
                    ISSUES
                  </div>
                  {task.issues.map((issue, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        color: 'rgba(255, 107, 107, 0.8)',
                        padding: '2px 0',
                      }}
                    >
                      • {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes hudPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 5px currentColor; }
        }
        @keyframes stepPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}