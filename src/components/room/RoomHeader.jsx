import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import PeopleInRoomButton from "@/components/room/PeopleInRoomButton";
import MicRequestsButton from "@/components/room/MicRequestsButton";
import PkButton from "@/components/room/PkButton";
import { Lock, Unlock, LogOut, Copy, Heart, Mic, CheckCircle2, XCircle, RefreshCw, Settings, X, Star } from "lucide-react";

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const SHIMMER_STYLE = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

function RoomCardModal({ room, hostUser, onClose, openUserCard }) {
  const roomId = room?.public_room_id
    ? `#${room.public_room_id}`
    : room?.id
    ? `#${String(room.id).slice(0, 8)}`
    : "";

  const roomIdDisplay = (
    <div className="flex items-center gap-2 bg-slate-100/50 pl-3 pr-1 py-1 rounded-lg border border-slate-200/50 shadow-sm mt-1">
      <div className="text-slate-600 text-sm font-mono font-semibold tracking-wide">{roomId}</div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(roomId);
        }}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-[0_0_10px_rgba(99,102,241,0.2)] transition-all duration-300 active:scale-95"
        title="Copy Room ID"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const roomLevel = room?.room_level ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-gradient-to-br from-white/95 via-slate-50/95 to-indigo-50/95 backdrop-blur-xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.4)] border border-white/60 overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 ease-out">
        {/* Header image / Close */}
        <div className="flex justify-end p-4 absolute top-0 right-0 z-10">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 backdrop-blur-md flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-all duration-300 hover:rotate-90 hover:scale-110"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Room avatar & Info */}
        <div className="px-6 pt-8 pb-6 overflow-y-auto hide-scrollbar">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
              <div className="w-24 h-24 rounded-3xl border-[4px] border-white/80 shadow-[0_0_25px_rgba(0,0,0,0.15)] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 shrink-0 relative z-10 transform group-hover:scale-110 transition-transform duration-500">
                {room?.avatar_url ? (
                  <img
                    src={room.avatar_url}
                    alt={room?.title}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Mic className="w-10 h-10 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="min-w-0 flex flex-col items-center gap-1 w-full">
              <div className="font-extrabold text-slate-900 text-xl truncate w-full px-4">{room?.title}</div>
              {roomIdDisplay}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {roomLevel !== null && (
              <div className="bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 border border-amber-300/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_15px_-5px_rgba(251,191,36,0.4)] hover:shadow-[0_8px_25px_-5px_rgba(251,191,36,0.6)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                <Star className="w-7 h-7 text-amber-500 drop-shadow-md group-hover:scale-110 transition-transform" fill="currentColor" />
                <div className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wider mt-1">Room Level</div>
                <div className="text-2xl font-black text-amber-900 drop-shadow-sm">{roomLevel}</div>
              </div>
            )}
            <div className={`border rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group ${room?.is_locked ? 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300/50 hover:shadow-md' : 'bg-gradient-to-br from-emerald-100 to-teal-50 border-emerald-300/50 hover:shadow-[0_8px_25px_-5px_rgba(16,185,129,0.4)]'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
              {room?.is_locked ? (
                <>
                  <Lock className="w-7 h-7 text-slate-600 drop-shadow-md group-hover:scale-110 transition-transform" />
                  <div className="text-[11px] text-slate-600 font-extrabold uppercase tracking-wider mt-1">Status</div>
                  <div className="text-2xl font-black text-slate-800 drop-shadow-sm">Locked</div>
                </>
              ) : (
                <>
                  <Unlock className="w-7 h-7 text-emerald-500 drop-shadow-md group-hover:scale-110 transition-transform" />
                  <div className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wider mt-1">Status</div>
                  <div className="text-2xl font-black text-emerald-900 drop-shadow-sm">Open</div>
                </>
              )}
            </div>
          </div>

          {/* Host */}
          {room?.owner_user_id && (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider px-1">Room Host</div>
              <button
                onClick={() => { openUserCard(room.owner_user_id); onClose(); }}
                className="w-full flex items-center gap-4 p-3 rounded-2xl border border-indigo-100/50 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300/50 hover:shadow-[0_8px_25px_-5px_rgba(99,102,241,0.25)] transition-all duration-300 group text-left"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm group-hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-300 group-hover:scale-105">
                  {hostUser?.avatar_url ? (
                    <img
                      src={hostUser.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Mic className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                    {hostUser?.name || hostUser?.display_name || "Room Owner"}
                  </div>
                  <div className="text-xs text-slate-500 truncate">View Profile</div>
                </div>
                <div className="shrink-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-white px-4 py-1.5 rounded-full text-xs font-extrabold shadow-[0_0_15px_rgba(251,191,36,0.6)] border border-yellow-300/50 group-hover:shadow-[0_0_25px_rgba(251,191,36,0.8)] group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
                  <span className="relative z-10 drop-shadow-md tracking-wider">HOST</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-shimmer"></div>
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
      <style>{SHIMMER_STYLE}</style>
      {showRoomCard && (
        <RoomCardModal
          room={room}
          hostUser={hostUser}
          onClose={() => setShowRoomCard(false)}
          openUserCard={openUserCard}
        />
      )}

      <div className="shrink-0 sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm p-2 sm:p-3 flex items-center justify-between gap-3 transition-all">
        {room?.is_locked ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200/60 shadow-sm font-medium">
            <Lock className="w-3 h-3 text-amber-500" /> Locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/60 shadow-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Open
          </span>
        )}

        <button
          onClick={() => setLeaveRoomOpen(true)}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all duration-300 hover:shadow-[0_0_15px_rgba(225,29,72,0.15)] group flex items-center justify-center"
          title="Leave Room"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="relative shrink-0 p-2 sm:p-3 border-b border-slate-200/60 bg-white/60 backdrop-blur-lg flex items-center gap-3 overflow-x-auto whitespace-nowrap hide-scrollbar shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        {/* Room avatar — opens room card */}
        <button
          onClick={() => setShowRoomCard(true)}
          className="relative group shrink-0 w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center cursor-pointer border-2 border-white shadow-md hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:border-indigo-100 transition-all duration-300 hover:scale-105"
          title="Room info"
        >
          {room?.avatar_url ? (
            <img
              src={room.avatar_url}
              alt={room.title}
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
            />
          ) : (
            <Mic className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
          )}
        </button>

        <div className="min-w-0 flex-1 max-w-[180px] flex flex-col justify-center gap-0.5">
          {/* Room title — opens room card */}
          <button
            onClick={() => setShowRoomCard(true)}
            className="font-bold text-slate-800 truncate text-[14px] text-left w-full hover:text-indigo-600 transition-colors"
          >
            {room?.title}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavoriteRoom(room?.id)}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border p-0 shrink-0 transition-all duration-300 hover:scale-110 active:scale-95 ${
                isFavorite
                  ? "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                  : "bg-white border-slate-200 text-slate-400 hover:text-rose-400 hover:border-rose-200 hover:bg-rose-50"
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'animate-pulse' : ''}`} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200/60 mx-1 shrink-0"></div>

        <PeopleInRoomButton
          people={currentPeopleRanked}
          onClick={() => setShowPeople(true)}
        />

        {canModerate ? (
          <div className="relative shrink-0 group flex items-center justify-center w-10 h-10">
            <div className="absolute inset-0 bg-blue-400/40 blur-md rounded-xl group-hover:bg-blue-400/60 transition-all duration-300 animate-pulse"></div>
            <div className="relative z-10 w-full h-full [&>*]:!w-full [&>*]:!h-full [&_button]:!w-full [&_button]:!h-full [&_button]:!rounded-xl [&_button]:!p-0 [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center">
              <MicRequestsButton
                count={pendingRequests.length}
                onClick={() => setRequestsOpen((prev) => !prev)}
                className="!w-full !h-full !p-0 !flex !items-center !justify-center !rounded-xl"
              />
            </div>
          </div>
        ) : null}

        {canModerate && (!pkSession || pkSession.status !== "live") ? (
          <div className="relative shrink-0 group flex items-center justify-center w-10 h-10">
            <div className="absolute inset-0 bg-blue-500/50 blur-md opacity-70 group-hover:opacity-100 transition-opacity duration-300 rounded-xl animate-pulse"></div>
            <div className="relative z-10 w-full h-full transform group-hover:scale-105 transition-transform duration-300 overflow-hidden rounded-xl [&>*]:!w-full [&>*]:!h-full [&_button]:!w-full [&_button]:!h-full [&_button]:!rounded-xl [&_button]:!p-0 [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center">
              <PkButton 
                onClick={() => setShowPkModal(true)} 
                disabled={pkBusy} 
                className="!w-full !h-full !p-0 !flex !items-center !justify-center !bg-gradient-to-br !from-blue-900/80 !via-blue-800/80 !to-blue-950/80 !text-white !border !border-blue-400/30 !shadow-[0_0_15px_rgba(59,130,246,0.5)] !rounded-xl backdrop-blur-md"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer pointer-events-none !w-full !h-full"></div>
            </div>
          </div>
        ) : null}

        <Button
          variant="outline"
          className="relative shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-100/50 via-amber-200/50 to-yellow-300/50 border border-yellow-300/50 text-yellow-900 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all duration-300 hover:scale-110 p-0 flex items-center justify-center group overflow-hidden backdrop-blur-md"
          onClick={() => setShowLeaderboard(true)}
          title="Leaderboard"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-shimmer"></div>
          <span className="text-xl relative z-10 group-hover:animate-bounce drop-shadow-md">🏆</span>
        </Button>

        {canModerate ? (
          <Button
            variant="outline"
            className="shrink-0 h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-300 hover:rotate-90 p-0 flex items-center justify-center"
            onClick={openSettings}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        ) : null}

        {myIncomingInvites.length > 0 ? (
          <div className="flex items-center gap-2 shrink-0 ml-1">
            {myIncomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm px-3 py-1.5 rounded-xl animate-in fade-in zoom-in duration-300"
              >
                <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5 hidden sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  Mic Invite
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAcceptMyInvite(inv)}
                  className="h-7 text-xs gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-2.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-105 border-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectMyInvite(inv)}
                  className="h-7 text-xs gap-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:shadow-[0_0_10px_rgba(225,29,72,0.15)] transition-all duration-300 hover:scale-105 px-2.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
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