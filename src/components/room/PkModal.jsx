import React from "react";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getDisplayName(userLike) {
  return (
    userLike?.display_name ||
    userLike?.name ||
    userLike?.username ||
    "User"
  );
}

function getSecondaryLabel(userLike, seatNo) {
  return (
    userLike?.profile_id ||
    userLike?.vip_id ||
    userLike?.public_id ||
    `Seat ${seatNo}`
  );
}

export default function PkModal({
  open,
  onClose,
  pkBusy = false,
  pkMode = "1v1",
  setPkMode,
  pkSeatsA = [],
  setPkSeatsA,
  pkSeatsB = [],
  setPkSeatsB,
  pkSeatA = "",
  setPkSeatA,
  pkSeatB = "",
  setPkSeatB,
  pkDuration = 5,
  setPkDuration,
  occupiedPkEligibleSeats = [],
  togglePkSeat,
  getRequiredPkTeamSize,
  fallbackAvatar,
  onCreatePk,
}) {
  if (!open) return null;

  const requiredCount =
    typeof getRequiredPkTeamSize === "function"
      ? getRequiredPkTeamSize(pkMode)
      : 1;

  const handleModeChange = (e) => {
    const value = e.target.value;
    setPkMode?.(value);
    setPkSeatsA?.([]);
    setPkSeatsB?.([]);
    setPkSeatA?.("");
    setPkSeatB?.("");
  };

  const handleDurationChange = (e) => {
    const value = Number(e.target.value);
    setPkDuration?.(Number.isFinite(value) ? value : 1);
  };

  const renderSeatButton = (side, seat) => {
    const seatId = String(seat.seat_no);
    const isA = side === "A";
    const selected = isA ? pkSeatsA.includes(seatId) : pkSeatsB.includes(seatId);
    const blocked = isA ? pkSeatsB.includes(seatId) : pkSeatsA.includes(seatId);
    const occupant = seat.occupant || {};
    const name = getDisplayName(occupant);
    const subtitle = getSecondaryLabel(occupant, seat.seat_no);

    return (
      <button
        key={`${side}-${seat.seat_no}`}
        type="button"
        disabled={blocked}
        onClick={() => togglePkSeat?.(side, seatId)}
        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          selected
            ? isA
              ? "border-fuchsia-400 bg-fuchsia-50"
              : "border-sky-400 bg-sky-50"
            : blocked
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <img
          src={occupant?.avatar_url || occupant?.avatar || fallbackAvatar}
          alt={name}
          className="w-10 h-10 rounded-full object-cover bg-slate-100 shrink-0"
          onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-slate-900">{name}</div>
          <div className="text-xs text-slate-500 truncate">{subtitle}</div>
        </div>
        {selected ? (
          <div className={`ml-auto text-[11px] font-bold shrink-0 ${isA ? "text-fuchsia-600" : "text-sky-600"}`}>
            Selected
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[85]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ✅ الكارت ثابت في الأسفل على موبايل، في المنتصف على desktop */}
      <div
        className="absolute inset-x-0 bottom-0 sm:inset-0 flex sm:items-center justify-center sm:p-3"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-xl border flex flex-col"
          style={{ maxHeight: "85dvh" }}   // ✅ dvh بيحسب مساحة الكيبورد تلقائياً
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Header ثابت ── */}
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
            <div className="font-semibold text-lg text-slate-900 flex items-center gap-2">
              <Swords className="w-5 h-5 text-purple-600" />
              Start PK
            </div>
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {/* ── Content قابل للـ scroll ── */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">

            {/* PK Mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PK Mode
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                value={pkMode}
                onChange={handleModeChange}
              >
                <option value="1v1">1 vs 1</option>
                <option value="2v2">2 vs 2</option>
                <option value="3v3">3 vs 3</option>
              </select>
            </div>

            {/* Side A */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Side A Seats
              </label>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {occupiedPkEligibleSeats.length > 0 ? (
                  occupiedPkEligibleSeats.map((seat) => renderSeatButton("A", seat))
                ) : (
                  <div className="text-sm text-slate-500 italic">No available seats</div>
                )}
              </div>
              <div className="mt-2 text-xs text-fuchsia-600 font-medium">
                Selected: {pkSeatsA.length} / {requiredCount}
              </div>
            </div>

            {/* Side B */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Side B Seats
              </label>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {occupiedPkEligibleSeats.length > 0 ? (
                  occupiedPkEligibleSeats.map((seat) => renderSeatButton("B", seat))
                ) : (
                  <div className="text-sm text-slate-500 italic">No available seats</div>
                )}
              </div>
              <div className="mt-2 text-xs text-sky-600 font-medium">
                Selected: {pkSeatsB.length} / {requiredCount}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Duration (minutes)
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={pkDuration}
                onChange={handleDurationChange}
              />
            </div>

          </div>

          {/* ── Footer ثابت — الأزرار دايماً ظاهرة ── */}
          <div className="px-4 py-3 border-t flex gap-2 shrink-0 bg-white">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={pkBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
              onClick={onCreatePk}
              disabled={pkBusy}
            >
              {pkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Start
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}