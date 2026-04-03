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
  hostUserId,
  targetMutedActive,
  moderatorsMap,
  effectiveSeats = [],
  FALLBACK_AVATAR,
  mentionUser,
  openGiftPanelForUser,
  goToProfilePage,
  toast,
  setInviteTargetUserId,
  selectedUserIsMod,
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

  const safeModeratorsMap =
    moderatorsMap instanceof Map ? moderatorsMap : new Map();

  const cardName = selectedUserProfile?.name || "User";
const cardAvatar = selectedUserProfile?.avatar_url || FALLBACK_AVATAR;

const cardId =
  selectedUserProfile?.display_id ??
  selectedUserProfile?.profile_id ??
  null;

const cardLevel =
  Number(
    selectedUserProfile?.currentLevel ??
    selectedUserProfile?.current_level ??
    selectedUserProfile?.level ??
    selectedUserProfile?.wallet_level ??
    selectedUserProfile?.walletLevel ??
    selectedUserProfile?.user_level ??
    0
  ) || null;

const cardFamily =
  selectedUserProfile?.family_name ??
  selectedUserProfile?.agency_name ??
  null;

const vipNumber =
  Number(
    selectedUserProfile?.vip_number ??
    selectedUserProfile?.vipLevel ??
    selectedUserProfile?.vip_level ??
    selectedUserProfile?.plan_level ??
    (selectedUserProfile?.is_vip ? 1 : 0)
  ) || 0;

const vipBadgeMap = {
  1: {
    label: "VIP 1",
    className: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  2: {
    label: "VIP 2",
    className: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  3: {
    label: "VIP 3",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  4: {
    label: "VIP 4",
    className: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

const vipBadge =
  vipNumber > 0 ? vipBadgeMap[Math.min(vipNumber, 4)] : null;

const planKey = String(selectedUserProfile?.plan || "").toLowerCase();

const planBadgeMap = {
  free: null,
  silver: {
    label: "Silver",
    className: "bg-slate-50 text-slate-700 border border-slate-200",
  },
  gold: {
    label: "Gold",
    className: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  },
  platinum: {
    label: "Platinum",
    className: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  },
  diamond: {
    label: "Diamond",
    className: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200",
  },
};

const planBadge = planBadgeMap[planKey] || null;

const cardIsMod = !!selectedUserIsMod;

const cardIsHost =
  String(selectedUserId || "") === String(hostUserId || "");

const cardIsAdmin = cardIsMod; 

  const handleInviteMic = () => {
    if (!selectedUserId) return;

    const firstEmptySeatNo =
      (effectiveSeats || [])
        .filter((s) => !s.user_id && !s.locked)
        .sort((a, b) => (a.seat_no || 0) - (b.seat_no || 0))[0]?.seat_no ??
      null;

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
  };

  const handleMuteToggle = async () => {
    if (!selectedUserId) return;

    if (targetMutedActive) {
      await unmuteUser(selectedUserId);
    } else {
      await muteUser(selectedUserId);
    }

    onClose();
  };

  const handleKick = () => {
    if (!selectedUserId) return;
    openKickConfirm(selectedUserId);
    onClose();
  };

  const handleBan = () => {
    if (!selectedUserId) return;
    openBanConfirm(selectedUserId);
    onClose();
  };

  const handleModeratorToggle = () => {
  if (!selectedUserId) return;

  if (cardIsMod) {
    removeModerator(selectedUserId);
  } else {
    assignModerator(selectedUserId);
  }

  onClose();
};

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
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
            className="text-sm text-slate-600 hover:text-slate-900"
            onClick={onClose}
            type="button"
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
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_AVATAR;
                  }}
                  alt={cardName}
                  className="w-16 h-16 rounded-full object-cover border bg-white"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-slate-900 truncate">
                      {cardName}
                    </div>

                    {cardIsHost ? (
  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 font-extrabold tracking-wide shadow-lg shadow-amber-500/50 border border-yellow-200">
    HOST
  </span>
) : null}

{cardIsMod ? (
  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-600 text-white font-extrabold tracking-wide shadow-lg shadow-indigo-500/50 border border-indigo-300">
    MOD
  </span>
) : null}

{vipBadge ? (
  <span
    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-extrabold tracking-wide shadow-lg shadow-yellow-500/50 border border-white/50 ${vipBadge.className}`}
  >
    <Crown className="w-3.5 h-3.5 drop-shadow-md" />
    {vipBadge.label}
  </span>
) : null}

{planBadge ? (
  <span
    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold tracking-wide shadow-md border border-white/30 ${planBadge.className}`}
  >
    {planBadge.label}
  </span>
) : null}

{cardLevel !== null && cardLevel > 0 ? (
  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 text-white font-extrabold tracking-wide shadow-lg shadow-blue-500/50 border border-cyan-200">
    Lv.{cardLevel}
  </span>
) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-slate-600">
                    {cardId ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border">
                        ID: <b className="text-slate-800">{cardId}</b>
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
                  variant="outline"
                  className="gap-2"
                  disabled={isSelfCard}
                  onClick={() => mentionUser(selectedUserProfile)}
                >
                  <AtSign className="w-4 h-4" />
                  Mention
                </Button>

                <Button
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
                      variant="outline"
                      className="gap-2"
                      onClick={handleInviteMic}
                    >
                      <Mic className="w-4 h-4" />
                      Invite Mic
                    </Button>

                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleMuteToggle}
                    >
                      <XCircle className="w-4 h-4" />
                      {targetMutedActive ? "Unmute Chat" : "Mute Chat"}
                    </Button>

                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleKick}
                    >
                      <X className="w-4 h-4" />
                      Kick
                    </Button>

                    <Button
                      className="gap-2 bg-rose-600 hover:bg-rose-700"
                      onClick={handleBan}
                    >
                      <ShieldBan className="w-4 h-4" />
                      Ban
                    </Button>

                    {isOwner ? (
  <Button
    variant="outline"
    className="gap-2"
    onClick={handleModeratorToggle}
  >
    <Shield className="w-4 h-4" />
    {cardIsMod ? "Remove Mod" : "Make Mod"}
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
  );
}