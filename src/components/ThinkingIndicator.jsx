import { useState, useEffect, useRef } from 'react';

export default function ThinkingIndicator({ isThinking, messages }) {
  const [dots, setDots] = useState('');
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isThinking) {
      setDots('');
      return;
    }
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [isThinking]);

  useEffect(() => {
    if (messages.length > lastMessageCount && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setLastMessageCount(messages.length);
  }, [messages, lastMessageCount]);

  return (
    <div
      className="absolute inset-0 flex flex-col pointer-events-none"
      style={{
        display: isThinking ? 'flex' : 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)',
      }}
    >
      <div
        className="flex items-center justify-center gap-2 py-2"
        style={{
          background: 'rgba(123, 47, 237, 0.1)',
          borderBottom: '1px solid rgba(123, 47, 237, 0.3)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#7c3aed',
            animation: 'thinkPulse 1s infinite',
          }}
        />
        <span
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            color: '#7c3aed',
            letterSpacing: '0.2em',
          }}
        >
          PROCESSING{dots}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-hidden"
        style={{ maxHeight: 100 }}
      >
        {messages.slice(-1)[0]?.content && (
          <div
            className="text-xs"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              color: 'rgba(224, 247, 255, 0.7)',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {messages.slice(-1)[0]?.content}
          </div>
        )}
      </div>

      <style>{`
        @keyframes thinkPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}