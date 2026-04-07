import React from "react";
import { Button } from "@/components/ui/button";
import PeopleInRoomButton from "@/components/room/PeopleInRoomButton";
import MicRequestsButton from "@/components/room/MicRequestsButton";
import PkButton from "@/components/room/PkButton";
import { Lock, Unlock, LogOut, Copy, Heart, Mic, CheckCircle2, XCircle, RefreshCw, Settings } from "lucide-react";

export default function RoomHeader({
  room,
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
  return (
    <>
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
        <button
          onClick={() => openUserCard(room.owner_user_id)}
          className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer border"
          title="Open owner card"
        >
          {room?.avatar_url ? (
            <img
              src={room.avatar_url}
              alt={room.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.innerHTML = '<svg class="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>';
              }}
            />
          ) : (
            <Mic className="w-4 h-4 text-slate-700" />
          )}
        </button>

        <div className="min-w-0 flex-1 max-w-[160px]">
          <div className="font-semibold text-slate-900 truncate text-[13px]">{room?.title}</div>

          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            {room?.public_room_id ? `#${room.public_room_id}` : room?.id ? `#${String(room.id).slice(0, 8)}` : ''}
            <button
              onClick={copyRoomId}
              className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
              title="Copy room id"
            >
              <Copy className="w-3 h-3" />
            </button>

            <button
              onClick={() => toggleFavoriteRoom(room?.id)}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border p-0 shrink-0 ${isFavorite ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
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
            onClick={() => setRequestsOpen(prev => !prev)}
          />
        ) : null}

        {canModerate && (!pkSession || pkSession.status !== "live") ? (
          <PkButton
            onClick={() => setShowPkModal(true)}
            disabled={pkBusy}
          />
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
              <div key={inv.id} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
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
