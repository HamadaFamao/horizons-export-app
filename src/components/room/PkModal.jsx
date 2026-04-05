import React, { useEffect, useState } from "react";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getDisplayName(userLike) {
  return userLike?.display_name || userLike?.name || userLike?.username || "User";
}
function getSecondaryLabel(userLike, seatNo) {
  return userLike?.profile_id || userLike?.vip_id || userLike?.public_id || `Seat ${seatNo}`;
}

export default function PkModal({
  open, onClose, pkBusy = false,
  pkMode = "1v1", setPkMode,
  pkSeatsA = [], setPkSeatsA,
  pkSeatsB = [], setPkSeatsB,
  pkSeatA = "", setPkSeatA,
  pkSeatB = "", setPkSeatB,
  pkDuration = 5, setPkDuration,
  occupiedPkEligibleSeats = [],
  togglePkSeat, getRequiredPkTeamSize,
  fallbackAvatar, onCreatePk,
}) {
  // ✅ نتتبع الـ visualViewport بدقة
  const [vpHeight, setVpHeight] = useState(() =>
    window.visualViewport ? window.visualViewport.height : window.innerHeight
  );
  const [vpTop, setVpTop] = useState(() =>
    window.visualViewport ? window.visualViewport.offsetTop : 0
  );

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        setVpHeight(vv.height);
        setVpTop(vv.offsetTop);
      } else {
        setVpHeight(window.innerHeight);
        setVpTop(0);
      }
    };

    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    } else {
      window.addEventListener("resize", update);
    }
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      } else {
        window.removeEventListener("resize", update);
      }
    };
  }, [open]);

  if (!open) return null;

  const requiredCount =
    typeof getRequiredPkTeamSize === "function" ? getRequiredPkTeamSize(pkMode) : 1;

  const handleModeChange = (e) => {
    setPkMode?.(e.target.value);
    setPkSeatsA?.([]);
    setPkSeatsB?.([]);
    setPkSeatA?.("");
    setPkSeatB?.("");
  };

  const handleDurationChange = (e) => {
    const v = Number(e.target.value);
    setPkDuration?.(Number.isFinite(v) ? v : 1);
  };

  const renderSeatButton = (side, seat) => {
    const seatId = String(seat.seat_no);
    const isA = side === "A";
    const selected = isA ? pkSeatsA.includes(seatId) : pkSeatsB.includes(seatId);
    const blocked = isA ? pkSeatsB.includes(seatId) : pkSeatsA.includes(seatId);
    const occupant = seat.occupant || {};
    return (
      <button
        key={`${side}-${seat.seat_no}`}
        type="button"
        disabled={blocked}
        onClick={() => togglePkSeat?.(side, seatId)}
        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? isA ? "border-fuchsia-400 bg-fuchsia-50" : "border-sky-400 bg-sky-50"
            : blocked
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <img
          src={occupant?.avatar_url || occupant?.avatar || fallbackAvatar}
          alt={getDisplayName(occupant)}
          className="w-9 h-9 rounded-full object-cover bg-slate-100 shrink-0"
          onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-slate-900 text-sm">{getDisplayName(occupant)}</div>
          <div className="text-xs text-slate-500 truncate">{getSecondaryLabel(occupant, seat.seat_no)}</div>
        </div>
        {selected && (
          <span className={`ml-auto text-[11px] font-bold shrink-0 ${isA ? "text-fuchsia-600" : "text-sky-600"}`}>
            Selected
          </span>
        )}
      </button>
    );
  };

  // ✅ الـ modal يتموضع بالضبط فوق الكيبورد
  // vpTop = المسافة من أعلى الصفحة للـ visualViewport (بيتغير لما الكيبورد يظهر)
  const modalMaxHeight = vpHeight * 0.88;

  return (
    // ✅ fixed على الـ screen مش الـ page، وبيتحرك مع الـ visualViewport
    <div
      style={{
        position: "fixed",
        top: vpTop,
        left: 0,
        right: 0,
        height: vpHeight,
        zIndex: 85,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* الكارت */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 448,
          maxHeight: modalMaxHeight,
          display: "flex",
          flexDirection: "column",
          background: "white",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ثابت ── */}
        <div style={{
          flexShrink: 0,
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 16 }}>
            <Swords style={{ width: 20, height: 20, color: "#7c3aed" }} />
            Start PK
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 14, color: "#64748b", padding: "4px 8px" }}
          >
            Close
          </button>
        </div>

        {/* ── Content قابل للـ scroll ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* PK Mode */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                PK Mode
              </label>
              <select
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 14, background: "white" }}
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Side A Seats
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                {occupiedPkEligibleSeats.length > 0
                  ? occupiedPkEligibleSeats.map((s) => renderSeatButton("A", s))
                  : <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No available seats</div>
                }
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#c026d3", fontWeight: 500 }}>
                Selected: {pkSeatsA.length} / {requiredCount}
              </div>
            </div>

            {/* Side B */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Side B Seats
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                {occupiedPkEligibleSeats.length > 0
                  ? occupiedPkEligibleSeats.map((s) => renderSeatButton("B", s))
                  : <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No available seats</div>
                }
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#0284c7", fontWeight: 500 }}>
                Selected: {pkSeatsB.length} / {requiredCount}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                Duration (minutes)
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={pkDuration}
                onChange={handleDurationChange}
                // ✅ منع scroll الصفحة لما اليوزر يكتب
                onFocus={(e) => e.target.select()}
              />
            </div>

          </div>
        </div>

        {/* ── Footer ثابت دايماً ── */}
        <div style={{
          flexShrink: 0,
          padding: "12px 16px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: 8,
          background: "white",
        }}>
          <Button
            type="button"
            variant="outline"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={pkBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            style={{ flex: 1, background: "#7c3aed", color: "white" }}
            onClick={onCreatePk}
            disabled={pkBusy}
          >
            {pkBusy ? <Loader2 style={{ width: 16, height: 16, marginRight: 4 }} className="animate-spin" /> : null}
            Start
          </Button>
        </div>

      </div>
    </div>
  );
}