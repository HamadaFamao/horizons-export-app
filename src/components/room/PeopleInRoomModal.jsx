import React from "react";

function getRankBadge(index) {
  if (index === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800 font-bold shadow-sm border border-yellow-200 animate-float">
        <span className="text-sm drop-shadow-sm">🥇</span> Rank #1
      </span>
    );
  }

  if (index === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-slate-200 to-slate-100 text-slate-700 font-bold shadow-sm border border-slate-300">
        <span className="text-sm drop-shadow-sm">🥈</span> Rank #2
      </span>
    );
  }

  if (index === 2) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-200 to-amber-100 text-amber-800 font-bold shadow-sm border border-amber-300">
        <span className="text-sm drop-shadow-sm">🥉</span> Rank #3
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200 transition-colors group-hover:bg-white group-hover:border-slate-300">
      Rank #{index + 1}
    </span>
  );
}

export default function PeopleInRoomModal({
  isOpen,
  onClose,
  people = [],
  openUserCard,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-enter {
          animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .stagger-item {
          opacity: 0;
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .gold-shine {
          position: relative;
          overflow: hidden;
        }
        .gold-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-20deg);
          animation: shine 3s infinite;
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-float {
          animation: float 2.5s ease-in-out infinite;
        }
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-pulse-soft {
          animation: pulse-soft 2s infinite;
        }
      `}</style>

      <div
  className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
  onClick={onClose}
  aria-hidden="true"
/>

      <div
  className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4"
  onClick={onClose}
>
  <div
    className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-modal-enter flex flex-col"
    onClick={(e) => e.stopPropagation()}
  >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              People in room
              <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                {people.length}
              </span>
            </div>

            <button
              className="text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all active:scale-95 font-medium"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2.5 scroll-smooth">
            {people.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <div className="text-4xl mb-3 opacity-50 animate-float">👻</div>
                <div className="text-sm font-medium">No one is currently in the room.</div>
              </div>
            ) : (
              people.map((p, index) => {
                const isTopThree = index < 3;

                return (
                  <button
                    key={p.user_id || index}
                    onClick={() => openUserCard(p.user_id)}
                    className={`group stagger-item w-full text-left border rounded-xl p-3 transition-all duration-300 ease-out flex items-center justify-between gap-3 hover:-translate-y-1 hover:shadow-lg ${
                      isTopThree
                        ? index === 0
                          ? "bg-gradient-to-r from-yellow-50 to-white border-yellow-200 hover:border-yellow-400 gold-shine"
                          : index === 1
                          ? "bg-gradient-to-r from-slate-50 to-white border-slate-200 hover:border-slate-400"
                          : "bg-gradient-to-r from-amber-50 to-white border-amber-200 hover:border-amber-400"
                        : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    style={{ animationDelay: `${index * 0.06}s` }}
                    title="Open user card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={p.avatar || "/default-avatar.png"}
                          alt={p.name || "User"}
                          className={`w-12 h-12 rounded-full object-cover border-2 bg-white transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${
                            index === 0
                              ? "border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                              : index === 1
                              ? "border-slate-300 shadow-[0_0_12px_rgba(148,163,184,0.4)]"
                              : index === 2
                              ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                              : "border-slate-200 group-hover:border-slate-300 group-hover:shadow-md"
                          }`}
                        />
                        {index === 0 && (
                          <div className="absolute -top-2.5 -right-2.5 text-xl animate-bounce drop-shadow-md">
                            👑
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {p.name || "User"}
                          </span>

                          {p.is_host ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200 font-bold shadow-sm animate-pulse-soft tracking-wide">
                              HOST
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1.5">
                          {getRankBadge(index)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <div
                        className={`font-black text-lg ${
                          index === 0
                            ? "text-yellow-600"
                            : index === 1
                            ? "text-slate-600"
                            : index === 2
                            ? "text-amber-600"
                            : "text-slate-800"
                        }`}
                      >
                        {(p.support_coins || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Coins
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}