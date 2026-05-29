export default function SettingsDrawer({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  wakeWord,
  setWakeWord,
  locationLat,
  setLocationLat,
  locationLon,
  setLocationLon,
  podcastUri,
  setPodcastUri,
  pcControl,
  setPcControl,
  dangerousTier,
  setDangerousTier,
  proactiveSuggestions,
  setProactiveSuggestions,
  onClearMemory,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      <div
        className="w-80 h-full overflow-y-auto"
        style={{
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderLeft: 'none',
          backdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-6"
          style={{
            borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 14,
                color: '#00d4ff',
                letterSpacing: '0.2em',
              }}
            >
              SETTINGS
            </span>
            <button
              onClick={onClose}
              className="text-cyan-400/60 hover:text-cyan-400 text-xl cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              API KEY
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter OpenCode API key..."
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: 4,
                color: '#e0f7ff',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              WAKE WORD
            </label>
            <input
              type="text"
              value={wakeWord}
              onChange={(e) => setWakeWord(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: 4,
                color: '#e0f7ff',
                fontSize: 12,
                fontFamily: 'Rajdhani, sans-serif',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              LOCATION
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={locationLat}
                onChange={(e) => setLocationLat(e.target.value)}
                placeholder="Latitude"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: 4,
                  color: '#e0f7ff',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <input
                type="text"
                value={locationLon}
                onChange={(e) => setLocationLon(e.target.value)}
                placeholder="Longitude"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: 4,
                  color: '#e0f7ff',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              PODCAST URI
            </label>
            <input
              type="text"
              value={podcastUri}
              onChange={(e) => setPodcastUri(e.target.value)}
              placeholder="spotify:show:..."
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: 4,
                color: '#e0f7ff',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>

          <div className="space-y-3">
            <label style={{ fontSize: 10, color: 'rgba(224, 247, 255, 0.4)', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>
              FEATURES
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pcControl}
                onChange={(e) => setPcControl(e.target.checked)}
                style={{ accentColor: '#00d4ff' }}
              />
              <span style={{ fontSize: 12, color: '#e0f7ff', fontFamily: 'Rajdhani, sans-serif' }}>
                PC Control
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dangerousTier}
                onChange={(e) => setDangerousTier(e.target.checked)}
                style={{ accentColor: '#ff2d6b' }}
              />
              <span style={{ fontSize: 12, color: '#e0f7ff', fontFamily: 'Rajdhani, sans-serif' }}>
                Dangerous Tier Actions
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={proactiveSuggestions}
                onChange={(e) => setProactiveSuggestions(e.target.checked)}
                style={{ accentColor: '#00d4ff' }}
              />
              <span style={{ fontSize: 12, color: '#e0f7ff', fontFamily: 'Rajdhani, sans-serif' }}>
                Proactive Suggestions
              </span>
            </label>
          </div>

          <div style={{ borderTop: '1px solid rgba(0, 212, 255, 0.1)', paddingTop: 16 }}>
            <button
              onClick={onClearMemory}
              className="w-full py-3 text-xs cursor-pointer transition-all hover:bg-red-500/10"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 45, 107, 0.3)',
                borderRadius: 4,
                color: '#ff2d6b',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
              }}
            >
              CLEAR MEMORY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}