import { useEffect, useRef, useState } from 'react';

function TypewriterText({ text, speed = 30, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (!text) {
      setDisplayed('');
      return;
    }

    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayed}
      <span className="typewriter-cursor">▋</span>
    </span>
  );
}

export default function ConversationLog({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      style={{
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: 13,
      }}
    >
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={i}
            className="mb-4"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                color: isUser ? 'rgba(224, 247, 255, 0.4)' : '#00d4ff',
                marginBottom: 4,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {isUser ? '[ INPUT ]' : '[ V.E.R.T.H.A. ]'}
            </div>

            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                background: isUser ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0, 212, 255, 0.05)',
                border: `1px solid ${isUser ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 212, 255, 0.15)'}`,
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  color: isUser ? '#e0f7ff' : 'rgba(0, 212, 255, 0.9)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {isUser ? (
                  msg.content
                ) : (
                  <TypewriterText text={msg.content} speed={20} />
                )}
              </div>
            </div>

            {i < messages.length - 1 && (
              <div
                style={{
                  width: '100%',
                  height: 1,
                  background: 'rgba(0, 212, 255, 0.1)',
                  margin: '12px 0',
                }}
              />
            )}
          </div>
        );
      })}

      <style>{`
        .typewriter-cursor {
          animation: blink 1s step-end infinite;
          color: #00d4ff;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}