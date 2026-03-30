import React, { useEffect, useState } from 'react';

const BURST_EMOJIS = ['✨', '💫', '⭐', '🌟', '💖'];

export default function EmojiBurst({ x, y, duration = 1500 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Create 5-8 floating particles
    const particleCount = Math.floor(Math.random() * 4) + 5;
    const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      emoji: BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)],
      left: (Math.random() - 0.5) * 100,
      delay: Math.random() * 100,
    }));
    setParticles(newParticles);

    // Auto-unmount after animation
    const timer = setTimeout(() => {
      setParticles([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed pointer-events-none z-50" style={{ left: x, top: y }}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute text-2xl animate-emoji-burst"
          style={{
            left: `${particle.left}px`,
            top: 0,
            animation: `emoji-burst ${duration}ms ease-out forwards`,
            animationDelay: `${particle.delay}ms`,
          }}
        >
          {particle.emoji}
        </div>
      ))}

      <style>{`
        @keyframes emoji-burst {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}