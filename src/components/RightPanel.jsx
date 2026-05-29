import { useState, useEffect } from 'react';

export default function RightPanel({ weather, spotify, tasks }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const weatherIcons = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    stormy: '⛈️',
    snowy: '❄️',
    foggy: '🌫️',
    default: '🌤️',
  };

  const getWeatherIcon = (condition) => {
    const c = condition?.toLowerCase() || '';
    if (c.includes('rain') || c.includes('drizzle')) return weatherIcons.rainy;
    if (c.includes('thunder') || c.includes('storm')) return weatherIcons.stormy;
    if (c.includes('snow')) return weatherIcons.snowy;
    if (c.includes('fog') || c.includes('mist')) return weatherIcons.foggy;
    if (c.includes('cloud')) return weatherIcons.cloudy;
    if (c.includes('clear') || c.includes('sun')) return weatherIcons.sunny;
    return weatherIcons.default;
  };

  return (
    <div
      className="h-full flex flex-col p-4 gap-6"
      style={{
        width: '30%',
        minWidth: 280,
        background: 'rgba(0, 212, 255, 0.03)',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: 'linear-gradient(90deg, transparent, #7b2fff, #00d4ff)',
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

      <div className="text-center">
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 32, color: '#00d4ff', letterSpacing: '0.1em' }}>
          {formatTime(currentTime)}
        </div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 13, color: 'rgba(224, 247, 255, 0.5)', letterSpacing: '0.2em' }}>
          {formatDate(currentTime)}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          borderRadius: 4,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 8 }}>WEATHER</div>
        {weather ? (
          <div className="flex items-center gap-4">
            <span style={{ fontSize: 32 }}>{getWeatherIcon(weather.condition)}</span>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 24, color: '#e0f7ff' }}>
                {weather.current_temp}°C
              </div>
              <div style={{ fontSize: 11, color: 'rgba(224, 247, 255, 0.6)', fontFamily: 'Rajdhani, sans-serif' }}>
                {weather.condition}
              </div>
            </div>
            <div className="ml-auto text-right" style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', fontFamily: 'Rajdhani, sans-serif' }}>
              <div>H: {weather.high}°</div>
              <div>L: {weather.low}°</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(224, 247, 255, 0.3)', fontStyle: 'italic' }}>unavailable</div>
        )}
      </div>

      {spotify && (
        <div
          style={{
            background: 'rgba(0, 255, 157, 0.03)',
            border: '1px solid rgba(0, 255, 157, 0.15)',
            borderRadius: 4,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(0, 255, 157, 0.6)', letterSpacing: '0.15em', marginBottom: 8 }}>SPOTIFY</div>
          <div style={{ fontSize: 13, color: '#e0f7ff', fontFamily: 'Rajdhani, sans-serif', marginBottom: 4 }}>
            {spotify.title}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(224, 247, 255, 0.5)', fontFamily: 'Rajdhani, sans-serif', marginBottom: 8 }}>
            {spotify.artist}
          </div>
          <div style={{ height: 3, background: 'rgba(0, 255, 157, 0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                width: `${spotify.progress || 0}%`,
                height: '100%',
                background: '#00ff9d',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1">
        <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', marginBottom: 8 }}>TASK QUEUE</div>
        <div className="space-y-2">
          {tasks?.length > 0 ? (
            tasks.map((task, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: 'rgba(123, 47, 255, 0.05)',
                  border: '1px solid rgba(123, 47, 255, 0.2)',
                  borderRadius: 3,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: task.completed ? '#00ff9d' : task.inProgress ? '#ffaa00' : 'rgba(224, 247, 255, 0.3)',
                    boxShadow: task.inProgress ? '0 0 8px #ffaa00' : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: task.completed ? 'rgba(224, 247, 255, 0.4)' : '#e0f7ff',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    fontFamily: 'Rajdhani, sans-serif',
                  }}
                >
                  {task.name}
                </span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.3)', fontStyle: 'italic' }}>no active tasks</div>
          )}
        </div>
      </div>
    </div>
  );
}