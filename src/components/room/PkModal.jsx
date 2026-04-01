import React from "react";

export default function PkModal({
  open,
  onClose,
  pkBusy,
  pkMode,
  setPkMode,
  pkSeatsA,
  setPkSeatsA,
  pkSeatsB,
  setPkSeatsB,
  pkSeatA,
  setPkSeatA,
  pkSeatB,
  setPkSeatB,
  pkDuration,
  setPkDuration,
  occupiedPkEligibleSeats,
  togglePkSeat,
  getRequiredPkTeamSize,
  fallbackAvatar,
  onCreatePk,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="absolute inset-0 flex items-end sm:items-center justify-center p-3"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white border shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-slate-900 text-[18px]">
              PK
            </div>

            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="text-sm text-slate-600">
              Start a PK session with another room.
            </div>

            <button
              type="button"
              disabled={pkBusy}
              onClick={onStartPk}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                pkBusy
                  ? "bg-purple-300 text-white cursor-not-allowed"
                  : "bg-purple-500 hover:bg-purple-600 text-white"
              }`}
            >
              {pkBusy ? "Starting..." : "Start PK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}