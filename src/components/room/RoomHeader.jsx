import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import PeopleInRoomButton from "@/components/room/PeopleInRoomButton";
import MicRequestsButton from "@/components/room/MicRequestsButton";
import PkButton from "@/components/room/PkButton";
import { Lock, Unlock, LogOut, Copy, Heart, Mic, CheckCircle2, XCircle, RefreshCw, Settings, X, Star } from "lucide-react";

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

function RoomCardModal({ room, hostUser, onClose, openUserCard }) {
  const roomId = room?.public_room_id
    ? `#${room.public_room_id}`
    : room?.id
    ? `#${String(room.id).slice(0, 8)}`
    : "";

  const roomLevel = room?.room_level ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 border border-white/20">
        {/* Gradient Header */}
        <div className="h-32 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 relative">
          <div className="absolute inset-0 bg-black/10"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:rotate-90 text-white shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 relative">
          {/* Room avatar & Title */}
          <div className="flex items-end gap-4 -mt-12 mb-5">
            <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-white shrink-0 relative z-10 group cursor-pointer">
              {room?.avatar_url ? (
                <img
                  src={room.avatar_url}
                  alt={room?.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                  <Mic className="w-8 h-8 text-slate-400 group-hover:scale-110 transition-transform duration-500" />
                </div>
              )}
            </div>
            <div className="mb-1 min-w-0 flex-1 pt-14">
              <div className="font-black text-slate-900 text-xl truncate tracking-tight">{room?.title}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="text-slate-600 text-xs font-mono bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/50">
                  {roomId}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(roomId)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all active:scale-95"
                  title="Copy Room ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {roomLevel !== null && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center shrink-0 shadow-inner">
                  <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
                </div>
                <div>
                  <div className="text-[10px] text-amber-600/80 font-bold uppercase tracking-widest mb-0.5">Room Level</div>
                  <div className="text-lg font-black text-amber-700 leading-none">{roomLevel}</div>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-slate-50 to-gray-50/50 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              {room?.is_locked ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0 shadow-inner">
                    <Lock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Status</div>
                    <div className="text-sm font-black text-slate-700 leading-none">Locked</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-emerald-100/80 flex items-center justify-center shrink-0 shadow-inner">
                    <Unlock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-widest mb-0.5">Status</div>
                    <div className="text-sm font-black text-emerald-700 leading-none">Open</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Host */}
          {room?.owner_user_id && (
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Room Host</div>
              <button
                onClick={() => { openUserCard(room.owner_user_id); onClose(); }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-violet-100 hover:shadow-md transition-all duration-300 active:scale-[0.98] group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 ring-2 ring-transparent group-hover:ring-violet-200 transition-all duration-300 shadow-sm">
                  {hostUser?.avatar_url ? (
                    <img
                      src={hostUser.avatar_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Mic className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="font-bold text-slate-800 truncate group-hover:text-violet-600 transition-colors text-sm">
                    {hostUser?.name || hostUser?.display_name || "Room Owner"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">View Profile</div>
                </div>
                <div className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-[10px] font-black tracking-wider shrink-0 shadow-sm">
                  HOST
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoomHeader({
  room,
  hostUser,
  setLeaveRoomOpen,
  openUserCard,
  copyRoomId,
  toggleFavoriteRoom,
  isFavorite,
  currentPeopleRanked,
  setShowPeople,
  canModerate,
  pendingRequests,
  setRequestsOpen,
  pkSession,
  pkBusy,
  setShowPkModal,
  setShowLeaderboard,
  handleResetMicGiftCounters,
  openSettings,
  myIncomingInvites,
  handleAcceptMyInvite,
  handleRejectMyInvite,
}) {
  const [showRoomCard, setShowRoomCard] = useState(false);

  return (
    <>
      {showRoomCard && (
        <RoomCardModal
          room={room}
          hostUser={hostUser}
          onClose={() => setShowRoomCard(false)}
          openUserCard={openUserCard}
        />
      )}

      {/* Top Bar */}
      <div className="shrink-0 sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 p-2 sm:p-3 flex items-center justify-between gap-3 transition-all shadow-sm">
        <div className="flex items-center gap-2">
          {room?.is_locked ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200/50 shadow-sm">
              <Lock className="w-3.5 h-3.5" /> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/50 shadow-sm">
              <Unlock className="w-3.5 h-3.5" /> Open
            </span>
          )}
        </div>

        <button
          onClick={() => setLeaveRoomOpen(true)}
          className="p-2.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md group"
          title="Leave Room"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="relative shrink-0 p-2 sm:p-3 border-b border-slate-100 bg-white/60 backdrop-blur-md flex items-center gap-2.5 overflow-x-auto whitespace-nowrap hide-scrollbar">
        
        {/* Room avatar — opens room card */}
        <button
          onClick={() => setShowRoomCard(true)}
          className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer border-2 border-white shadow-sm hover:shadow-md hover:scale-105 hover:ring-2 hover:ring-violet-400 hover:ring-offset-2 transition-all duration-300 group"
          title="Room info"
        >
          {room?.avatar_url ? (
            <img
              src={room.avatar_url}
              alt={room.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
            />
          ) : (
            <Mic className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform duration-500" />
          )}
        </button>

        {/* Room title & Favorite */}
        <div className="min-w-0 flex-1 max-w-[160px] flex flex-col justify-center gap-1">
          <button
            onClick={() => setShowRoomCard(true)}
            className="font-bold text-slate-800 truncate text-[13px] sm:text-sm text-left w-full hover:text-violet-600 transition-colors"
          >
            {room?.title}
          </button>
          <div className="flex items-center">
            <button
              onClick={() => toggleFavoriteRoom(room?.id)}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-300 active:scale-75 ${
                isFavorite
                  ? "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100 shadow-sm"
                  : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-rose-400"
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? "animate-in zoom-in duration-300" : ""}`} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="w-px h-8 bg-slate-200 mx-1 shrink-0"></div>

        <PeopleInRoomButton
          people={currentPeopleRanked}
          onClick={() => setShowPeople(true)}
        />

        {canModerate ? (
          <MicRequestsButton
            count={pendingRequests.length}
            onClick={() => setRequestsOpen((prev) => !prev)}
          />
        ) : null}

        {canModerate && (!pkSession || pkSession.status !== "live") ? (
          <PkButton onClick={() => setShowPkModal(true)} disabled={pkBusy} />
        ) : null}

        <Button
          variant="outline"
          className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200/60 text-amber-600 hover:from-yellow-100 hover:to-amber-100 hover:text-amber-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-0"
          onClick={() => setShowLeaderboard(true)}
          title="Leaderboard"
        >
          <span className="text-lg drop-shadow-sm">🏆</span>
        </Button>

        {canModerate ? (
          <Button
            variant="outline"
            className="shrink-0 h-10 w-10 rounded-xl bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-violet-600 hover:border-violet-200 hover:shadow-md hover:rotate-90 transition-all duration-300 p-0"
            onClick={openSettings}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        ) : null}

        {/* Invites */}
        {myIncomingInvites.length > 0 ? (
          <div className="flex items-center gap-2 shrink-0 ml-1 pl-3 border-l border-slate-200">
            {myIncomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100/50 px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-right-4 fade-in duration-300"
              >
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 hidden sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  Mic Invite
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAcceptMyInvite(inv)}
                  className="h-8 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-lg shadow-sm hover:shadow transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectMyInvite(inv)}
                  className="h-8 text-xs font-bold gap-1.5 text-rose-600 border-rose-200 bg-white hover:bg-rose-50 px-3 rounded-lg shadow-sm hover:shadow transition-all active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}