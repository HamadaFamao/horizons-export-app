import React from 'react';
import { cn } from '@/lib/utils';

// Custom SVG Icons designed to match the FAMO Level Badge Evolution
const Icons = {
  Novice: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="rgba(255,255,255,0.2)" />
    </svg>
  ),
  BrightEmerald: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="rgba(255,255,255,0.15)" />
      <path d="M12 5.5l-5.5 2v4.5c0 3.5 2.5 6.5 5.5 7.5 3-.1 5.5-3.1 5.5-7.5v-4.5l-5.5-2z" fill="rgba(255,255,255,0.25)" />
    </svg>
  ),
  DarkEmerald: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="rgba(255,255,255,0.15)" />
      <path d="M12 5.5l-5.5 2v4.5c0 3.5 2.5 6.5 5.5 7.5 3-.1 5.5-3.1 5.5-7.5v-4.5l-5.5-2z" fill="rgba(255,255,255,0.2)" />
      <g fill="#fff">
        <path d="M9 9.5l.5 1.5h1.5l-1.2 1 .5 1.5-1.3-1-1.3 1 .5-1.5-1.2-1h1.5z" />
        <path d="M15 9.5l.5 1.5h1.5l-1.2 1 .5 1.5-1.3-1-1.3 1 .5-1.5-1.2-1h1.5z" />
        <path d="M12 13l.5 1.5h1.5l-1.2 1 .5 1.5-1.3-1-1.3 1 .5-1.5-1.2-1h1.5z" />
      </g>
    </svg>
  ),
  Elite: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 6l-3 4 3 6 3-6-3-4z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  Indigo: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 10c-3 0-5 3-5 3 1.5-1.5 3-1.5 5-1.5V10zM18 10c3 0 5 3 5 3-1.5-1.5-3-1.5-5-1.5V10z" fill="#fff" opacity="0.6"/>
      <path d="M12 3L5 5.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5.5L12 3z" />
      <path d="M12 3v21c4-1.5 7-5.5 7-10V5.5L12 3z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 8l-2 3 2 4 2-4-2-3z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  Purple: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 9c-4-1-6 4-6 4 2-2 4-2 6-1V9zM17 9c4-1 6 4 6 4-2-2-4-2-6-1V9z" fill="#fff" opacity="0.7"/>
      <path d="M7 13c-3-1-5 2-5 2 1.5-1.5 3-1.5 5-.5V13zM17 13c3-1 5 2 5 2-1.5-1.5-3-1.5-5-.5V13z" fill="#fff" opacity="0.5"/>
      <path d="M12 3L5 5.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5.5L12 3z" />
      <path d="M12 3v21c4-1.5 7-5.5 7-10V5.5L12 3z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 7l-2.5 3.5 2.5 5 2.5-5L12 7z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  Champion: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1L12 5z" fill="#fff" />
      <path d="M12 13l1.5 1.5L15 13l-1.5-1.5L12 13z" fill="#fff" opacity="0.9" />
      <path d="M12 16l1 1 1.5-1-1-1L12 16z" fill="#fff" opacity="0.7" />
    </svg>
  ),
  Turquoise: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 10c-3-1-6 3-6 3 2-2 4-2 6-1V10zM16 10c3-1 6 3 6 3-2-2-4-2-6-1V10z" fill="#fff" opacity="0.7"/>
      <path d="M12 2L3 10l9 12 9-12L12 2z" />
      <path d="M12 2v20l9-12L12 2z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 6l-4 5 4 7 4-7-4-5z" fill="#fff" opacity="0.8" />
    </svg>
  ),
  Cyan: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" fill="#fff" opacity="0.4" />
      <path d="M12 3L4 11l8 10 8-10L12 3z" />
      <path d="M12 3v20l8-10L12 3z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 7l-3 4 3 5 3-5-3-4z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  RoyalViolet: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5l2-3 2 1.5L14 2l2 3H8z" fill="#FBBF24" />
      <path d="M12 6L4 8.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V8.5L12 6z" />
      <path d="M12 6v21c4-1.5 7-5.5 7-10V8.5L12 6z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 10l-2 3 2 4 2-4-2-3z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  Immortal: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 1c-1.5 0-3 3-3 5 0 1 .5 2 1 3-1-1-1-2.5 0-3.5 1 2 2 3 1 5 2-1 3-2.5 3-4.5 0-2.5-1.5-5-2-5z" fill="#FBBF24" opacity="0.8" />
      <path d="M12 5L4 7.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V7.5L12 5z" />
      <path d="M12 5v21c4-1.5 7-5.5 7-10V7.5L12 5z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 9l-2 3 2 4 2-4-2-3z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  GlowingGemstones: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 15c-2-3-1-6 0-7 1-1 2-1 2-1s-1 1-1 2c-1 2-1 4 0 6 1 1 2 1 2 1s-1 0-2-1zM18 15c2-3 1-6 0-7-1-1-2-1-2-1s1 1 1 2c1 2 1 4 0 6-1 1-2 1-2 1s1 0 2-1z" fill="#FBBF24" />
      <path d="M12 4L4 6.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6.5L12 4z" />
      <path d="M12 4v21c4-1.5 7-5.5 7-10V6.5L12 4z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 9l-2 3 2 4 2-4-2-3z" fill="#fff" opacity="0.9" />
    </svg>
  ),
  Emperor: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 10c-3-2-4 3-4 3 1.5-3 4-3 6-1V10zM20 10c3-2 4 3 4 3-1.5-3-4-3-6-1V10z" fill="#FBBF24" opacity="0.9"/>
      <path d="M4 14c-2-1-3 2-3 2 1-2 3-2 5-.5V14zM20 14c2-1 3 2 3 2-1-2-3-2-5-.5V14z" fill="#FBBF24" opacity="0.7"/>
      <path d="M9 3l1.5-2 1.5 1.5L13.5 1 15 3H9z" fill="#FBBF24" />
      <path d="M12 4L4 6.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6.5L12 4z" />
      <path d="M12 4v21c4-1.5 7-5.5 7-10V6.5L12 4z" fill="rgba(255,255,255,0.2)" />
      <path d="M12 8l-2.5 3.5 2.5 4.5 2.5-4.5L12 8z" fill="#fff" opacity="0.9" />
    </svg>
  ),
};

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
    icon: Icons.Novice,
  },
  {
    min: 9, max: 12,
    name: 'Bright Emerald',
    color: '#00C853',
    glow: 'rgba(0,200,83,0.6)',
    bg: 'linear-gradient(135deg, #b9f6ca 0%, #00e676 50%, #00a152 100%)',
    border: '#00a152',
    textColor: '#fff',
    icon: Icons.BrightEmerald,
  },
  {
    min: 13, max: 15,
    name: 'Dark Emerald',
    color: '#00701a',
    glow: 'rgba(0,112,26,0.6)',
    bg: 'linear-gradient(135deg, #00e676 0%, #00c853 50%, #00600f 100%)',
    border: '#00600f',
    textColor: '#fff',
    icon: Icons.DarkEmerald,
  },
  {
    min: 16, max: 20,
    name: 'Elite',
    color: '#1565C0',
    glow: 'rgba(33,150,243,0.6)',
    bg: 'linear-gradient(135deg, #90caf9 0%, #2196f3 50%, #0d47a1 100%)',
    border: '#0d47a1',
    textColor: '#fff',
    icon: Icons.Elite,
  },
  {
    min: 21, max: 30,
    name: 'Indigo',
    color: '#3949AB',
    glow: 'rgba(63,81,181,0.6)',
    bg: 'linear-gradient(135deg, #9fa8da 0%, #3f51b5 50%, #1a237e 100%)',
    border: '#1a237e',
    textColor: '#fff',
    icon: Icons.Indigo,
  },
  {
    min: 31, max: 40,
    name: 'Purple',
    color: '#7B1FA2',
    glow: 'rgba(156,39,176,0.6)',
    bg: 'linear-gradient(135deg, #e1bee7 0%, #9c27b0 50%, #4a148c 100%)',
    border: '#4a148c',
    textColor: '#fff',
    icon: Icons.Purple,
  },
  {
    min: 41, max: 50,
    name: 'Champion',
    color: '#E91E8C',
    glow: 'rgba(233,30,99,0.6)',
    bg: 'linear-gradient(135deg, #f8bbd0 0%, #e91e63 50%, #880e4f 100%)',
    border: '#880e4f',
    textColor: '#fff',
    icon: Icons.Champion,
  },
  {
    min: 51, max: 79,
    name: 'Turquoise',
    color: '#00897B',
    glow: 'rgba(0,150,136,0.6)',
    bg: 'linear-gradient(135deg, #b2dfdb 0%, #009688 50%, #004d40 100%)',
    border: '#004d40',
    textColor: '#fff',
    icon: Icons.Turquoise,
  },
  {
    min: 80, max: 100,
    name: 'Cyan',
    color: '#00B8D4',
    glow: 'rgba(0,188,212,0.6)',
    bg: 'linear-gradient(135deg, #b2ebf2 0%, #00bcd4 50%, #006064 100%)',
    border: '#006064',
    textColor: '#fff',
    icon: Icons.Cyan,
  },
  {
    min: 101, max: 150,
    name: 'Royal Violet',
    color: '#6A1B9A',
    glow: 'rgba(103,58,183,0.7)',
    bg: 'linear-gradient(135deg, #d1c4e9 0%, #673ab7 50%, #311b92 100%)',
    border: '#311b92',
    textColor: '#fff',
    icon: Icons.RoyalViolet,
  },
  {
    min: 151, max: 200,
    name: 'Immortal',
    color: '#B71C1C',
    glow: 'rgba(244,67,54,0.7)',
    bg: 'linear-gradient(135deg, #ffcdd2 0%, #f44336 50%, #b71c1c 100%)',
    border: '#b71c1c',
    textColor: '#fff',
    icon: Icons.Immortal,
  },
  {
    min: 201, max: 300,
    name: 'Glowing Gemstones',
    color: '#FF6F00',
    glow: 'rgba(255,152,0,0.7)',
    bg: 'linear-gradient(135deg, #ffe082 0%, #ff9800 50%, #e65100 100%)',
    border: '#e65100',
    textColor: '#fff',
    icon: Icons.GlowingGemstones,
  },
  {
    min: 301, max: Infinity,
    name: 'FAMO Emperor',
    color: '#FFD700',
    glow: 'rgba(255,193,7,0.8)',
    bg: 'linear-gradient(135deg, #fff9c4 0%, #ffc107 40%, #ff8f00 100%)',
    border: '#ff8f00',
    textColor: '#5c4000',
    icon: Icons.Emperor,
  },
];

export function getLevelTier(level) {
  return LEVEL_TIERS.find(t => level >= t.min && level <= t.max) || LEVEL_TIERS[0];
}

export default function LevelBadge({ level, size = 'md', showName = false, className }) {
  if (!level && level !== 0) return null;

  const tier = getLevelTier(level);
  const Icon = tier.icon;

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
        <span className={cn(s.icon, "drop-shadow-md flex items-center justify-center")}>
          <Icon className="w-[1.3em] h-[1.3em]" />
        </span>
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