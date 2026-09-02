import React from 'react';
import { cn } from '@/lib/utils';

// Custom SVG Icons designed to match the FAMO Level Badge Evolution
const Icons = {
  Novice: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#E5E7EB" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#D1D5DB" />
      <path d="M12 4.5L5.5 6.5v4.5c0 3.5 2.5 6.5 6.5 7.5 4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#F3F4F6" />
      <path d="M12 4.5v15c4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#FFFFFF" />
    </svg>
  ),
  BrightEmerald: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#10B981" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#059669" />
      <path d="M12 4.5L5.5 6.5v4.5c0 3.5 2.5 6.5 6.5 7.5 4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#34D399" />
      <path d="M12 4.5v15c4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#6EE7B7" />
    </svg>
  ),
  DarkEmerald: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#065F46" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#064E3B" />
      <path d="M12 4.5L5.5 6.5v4.5c0 3.5 2.5 6.5 6.5 7.5 4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#059669" />
      <path d="M12 4.5v15c4-.1 6.5-3.1 6.5-7.5v-4.5L12 4.5z" fill="#10B981" />
      <g fill="#FCD34D">
        <path d="M12 14.5l.9 2.7 2.8.1-2.2 1.7.8 2.7-2.3-1.8-2.3 1.8.8-2.7-2.2-1.7 2.8-.1z" />
        <path d="M7.5 13l.7 2 2.1.1-1.7 1.3.6 2.1-1.7-1.4-1.7 1.4.6-2.1-1.7-1.3 2.1-.1z" />
        <path d="M16.5 13l.7 2 2.1.1-1.7 1.3.6 2.1-1.7-1.4-1.7 1.4.6-2.1-1.7-1.3 2.1-.1z" />
      </g>
    </svg>
  ),
  Elite: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M2 8l2-2v8l-2-2zM22 8l-2-2v8l2-2z" fill="#60A5FA" />
      <path d="M12 1L4 4v7c0 5 4 9 8 11 4-2 8-6 8-11V4l-8-3z" fill="#2563EB" />
      <path d="M12 1v21c4-2 8-6 8-11V4l-8-3z" fill="#1D4ED8" />
      <path d="M12 6l-3 4 3 5 3-5-3-4z" fill="#BFDBFE" />
      <path d="M12 6v9l3-5-3-4z" fill="#DBEAFE" />
    </svg>
  ),
  Indigo: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 8c-3-1-5 2-5 2 1.5-2.5 4-3 6-1.5V8zM17 8c3-1 5 2 5 2-1.5-2.5-4-3-6-1.5V8z" fill="#818CF8"/>
      <path d="M6 11c-2.5-.5-4 2-4 2 1-2 3-2 5-1v-1zM18 11c2.5-.5 4 2 4 2-1-2-3-2-5-1v-1z" fill="#6366F1"/>
      <path d="M6 14c-2 0-3 2-3 2 1-1.5 2.5-1.5 4-.5v-1.5zM18 14c2 0 3 2 3 2-1-1.5-2.5-1.5-4-.5v-1.5z" fill="#4F46E5"/>
      <path d="M12 3L5 5.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5.5L12 3z" fill="#312E81" />
      <path d="M12 3v21c4-1.5 7-5.5 7-10V5.5L12 3z" fill="#1E1B4B" />
      <path d="M12 8l-2 3 2 4 2-4-2-3z" fill="#A5B4FC" />
      <path d="M12 8v7l2-4-2-3z" fill="#E0E7FF" />
    </svg>
  ),
  Purple: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 10C4 8 1 12 1 12c2-4 6-5 9-2v-2zM15 10c5-2 8 2 8 2-2-4-6-5-9-2v-2z" fill="#C084FC"/>
      <path d="M8 13c-4-1-6 3-6 3 1.5-3 5-3 7-1v-2zM16 13c4-1 6 3 6 3-1.5-3-5-3-7-1v-2z" fill="#A855F7"/>
      <path d="M8 16c-3 0-5 2-5 2 1-2 4-2 6-.5v-1.5zM16 16c3 0 5 2 5 2-1-2-4-2-6-.5v-1.5z" fill="#9333EA"/>
      <path d="M12 3l-4 6 4 11 4-11-4-6z" fill="#7E22CE" />
      <path d="M12 3v17l4-11-4-6z" fill="#6B21A8" />
      <path d="M12 5l-2 4 2 6 2-6-2-4z" fill="#E9D5FF" />
      <path d="M12 5v10l2-6-2-4z" fill="#F3E8FF" />
    </svg>
  ),
  Champion: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 1L3 4v7c0 5.5 4 10 9 12 5-2 9-6.5 9-12V4l-9-3z" fill="#FBBF24" />
      <path d="M12 1v22c5-2 9-6.5 9-12V4l-9-3z" fill="#F59E0B" />
      <path d="M12 3L5 5.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5.5L12 3z" fill="#DB2777" />
      <path d="M12 3v21c4-1.5 7-5.5 7-10V5.5L12 3z" fill="#BE185D" />
      <path d="M12 1l-2 2h4l-2-2z" fill="#FDE68A" />
      <path d="M7 3l-1 2h2L7 3zM17 3l1 2h-2l1-2z" fill="#FDE68A" />
      <path d="M12 7l-2.5 3.5 2.5 5 2.5-5L12 7z" fill="#FBCFE8" />
      <path d="M12 7v8.5l2.5-5L12 7z" fill="#FDF2F8" />
    </svg>
  ),
  Turquoise: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 8c-3-1-5 2-5 2 1.5-2.5 4-3 6-1.5V8zM18 8c3-1 5 2 5 2-1.5-2.5-4-3-6-1.5V8z" fill="#5EEAD4"/>
      <path d="M5 11c-2.5-.5-4 2-4 2 1-2 3-2 5-1v-1zM19 11c2.5-.5 4 2 4 2-1-2-3-2-5-1v-1z" fill="#2DD4BF"/>
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#0D9488" />
      <path d="M12 2v20c4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#0F766E" />
      <path d="M12 6l-3 3 3 5 3-5-3-3z" fill="#CCFBF1" />
      <path d="M12 6v8l3-5-3-3z" fill="#F0FDFA" />
    </svg>
  ),
  Cyan: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 0l1 3 3-1-2 3 4 1-3 2 3 3-4-1 2 4-3-2-1 3-1-3-3 2 2-4-4 1 3-3-3-2 4-1-2-3 3 1 1-3z" fill="#A5F3FC" />
      <path d="M12 3L4 6v6c0 4.5 3 8.5 8 10 5-1.5 8-5.5 8-10V6l-8-3z" fill="#0891B2" />
      <path d="M12 3v22c5-1.5 8-5.5 8-10V6l-8-3z" fill="#0E7490" />
      <path d="M12 7l-3 4 3 5 3-5-3-4z" fill="#CFFAFE" />
      <path d="M12 7v9l3-5-3-4z" fill="#ECFEFF" />
    </svg>
  ),
  RoyalViolet: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 9c-3-1-5 2-5 2 1.5-2.5 4-3 6-1.5V9zM17 9c3-1 5 2 5 2-1.5-2.5-4-3-6-1.5V9z" fill="#D8B4FE"/>
      <path d="M6 12c-2.5-.5-4 2-4 2 1-2 3-2 5-1v-1zM18 12c2.5-.5 4 2 4 2-1-2-3-2-5-1v-1z" fill="#C084FC"/>
      <path d="M8 5l2-3 2 1.5L14 2l2 3H8z" fill="#FBBF24" />
      <path d="M12 6L4 8.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V8.5L12 6z" fill="#7E22CE" />
      <path d="M12 6v21c4-1.5 7-5.5 7-10V8.5L12 6z" fill="#6B21A8" />
      <path d="M12 10l-2 3 2 4 2-4-2-3z" fill="#F3E8FF" />
      <path d="M12 10v7l2-4-2-3z" fill="#FAF5FF" />
    </svg>
  ),
  Immortal: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 8c-4-2-6 2-6 2 2-3 5-3 7-1V8zM17 8c4-2 6 2 6 2-2-3-5-3-7-1V8z" fill="#FCA5A5"/>
      <path d="M6 11c-3-1-5 2-5 2 1.5-2.5 4-2.5 6-1v-1zM18 11c3-1 5 2 5 2-1.5-2.5-4-2.5-6-1v-1z" fill="#F87171"/>
      <path d="M6 14c-2 0-4 2-4 2 1-2 3-2 5-.5v-1.5zM18 14c2 0 4 2 4 2-1-2-3-2-5-.5v-1.5z" fill="#EF4444"/>
      <path d="M7 4l2.5-3 2.5 2 2.5-2L17 4H7z" fill="#FBBF24" />
      <path d="M12 5L4 7.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V7.5L12 5z" fill="#B91C1C" />
      <path d="M12 5v21c4-1.5 7-5.5 7-10V7.5L12 5z" fill="#991B1B" />
      <path d="M12 9l-2.5 3.5 2.5 4.5 2.5-4.5L12 9z" fill="#FEE2E2" />
      <path d="M12 9v8l2.5-4.5L12 9z" fill="#FEF2F2" />
    </svg>
  ),
  GlowingGemstones: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 18c-1-1-2-3-2-5 0-1 1-2 1-2s-1 1-1 3c0 2 1 4 2 5 1 1 2 1 2 1s-1 0-2-2z" fill="#F59E0B"/>
      <path d="M4 14c-1-1-1-3 0-4 0-1 1-2 1-2s-1 1-1 2c-1 2 0 4 1 5 1 1 1 1 1 1s-1 0-2-2z" fill="#F59E0B"/>
      <path d="M3 10c0-1 0-2 1-3 1-1 2-1 2-1s-1 1-2 2c-1 1-1 2-1 3 0 1 1 1 1 1s-1 0-1-2z" fill="#F59E0B"/>
      <path d="M18 18c1-1 2-3 2-5 0-1-1-2-1-2s1 1 1 3c0 2-1 4-2 5-1 1-2 1-2 1s1 0 2-2z" fill="#F59E0B"/>
      <path d="M20 14c1-1 1-3 0-4 0-1-1-2-1-2s1 1 1 2c1 2 0 4-1 5-1 1-1 1-1 1s1 0 2-2z" fill="#F59E0B"/>
      <path d="M21 10c0-1 0-2-1-3-1-1-2-1-2-1s1 1 2 2c1 1 1 2 1 3 0 1-1 1-1 1s1 0 1-2z" fill="#F59E0B"/>
      <path d="M12 2L5 5v6c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5L12 2z" fill="#D97706" />
      <path d="M12 2v21c4-1.5 7-5.5 7-10V5L12 2z" fill="#B45309" />
      <path d="M12 7l-2 3 2 4 2-4-2-3z" fill="#FEF3C7" />
      <path d="M12 7v7l2-4-2-3z" fill="#FFFBEB" />
    </svg>
  ),
  Emperor: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 7c-4-2-6 3-6 3 2-4 6-4 8-2V7zM18 7c4-2 6 3 6 3-2-4-6-4-8-2V7z" fill="#FDE68A"/>
      <path d="M5 10c-3-1-5 3-5 3 1.5-3.5 5-3.5 7-1.5v-1.5zM19 10c3-1 5 3 5 3-1.5-3.5-5-3.5-7-1.5v-1.5z" fill="#FCD34D"/>
      <path d="M5 13c-2-1-4 2-4 2 1-2.5 4-2.5 6-1v-1zM19 13c2-1 4 2 4 2-1-2.5-4-2.5-6-1v-1z" fill="#FBBF24"/>
      <path d="M6 16c-2 0-3 2-3 2 1-2 3-2 5-.5v-1.5zM18 16c2 0 3 2 3 2-1-2-3-2-5-.5v-1.5z" fill="#F59E0B"/>
      <path d="M8 3l2-2.5 2 1.5 2-1.5 2 2.5H8z" fill="#F59E0B" />
      <circle cx="8" cy="2.5" r="0.5" fill="#F59E0B" />
      <circle cx="12" cy="0.5" r="0.5" fill="#F59E0B" />
      <circle cx="16" cy="2.5" r="0.5" fill="#F59E0B" />
      <path d="M12 4L4 6.5v5.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6.5L12 4z" fill="#D97706" />
      <path d="M12 4v21c4-1.5 7-5.5 7-10V6.5L12 4z" fill="#B45309" />
      <path d="M12 8l-2.5 3.5 2.5 4.5 2.5-4.5L12 8z" fill="#FEF3C7" />
      <path d="M12 8v8l2.5-4.5L12 8z" fill="#FFFBEB" />
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
    bg: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #d4d4d4 100%)',
    border: '#b5b5b5',
    textColor: '#424242',
    icon: Icons.Novice,
  },
  {
    min: 9, max: 12,
    name: 'Bright Emerald',
    color: '#00C853',
    glow: 'rgba(0,200,83,0.6)',
    bg: 'linear-gradient(135deg, #e8fced 0%, #69f0ae 50%, #00c853 100%)',
    border: '#00a152',
    textColor: '#fff',
    icon: Icons.BrightEmerald,
  },
  {
    min: 13, max: 15,
    name: 'Dark Emerald',
    color: '#00701a',
    glow: 'rgba(0,112,26,0.6)',
    bg: 'linear-gradient(135deg, #69f0ae 0%, #00e676 50%, #00a152 100%)',
    border: '#00600f',
    textColor: '#fff',
    icon: Icons.DarkEmerald,
  },
  {
    min: 16, max: 20,
    name: 'Elite',
    color: '#1565C0',
    glow: 'rgba(33,150,243,0.6)',
    bg: 'linear-gradient(135deg, #e3f2fd 0%, #64b5f6 50%, #1976d2 100%)',
    border: '#0d47a1',
    textColor: '#fff',
    icon: Icons.Elite,
  },
  {
    min: 21, max: 30,
    name: 'Indigo',
    color: '#3949AB',
    glow: 'rgba(63,81,181,0.6)',
    bg: 'linear-gradient(135deg, #e8eaf6 0%, #7986cb 50%, #303f9f 100%)',
    border: '#1a237e',
    textColor: '#fff',
    icon: Icons.Indigo,
  },
  {
    min: 31, max: 40,
    name: 'Purple',
    color: '#7B1FA2',
    glow: 'rgba(156,39,176,0.6)',
    bg: 'linear-gradient(135deg, #f3e5f5 0%, #ba68c8 50%, #7b1fa2 100%)',
    border: '#4a148c',
    textColor: '#fff',
    icon: Icons.Purple,
  },
  {
    min: 41, max: 50,
    name: 'Champion',
    color: '#E91E8C',
    glow: 'rgba(233,30,99,0.6)',
    bg: 'linear-gradient(135deg, #fce4ec 0%, #f06292 50%, #c2185b 100%)',
    border: '#880e4f',
    textColor: '#fff',
    icon: Icons.Champion,
  },
  {
    min: 51, max: 79,
    name: 'Turquoise',
    color: '#00897B',
    glow: 'rgba(0,150,136,0.6)',
    bg: 'linear-gradient(135deg, #e0f2f1 0%, #4db6ac 50%, #00796b 100%)',
    border: '#004d40',
    textColor: '#fff',
    icon: Icons.Turquoise,
  },
  {
    min: 80, max: 100,
    name: 'Cyan',
    color: '#00B8D4',
    glow: 'rgba(0,188,212,0.6)',
    bg: 'linear-gradient(135deg, #e0f7fa 0%, #4dd0e1 50%, #0097a7 100%)',
    border: '#006064',
    textColor: '#fff',
    icon: Icons.Cyan,
  },
  {
    min: 101, max: 150,
    name: 'Royal Violet',
    color: '#6A1B9A',
    glow: 'rgba(103,58,183,0.7)',
    bg: 'linear-gradient(135deg, #ede7f6 0%, #9575cd 50%, #512da8 100%)',
    border: '#311b92',
    textColor: '#fff',
    icon: Icons.RoyalViolet,
  },
  {
    min: 151, max: 200,
    name: 'Immortal',
    color: '#B71C1C',
    glow: 'rgba(244,67,54,0.7)',
    bg: 'linear-gradient(135deg, #ffebee 0%, #e57373 50%, #d32f2f 100%)',
    border: '#b71c1c',
    textColor: '#fff',
    icon: Icons.Immortal,
  },
  {
    min: 201, max: 300,
    name: 'Glowing Gemstones',
    color: '#FF6F00',
    glow: 'rgba(255,152,0,0.7)',
    bg: 'linear-gradient(135deg, #fff8e1 0%, #ffb74d 50%, #f57c00 100%)',
    border: '#e65100',
    textColor: '#fff',
    icon: Icons.GlowingGemstones,
  },
  {
    min: 301, max: Infinity,
    name: 'FAMO Emperor',
    color: '#FFD700',
    glow: 'rgba(255,193,7,0.8)',
    bg: 'linear-gradient(135deg, #fffde7 0%, #ffd54f 50%, #ffb300 100%)',
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