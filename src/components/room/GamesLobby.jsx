import React from 'react';
import { X } from 'lucide-react';

const TRIVIA_BRAND_NAME = 'Krombo';
const TRIVIA_SUBTITLE = 'Quiz Arena';

const GAMES = [
  {
    id: 'pk',
    emoji: '⚔️',
    name: 'PK Battle',
    description: 'Challenge another player to a live battle!',
    color: 'from-blue-600 to-purple-600',
    available: true,
  },
  {
    id: 'spin',
    emoji: '🎡✨',
    name: 'Spin Wheel',
    description: 'Winner takes all! Join the spin and test your luck.',
    color: 'from-amber-500 to-yellow-400',
    available: true,
  },
  {
    id: 'race',
    emoji: '🐍🪜✨',
    name: 'Snakes and Ladders',
    description: 'Roll dice and race to the finish line!',
    color: 'from-blue-500 to-cyan-400',
    available: true,
  },
  {
    id: 'ludo',
    emoji: '🎯',
    name: 'Ludo Game',
    description: 'Race your 4 pieces to the center!',
    color: 'from-red-500 to-yellow-400',
    available: true,
  },
  {
    id: 'slots',
    emoji: '🎰✨',
    name: 'Slot Machine',
    description: 'Spin the slots and win big!',
    color: 'from-rose-500 to-orange-400',
    available: false,
  },
  {
    id: 'trivia',
    emoji: '🧠',
    name: TRIVIA_BRAND_NAME,
    subtitle: TRIVIA_SUBTITLE,
    description: 'Test your knowledge and compete with others',
    color: 'from-purple-500 to-blue-500',
    available: true,
  },
];

export default function GamesLobby({ open, onClose, onSelectGame, activeSpinSession }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute inset-x-0 bottom-0 bg-slate-900 rounded-t-3xl
          shadow-2xl flex flex-col overflow-hidden max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between
          border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <span className="font-bold text-white text-lg">Games</span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {GAMES.map(game => (
              <button
                key={game.id}
                type="button"
                onClick={() => {
                  if (!game.available) return;
                  onSelectGame(game.id);
                }}
                disabled={!game.available}
                className={`group flex flex-col items-center gap-2 p-3 rounded-2xl
                  border transition-all duration-300 active:scale-95 relative
                  ${game.available
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:-translate-y-1'
                    : 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'
                  }`}
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br
                  ${game.color} flex items-center justify-center
                  text-2xl shadow-lg transition-transform duration-300
                  ${game.available ? 'group-hover:scale-110 group-hover:rotate-6' : ''}`}>
                  <span className="drop-shadow-md whitespace-nowrap">{game.emoji}</span>
                </div>

                {/* Name */}
                <span className="text-white font-bold text-xs text-center
                  leading-tight">
                  {game.name}
                </span>
                {game.subtitle && (
                  <span className="text-white/60 text-[10px] text-center leading-tight">
                    {game.subtitle}
                  </span>
                )}

                {/* Badges */}
                {game.id === 'spin' && activeSpinSession && (
                  <span className="absolute top-1.5 right-1.5 text-[8px]
                    font-black px-1.5 py-0.5 rounded-full
                    bg-emerald-500/20 text-emerald-400
                    border border-emerald-500/30 animate-pulse">
                    LIVE
                  </span>
                )}
                {!game.available && (
                  <span className="absolute top-1.5 right-1.5 text-[8px]
                    font-bold px-1.5 py-0.5 rounded-full
                    bg-white/10 text-white/40">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}