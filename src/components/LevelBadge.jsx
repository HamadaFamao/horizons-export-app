import React from 'react';
import { cn } from '@/lib/utils';

// Level tiers config matching FAMO Level Badge Evolution design
const LEVEL_TIERS = [
  {
    min: 1, max: 8,
    name: 'Novice',
    color: '#C0C0C0',
    glow: 'rgba(192,192,192,0.6)',
    bg: 'linear-gradient(135deg, #ffffff 0%, #e4e4e4 50%, #b5b5b5 100%)',
    border: '#b5b5b5',
    textColor: '#424242',
    icon: '🛡️',
  },
  {
    min: 9, max: 12,
    name: 'Bright Emerald',
    color: '#00C853',
    glow: 'rgba(0,200,83,0.6)',
    bg: 'linear-gradient(135deg, #b9f6ca 0%, #00e676 50%, #00a152 100%)',
    border: '#00a152',
    textColor: '#fff',
    icon: '🛡️',
  },
  {
    min: 13, max: 15,
    name: 'Dark Emerald',
    color: '#00701a',
    glow: 'rgba(0,112,26,0.6)',
    bg: 'linear-gradient(135deg, #00e676 0%, #00c853 50%, #00600f 100%)',
    border: '#00600f',
    textColor: '#fff',
    icon: '🛡️',
  },
  {
    min: 16, max: 20,
    name: 'Elite',
    color: '#1565C0',
    glow: 'rgba(33,150,243,0.6)',
    bg: 'linear-gradient(135deg, #90caf9 0%, #2196f3 50%, #0d47a1 100%)',
    border: '#0d47a1',
    textColor: '#fff',
    icon: '💠',
  },
  {
    min: 21, max: 30,
    name: 'Indigo',
    color: '#3949AB',
    glow: 'rgba(63,81,181,0.6)',
    bg: 'linear-gradient(135deg, #9fa8da 0%, #3f51b5 50%, #1a237e 100%)',
    border: '#1a237e',
    textColor: '#fff',
    icon: '🔷',
  },
  {
    min: 31, max: 40,
    name: 'Purple',
    color: '#7B1FA2',
    glow: 'rgba(156,39,176,0.6)',
    bg: 'linear-gradient(135deg, #e1bee7 0%, #9c27b0 50%, #4a148c 100%)',
    border: '#4a148c',
    textColor: '#fff',
    icon: '🔮',
  },
  {
    min: 41, max: 50,
    name: 'Champion',
    color: '#E91E8C',
    glow: 'rgba(233,30,99,0.6)',
    bg: 'linear-gradient(135deg, #f8bbd0 0%, #e91e63 50%, #880e4f 100%)',
    border: '#880e4f',
    textColor: '#fff',
    icon: '👑',
  },
  {
    min: 51, max: 79,
    name: 'Turquoise',
    color: '#00897B',
    glow: 'rgba(0,150,136,0.6)',
    bg: 'linear-gradient(135deg, #b2dfdb 0%, #009688 50%, #004d40 100%)',
    border: '#004d40',
    textColor: '#fff',
    icon: '💎',
  },
  {
    min: 80, max: 100,
    name: 'Cyan',
    color: '#00B8D4',
    glow: 'rgba(0,188,212,0.6)',
    bg: 'linear-gradient(135deg, #b2ebf2 0%, #00bcd4 50%, #006064 100%)',
    border: '#006064',
    textColor: '#fff',
    icon: '🔹',
  },
  {
    min: 101, max: 150,
    name: 'Royal Violet',
    color: '#6A1B9A',
    glow: 'rgba(103,58,183,0.7)',
    bg: 'linear-gradient(135deg, #d1c4e9 0%, #673ab7 50%, #311b92 100%)',
    border: '#311b92',
    textColor: '#fff',
    icon: '👑',
  },
  {
    min: 151, max: 200,
    name: 'Immortal',
    color: '#B71C1C',
    glow: 'rgba(244,67,54,0.7)',
    bg: 'linear-gradient(135deg, #ffcdd2 0%, #f44336 50%, #b71c1c 100%)',
    border: '#b71c1c',
    textColor: '#fff',
    icon: '🔥',
  },
  {
    min: 201, max: 300,
    name: 'Glowing Gemstones',
    color: '#FF6F00',
    glow: 'rgba(255,152,0,0.7)',
    bg: 'linear-gradient(135deg, #ffe082 0%, #ff9800 50%, #e65100 100%)',
    border: '#e65100',
    textColor: '#fff',
    icon: '💠',
  },
  {
    min: 301, max: Infinity,
    name: 'FAMO Emperor',
    color: '#FFD700',
    glow: 'rgba(255,193,7,0.8)',
    bg: 'linear-gradient(135deg, #fff9c4 0%, #ffc107 40%, #ff8f00 100%)',
    border: '#ff8f00',
    textColor: '#5c4000',
    icon: '👑',
  },
];

export function getLevelTier(level) {
  return LEVEL_TIERS.find(t => level >= t.min && level <= t.max) || LEVEL_TIERS[0];
}

export default function LevelBadge({ level, size = 'md', showName = false, className }) {
  if (!level && level !== 0) return null;

  const tier = getLevelTier(level);

  const sizes = {
    xs: { badge: 'px-2 py-0.5 text-[10px]', icon: 'text-[10px]' },
    sm: { badge: 'px-2.5 py-0.5 text-xs', icon: 'text-xs' },
    md: { badge: 'px-3 py-1 text-sm', icon: 'text-sm' },
    lg: { badge: 'px-4 py-1.5 text-base', icon: 'text-base' },
    xl: { badge: 'px-5 py-2 text-lg', icon: 'text-lg' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-extrabold select-none transition-all duration-300 hover:scale-105 hover:brightness-110',
          s.badge
        )}
        style={{
          background: tier.bg,
          border: `1px solid ${tier.border}`,
          color: tier.textColor,
          textShadow: tier.textColor === '#fff' ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 1px rgba(255,255,255,0.6)',
          boxShadow: `
            0 0 10px ${tier.glow}, 
            0 0 20px ${tier.glow}, 
            inset 0 2px 4px rgba(255,255,255,0.6), 
            inset 0 -2px 4px rgba(0,0,0,0.25), 
            0 3px 6px rgba(0,0,0,0.3)
          `,
        }}
      >
        <span className={cn(s.icon, "drop-shadow-md")}>{tier.icon}</span>
        <span className="tracking-wide">{level}</span>
      </div>
      {showName && (
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold tracking-wider uppercase drop-shadow-sm">
          {tier.name}
        </span>
      )}
    </div>
  );
}