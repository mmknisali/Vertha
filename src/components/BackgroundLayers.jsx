import { useMemo } from 'react';

const stars = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: Math.random() * 1.5 + 0.5,
  delay: Math.random() * 10,
  duration: 10 + Math.random() * 20,
}));

export default function BackgroundLayers() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(0, 212, 255, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 0% 0%, rgba(123, 47, 255, 0.02) 0%, transparent 40%)
          `,
        }}
      />

      <div className="stars-layer">
        {stars.map((star) => (
          <span
            key={star.id}
            style={{
              position: 'absolute',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              background: 'rgba(0, 212, 255, 0.5)',
              borderRadius: '50%',
              animation: `starDrift ${star.duration}s linear infinite`,
              animationDelay: `${star.delay}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'center bottom',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
        }}
      />

      <div
        className="absolute inset-0 scanlines"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          )`,
        }}
      />

      <style>{`
        @keyframes starDrift {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-10px) translateX(5px); }
          100% { transform: translateY(0) translateX(0); }
        }
        .stars-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}