import { useEffect, useRef } from 'react';

export default function Orb({ status, interimText }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = 150;
    const centerY = 150;
    const radius = 80;

    for (let i = 0; i < 30; i++) {
      particlesRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: radius + 20 + Math.random() * 40,
        speed: 0.002 + Math.random() * 0.003,
        size: 1 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.5,
      });
    }

    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, 300, 300);

      const breathe = status === 'monitoring' ? Math.sin(phase * 0.5) * 0.1 + 1 : 1;
      const pulseScale = status === 'listening' ? 1.05 : breathe;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(pulseScale, pulseScale);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      if (status === 'error') {
        gradient.addColorStop(0, 'rgba(255, 45, 107, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 45, 107, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 45, 107, 0)');
      } else if (status === 'speaking') {
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(123, 47, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(123, 47, 255, 0)');
      } else if (status === 'processing' || status === 'thinking') {
        gradient.addColorStop(0, 'rgba(123, 47, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(123, 47, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(123, 47, 255, 0)');
      } else if (status === 'listening') {
        gradient.addColorStop(0, 'rgba(0, 255, 157, 0.9)');
        gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = status === 'error' ? 'rgba(255, 45, 107, 0.6)' : 'rgba(0, 212, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (status === 'processing' || status === 'thinking') {
        ctx.strokeStyle = 'rgba(123, 47, 255, 0.5)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          const lat = (i / 6) * Math.PI - Math.PI / 2;
          for (let j = 0; j < 50; j++) {
            const lon = (j / 50) * Math.PI * 2;
            const x = radius * 0.8 * Math.cos(lat) * Math.cos(lon + phase);
            const y = radius * 0.8 * Math.sin(lat);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          const lon = (i / 6) * Math.PI * 2 + phase;
          const rx = Math.abs(radius * 0.8 * Math.cos(0) * Math.cos(lon));
          const ry = Math.abs(radius * 0.8 * Math.sin(lon));
          if (rx > 0.5 && ry > 0.5) {
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      if (status === 'speaking') {
        for (let i = 0; i < 3; i++) {
          const ringRadius = radius + 20 + i * 15 + ((phase * 50) % 45);
          const ringOpacity = Math.max(0, 0.4 - i * 0.1 - (ringRadius - radius - 20) / 100);
          ctx.beginPath();
          ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 212, 255, ${ringOpacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      ctx.restore();

      if (status === 'monitoring' || status === 'listening') {
        const scanAngle = status === 'monitoring' ? phase * 0.3 : phase * 1.5;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(scanAngle);

        ctx.beginPath();
        ctx.arc(0, 0, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        ctx.setLineDash([5, 10]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        const dotCount = 8;
        for (let i = 0; i < dotCount; i++) {
          const dotAngle = (i / dotCount) * Math.PI * 2;
          const dotRadius = radius + 15 + Math.sin(phase * 2 + i) * 5;
          const dotX = Math.cos(dotAngle) * dotRadius;
          const dotY = Math.sin(dotAngle) * dotRadius;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
          ctx.fill();
        }

        ctx.restore();
      }

      particlesRef.current.forEach((p) => {
        p.angle += p.speed;
        const x = centerX + Math.cos(p.angle) * p.radius;
        const y = centerY + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity * 0.3})`;
        ctx.fill();
      });

      phase += 0.016;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status]);

  return (
    <div className="relative" style={{ width: 300, height: 300 }}>
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="absolute inset-0"
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: 'scale(0.4)' }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-20">
          <defs>
            <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#orbGlow)" />
        </svg>
      </div>
    </div>
  );
}