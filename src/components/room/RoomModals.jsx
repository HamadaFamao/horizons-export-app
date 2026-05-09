import React from "react";
import PeopleInRoomModal from "@/components/room/PeopleInRoomModal";
import MicRequestsModal from "@/components/room/MicRequestsModal";
import PkModal from "@/components/room/PkModal";
import UserCardModal from "@/components/room/UserCardModal";
import LeaderboardModal from "@/components/LeaderboardModal";
import { Button } from "@/components/ui/button";
import { Loader2, MicOff, CheckCircle2, RefreshCw, Settings, ImageIcon, X, Minimize2, Power, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" rx="64" fill="#f1f5f9"/>
    <circle cx="64" cy="52" r="22" fill="#cbd5e1"/>
    <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/>
  </svg>`);

const ROOM_BACKGROUND_PRESETS = [
  // Free - static images (WebP)
  { id: "stars", type: "image", url: "/room-backgrounds/stars.webp", label: "Stars", vip: false },
  { id: "soft", type: "image", url: "/room-backgrounds/soft.webp", label: "Soft", vip: false },
  { id: "nature", type: "image", url: "/room-backgrounds/nature.webp", label: "Nature", vip: false },
  { id: "abstract", type: "image", url: "/room-backgrounds/abstract.webp", label: "Abstract", vip: false },
  {
  id: "softpink",
  type: "image",
  url: "/room-backgrounds/softpink.webp",
  label: "Soft Pink",
  vip: false
},
{
  id: "dark",
  type: "image",
  url: "/room-backgrounds/dark.webp",
  label: "Dark",
  vip: false
},

  // VIP - animated videos (MP4)
  { id: "romantic", type: "video", url: "/room-backgrounds/romantic.mp4", label: "Romantic", vip: true },
  { id: "vip", type: "video", url: "/room-backgrounds/vip.mp4", label: "VIP", vip: true },
  { id: "neon", type: "video", url: "/room-backgrounds/neon.mp4", label: "Neon", vip: true },
  { id: "luxury", type: "video", url: "/room-backgrounds/luxury.mp4", label: "Luxury", vip: true },
];

export default function RoomModals({
  // Background changed callback
  onBackgroundChanged,

  // PeopleInRoomModal
  showPeople,
  setShowPeople,
  currentPeopleRanked,
  openUserCard,

  // seatMenu modal
  seatMenuOpen,
  closeSeatMenu,
  effectiveSeats,
  user,
  seatMenuSeatNo,
  setSeatMenuSeatNo,
  canModerate,
  inviteOnlyMode,
  setInviteOnlyMode,
  inviteTargetUserId,
  setInviteTargetUserId,
  inviteOpen,
  setInviteOpen,
  takeMicSeat,
  moveMicSeat,
  setSeatLocked,
  seatMenuSeatLocked,
  activeParticipants,
  inviteUserToMic,
  toast,
  toastSuccess,
  handleClearChat,
  onLockRoom,
  onUnlockRoom,

  // showSettings modal
  showSettings,
  closeSettings,
  setRoom,
  onToggleChat,
  settingsTab,
  setSettingsTab,
  handleResetMicGiftCounters,
  openBansTab,
  room,
  isOwner,
  isVIP,
  hasAnimatedBackgroundAccess,
  roomAvatarInputRef,
  handleRoomAvatarUpload,
  roomAvatarUploading,
  roomAvatarVipInputRef,
  handleRoomAvatarVipUpload,
  roomAvatarVipUploading,
  roomBackgroundInputRef,
  handleRoomBackgroundUpload,
  roomBackgroundVipInputRef,
  handleRoomBackgroundVipUpload,
  roomBackgroundUploading,
  loadingBans,
  bannedList,
  setBannedList,
  settingsBusy,
  fetchBans,
  mountedRef,
  unbanUser,

  // MicRequestsModal
  requestsOpen,
  setRequestsOpen,
  pendingRequests,
  acceptRequest,
  rejectRequest,

  // leaveRoom modal
  leaveRoomOpen,
  setLeaveRoomOpen,
  roomId,
  setRoomData,
  miniRoomActiveRef,
  setMiniRoomActive,
  navigate,
  handleExitRoom,

  // LeaderboardModal
  showLeaderboard,
  setShowLeaderboard,
  leaderboardTab,
  setLeaderboardTab,
  leaderboardData,

  // PkModal
  showPkModal,
  setShowPkModal,
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
  handleCreatePk,

  // PK Result modal
  pkResultOpen,
  pkResultData,
  setPkResultOpen,
  setPkResultData,

  // UserCardModal
  hostUser,
  isUserCardOpen,
  closeUserCard,
  cardLoading,
  selectedUserProfile,
  selectedUserId,
  selectedUserIsMod,
  isSelfCard,
  canShowOwnerTools,
  targetMutedActive,
  moderatorsMap,
  mentionUser,
  openGiftPanelForUser,
  goToProfilePage,
  muteUser,
  unmuteUser,
  openKickConfirm,
  openBanConfirm,
  assignModerator,
  removeModerator,
  setSeatMenuOpen,
}) {
  const showSuccessToast = toastSuccess || toast;
  const [lockPin, setLockPin] = React.useState("");
  const [moderatorsList, setModeratorsList] = React.useState([]);
  const [moderatorsLoading, setModeratorsLoading] = React.useState(false);
  const [roomBackgroundPreviewFailed, setRoomBackgroundPreviewFailed] = React.useState(false);
  const [showBackgroundGallery, setShowBackgroundGallery] = React.useState(false);
  const [selectedBackgroundPreset, setSelectedBackgroundPreset] = React.useState(null);
  const [applyingBackgroundPreset, setApplyingBackgroundPreset] = React.useState(false);
  const [randomAutoPlay, setRandomAutoPlay] = React.useState(false);
  const randomIntervalRef = React.useRef(null);

  const isVideoBackground = (url) => /\.(mp4|webm)(\?|#|$)/i.test(String(url || ""));
  const previewBackgroundUrl = selectedBackgroundPreset?.url || room?.background_url;
  const canUseGallery = true;
  const hasCoinsFeature = Boolean(hasAnimatedBackgroundAccess);
  const freeBackgroundPresets = ROOM_BACKGROUND_PRESETS.filter((preset) => !preset.vip);
  const vipBackgroundPresets = ROOM_BACKGROUND_PRESETS.filter((preset) => preset.vip);

  React.useEffect(() => {
    console.log("[ROOM_BACKGROUND_ACCESS]", {
      isVIP: Boolean(isVIP),
      hasAnimatedBackgroundAccess: Boolean(hasAnimatedBackgroundAccess),
      canUseGallery,
    });
  }, [isVIP, hasAnimatedBackgroundAccess, canUseGallery]);

  React.useEffect(() => {
    setRoomBackgroundPreviewFailed(false);
  }, [previewBackgroundUrl]);

  React.useEffect(() => {
    if (!showBackgroundGallery && randomAutoPlay) {
      clearInterval(randomIntervalRef.current);
      setRandomAutoPlay(false);
    }
  }, [showBackgroundGallery]);

  React.useEffect(() => {
    return () => {
      if (randomIntervalRef.current) clearInterval(randomIntervalRef.current);
    };
  }, []);

  const applyBackgroundPreset = async () => {
    if (!isOwner || !room?.id || !selectedBackgroundPreset?.url) return;
    if (!isVIP) {
      toast("Upgrade to VIP or use coins to unlock this feature", 1400);
      return;
    }

    setApplyingBackgroundPreset(true);
    try {
      const newUrl = selectedBackgroundPreset.url;
      const { error } = await supabase
        .from("live_rooms")
        .update({ background_url: newUrl })
        .eq("id", room.id);

      if (error) throw error;

      setRoom((prev) => (prev ? { ...prev, background_url: newUrl } : prev));
      await onBackgroundChanged?.(newUrl);
      setSelectedBackgroundPreset(null);
      setShowBackgroundGallery(false);
      showSuccessToast("Room background updated successfully!");
    } catch (e) {
      toast(e?.message || "Failed to update room background", 1400);
    } finally {
      setApplyingBackgroundPreset(false);
    }
  };

  const applyRandomBackground = async () => {
    const accessiblePresets = isVIP
      ? ROOM_BACKGROUND_PRESETS
      : ROOM_BACKGROUND_PRESETS.filter((p) => !p.vip);

    if (!accessiblePresets.length) return;

    const random = accessiblePresets[Math.floor(Math.random() * accessiblePresets.length)];

    const { error } = await supabase
      .from("live_rooms")
      .update({ background_url: random.url })
      .eq("id", room.id);

    if (!error) {
      setRoom((prev) => (prev ? { ...prev, background_url: random.url } : prev));
      setSelectedBackgroundPreset(random);
      await onBackgroundChanged?.(random.url);
      toast("🎲 Background changed!", 1000);
    }
  };

  const toggleRandomMode = () => {
    if (randomAutoPlay) {
      clearInterval(randomIntervalRef.current);
      setRandomAutoPlay(false);
      toast("🎲 Random stopped", 1000);
    } else {
      setRandomAutoPlay(true);
      applyRandomBackground();
      randomIntervalRef.current = setInterval(applyRandomBackground, 8000);
      toast("🎲 Random started!", 1000);
    }
  };

  const applyFreeBackgroundPreset = async (preset) => {
    if (!isOwner || !room?.id || !preset?.url) return;

    setSelectedBackgroundPreset(preset);

    const { error } = await supabase
      .from("live_rooms")
      .update({ background_url: preset.url })
      .eq("id", room.id);

    if (error) {
      toast(error?.message || "Failed to apply background", 1400);
      return;
    }

    setRoom((prev) => (prev ? { ...prev, background_url: preset.url } : prev));
    await onBackgroundChanged?.(preset.url);
    toast("✅ Background applied!", 1200);
  };

  const fetchModerators = async () => {
    if (!isOwner || !room?.id) {
      setModeratorsList([]);
      return;
    }

    setModeratorsLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("live_room_roles")
        .select("user_id")
        .eq("room_id", room.id)
        .eq("role", "mod")
        .eq("is_active", true)
        .is("revoked_at", null);

      if (rolesError) throw rolesError;

      const userIds = (rolesData || []).map((r) => r.user_id);
      if (userIds.length === 0) {
        setModeratorsList([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      setModeratorsList(
        userIds.map((userId) => {
          const profile = (profilesData || []).find((p) => String(p.id) === String(userId));
          return {
            user_id: userId,
            display_name: profile?.name || "User",
            avatar_url: profile?.avatar_url || null,
          };
        })
      );
    } catch (e) {
      toast(e?.message || "Failed to load moderators", 1400);
      setModeratorsList([]);
    } finally {
      setModeratorsLoading(false);
    }
  };

  React.useEffect(() => {
    if (!showSettings || settingsTab !== "general" || !room?.id || !isOwner) return;
    fetchModerators();
  }, [showSettings, settingsTab, room?.id, isOwner]);

  return (
    <>
      <PeopleInRoomModal
        isOpen={showPeople}
        onClose={() => setShowPeople(false)}
        people={currentPeopleRanked}
        openUserCard={openUserCard}
      />

      {seatMenuOpen ? (
        <div className="fixed inset-0 z-[85]">
          <div className="absolute inset-0 bg-black/50" onClick={closeSeatMenu} aria-hidden="true" />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  Options
                  {(() => {
                    const mySeat = (effectiveSeats || []).find(s => user?.id && String(s.user_id) === String(user.id));
                    const isMyCurrentSeat = !!mySeat && Number(mySeat.seat_no) === Number(seatMenuSeatNo);
                    if (isMyCurrentSeat) {
                      return (
                        <button
                          onClick={() => { toast("Mute Mic (soon)", 1200); closeSeatMenu(); }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition"
                          title="Mute Mic"
                        >
                          <MicOff className="w-4 h-4" />
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <button className="text-sm text-slate-600 hover:text-slate-900" onClick={closeSeatMenu}>Close</button>
              </div>

              <div className="p-4 space-y-2">
                {(() => {
                  const mySeat = (effectiveSeats || []).find(s => user?.id && String(s.user_id) === String(user.id));
                  const isOnMic = !!mySeat;
                  const canMoveHere = isOnMic && Number(mySeat?.seat_no) !== Number(seatMenuSeatNo);
                  const seatMenuSeat = (effectiveSeats || []).find(s => s.seat_no === seatMenuSeatNo);
                  const isOccupied = !!seatMenuSeat?.user_id;

                  return (
                    <>
                      {!isOccupied && (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => {
                            setInviteOnlyMode(false);
                            setInviteTargetUserId(null);
                            setInviteOpen(true);
                          }}
                        >
                          Invite to Mic
                        </Button>
                      )}

                      {!inviteOnlyMode && !isOnMic && !isOccupied && (
                        <Button className="w-full" onClick={async () => {
                          try {
                            await takeMicSeat(seatMenuSeatNo);
                            showSuccessToast("Mic taken", 1200);
                            closeSeatMenu();
                          } catch (e) { toast(e?.message || "Failed", 1400); }
                        }}>
                          Take Mic
                        </Button>
                      )}

                      {!inviteOnlyMode && canMoveHere && !isOccupied && (
                        <Button className="w-full" onClick={async () => {
                          try {
                            await moveMicSeat(seatMenuSeatNo);
                            showSuccessToast("Mic moved", 1200);
                            closeSeatMenu();
                          } catch (e) { toast(e?.message || "Failed", 1400); }
                        }}>
                          Move here
                        </Button>
                      )}

                      {!inviteOnlyMode && canModerate && (
                        <Button className="w-full" variant="outline" onClick={async () => {
                          try {
                            await setSeatLocked(seatMenuSeatNo, !seatMenuSeatLocked);
                            toast("Seat updated", 1200);
                            closeSeatMenu();
                          } catch (e) { toast(e?.message || "Failed", 1400); }
                        }}>
                          {seatMenuSeatLocked ? "Unlock Seat" : "Lock Seat"}
                        </Button>
                      )}
                    </>
                  );
                })()}

                {inviteOpen ? (
                  <div className="mt-3 border-t pt-3">
                    <div className="text-sm font-semibold text-slate-900">Select user</div>
                    <div className="mt-2 max-h-[45vh] overflow-auto space-y-2">
                      {activeParticipants.filter(p => p.user_id !== user?.id).map((p) => (
                        <button
                          key={p.user_id}
                          onClick={async () => {
                            try { await inviteUserToMic(p.user_id); }
                            catch (e) { toast(e?.message || "Failed to invite", 1400); }
                          }}
                          className="w-full text-left border rounded-xl p-2 hover:bg-slate-50 transition flex items-center gap-3"
                        >
                          <img src={p.avatar_url || FALLBACK_AVATAR} onError={(e) => e.currentTarget.src = FALLBACK_AVATAR}
                            className="w-10 h-10 rounded-full object-cover border bg-white" alt={p.display_name || "User"} />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">{p.display_name || "User"}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      ) : null}

      {showSettings ? (
  <div className="fixed inset-0 z-[75]">
    <div className="absolute inset-0 bg-black/50" onClick={closeSettings} aria-hidden="true" />
    <div className="absolute inset-0 flex items-end justify-center" onClick={closeSettings}>
      <div className="mb-0 w-full max-w-md max-h-[80vh] bg-white border shadow-2xl rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="pt-2 pb-1 flex justify-center" aria-hidden="true">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>

              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-600" />
                  Room Settings
                </div>
                <button className="text-xs text-slate-600 hover:text-slate-900" onClick={closeSettings}>
                  Close
                </button>
              </div>

              <div className="px-3 pt-2">
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1.5 rounded-lg text-xs border ${settingsTab === "general" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                      }`}
                    onClick={() => setSettingsTab("general")}
                  >
                    General
                  </button>

                  <button
                    className={`px-3 py-1.5 rounded-lg text-xs border ${settingsTab === "bans" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                      }`}
                    onClick={openBansTab}
                  >
                    Bans
                  </button>
                </div>
              </div>

              <div className="p-3 flex-1 overflow-y-auto">
                {settingsTab === "general" ? (
                  <>
                    {isOwner ? (
                      <div className="mb-6">
                        <div className="text-sm font-semibold text-slate-900">Room Name</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Change your room's display name.
                        </div>
                        <input
                          id="room-name-input"
                          type="text"
                          maxLength={50}
                          defaultValue={room?.title || room?.name || ""}
                          placeholder="Enter room name..."
                          className="mt-2 w-full border rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-400">Max 50 characters</span>
                        </div>
                        <button
                          onClick={async () => {
                            const el = document.getElementById("room-name-input");
                            const newName = el?.value?.trim();
                            if (!newName) {
                              toast("Room name cannot be empty", 1400);
                              return;
                            }
                            if (newName.length > 50) {
                              toast("Room name too long", 1400);
                              return;
                            }
                            const { error } = await supabase
                              .from("live_rooms")
                              .update({ title: newName })
                              .eq("id", room?.id);
                            if (error) {
                              toast(error.message || "Failed to update room name", 1400);
                              return;
                            }
                            setRoom(prev => ({ ...prev, title: newName }));
                            toastSuccess("✅ Room name updated!", 1400);
                          }}
                          className="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
                        >
                          Save
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-6 border-t pt-4">
                      <div className="text-sm font-semibold text-slate-900">Room Avatar</div>
                      <div className="text-xs text-slate-500 mt-1">Upload a PNG or GIF image for your room's main picture.</div>

                      {/* Current Avatar Display */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50">
                          {room?.avatar_url ? (
                            <img
                              src={room.avatar_url}
                              alt="Room avatar"
                              className="w-full h-full object-cover"
                              onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-slate-700">Current room avatar</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {room?.avatar_url ? "Click upload to change" : "No avatar set"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <label className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-xl transition cursor-pointer group ${
                          !isOwner ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50'
                        }`}>
                          <input
                            ref={roomAvatarInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            onChange={handleRoomAvatarUpload}
                            disabled={roomAvatarUploading || !isOwner}
                            className="hidden"
                          />
                          {roomAvatarUploading ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                          ) : (
                            <ImageIcon className={`w-5 h-5 mr-2 ${!isOwner ? 'text-slate-300' : 'text-slate-400 group-hover:text-blue-500'}`} />
                          )}
                          <span className={`text-sm font-medium ${!isOwner ? 'text-slate-400' : 'text-slate-600 group-hover:text-blue-600'}`}>
                            {roomAvatarUploading ? 'Uploading...' : !isOwner ? 'Only owners can upload' : 'Upload image'}
                          </span>
                        </label>

                        <label className={`relative overflow-hidden flex items-center justify-center w-full p-3 rounded-xl transition cursor-pointer ${
                          !isOwner || !isVIP
                            ? 'border border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 shadow-[0_0_14px_rgba(251,191,36,0.4)] border border-amber-300'
                        }`}>
                          <input
                            ref={roomAvatarVipInputRef}
                            type="file"
                            accept="image/*,video/mp4,video/webm"
                            onChange={handleRoomAvatarVipUpload}
                            disabled={roomAvatarVipUploading || !isOwner || !isVIP}
                            className="hidden"
                          />
                          {isVIP && isOwner && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.5s_ease-in-out_infinite] skew-x-[-20deg]" />
                            </div>
                          )}
                          {roomAvatarVipUploading ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin mr-2" />
                          ) : (
                            <span className="text-sm font-bold text-white relative z-10">
                              {!isVIP ? '🔒 VIP Upload' : !isOwner ? '🔒 VIP Upload' : '👑 VIP Upload'}
                            </span>
                          )}
                        </label>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          Free (PNG/JPG/WEBP/GIF)
                        </span>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          VIP: All formats including video 👑
                          {!isVIP ? <span className="ml-1">🔒</span> : null}
                        </span>
                      </div>
                    </div>

                    {/* Topic */}
                    <div className="mt-6 border-t pt-4">
                      <div className="text-sm font-semibold text-slate-900">Room Topic</div>
                      <div className="text-xs text-slate-500 mt-1">Show a topic or event title on your room card.</div>
                      <input
                        id="room-topic-input"
                        type="text"
                        maxLength={60}
                        defaultValue={room?.topic || ""}
                        placeholder="e.g. Friday Night Chat 🎉"
                        className="mt-2 w-full border rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                      <button
                        onClick={async () => {
                          const el = document.getElementById("room-topic-input");
                          const newTopic = el?.value?.trim() || null;
                          if (!room?.id) return;
                          const { error } = await supabase
                            .from("live_rooms")
                            .update({ topic: newTopic })
                            .eq("id", room.id);
                          if (error) { toast(error.message, 1400); return; }
                          setRoom(prev => ({ ...prev, topic: newTopic }));
                          showSuccessToast("✅ Topic updated", 1400);
                        }}
                        className="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
                      >
                        Save
                      </button>
                    </div>

                    {/* Welcome Message */}
<div className="mt-6 border-t pt-4">

  <div className="text-sm font-semibold text-slate-900">Welcome Message</div>
  <div className="text-xs text-slate-500 mt-1">
    Shown to everyone when they join the room.
  </div>
  <textarea
    id="welcome-msg-input"
    className="mt-2 w-full border rounded-xl p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
    rows={3}
    maxLength={200}
    defaultValue={room?.welcome_message || "Respect everyone and enjoy the conversation."}
    placeholder="Enter welcome message..."
  />
  <button
    onClick={async () => {
  const el = document.getElementById("welcome-msg-input");
  const newMsg = el?.value?.trim();
  if (!newMsg) return;
  await supabase
    .from("live_rooms")
    .update({ welcome_message: newMsg })
    .eq("id", room?.id);
  setRoom(prev => ({ ...prev, welcome_message: newMsg }));
  showSuccessToast("✅ Welcome message updated", 1400);
}}
    className="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
  >
    Save
  </button>
</div>

                    <div className="mt-6 border-t pt-4">
                      <div className="text-sm font-semibold text-slate-900">Room Background</div>
                      <div className="text-xs text-slate-500 mt-1">Upload a background image to display behind your room UI.</div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            {previewBackgroundUrl && !roomBackgroundPreviewFailed ? (
                              isVideoBackground(previewBackgroundUrl) ? (
                                <video
                                  src={previewBackgroundUrl}
                                  className="w-full h-full object-cover"
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onError={() => setRoomBackgroundPreviewFailed(true)}
                                />
                              ) : (
                                <>
                                  <div
                                    className="w-full h-full bg-cover bg-center"
                                    style={{ backgroundImage: `url(${previewBackgroundUrl})` }}
                                  />
                                  <img
                                    src={previewBackgroundUrl}
                                    alt=""
                                    className="hidden"
                                    onError={() => setRoomBackgroundPreviewFailed(true)}
                                  />
                                </>
                              )
                            ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-slate-700">Current room background</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {previewBackgroundUrl && !roomBackgroundPreviewFailed ? 'Click upload to replace' : 'No background set'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <label className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-xl transition cursor-pointer group ${
                            !isOwner ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50'
                          }`}>
                            <input
                              ref={roomBackgroundInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/avif,image/gif"
                              onChange={handleRoomBackgroundUpload}
                              disabled={roomBackgroundUploading || !isOwner}
                              className="hidden"
                            />
                            {roomBackgroundUploading ? (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                            ) : (
                              <ImageIcon className={`w-5 h-5 mr-2 transition ${
                                !isOwner ? 'text-slate-300' : 'text-slate-400 group-hover:text-blue-500'
                              }`} />
                            )}
                            <span className={`text-sm font-medium transition ${
                              !isOwner ? 'text-slate-400' : 'text-slate-600 group-hover:text-blue-600'
                            }`}>
                              {roomBackgroundUploading ? 'Uploading...' : !isOwner ? 'Only owners can upload' : 'Upload background'}
                            </span>
                          </label>

                          <button
                            type="button"
                            className={`w-full p-3 border rounded-xl text-sm font-medium transition ${
                              !isOwner || !canUseGallery
                                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                                : `${isVIP ? 'border-amber-200 hover:shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'border-slate-300 opacity-50 cursor-not-allowed'} text-slate-700 hover:bg-slate-50`
                            }`}
                            onClick={() => {
                              if (!isVIP) {
                                toast("Upgrade to VIP to unlock this feature", 1400);
                                return;
                              }
                              setShowBackgroundGallery((v) => !v);
                            }}
                            disabled={!isOwner || roomBackgroundUploading || applyingBackgroundPreset}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              Choose from gallery
                              <span
                                className="relative inline-flex items-center overflow-hidden rounded-full border border-amber-300 bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-black text-amber-900"
                                style={{ animation: 'vipBadgePulse 2s ease-in-out infinite' }}
                              >
                                VIP 👑
                                <span className="pointer-events-none absolute inset-0 overflow-hidden">
                                  <span
                                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                    style={{ animation: 'badgeShimmer 2s infinite' }}
                                  />
                                </span>
                              </span>
                              {!canUseGallery ? <span className="text-sm">🔒</span> : null}
                            </span>
                          </button>
                        </div>

                        <div className="mt-2">
                          <label className={`relative overflow-hidden flex items-center justify-center w-full p-3 border-2 rounded-xl transition cursor-pointer group ${
                            !isOwner || !isVIP
                              ? 'border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed opacity-50'
                              : 'border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-bold hover:brightness-110 hover:shadow-[0_0_14px_rgba(251,191,36,0.5)]'
                          }`}
                          onClick={(e) => {
                            if (!isVIP) {
                              e.preventDefault();
                              toast("Upgrade to VIP to unlock this feature", 1400);
                            }
                          }}>
                            <input
                              ref={roomBackgroundVipInputRef}
                              type="file"
                              accept="image/*,video/mp4,video/webm"
                              onChange={handleRoomBackgroundVipUpload}
                              disabled={roomBackgroundUploading || !isOwner || !isVIP}
                              className="hidden"
                            />
                            {roomBackgroundUploading ? (
                              <Loader2 className={`w-5 h-5 animate-spin mr-2 ${!isOwner || !isVIP ? 'text-slate-500' : 'text-white'}`} />
                            ) : (
                              <ImageIcon className={`w-5 h-5 mr-2 transition ${
                                !isOwner || !isVIP ? 'text-slate-500' : 'text-white'
                              }`} />
                            )}
                            <span className={`text-sm transition ${
                              !isOwner || !isVIP ? 'text-slate-600 font-medium' : 'text-white font-bold'
                            }`}>
                              {!isOwner || !isVIP ? '🔒 ' : '👑 '}
                              VIP Upload
                            </span>
                            {!isOwner || !isVIP ? null : (
                              <span className="pointer-events-none absolute inset-0 overflow-hidden">
                                <span
                                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                                  style={{ animation: 'badgeShimmer 2.5s infinite' }}
                                />
                              </span>
                            )}
                          </label>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Free (PNG/JPG/WEBP/AVIF)
                          </span>
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Coins feature 💰
                            {!hasCoinsFeature && !isVIP ? <span className="ml-1">🔒</span> : null}
                          </span>
                        </div>

                        <div className="mt-3 p-3 border rounded-xl bg-slate-50/70">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-bold text-slate-700">🖼️ Free Backgrounds</div>
                            <button
                              type="button"
                              onClick={toggleRandomMode}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                randomAutoPlay
                                  ? 'bg-rose-500 text-white animate-pulse'
                                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {randomAutoPlay ? '⏹ Stop' : '🎲 Random'}
                            </button>
                          </div>
                        <div className="grid grid-cols-2 gap-2">
                            {freeBackgroundPresets.map((preset) => {
                              const selected = selectedBackgroundPreset?.id === preset.id;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={async () => {
                                    await applyFreeBackgroundPreset(preset);
                                  }}
                                  className={`text-left border rounded-lg overflow-hidden bg-white transition relative ${selected ? 'border-slate-900 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                  <div className="h-16 bg-slate-100">
                                    <div
                                      className="w-full h-full bg-cover bg-center"
                                      style={{ backgroundImage: `url(${preset.url})` }}
                                    />
                                  </div>
                                  <div className="px-2 py-1.5 text-xs font-medium text-slate-700 truncate">{preset.label}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {showBackgroundGallery ? (
                          <div className="mt-3 p-3 border rounded-xl bg-slate-50/70">
                            <style>{`
                              @keyframes vipGlow {
                                0%, 100% { box-shadow: 0 0 8px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.2); }
                                50% { box-shadow: 0 0 16px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4); }
                              }
                              @keyframes shimmer {
                                0% { transform: translateX(-150%) skewX(-20deg); }
                                100% { transform: translateX(250%) skewX(-20deg); }
                              }
                              @keyframes vipBadgePulse {
                                0%, 100% { box-shadow: 0 0 4px rgba(251,191,36,0.4); transform: scale(1); }
                                50% { box-shadow: 0 0 10px rgba(251,191,36,0.9); transform: scale(1.08); }
                              }
                              @keyframes badgeShimmer {
                                0% { transform: translateX(-150%) skewX(-20deg); }
                                100% { transform: translateX(250%) skewX(-20deg); }
                              }
                            `}</style>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold text-amber-800">👑 VIP Backgrounds</div>
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Gold</span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (randomAutoPlay) {
                                    if (randomIntervalRef.current) {
                                      clearInterval(randomIntervalRef.current);
                                      randomIntervalRef.current = null;
                                    }
                                    setRandomAutoPlay(false);
                                    return;
                                  }

                                  await applyRandomBackground();

                                  randomIntervalRef.current = setInterval(() => {
                                    applyRandomBackground();
                                  }, 8000);

                                  setRandomAutoPlay(true);
                                }}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  randomAutoPlay
                                    ? 'bg-rose-500 text-white animate-pulse'
                                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {randomAutoPlay ? '⏹ Stop Random' : '🎲 Random'}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {vipBackgroundPresets.map((preset) => {
                                const selected = selectedBackgroundPreset?.id === preset.id;
                                const locked = !isVIP;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => {
                                      if (locked) {
                                        toast("Upgrade to VIP to unlock animated backgrounds", 1400);
                                        return;
                                      }
                                      setSelectedBackgroundPreset(preset);
                                    }}
                                    className={`text-left border-2 rounded-lg overflow-hidden transition relative bg-gradient-to-br from-amber-950/10 to-transparent ${selected ? 'border-amber-400' : 'border-[rgba(251,191,36,0.8)]'}`}
                                    style={{
                                      animation: 'vipGlow 2s ease-in-out infinite',
                                      boxShadow: selected
                                        ? '0 0 22px rgba(251,191,36,0.95), 0 0 54px rgba(251,191,36,0.55)'
                                        : undefined,
                                    }}
                                  >
                                    <div className="h-16 bg-slate-100">
                                      <video
                                        src={preset.url}
                                        className="w-full h-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                      />
                                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                        <div
                                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                          style={{ animation: 'shimmer 2.5s infinite' }}
                                        />
                                      </div>
                                      {locked ? (
                                        <div className="absolute inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center text-white text-xl">🔒</div>
                                      ) : null}
                                    </div>
                                    <div className="px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 truncate">👑 {preset.label}</div>
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (selectedBackgroundPreset?.vip && !isVIP) {
                                  toast("Upgrade to VIP to unlock animated backgrounds", 1400);
                                  return;
                                }
                                applyBackgroundPreset();
                              }}
                              disabled={!selectedBackgroundPreset || applyingBackgroundPreset || !isOwner || (selectedBackgroundPreset?.vip && !isVIP)}
                              className="mt-3 w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {applyingBackgroundPreset ? "Saving..." : "Use this background"}
                            </button>
                          </div>
                        ) : null}

                        <div className="text-xs text-slate-500 mt-2">
                          Supported: all image formats including GIF
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Recommended: MP4/WebM under 10MB for best performance
                        </div>
                      </div>
                    </div>

{/* Reset Counters */}
<div className="mt-6 border-t pt-4">
  <div className="text-sm font-semibold text-slate-900">Gift Counters</div>
  <div className="text-xs text-slate-500 mt-1">Reset all mic gift support counters.</div>
  <button
    onClick={async () => {
  closeSettings();
  await handleResetMicGiftCounters();
}}
    className="mt-3 w-full py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center justify-center gap-2"
  >
    <RefreshCw className="w-4 h-4" />
    Reset Counters
  </button>
</div>

{/* Clear Chat */}
<div className="mt-6 border-t pt-4">
  <div className="text-sm font-semibold text-slate-900">Clear Chat</div>
  <div className="text-xs text-slate-500 mt-1">Delete all messages in the room chat.</div>
  <button
    onClick={async () => {
  const confirmed = window.confirm("Are you sure you want to clear all chat messages?");
  if (!confirmed) return;
  closeSettings();
  setTimeout(() => handleClearChat(), 300);
}}
    className="mt-3 w-full py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center justify-center gap-2"
  >
    <span>🗑️</span>
    Clear Chat
  </button>
</div>

{/* Lock Room */}
<div className="mt-6 border-t pt-4">
  <div className="text-sm font-semibold text-slate-900">Lock Room</div>

  {/* لو عنده اشتراك نشط */}
  {room?.lock_expires_at && new Date(room.lock_expires_at) > new Date() ? (
    <>
      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="text-xs text-slate-500">
          Plan expires: {new Date(room.lock_expires_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>

      {room?.is_locked ? (
  <button
    onClick={async () => { await onUnlockRoom?.(); }}
    className="mt-3 w-full py-2 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition flex items-center justify-center gap-2"
  >
    🔓 Unlock Room
  </button>
) : (
  <>
    <div className="mt-3">
      <div className="text-xs text-slate-500 mb-1">PIN to lock with</div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={lockPin || room?.lock_pin || ""}
        onChange={(e) => setLockPin(String(e.target.value || "").replace(/\D/g, "").slice(0, 4))}
        placeholder="Enter 4-digit PIN"
        className="w-full border rounded-xl px-3 py-2 text-sm"
      />
    </div>
    <button
      onClick={async () => {
        const pinToUse = lockPin || room?.lock_pin || "";
        if (!/^\d{4}$/.test(pinToUse)) { toast("Enter a valid 4-digit PIN", 1400); return; }
        await onLockRoom?.(0, 0, pinToUse);
      }}
      className="mt-3 w-full py-2 rounded-xl border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition flex items-center justify-center gap-2"
    >
      🔒 Lock Room (free)
    </button>
  </>
)}

      {/* زر تجديد الاشتراك */}
      <div className="mt-4 border-t pt-3">
        <div className="text-xs text-slate-500 mb-2">Renew or extend plan:</div>
        <div className="space-y-2">
          <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter PIN first", 1400); return; } const confirmed = window.confirm("Renew for 24h for 500 coins?"); if (!confirmed) return; await onLockRoom?.(24, 500, lockPin); }}
            className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition">
            🔒 24 hours — 500 coins
          </button>
          <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter PIN first", 1400); return; } const confirmed = window.confirm("Renew for 7 days for 3000 coins?"); if (!confirmed) return; await onLockRoom?.(24 * 7, 3000, lockPin); }}
            className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition">
            🔒 7 days — 3,000 coins
          </button>
          <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter PIN first", 1400); return; } const confirmed = window.confirm("Renew for 30 days for 10000 coins?"); if (!confirmed) return; await onLockRoom?.(24 * 30, 10000, lockPin); }}
            className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition">
            🔒 30 days — 10,000 coins
          </button>
        </div>
      </div>
    </>
  ) : (
    /* مفيش اشتراك — أزرار الشراء الأصلية */
    <div className="mt-3 space-y-2">
      <div>
        <div className="text-xs text-slate-500 mb-1">Set 4-digit PIN</div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={lockPin}
          onChange={(e) => setLockPin(String(e.target.value || "").replace(/\D/g, "").slice(0, 4))}
          placeholder="Enter 4-digit PIN"
          className="w-full border rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter a valid 4-digit PIN", 1400); return; } const confirmed = window.confirm("Lock room for 24 hours for 500 coins?"); if (!confirmed) return; await onLockRoom?.(24, 500, lockPin); }}
        className="w-full py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition">
        🔒 24 hours — 500 coins
      </button>
      <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter a valid 4-digit PIN", 1400); return; } const confirmed = window.confirm("Lock room for 7 days for 3000 coins?"); if (!confirmed) return; await onLockRoom?.(24 * 7, 3000, lockPin); }}
        className="w-full py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition">
        🔒 7 days — 3,000 coins
      </button>
      <button onClick={async () => { if (!/^\d{4}$/.test(lockPin)) { toast("Enter a valid 4-digit PIN", 1400); return; } const confirmed = window.confirm("Lock room for 30 days for 10000 coins?"); if (!confirmed) return; await onLockRoom?.(24 * 30, 10000, lockPin); }}
        className="w-full py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition">
        🔒 30 days — 10,000 coins
      </button>
    </div>
  )}
</div>

{/* Chat Toggle */}
<div className="mt-6 border-t pt-4">
  <div className="text-sm font-semibold text-slate-900">Chat Status</div>
  <div className="text-xs text-slate-500 mt-1">
    Chat is currently {room?.chat_disabled ? "disabled" : "enabled"}.
  </div>
  <button
    onClick={async () => {
      await onToggleChat?.();
    }}
    className="mt-3 w-full py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2"
  >
    {room?.chat_disabled ? "Enable Chat" : "Disable Chat"}
  </button>
</div>

                    {isOwner ? (
                      <div className="mt-6 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Moderators</div>
                            <div className="text-xs text-slate-500 mt-1">Manage room moderators.</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={fetchModerators}
                            disabled={moderatorsLoading}
                          >
                            {moderatorsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Refresh
                          </Button>
                        </div>

                        {moderatorsLoading ? (
                          <div className="mt-3 flex items-center gap-2 text-slate-600">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                          </div>
                        ) : moderatorsList.length === 0 ? (
                          <div className="mt-3 text-sm text-slate-500">No moderators</div>
                        ) : (
                          <div className="mt-3 space-y-2 max-h-[40vh] overflow-auto">
                            {moderatorsList.map((m) => (
                              <div key={m.user_id} className="border rounded-xl p-2 flex items-center gap-3">
                                <img
                                  src={m.avatar_url || FALLBACK_AVATAR}
                                  onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                                  alt={m.display_name || "User"}
                                  className="w-10 h-10 rounded-full object-cover border bg-white"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-900 truncate">{m.display_name || "User"}</div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    await removeModerator(m.user_id);
                                    await fetchModerators();
                                  }}
                                  disabled={moderatorsLoading || settingsBusy}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Banned users</div>
                        <div className="text-xs text-slate-500 mt-1">Ban = منع نهائي حتى Unban.</div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          const list = await fetchBans();
                          if (mountedRef.current) setBannedList(list);
                        }}
                        disabled={settingsBusy || loadingBans}
                      >
                        {loadingBans ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Refresh
                      </Button>
                    </div>

                    {loadingBans ? (
                      <div className="mt-3 flex items-center gap-2 text-slate-600">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                      </div>
                    ) : bannedList.length === 0 ? (
                      <div className="mt-3 text-sm text-slate-500">No banned users.</div>
                    ) : (
                      <div className="mt-3 space-y-2 max-h-[50vh] overflow-auto">
                        {bannedList.map((b) => (
                          <div key={b.user_id} className="border rounded-xl p-2 flex items-center gap-3">
                            <img
                              src={b.avatar_url || FALLBACK_AVATAR}
                              onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                              alt={b.display_name || "User"}
                              className="w-10 h-10 rounded-full object-cover border bg-white cursor-pointer"
                              onClick={() => openUserCard(b.user_id)}
                            />
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-semibold text-slate-900 truncate cursor-pointer"
                                onClick={() => openUserCard(b.user_id)}
                              >
                                {b.display_name || "User"}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {b.banned_until ? `Until: ${new Date(b.banned_until).toLocaleString()}` : "Permanent"}
                              </div>
                              {b.reason ? <div className="text-[11px] text-slate-500 mt-0.5">Reason: {b.reason}</div> : null}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => unbanUser(b.user_id)}
                              disabled={!canModerate || settingsBusy}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Unban
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MicRequestsModal
        open={requestsOpen}
        onClose={() => setRequestsOpen(false)}
        requests={pendingRequests}
        onApprove={acceptRequest}
        onReject={rejectRequest}
        canModerate={canModerate}
        openUserCard={openUserCard}
      />

      {leaveRoomOpen ? (
        <div
          className="fixed inset-0 z-[90]"
          onClick={() => setLeaveRoomOpen(false)}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Bottom Sheet */}
          <div className="absolute inset-0 flex items-end justify-center p-3">
            <div
              className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title */}
              <div className="relative mb-4 text-center">
                <button
                  type="button"
                  onClick={() => setLeaveRoomOpen(false)}
                  className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="text-lg font-bold text-slate-900">
                  Leave room?
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Keep it running or exit completely
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between gap-4">
                {/* Share */}
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center gap-1"
                  onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({
                          title: room?.title || room?.name || "Live Room",
                          text: "Join my live room",
                          url: window.location.href,
                        });
                      } else {
                        await navigator.clipboard.writeText(window.location.href);
                      }
                    } catch (_) { }
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                    <Share2 className="h-6 w-6 text-slate-700" />
                  </div>
                  <span className="text-xs text-slate-600">Share</span>
                </button>

                {/* Keep */}
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center gap-1"
                  onClick={() => {
                    setLeaveRoomOpen(false);

                    setRoomData({
                      roomId: roomId,
                      name: room?.title || room?.name || "Live Room",
                    });

                    miniRoomActiveRef.current = true;
                    setMiniRoomActive(true);
                    navigate("/");
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                    <Minimize2 className="h-6 w-6 text-slate-700" />
                  </div>
                  <span className="text-xs text-slate-600">Keep</span>
                </button>

                {/* Exit */}
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center gap-1"
                  onClick={handleExitRoom}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                    <Power className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-xs font-semibold text-red-600">Exit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LeaderboardModal
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        leaderboardTab={leaderboardTab}
        setLeaderboardTab={setLeaderboardTab}
        leaderboardData={leaderboardData}
        fallbackAvatar={FALLBACK_AVATAR}
        onOpenUserCard={(userId, user) => {
          if (!userId) return;
          setShowLeaderboard(false);
          openUserCard(userId, user);
        }}
      />

      <PkModal
        open={showPkModal}
        onClose={() => setShowPkModal(false)}
        pkBusy={pkBusy}
        pkMode={pkMode}
        setPkMode={setPkMode}
        pkSeatsA={pkSeatsA}
        setPkSeatsA={setPkSeatsA}
        pkSeatsB={pkSeatsB}
        setPkSeatsB={setPkSeatsB}
        pkSeatA={pkSeatA}
        setPkSeatA={setPkSeatA}
        pkSeatB={pkSeatB}
        setPkSeatB={setPkSeatB}
        pkDuration={pkDuration}
        setPkDuration={setPkDuration}
        occupiedPkEligibleSeats={occupiedPkEligibleSeats}
        togglePkSeat={togglePkSeat}
        getRequiredPkTeamSize={getRequiredPkTeamSize}
        fallbackAvatar={FALLBACK_AVATAR}
        onCreatePk={handleCreatePk}
      />

      {pkResultOpen && pkResultData && (() => {
        const winnerSide = pkResultData?.winnerSide || "draw";
        const isDraw = winnerSide === "draw";
        const isSideAWinner = winnerSide === "A";
        const isSideBWinner = winnerSide === "B";

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="absolute w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] bg-gradient-to-tr from-fuchsia-500/30 to-cyan-500/30 blur-[80px] rounded-full animate-pulse pointer-events-none"></div>

            <div
              className="w-full max-w-[380px] sm:max-w-md overflow-hidden rounded-[32px] bg-white/95 backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.4)] border border-white/20 relative animate-in zoom-in-95 duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-fuchsia-50 via-white to-cyan-50 text-center overflow-hidden">
                <h2 className="relative text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-cyan-600 drop-shadow-sm">
                  PK Result
                </h2>
              </div>

              <div className="p-4 sm:p-5 bg-slate-50/40 relative">
                <div className="flex justify-center mb-5 relative z-10">
                  <div
                    className={`inline-flex items-center rounded-full px-6 py-2 text-white font-extrabold text-base sm:text-lg border shadow-[0_0_20px_rgba(34,211,238,0.35)] ${
                      isDraw
                        ? "bg-gradient-to-r from-slate-400 to-slate-500 border-slate-300"
                        : isSideAWinner
                        ? "bg-gradient-to-r from-fuchsia-500 to-purple-500 border-fuchsia-300/50"
                        : "bg-gradient-to-r from-cyan-400 to-blue-500 border-cyan-300/50"
                    }`}
                  >
                    <span className="drop-shadow-md">
                      {isDraw ? "🤝 Draw" : `🏆 Winner: Side ${winnerSide}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div
                    className={`relative rounded-[24px] p-4 text-center shadow-sm overflow-hidden group ${
                      isDraw
                        ? "border border-slate-200 bg-gradient-to-b from-white to-slate-50/80"
                        : isSideAWinner
                        ? "border border-fuchsia-300 bg-gradient-to-b from-white to-fuchsia-100/70 shadow-[0_0_25px_rgba(217,70,239,0.18)]"
                        : "border border-fuchsia-200 bg-gradient-to-b from-white to-fuchsia-50/80"
                    }`}
                  >
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-fuchsia-400/10 rounded-full blur-xl group-hover:bg-fuchsia-400/20 transition-all"></div>

                    <div
                      className={`mx-auto mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold tracking-wider text-[10px] sm:text-xs shadow-sm ${
                        isDraw
                          ? "border border-slate-200 bg-slate-50 text-slate-500"
                          : isSideAWinner
                          ? "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                          : "border border-fuchsia-100 bg-fuchsia-50/80 text-fuchsia-600"
                      }`}
                    >
                      {isDraw ? "🤝 DRAW" : isSideAWinner ? "🏆 WINNER" : "🥈 RUNNER-UP"}
                    </div>

                    <div
                      className={`font-black tracking-widest text-sm sm:text-base mb-1 ${
                        isDraw
                          ? "text-slate-700"
                          : isSideAWinner
                          ? "text-fuchsia-900"
                          : "text-fuchsia-800"
                      }`}
                    >
                      SIDE A
                    </div>

                    <div
                      className={`text-4xl sm:text-5xl leading-none font-black text-transparent bg-clip-text drop-shadow-sm ${
                        isDraw
                          ? "bg-gradient-to-b from-slate-500 to-slate-700"
                          : isSideAWinner
                          ? "bg-gradient-to-b from-fuchsia-500 to-fuchsia-700"
                          : "bg-gradient-to-b from-fuchsia-500 to-fuchsia-700"
                      }`}
                    >
                      {Number(pkResultData.scoreA || 0)}
                    </div>
                  </div>

                  <div
                    className={`relative rounded-[24px] p-4 text-center shadow-sm overflow-hidden group ${
                      isDraw
                        ? "border border-slate-200 bg-gradient-to-b from-white to-slate-50/80"
                        : isSideBWinner
                        ? "border border-cyan-300 bg-gradient-to-b from-white to-cyan-100/60 shadow-[0_0_25px_rgba(34,211,238,0.2)]"
                        : "border border-cyan-200 bg-gradient-to-b from-white to-cyan-50/70"
                    }`}
                  >
                    <div className="absolute -left-4 -top-4 w-20 h-20 bg-cyan-400/20 rounded-full blur-xl group-hover:bg-cyan-400/30 transition-all"></div>

                    <div
                      className={`mx-auto mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold tracking-wider text-[10px] sm:text-xs shadow-sm ${
                        isDraw
                          ? "border border-slate-200 bg-slate-50 text-slate-500"
                          : isSideBWinner
                          ? "border border-cyan-200 bg-cyan-50 text-cyan-700"
                          : "border border-cyan-100 bg-cyan-50/80 text-cyan-600"
                      }`}
                    >
                      {isDraw ? "🤝 DRAW" : isSideBWinner ? "🏆 WINNER" : "🥈 RUNNER-UP"}
                    </div>

                    <div
                      className={`font-black tracking-widest text-sm sm:text-base mb-1 ${
                        isDraw
                          ? "text-slate-700"
                          : isSideBWinner
                          ? "text-cyan-900"
                          : "text-cyan-800"
                      }`}
                    >
                      SIDE B
                    </div>

                    <div
                      className={`text-4xl sm:text-5xl leading-none font-black text-transparent bg-clip-text ${
                        isDraw
                          ? "bg-gradient-to-b from-slate-500 to-slate-700"
                          : isSideBWinner
                          ? "bg-gradient-to-b from-cyan-400 to-cyan-600 drop-shadow-[0_2px_10px_rgba(34,211,238,0.4)]"
                          : "bg-gradient-to-b from-cyan-400 to-cyan-600"
                      }`}
                    >
                      {Number(pkResultData.scoreB || 0)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-[24px] border border-fuchsia-100 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                    <div className="text-fuchsia-800 text-xs sm:text-sm font-black mb-2 text-center">
                      Side A Players
                    </div>
                    <div className="h-[2px] w-12 mx-auto bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent mb-3" />

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {(pkResultData.sideAPlayers || []).map((player, idx) => (
                        <div
                          key={`${player.user_id || player.id || idx}-A`}
                          className="flex items-center gap-2 rounded-[16px] border border-fuchsia-50 bg-gradient-to-r from-fuchsia-50/30 to-white p-2 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={player.avatar_url || FALLBACK_AVATAR}
                              alt={player.display_name || "User"}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                              onError={(e) => {
                                e.currentTarget.src = FALLBACK_AVATAR;
                              }}
                            />
                            <div className="absolute -bottom-1 -right-1 text-xs drop-shadow-md">
                              {isDraw ? "🤝" : isSideAWinner ? "🏆" : "🥈"}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-slate-800 font-bold text-[11px] sm:text-xs truncate">
                              {player.display_name || player.name || "User"}
                            </div>
                            <div className="text-slate-400 text-[9px] sm:text-[10px] font-medium">
                              Seat #{player.seat_no}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-cyan-100 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                    <div className="text-cyan-900 text-xs sm:text-sm font-black mb-2 text-center">
                      Side B Players
                    </div>
                    <div className="h-[2px] w-12 mx-auto bg-gradient-to-r from-transparent via-cyan-300 to-transparent mb-3" />

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {(pkResultData.sideBPlayers || []).map((player, idx) => (
                        <div
                          key={`${player.user_id || player.id || idx}-B`}
                          className="flex items-center gap-2 rounded-[16px] border border-cyan-50 bg-gradient-to-r from-cyan-50/30 to-white p-2 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={player.avatar_url || FALLBACK_AVATAR}
                              alt={player.display_name || "User"}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                              onError={(e) => {
                                e.currentTarget.src = FALLBACK_AVATAR;
                              }}
                            />
                            <div className="absolute -bottom-1 -right-1 text-xs drop-shadow-md">
                              {isDraw ? "🤝" : isSideBWinner ? "🏆" : "🥈"}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-slate-800 font-bold text-[11px] sm:text-xs truncate">
                              {player.display_name || player.name || "User"}
                            </div>
                            <div className="text-slate-400 text-[9px] sm:text-[10px] font-medium">
                              Seat #{player.seat_no}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPkResultOpen(false);
                    }}
                    className="h-12 sm:h-14 rounded-[20px] border-2 border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPkResultOpen(false);
                      setPkResultData(null);
                      setShowPkModal(true);
                    }}
                    className="h-12 sm:h-14 rounded-[20px] bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[13px] sm:text-sm font-bold shadow-[0_4px_15px_rgba(168,85,247,0.4)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 transition-all active:scale-95 leading-tight px-2"
                  >
                    Start New Round
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      <UserCardModal
        open={isUserCardOpen}
        onClose={closeUserCard}
        cardLoading={cardLoading}
        selectedUserProfile={selectedUserProfile}
        selectedUserId={selectedUserId}
        selectedUserIsMod={selectedUserIsMod}
        isSelfCard={isSelfCard}
        canShowOwnerTools={canShowOwnerTools}
        isOwner={isOwner}
        hostUserId={hostUser?.id || room?.owner_user_id || null}
        targetMutedActive={targetMutedActive}
        moderatorsMap={moderatorsMap}
        effectiveSeats={effectiveSeats}
        FALLBACK_AVATAR={FALLBACK_AVATAR}
        mentionUser={mentionUser}
        openGiftPanelForUser={openGiftPanelForUser}
        goToProfilePage={goToProfilePage}
        toast={toast}
        setInviteTargetUserId={setInviteTargetUserId}
        setInviteOnlyMode={setInviteOnlyMode}
        setSeatMenuSeatNo={setSeatMenuSeatNo}
        setSeatMenuOpen={setSeatMenuOpen}
        setInviteOpen={setInviteOpen}
        muteUser={muteUser}
        unmuteUser={unmuteUser}
        openKickConfirm={openKickConfirm}
        openBanConfirm={openBanConfirm}
        assignModerator={assignModerator}
        removeModerator={removeModerator}
      />
    </>
  );
}
