import { useEffect, useRef, useState } from 'react';

const STATUS_COLORS = {
  monitoring: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)', ring: '#00d4ff' },
  listening: { core: '#00ff9d', glow: 'rgba(0, 255, 157, 0.5)', ring: '#00ff9d' },
  thinking: { core: '#7c3aed', glow: 'rgba(124, 58, 237, 0.5)', ring: '#7c3aed' },
  processing: { core: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)', ring: '#8b5cf6' },
  speaking: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.5)', ring: '#06b6d4' },
  error: { core: '#ff2d6b', glow: 'rgba(255, 45, 107, 0.5)', ring: '#ff2d6b' },
};

export default function Orb({ status, interimText, taskProgress }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const [energyPulse, setEnergyPulse] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = 150;
    const centerY = 150;
    const radius = 70;

    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: radius + 25 + Math.random() * 50,
        speed: 0.003 + Math.random() * 0.004,
        size: 1 + Math.random() * 2.5,
        opacity: 0.2 + Math.random() * 0.6,
        decay: 0.001 + Math.random() * 0.002,
        hue: Math.random() * 30 - 15,
      });
    }

    let phase = 0;
    let lastStatus = status;

    const draw = () => {
      ctx.clearRect(0, 0, 300, 300);
      const colors = STATUS_COLORS[status] || STATUS_COLORS.monitoring;

      if (status !== lastStatus) {
        lastStatus = status;
        setEnergyPulse(1);
      }
      if (energyPulse > 0) {
        setEnergyPulse(prev => Math.max(0, prev - 0.02));
      }

      const breathe = status === 'monitoring' ? Math.sin(phase * 0.4) * 0.08 + 1 : 1;
      const pulseScale = status === 'listening' ? 1.06 : status === 'thinking' ? 1.02 + Math.sin(phase * 2) * 0.02 : breathe;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(pulseScale, pulseScale);

      if (energyPulse > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 30 + (1 - energyPulse) * 40, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${status === 'error' ? '255,45,107' : '0,212,255'}, ${energyPulse * 0.6})`;
        ctx.lineWidth = 3 + energyPulse * 5;
        ctx.stroke();
      }

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(0.4, colors.glow.replace('0.5', '0.3').replace('0.4', '0.2'));
      gradient.addColorStop(0.7, colors.glow.replace('0.5', '0.15').replace('0.4', '0.1'));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.4);
      coreGradient.addColorStop(0, status === 'error' ? 'rgba(255, 45, 107, 0.9)' : 'rgba(0, 212, 255, 0.7)');
      coreGradient.addColorStop(0.5, status === 'error' ? 'rgba(255, 45, 107, 0.4)' : 'rgba(0, 212, 255, 0.3)');
      coreGradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `${colors.ring}40`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius - 5, 0, Math.PI * 2);
      ctx.strokeStyle = `${colors.ring}20`;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (status === 'thinking' || status === 'processing') {
        ctx.strokeStyle = `${colors.ring}50`;
        ctx.lineWidth = 0.5;
        const ringCount = 5;
        for (let i = 0; i < ringCount; i++) {
          const ringPhase = phase * 0.8 + (i / ringCount) * Math.PI * 2;
          const ringRadius = radius * 0.5 + (i + 1) * (radius * 0.5 / ringCount);
          ctx.beginPath();
          for (let j = 0; j < 60; j++) {
            const theta = (j / 60) * Math.PI * 2;
            const wobble = Math.sin(theta * 3 + ringPhase) * 3;
            const r = ringRadius + wobble;
            const x = r * Math.cos(theta);
            const y = r * Math.sin(theta);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      if (status === 'speaking') {
        for (let i = 0; i < 5; i++) {
          const wavePhase = (phase * 80 + i * 30) % 80;
          const waveRadius = radius + 15 + wavePhase;
          const waveOpacity = Math.max(0, 0.5 - wavePhase / 80 - i * 0.08);
          ctx.beginPath();
          ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 212, 255, ${waveOpacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const barCount = 32;
        const innerR = radius * 0.35;
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const barHeight = (Math.sin(phase * 3 + i * 0.5) * 0.5 + 0.5) * 15 + 5;
          const x1 = Math.cos(angle) * innerR;
          const y1 = Math.sin(angle) * innerR;
          const x2 = Math.cos(angle) * (innerR + barHeight);
          const y2 = Math.sin(angle) * (innerR + barHeight);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(0, 212, 255, 0.6)`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      ctx.restore();

      if (status === 'monitoring' || status === 'listening') {
        const scanSpeed = status === 'listening' ? phase * 2 : phase * 0.4;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(scanSpeed);

        ctx.beginPath();
        ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
        ctx.strokeStyle = `${colors.ring}25`;
        ctx.setLineDash([3, 12]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(0, 0, radius + 20, 0, Math.PI * 2);
        ctx.strokeStyle = `${colors.ring}15`;
        ctx.setLineDash([1, 8]);
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);

        const dotCount = 12;
        for (let i = 0; i < dotCount; i++) {
          const dotAngle = (i / dotCount) * Math.PI * 2;
          const dotPhase = Math.sin(phase * 2 + i * 0.8) * 0.5 + 0.5;
          const dotRadius = radius + 18 + dotPhase * 8;
          const dotX = Math.cos(dotAngle) * dotRadius;
          const dotY = Math.sin(dotAngle) * dotRadius;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1.5 + dotPhase * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `${colors.ring}${Math.floor(40 + dotPhase * 60).toString(16).padStart(2, '0')}`;
          ctx.fill();
        }

        ctx.restore();
      }

      particlesRef.current.forEach((p) => {
        p.angle += p.speed;
        if (Math.random() < p.decay) {
          p.opacity = Math.max(0, p.opacity - p.decay * 10);
          p.radius = radius + 20 + Math.random() * 50;
          p.angle = Math.random() * Math.PI * 2;
        }
        if (p.opacity <= 0) {
          p.opacity = 0.3 + Math.random() * 0.5;
          p.radius = radius + 20 + Math.random() * 50;
        }
        const x = centerX + Math.cos(p.angle) * p.radius;
        const y = centerY + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity * 0.4})`;
        ctx.fill();
      });

      if (taskProgress && taskProgress > 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        const progressAngle = (taskProgress / 100) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 35, -Math.PI / 2, progressAngle);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      phase += 0.016;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status, taskProgress, energyPulse]);

  return (
    <div className="relative" style={{ width: 300, height: 300 }}>
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="absolute inset-0"
      />
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transform: 'scale(0.35)' }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-10">
          <defs>
            <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#orbGlow)" />
        </svg>
      </div>
    </div>
  );
}