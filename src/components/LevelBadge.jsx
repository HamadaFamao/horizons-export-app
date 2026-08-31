import React from 'react';
import { cn } from '@/lib/utils';

// Level tiers config matching FAMO Level Badge Evolution design
const LEVEL_TIERS = [
  {
    min: 1, max: 8,
    name: 'Novice',
    color: '#C0C0C0',
    glow: 'rgba(192,192,192,0.3)',
    bg: 'linear-gradient(135deg, #e8e8e8, #c0c0c0)',
    border: '#a0a0a0',
    textColor: '#666',
    icon: '🛡️',
  },
  {
    min: 9, max: 12,
    name: 'Bright Emerald',
    color: '#00C853',
    glow: 'rgba(0,200,83,0.4)',
    bg: 'linear-gradient(135deg, #69f0ae, #00c853)',
    border: '#00C853',
    textColor: '#fff',
    icon: '🛡️',
  },
  {
    min: 13, max: 15,
    name: 'Dark Emerald',
    color: '#00701a',
    glow: 'rgba(0,112,26,0.4)',
    bg: 'linear-gradient(135deg, #00c853, #00701a)',
    border: '#00701a',
    textColor: '#fff',
    icon: '🛡️',
  },
  {
    min: 16, max: 20,
    name: 'Elite',
    color: '#1565C0',
    glow: 'rgba(21,101,192,0.5)',
    bg: 'linear-gradient(135deg, #42a5f5, #1565c0)',
    border: '#1565C0',
    textColor: '#fff',
    icon: '💠',
  },
  {
    min: 21, max: 30,
    name: 'Indigo',
    color: '#3949AB',
    glow: 'rgba(57,73,171,0.5)',
    bg: 'linear-gradient(135deg, #7986cb, #3949ab)',
    border: '#3949AB',
    textColor: '#fff',
    icon: '🔷',
  },
  {
    min: 31, max: 40,
    name: 'Purple',
    color: '#7B1FA2',
    glow: 'rgba(123,31,162,0.5)',
    bg: 'linear-gradient(135deg, #ce93d8, #7b1fa2)',
    border: '#7B1FA2',
    textColor: '#fff',
    icon: '🔮',
  },
  {
    min: 41, max: 50,
    name: 'Champion',
    color: '#E91E8C',
    glow: 'rgba(233,30,140,0.5)',
    bg: 'linear-gradient(135deg, #f48fb1, #e91e8c)',
    border: '#E91E8C',
    textColor: '#fff',
    icon: '👑',
  },
  {
    min: 51, max: 79,
    name: 'Turquoise',
    color: '#00897B',
    glow: 'rgba(0,137,123,0.5)',
    bg: 'linear-gradient(135deg, #80cbc4, #00897b)',
    border: '#00897B',
    textColor: '#fff',
    icon: '💎',
  },
  {
    min: 80, max: 100,
    name: 'Cyan',
    color: '#00B8D4',
    glow: 'rgba(0,184,212,0.5)',
    bg: 'linear-gradient(135deg, #80deea, #00b8d4)',
    border: '#00B8D4',
    textColor: '#fff',
    icon: '🔹',
  },
  {
    min: 101, max: 150,
    name: 'Royal Violet',
    color: '#6A1B9A',
    glow: 'rgba(106,27,154,0.6)',
    bg: 'linear-gradient(135deg, #ab47bc, #6a1b9a)',
    border: '#6A1B9A',
    textColor: '#fff',
    icon: '👑',
  },
  {
    min: 151, max: 200,
    name: 'Immortal',
    color: '#B71C1C',
    glow: 'rgba(183,28,28,0.6)',
    bg: 'linear-gradient(135deg, #ef9a9a, #b71c1c)',
    border: '#B71C1C',
    textColor: '#fff',
    icon: '🔥',
  },
  {
    min: 201, max: 300,
    name: 'Glowing Gemstones',
    color: '#FF6F00',
    glow: 'rgba(255,111,0,0.6)',
    bg: 'linear-gradient(135deg, #ffcc02, #ff6f00)',
    border: '#FF6F00',
    textColor: '#fff',
    icon: '💠',
  },
  {
    min: 301, max: Infinity,
    name: 'FAMO Emperor',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.7)',
    bg: 'linear-gradient(135deg, #fff176, #ffd700, #ff8f00)',
    border: '#FFD700',
    textColor: '#7a5800',
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
    xs: { badge: 'px-1.5 py-0.5 text-[10px]', icon: 'text-[10px]' },
    sm: { badge: 'px-2 py-0.5 text-xs', icon: 'text-xs' },
    md: { badge: 'px-2.5 py-1 text-sm', icon: 'text-sm' },
    lg: { badge: 'px-3 py-1.5 text-base', icon: 'text-base' },
    xl: { badge: 'px-4 py-2 text-lg', icon: 'text-lg' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={cn('inline-flex flex-col items-center gap-0.5', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full font-bold select-none',
          s.badge
        )}
        style={{
          background: tier.bg,
          border: `1.5px solid ${tier.border}`,
          color: tier.textColor,
          boxShadow: `0 0 8px ${tier.glow}, 0 2px 4px rgba(0,0,0,0.2)`,
        }}
      >
        <span className={s.icon}>{tier.icon}</span>
        <span>{level}</span>
      </div>
      {showName && (
        <span className="text-[10px] text-gray-400 font-medium">{tier.name}</span>
      )}
    </div>
  );
}
