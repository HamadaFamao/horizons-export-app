import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function CycleCountdown({ deadline, className }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(null);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  if (expired) {
    return (
      <div className={cn('flex items-center gap-1.5 text-red-600', className)}>
        <span className="text-sm font-bold">⏰ Deadline passed</span>
      </div>
    );
  }

  if (!timeLeft) return null;

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 6;
  const isWarning = timeLeft.days <= 1;

  return (
    <div className={cn(
      'flex items-center gap-1 text-xs font-mono font-bold',
      isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600',
      className
    )}>
      <span>⏱️</span>
      {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
      <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
}
