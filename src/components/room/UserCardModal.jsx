import React from "react";
import {
  Loader2,
  AtSign,
  Heart,
  Gift,
  Crown,
  ShieldBan,
  Shield,
  Mic,
  XCircle,
  X,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserCardModal({
  open,
  onClose,
  cardLoading,
  selectedUserProfile,
  selectedUserId,
  isSelfCard,
  canShowOwnerTools,
  isOwner,
  targetMutedActive,
  moderatorsMap,
  effectiveSeats = [],
  FALLBACK_AVATAR,
  mentionUser,
  openGiftPanelForUser,
  goToProfilePage,
  toast,
  setInviteTargetUserId,
  setInviteOnlyMode,
  setSeatMenuSeatNo,
  setSeatMenuOpen,
  setInviteOpen,
  muteUser,
  unmuteUser,
  openKickConfirm,
  openBanConfirm,
  assignModerator,
  removeModerator,
}) {
  if (!open) return null;

  const cardName = selectedUserProfile?.name || "User";
  const cardAvatar = selectedUserProfile?.avatar_url || FALLBACK_AVATAR;
  const cardId = selectedUserProfile?.profile_id ?? null;
  const cardLevel = selectedUserProfile?.level ?? null;
  const cardVip = !!selectedUserProfile?.is_vip;
  const cardFamily = selectedUserProfile?.agency_name || null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3">
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-slate-600" />
              User
            </div>

            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4">
            {cardLoading ? (
              <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : selectedUserProfile ? (
              <>
                <div className="flex items-center gap-3">
                  <img
                    src={cardAvatar}
                    alt={cardName}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_AVATAR;
                    }}
                    className="w-16 h-16 rounded-full object-cover border bg-white"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-slate-900 truncate">
                        {cardName}
                      </div>

                      {cardVip ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Crown className="w-3.5 h-3.5" />
                          VIP
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-slate-600">
                      {cardId ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border">
                          ID: <b className="text-slate-800">{cardId}</b>
                        </span>
                      ) : null}

                      {cardLevel != null ? (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                          Level: <b>{cardLevel}</b>
                        </span>
                      ) : null}

                      {cardFamily ? (
                        <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700">
                          Family: <b>{cardFamily}</b>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isSelfCard}
                    onClick={() => mentionUser(selectedUserProfile)}
                  >
                    <AtSign className="w-4 h-4" />
                    Mention
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isSelfCard}
                    onClick={() => {
                      toast("❤️ Like (soon)", 1200);
                      onClose();
                    }}
                  >
                    <Heart className="w-4 h-4" />
                    Like
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isSelfCard}
                    onClick={() => {
                      openGiftPanelForUser(selectedUserProfile);
                      onClose();
                    }}
                  >
                    <Gift className="w-4 h-4" />
                    Send Gift
                  </Button>

                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => {
                      onClose();
                      goToProfilePage(selectedUserId);
                    }}
                  >
                    View Profile
                  </Button>
                </div>

                {canShowOwnerTools ? (
                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs text-slate-500 mb-2">
                      Owner / Moderator tools
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          if (!selectedUserId) return;

                          const firstEmptySeatNo =
                            (effectiveSeats || [])
                              .filter((s) => !s.user_id && !s.locked)
                              .sort(
                                (a, b) => (a.seat_no || 0) - (b.seat_no || 0)
                              )[0]?.seat_no ?? null;

                          if (!firstEmptySeatNo) {
                            toast("No empty seat", 1200);
                            return;
                          }

                          setInviteTargetUserId(selectedUserId);
                          setInviteOnlyMode(true);
                          setSeatMenuSeatNo(firstEmptySeatNo);
                          onClose();
                          setSeatMenuOpen(true);
                          setInviteOpen(true);
                        }}
                      >
                        <Mic className="w-4 h-4" />
                        Invite Mic
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                          if (!selectedUserId) return;
                          if (targetMutedActive) await unmuteUser(selectedUserId);
                          else await muteUser(selectedUserId);
                          onClose();
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                        {targetMutedActive ? "Unmute Chat" : "Mute Chat"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          if (!selectedUserId) return;
                          openKickConfirm(selectedUserId);
                          onClose();
                        }}
                      >
                        <X className="w-4 h-4" />
                        Kick
                      </Button>

                      <Button
                        type="button"
                        className="gap-2 bg-rose-600 hover:bg-rose-700"
                        onClick={() => {
                          if (!selectedUserId) return;
                          openBanConfirm(selectedUserId);
                          onClose();
                        }}
                      >
                        <ShieldBan className="w-4 h-4" />
                        Ban
                      </Button>

                      {isOwner ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            if (!selectedUserId) return;

                            if (moderatorsMap.has(selectedUserId)) {
                              removeModerator(selectedUserId);
                            } else {
                              assignModerator(selectedUserId);
                            }

                            onClose();
                          }}
                        >
                          <Shield className="w-4 h-4" />
                          {moderatorsMap.has(selectedUserId)
                            ? "Remove Mod"
                            : "Make Mod"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-slate-500">No user data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}