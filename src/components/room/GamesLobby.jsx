import React from 'react';
import { X } from 'lucide-react';

const GAMES = [
  {
    id: 'spin',
    emoji: '🎡',
    name: 'Spin Wheel',
    description: 'Winner takes all! Join the spin and test your luck.',
    color: 'from-amber-500 to-yellow-400',
    available: true,
  },
  {
    id: 'dice',
    emoji: '🎲',
    name: 'Dice Roll',
    description: 'Roll the dice, highest number wins.',
    color: 'from-blue-500 to-cyan-400',
    available: false,
  },
  {
    id: 'rps',
    emoji: '✂️',
    name: 'Rock Paper Scissors',
    description: '1v1 challenge between two players.',
    color: 'from-purple-500 to-pink-400',
    available: false,
  },
  {
    id: 'slots',
    emoji: '🎰',
    name: 'Slot Machine',
    description: 'Spin the slots and win big!',
    color: 'from-rose-500 to-orange-400',
    available: false,
  },
  {
    id: 'trivia',
    emoji: '❓',
    name: 'Trivia',
    description: 'Answer questions faster than others.',
    color: 'from-emerald-500 to-teal-400',
    available: false,
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
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {GAMES.map(game => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                if (!game.available) return;
                onSelectGame(game.id);
              }}
              disabled={!game.available}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl
                border transition text-left
                ${game.available
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98]'
                  : 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'
                }`}
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br
                ${game.color} flex items-center justify-center
                text-3xl shrink-0 shadow-lg`}>
                {game.emoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-base">
                    {game.name}
                  </span>
                  {game.id === 'spin' && activeSpinSession && (
                    <span className="text-[9px] font-black px-2 py-0.5
                      rounded-full bg-emerald-500/20 text-emerald-400
                      border border-emerald-500/30 animate-pulse">
                      LIVE
                    </span>
                  )}
                  {!game.available && (
                    <span className="text-[9px] font-bold px-2 py-0.5
                      rounded-full bg-white/10 text-white/40">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                  {game.description}
                </p>
              </div>

              {/* Arrow */}
              {game.available && (
                <div className="text-white/30 text-xl shrink-0">›</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}