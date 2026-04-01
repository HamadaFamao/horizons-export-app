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
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        className="absolute inset-0 flex items-end sm:items-center justify-center p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden">
          
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">
              People in room ({people.length})
            </div>
            <button
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-auto p-3 space-y-2">
            {people.length === 0 ? (
              <div className="text-sm text-slate-500 p-3">
                No one is currently in the room.
              </div>
            ) : (
              people.map((p, index) => (
                <button
                  key={p.user_id || index}
                  onClick={() => openUserCard(p.user_id)}
                  className="w-full text-left border rounded-xl p-3 hover:bg-slate-50 transition flex items-center justify-between"
                >
                  {/* Left */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={p.avatar || "/default-avatar.png"}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">
                          {p.name || "User"}
                        </span>

                        {p.is_host && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                            HOST
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        Rank #{index + 1}
                      </div>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-900">
                      {(p.support_coins || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Coins
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}