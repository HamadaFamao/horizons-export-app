import React from "react";

function getRankBadge(index) {
  if (index === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
        🥇 Rank #1
      </span>
    );
  }

  if (index === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
        🥈 Rank #2
      </span>
    );
  }

  if (index === 2) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
        🥉 Rank #3
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3">
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden animate-[fadeIn_.18s_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-slate-900">
              People in room ({people.length})
            </div>

            <button
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="max-h-[60vh] overflow-auto p-3 space-y-2">
            {people.length === 0 ? (
              <div className="text-sm text-slate-500 p-3">
                No one is currently in the room.
              </div>
            ) : (
              people.map((p, index) => {
                const isTopThree = index < 3;

                return (
                  <button
                    key={p.user_id || index}
                    onClick={() => openUserCard(p.user_id)}
                    className={`w-full text-left border rounded-xl p-3 transition flex items-center justify-between gap-3 ${
                      isTopThree
                        ? "bg-gradient-to-r from-slate-50 to-white border-slate-200 hover:bg-slate-50"
                        : "hover:bg-slate-50"
                    }`}
                    title="Open user card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={p.avatar || "/default-avatar.png"}
                          alt={p.name || "User"}
                          className={`w-12 h-12 rounded-full object-cover border bg-white ${
                            index === 0
                              ? "border-yellow-400"
                              : index === 1
                              ? "border-slate-300"
                              : index === 2
                              ? "border-amber-500"
                              : "border-slate-200"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 truncate">
                            {p.name || "User"}
                          </span>

                          {p.is_host ? (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                              HOST
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1">
                          {getRankBadge(index)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900">
                        {(p.support_coins || 0).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500">
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