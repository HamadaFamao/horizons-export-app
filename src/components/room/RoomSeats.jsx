import React from "react";
import { XCircle, MicOff } from "lucide-react";
import { ROOM_EMOJIS } from "@/lib/roomEmojis";

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" rx="64" fill="#f1f5f9"/>
    <circle cx="64" cy="52" r="22" fill="#cbd5e1"/>
    <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/>
  </svg>`);

export default function RoomSeats({
  loading,
  effectiveSeats,
  user,
  mutedUsers,
  activeSpeakers,
  pkUserSideMap,
  canModerate,
  isOwner,
  room,
  micSeatRefs,
  removeFromMic,
  leaveMySeat,
  openSeatMenu,
  openUserCard,
  toast,
  micMode,
  takeSeat,
  renderRoleBadge,
  micGiftTotals,
  micGiftTotalsReady,
  seatEmojiEffects,
}) {
  return (
    <div className="shrink-0 bg-transparent border-b lg:border-b-0 lg:border-r border-white/20 flex flex-col lg:w-[312px] xl:w-[336px]">
      <style>{`
        @keyframes seatEmojiPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3">
        <div className="grid grid-cols-3 gap-2">
          {loading
            ? null
            : (effectiveSeats || []).map((s) => {
              const person = s.occupant || null;
              let name = "Empty";
              let avatar = FALLBACK_AVATAR;

              if (person) {
                name =
                  person.display_name ||
                  person.full_name ||
                  person.raw_profile?.name ||
                  "User";
                avatar = person.avatar_url || FALLBACK_AVATAR;
              } else {
                name = "Empty";
                avatar = FALLBACK_AVATAR;
              }

              const isMySeat = !!(
                user?.id &&
                s.user_id &&
                String(s.user_id) === String(user.id)
              );
              const isSeatMuted = !!mutedUsers?.[String(s.user_id)];
              const isLocked = !!s.locked;
              const speakerLevel = Number(activeSpeakers?.[s.user_id] || 0);
              const isSpeakingNow = speakerLevel > 0.04;
              const waveScale = 1 + Math.min(speakerLevel, 0.5) * 0.35;
              const pkSide = s.user_id ? pkUserSideMap.get(String(s.user_id)) : null;
              const isHostUser = !!(s.user_id && String(s.user_id) === String(room?.owner_user_id));
              const hasRoleBadge = !!(s.user_id && renderRoleBadge(s.user_id));
              const isModUser = !!(s.user_id && !isHostUser && hasRoleBadge);
              const activeEffect = (seatEmojiEffects || []).find(
                (effect) => String(effect.userId) === String(s.user_id)
              );
              const activeEmojiMeta = activeEffect
                ? (ROOM_EMOJIS.find((emoji) => emoji.id === activeEffect.id) ||
                   ROOM_EMOJIS.find((emoji) => emoji.src === activeEffect.src))
                : null;

              return (
                <div
                  key={`${s.room_id}_${s.seat_no}`}
                  className={`relative rounded-xl border p-2 transition-all duration-300 backdrop-blur-sm ${pkSide === "A"
                    ? "bg-fuchsia-500/15 border-fuchsia-300/50 shadow-[0_0_12px_rgba(232,121,249,0.25)]"
                    : pkSide === "B"
                      ? "bg-cyan-500/15 border-cyan-300/50 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                      : "bg-white/10 border-white/20"
                    }`}
                  ref={(el) => {
                    if (s?.user_id) {
                      if (el) {
                        micSeatRefs.current[String(s.user_id)] = el;
                      } else {
                        delete micSeatRefs.current[String(s.user_id)];
                      }
                    }
                  }}
                >
                  <div className="mb-1 flex items-start justify-between gap-1">
                    <div className="text-[10px] text-white/70">Seat #{s.seat_no}</div>

                    <div className="flex items-center gap-1">
                      {pkSide === "A" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">
                          A
                        </span>
                      )}
                      {pkSide === "B" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 border border-cyan-200">
                          B
                        </span>
                      )}
                      {isLocked ? (
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                          🔒
                        </span>
                      ) : null}

                      {canModerate &&
                        s.user_id &&
                        !isMySeat &&
                        (isOwner || String(s.user_id) !== String(room?.owner_user_id)) ? (
                        <button
                          type="button"
                          onClick={() => removeFromMic(s.user_id)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Remove from mic"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : null}

                      {isMySeat ? (
                        <button
                          type="button"
                          onClick={() => leaveMySeat(s.seat_no)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Leave seat"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <button
                    className="w-full text-left"
                    onClick={() => {
                      if (isMySeat) {
                        openSeatMenu(s.seat_no);
                        return;
                      }

                      if (s.user_id) {
                        openUserCard(s.user_id);
                        return;
                      }

                      if (!s.user_id && canModerate) {
                        openSeatMenu(s.seat_no);
                        return;
                      }

                      if (!s.user_id && !canModerate) {
                        if (isLocked) {
                          toast("Seat is locked", 1200);
                          return;
                        }

                        if (micMode === "open") {
                          takeSeat(s.seat_no);
                          return;
                        }

                        toast("Request Mic first", 1200);
                      }
                    }}
                    disabled={false}
                    title={isMySeat ? "Open seat menu" : s.user_id ? "Open user card" : ""}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="relative flex items-center justify-center shrink-0">
                        {activeEffect ? (
                          <div
                            key={activeEffect.id}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                          >
                            <img
                              src={activeEffect.src}
                              alt={activeEmojiMeta?.label || "reaction"}
                              className="w-16 h-16 object-contain drop-shadow-lg animate-[seatEmojiPop_0.3s_ease-out_forwards]"
                              style={activeEffect.flip ? { transform: 'scaleX(-1)' } : undefined}
                            />
                          </div>
                        ) : null}

                        {s.user_id ? (
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                            {renderRoleBadge(s.user_id)}
                          </div>
                        ) : null}

                        {isSpeakingNow ? (
                          <>
                            <span
                              className="absolute inset-0 rounded-full border-2 border-emerald-400/70 animate-ping"
                              style={{
                                transform: `scale(${waveScale})`,
                                animationDuration: "900ms",
                              }}
                            />
                            <span
                              className="absolute inset-0 rounded-full border border-emerald-300/60"
                              style={{
                                transform: `scale(${1.08 + Math.min(speakerLevel, 0.4) * 0.22})`,
                                boxShadow: `0 0 ${16 + speakerLevel * 26}px rgba(52,211,153,${0.25 + speakerLevel * 0.35
                                  })`,
                              }}
                            />
                          </>
                        ) : null}

                        <img
                          src={avatar}
                          alt={name}
                          onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                          className={`object-cover bg-white/30 relative z-10 rounded-full transition-all duration-150 backdrop-blur-sm rounded-full object-cover ring-2 ring-white/60 shadow-lg ${s.user_id ? "w-16 h-16 sm:w-[72px] sm:h-[72px] cursor-pointer" : "w-9 h-9 sm:w-10 sm:h-10"
                            } ${isSpeakingNow
                              ? "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                              : isSeatMuted
                                ? "ring-2 ring-red-400/60"
                                : ""
                            }`}
                          style={
                            isSpeakingNow
                              ? {
                                boxShadow: `0 0 ${18 + speakerLevel * 28}px rgba(52,211,153,${0.35 + speakerLevel * 0.45
                                  })`,
                                transform: `scale(${1 + Math.min(speakerLevel, 0.35) * 0.18})`,
                              }
                              : undefined
                          }
                          onClick={(e) => {
                            if (!isMySeat && s.user_id) {
                              e.stopPropagation();
                              openUserCard(s.user_id);
                            }
                          }}
                        />

                        {isSpeakingNow ? (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-end gap-[2px] px-1.5 py-1 rounded-full bg-black/45 backdrop-blur-sm z-20">
                            {[0, 1, 2, 3].map((i) => {
                              const heights = [
                                6 + speakerLevel * 14,
                                10 + speakerLevel * 18,
                                7 + speakerLevel * 12,
                                12 + speakerLevel * 20,
                              ];
                              return (
                                <span
                                  key={i}
                                  className="w-[3px] rounded-full bg-emerald-400 transition-all duration-150"
                                  style={{ height: `${heights[i]}px` }}
                                />
                              );
                            })}
                          </div>
                        ) : null}

                        {isSeatMuted ? (
                          <div className="absolute -bottom-1 -right-1 z-20 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-white shadow-md">
                            <MicOff className="w-3 h-3" />
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={`mt-1 w-full text-xs sm:text-sm truncate flex items-center justify-center ${s.user_id ? "cursor-pointer" : ""
                          }`}
                        onClick={(e) => {
                          if (!isMySeat && s.user_id) {
                            e.stopPropagation();
                            openUserCard(s.user_id);
                          }
                        }}
                      >
                        <span
                          className={`max-w-[80px] truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] ${
                            !s.user_id
                              ? "text-white/80 font-semibold"
                              : isHostUser
                                ? "text-amber-300 font-black"
                                : isModUser
                                  ? "text-blue-300 font-bold"
                                  : "text-white font-semibold"
                          }`}
                        >
                          {s.user_id ? name : "Empty"}
                        </span>
                      </div>

                      {s.user_id && micGiftTotalsReady ? (
                        <div className="mt-1 text-[11px] font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center justify-center gap-1">
                          <span>💰</span>
                          <span>{(micGiftTotals[s.user_id] || 0).toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="mt-1 h-[16px]" />
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
