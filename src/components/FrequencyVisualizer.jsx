import { useEffect, useRef } from 'react';

export default function FrequencyVisualizer({ analyser, isActive }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const centerX = 150;
    const centerY = 150;
    const innerRadius = 95;
    const outerRadius = 130;
    const barCount = 64;

    const draw = () => {
      ctx.clearRect(0, 0, 300, 300);

      if (!isActive) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (innerRadius + outerRadius) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const dataArray = new Uint8Array(barCount);
      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const value = dataArray[i] / 255;
        const barHeight = value * (outerRadius - innerRadius);

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
        const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(123, 47, 255, 0.9)');

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [analyser, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'scale(1)', opacity: isActive ? 1 : 0.3 }}
    />
  );
}