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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header image */}
        <div className="relative h-36 bg-gradient-to-br from-slate-700 to-slate-900">
          {room?.background_url && (
            <img
              src={room.background_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Room avatar */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-slate-100 shrink-0">
              {room?.avatar_url ? (
                <img
                  src={room.avatar_url}
                  alt={room?.title}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Mic className="w-8 h-8 text-slate-400" />
                </div>
              )}
            </div>
            <div className="mb-2 min-w-0">
              <div className="font-bold text-slate-900 text-lg truncate">{room?.title}</div>
              <div className="text-slate-500 text-sm font-mono">{roomId}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {roomLevel !== null && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" />
                <div>
                  <div className="text-xs text-amber-700 font-medium">Room Level</div>
                  <div className="text-lg font-bold text-amber-800">{roomLevel}</div>
                </div>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-2">
              {room?.is_locked ? (
                <>
                  <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Status</div>
                    <div className="text-sm font-bold text-slate-700">Locked</div>
                  </div>
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Status</div>
                    <div className="text-sm font-bold text-emerald-700">Open</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Host */}
          {room?.owner_user_id && (
            <button
              onClick={() => { openUserCard(room.owner_user_id); onClose(); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                {room?.owner_avatar_url ? (
                  <img
                    src={room.owner_avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Mic className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs text-slate-500">Host</div>
                <div className="font-semibold text-slate-800 truncate">
                  {hostUser?.name || hostUser?.display_name || "Room Owner"}
                </div>
              </div>
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                HOST
              </span>
            </button>
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
          onClose={() => setShowRoomCard(false)}
          openUserCard={openUserCard}
        />
      )}

      <div className="shrink-0 sticky top-0 z-20 bg-white/95 backdrop-blur border-b p-2 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {room?.is_locked ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <Lock className="w-3 h-3" /> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Unlock className="w-3 h-3" /> Open
            </span>
          )}

          <button
            onClick={() => setLeaveRoomOpen(true)}
            className="p-2 rounded-full border bg-white hover:bg-gray-50"
            title="Leave Room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative shrink-0 p-2 sm:p-2.5 border-b flex items-center gap-1 overflow-x-auto whitespace-nowrap hide-scrollbar">
        {/* Room avatar — opens room card */}
        <button
          onClick={() => setShowRoomCard(true)}
          className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer border hover:ring-2 hover:ring-slate-300 transition"
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
            <Mic className="w-4 h-4 text-slate-700" />
          )}
        </button>

        <div className="min-w-0 flex-1 max-w-[160px]">
          {/* Room title — opens room card */}
          <button
            onClick={() => setShowRoomCard(true)}
            className="font-semibold text-slate-900 truncate text-[13px] text-left w-full hover:text-slate-600 transition"
          >
            {room?.title}
          </button>

          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            {room?.public_room_id
              ? `#${room.public_room_id}`
              : room?.id
              ? `#${String(room.id).slice(0, 8)}`
              : ""}
            <button
              onClick={copyRoomId}
              className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
              title="Copy room id"
            >
              <Copy className="w-3 h-3" />
            </button>

            <button
              onClick={() => toggleFavoriteRoom(room?.id)}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border p-0 shrink-0 ${
                isFavorite
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

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
          className="shrink-0 h-8 w-8 rounded-lg bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 p-0"
          onClick={() => setShowLeaderboard(true)}
        >
          <span className="text-sm">🏆</span>
        </Button>

        {canModerate ? (
          <Button
            variant="outline"
            className="shrink-0 h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 p-0"
            onClick={handleResetMicGiftCounters}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        ) : null}

        {canModerate ? (
          <Button
            variant="outline"
            className="shrink-0 h-8 w-8 rounded-lg p-0"
            onClick={openSettings}
          >
            <Settings className="w-4 h-4" />
          </Button>
        ) : null}

        {myIncomingInvites.length > 0 ? (
          <div className="flex items-center gap-2 shrink-0">
            {myIncomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg"
              >
                <span className="text-xs font-semibold text-indigo-800 flex items-center gap-1 hidden sm:flex">
                  <Mic className="w-3.5 h-3.5" />
                  Mic Invite
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAcceptMyInvite(inv)}
                  className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectMyInvite(inv)}
                  className="h-7 text-xs gap-1 text-rose-600 hover:bg-rose-50 px-2"
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
