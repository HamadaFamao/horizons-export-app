import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useMiniRoom } from "@/contexts/MiniRoomContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GiftPanel from "@/components/GiftPanel";
import { getLevelFromXp } from "@/lib/xpLevelUtils";
import PeopleInRoomButton from "@/components/room/PeopleInRoomButton";
import PeopleInRoomModal from "@/components/room/PeopleInRoomModal";
import MicRequestsButton from "@/components/room/MicRequestsButton";
import MicRequestsModal from "@/components/room/MicRequestsModal";
import PkButton from "@/components/room/PkButton";
import PkModal from "@/components/room/PkModal";
import UserCardModal from "@/components/room/UserCardModal";
import { fetchUserWallet } from "@/lib/walletUtils";
import { connectVoice } from "@/lib/livekit";
import {
  sendLiveRoomGift,
  fetchLiveRoomGiftEventFull,
  buildLiveRoomGiftEffect
} from "@/lib/liveRoomGiftService";
import {
  Loader2,
  ArrowLeft,
  Send,
  MoreVertical,
  Trash2,
  Mic,
  X,
  Minimize2,
  MicOff,
  Lock,
  Unlock,
  Copy,
  Users,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Crown,
  AtSign,
  Heart,
  Gift,
  User as UserIcon,
  Settings,
  Image as ImageIcon,
  ShieldBan,
  RefreshCw,
  Shield,
  Bell,
  LogOut,
  Share2,
  Power
} from "lucide-react";

import LeaderboardModal from "@/components/LeaderboardModal";
import RoomHeader from "@/components/room/RoomHeader";
import RoomSeats from "@/components/room/RoomSeats";
import RoomChat from "@/components/room/RoomChat";
import RoomModals from "@/components/room/RoomModals";

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" rx="64" fill="#f1f5f9"/>
    <circle cx="64" cy="52" r="22" fill="#cbd5e1"/>
    <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/>
  </svg>`);

function isVipActive(profile) {
  if (!profile?.is_vip) return false;
  if (!profile?.vip_until) return true;
  const t = new Date(profile.vip_until).getTime();
  return Number.isFinite(t) ? t > Date.now() : true;
}

function parseInvitedSeatNo(note) {
  const m = String(note || "").match(/seat:(\d+)/i);
  return m ? Number(m[1]) : null;
}

const isSmallRoomGift = (effect) => {
  const price =
    Number(effect?.price || effect?.coins_spent || effect?.gift_cost || effect?.cost || 0);

  return price > 0 && price <= 500;
};

const getEventTotalCoins = (event, fallbackQuantity = 1) => {
  const quantityValue = Number(
    event?.quantity ??
    event?.quantity_sent ??
    event?.quantity_requested ??
    fallbackQuantity ??
    1
  );

  if (event?.total_coins !== undefined && event?.total_coins !== null) {
    return Number(event.total_coins) || 0;
  }

  if (event?.coins_spent_total !== undefined && event?.coins_spent_total !== null) {
    return Number(event.coins_spent_total) || 0;
  }

  const baseCoins = Number(
    event?.coins_spent ??
    event?.gift_cost ??
    event?.cost ??
    0
  );

  if (!baseCoins) return 0;

  return quantityValue > 1 ? baseCoins * quantityValue : baseCoins;
};

const getPkEventCoins = (ev) => (
  Number(ev?.total_coins) ||
  Number(ev?.coins_spent_total) ||
  (Number(ev?.coins_spent || 0) * Number(ev?.quantity || ev?.quantity_sent || ev?.quantity_requested || 1))
);

const getPkScoreFromEvents = (events, session, participants) => {
  if (!session?.started_at || !(participants || []).length) {
    return { A: 0, B: 0 };
  }

  const startedAtMs = new Date(session.started_at).getTime();
  const endedAtMs = session?.ends_at ? new Date(session.ends_at).getTime() : Infinity;

  const userToSide = new Map();
  (participants || []).forEach((p) => {
    if (p?.user_id && p?.side) {
      userToSide.set(String(p.user_id), p.side);
    }
  });

  const totals = { A: 0, B: 0 };

  (events || []).forEach((ev) => {
    const ts = ev?.created_at ? new Date(ev.created_at).getTime() : 0;
    if (!ts || ts < startedAtMs || ts > endedAtMs) return;

    const receiverId = ev?.receiver_id ? String(ev.receiver_id) : null;
    if (!receiverId) return;

    const side = userToSide.get(receiverId);
    if (!side) return;

    const coins = getPkEventCoins(ev);
    if (!coins) return;

    totals[side] = (totals[side] || 0) + coins;
  });

  return totals;
};

const rebuildMicGiftTotalsFromEvents = (events) => {
  const totals = {};
  (events || []).forEach((ev) => {
    const receiverId = ev?.receiver_id;
    if (!receiverId) return;

    const coins = getEventTotalCoins(
      ev,
      ev?.quantity || ev?.quantity_sent || ev?.quantity_requested || 1
    );

    if (coins > 0) {
      totals[receiverId] = (totals[receiverId] || 0) + coins;
    }
  });
  return totals;
};

const normalizeGiftHistoryForRoomMessages = (events) => {
  return (events || []).map((ev) => ({
    ...ev,
    id: ev.id ? `gift-${ev.id}` : `gift-${ev.created_at}-${ev.receiver_id || "x"}`,
    type: "gift",
    content_type: "gift",
    quantity:
      ev.quantity ??
      ev.quantity_sent ??
      ev.quantity_requested ??
      1,
    total_coins:
      ev.total_coins ??
      ev.coins_spent_total ??
      getEventTotalCoins(ev, ev.quantity ?? ev.quantity_sent ?? ev.quantity_requested ?? 1),
  }));
};

const getMicGiftTotalsStorageKey = (roomId) => `live_room_mic_gift_totals:${roomId}`;

const KICK_OPTIONS = [
  { label: "5 minutes", minutes: 5 },
  { label: "10 minutes", minutes: 10 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "60 minutes", minutes: 60 },
  { label: "24 hours", minutes: 24 * 60 },
];

const SPARKLE_CSS = `
@keyframes slideArrow {
  0% { transform: translateX(0); opacity: 0.6; }
  50% { transform: translateX(6px); opacity: 1; }
  100% { transform: translateX(0); opacity: 0.6; }
}
.arrow-anim {
  animation: slideArrow 1s infinite;
}
@keyframes giftBounce {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
.gift-bounce {
  animation: giftBounce 0.8s ease-in-out infinite;
}
`;

function getExt(file) {
  const name = file?.name || "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
}

const ENABLE_GIFT_MESSAGE_TEXT = true;

const buildPkDisplaySidesFromSeats = (seatA, seatB, seats) => {
  const findSeat = (seatNo) =>
    (seats || []).find((s) => String(s.seat_no) === String(seatNo));

  const aSeat = findSeat(seatA);
  const bSeat = findSeat(seatB);

  const mapSeatToPkUser = (seat, side) => {
    if (!seat) return [];

    const occ = seat.occupant || null;

    const userId =
      occ?.user_id ||
      seat.user_id ||
      null;

    const displayName =
      occ?.display_name ||
      occ?.name ||
      seat.display_name ||
      seat.name ||
      "User";

    const avatarUrl =
      occ?.avatar_url ||
      seat.avatar_url ||
      FALLBACK_AVATAR;

    if (!userId && !displayName) return [];

    return [
      {
        user_id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        seat_no: seat.seat_no,
        side,
      },
    ];
  };

  return {
    A: mapSeatToPkUser(aSeat, "A"),
    B: mapSeatToPkUser(bSeat, "B"),
  };
};

const PK_AUDIO_TRACKS = [
  '/sounds/pk-audio/countdown.mp3',
  '/sounds/pk-audio/last-seconds.mp3',
  '/sounds/pk-audio/crowd.mp3',
];

export default function LiveRoomPage() {
  // ==========================================
  // 1. Contexts & Router
  // ==========================================
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setMiniRoomActive, setRoomData, miniRoomActive } = useMiniRoom();

  // ==========================================
  // 2. Refs
  // ==========================================
  const countdownAudioRef = useRef(null);
  const countdownStartedRef = useRef(false);
  const selectedPkAudioRef = useRef(null);
  const selectedPkSessionIdRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const roomAvatarInputRef = useRef(null);
  const roomBackgroundInputRef = useRef(null);

  const miniRoomActiveRef = useRef(false);
  const livekitRoomRef = useRef(null);
  const mountedRef = useRef(true);
  const profilesCacheRef = useRef(new Map());
  const channelRef = useRef(null);
  const messagesChannelRef = useRef(null);
  const participantsChannelRef = useRef(null);
  const micSeatsChannelRef = useRef(null);
  const micRequestsChannelRef = useRef(null);
  const rtNameRef = useRef(null);
  const rtAuthUnsubRef = useRef(null);
  const rtDebugBoundRef = useRef(false);
  const rtStartedRef = useRef(false);
  const rtRoomIdRef = useRef(null);
  const pollRef = useRef(null);
  const lastJoinIdsRef = useRef(new Set());
  const activeParticipantsRef = useRef([]);
  const participantsMapRef = useRef({});
  const processedRoomGiftIdsRef = useRef(new Set());
  const processingRoomGiftIdsRef = useRef(new Set());
  const repeatHideTimerRef = useRef(null);
  const micSeatRefs = useRef({});
  const chatScrollRef = useRef(null);
  const chatBottomRef = useRef(null);
  const micGiftTotalsHydratedRef = useRef(false);
  const pkSessionRef = useRef(null);
  const pkParticipantsRef = useRef([]);
  const pkDisplaySidesRef = useRef({ A: [], B: [] });
  const pkFinishTriggeredRef = useRef(false);
  const roomGiftMessagesRef = useRef([]);
  const serverOffsetMsRef = useRef(0);
  const pkTimerIntervalRef = useRef(null);


  // ==========================================
  // 3. States
  // ==========================================
  const [joinTime] = useState(Date.now());
  const [room, setRoom] = useState(null);
  const [micMode, setMicMode] = useState("request");
  const [activeSpeakers, setActiveSpeakers] = useState({});
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceError, setVoiceError] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [mutedUsers, setMutedUsers] = useState({});
  const [micSeats, setMicSeats] = useState([]);
  const [micRequests, setMicRequests] = useState([]);
  const [myMicInvites, setMyMicInvites] = useState([]);
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [showPeople, setShowPeople] = useState(false);
  const [currentPeopleRanked, setCurrentPeopleRanked] = useState([]);
  const [messages, setMessages] = useState([]);
  const [roomGiftMessages, setRoomGiftMessages] = useState([]);
  const [roomGiftEffects, setRoomGiftEffects] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [joinNotifs, setJoinNotifs] = useState([]);
  const [favoriteRoomIds, setFavoriteRoomIds] = useState([]);
  const isFavorite = useMemo(
    () => !!room?.id && favoriteRoomIds.includes(String(room.id)),
    [favoriteRoomIds, room?.id]
  );

  useEffect(() => {
    try {
      const savedFavorites = window.localStorage.getItem('favorite_room_ids');
      if (savedFavorites) {
        const ids = JSON.parse(savedFavorites);
        if (Array.isArray(ids)) {
          setFavoriteRoomIds(ids.filter((id) => id));
        }
      }
    } catch (error) {
      console.warn('[LiveRoomPage] unable to read favorite_room_ids', error);
    }
  }, []);

  const saveFavoriteRoomIds = (ids) => {
    try {
      window.localStorage.setItem('favorite_room_ids', JSON.stringify(ids));
    } catch (error) {
      console.warn('[LiveRoomPage] unable to save favorite_room_ids', error);
    }
  };

  const toggleFavoriteRoom = (roomId) => {
    if (!roomId) return;
    const normalized = String(roomId);
    const isCurrentlyFavorite = favoriteRoomIds.includes(normalized);
    const next = isCurrentlyFavorite
      ? favoriteRoomIds.filter((id) => id !== normalized)
      : [normalized, ...favoriteRoomIds];

    setFavoriteRoomIds(next);
    saveFavoriteRoomIds(next);
    toast(
      isCurrentlyFavorite ? 'Removed room from favorites' : 'Added room to favorites',
      1200
    );
  };

  const [isUserCardOpen, setIsUserCardOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [selectedUserIsMod, setSelectedUserIsMod] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
const fetchProfileCardData = async (userId) => {
  if (!userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("v_user_profile_with_wallet")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return null;

  let merged = { ...profile };

  try {
    const { data: ua } = await supabase
      .from("v_user_agency")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (ua) {
      merged = {
        ...merged,
        agency_id: ua.agency_id ?? merged.agency_id ?? null,
        agency_name:
          ua.agency_name ??
          merged.agency_name ??
          merged.family_name ??
          null,
        family_id: ua.agency_id ?? merged.family_id ?? null,
        family_name:
          ua.agency_name ??
          merged.family_name ??
          merged.agency_name ??
          null,
      };
    }
  } catch (e) {
    // ignore
  }

  const normalizedLevel =
  merged?.xp !== undefined && merged?.xp !== null
    ? getLevelFromXp(merged.xp)?.currentLevel ?? null
    : null;

const normalizedVipNumber =
  Number(
    merged?.vip_number ??
    merged?.vipLevel ??
    merged?.vip_level ??
    merged?.plan_level ??
    (merged?.is_vip ? 1 : 0)
  ) || 0;

return {
  ...merged,
  profile_id: merged?.profile_id ?? null,
  display_id:
    merged?.profile_id ??
    (String(merged?.id || "").slice(0, 6) || null),
  level: normalizedLevel,
  currentLevel: normalizedLevel,
  vip_number: normalizedVipNumber,
  agency_name:
    merged?.agency_name ??
    merged?.family_name ??
    null,
  family_name:
    merged?.family_name ??
    merged?.agency_name ??
    null,
};
};
  const [mutesMap, setMutesMap] = useState(new Map());
  const [myRoomRole, setMyRoomRole] = useState(null);
  const [roomRole, setRoomRole] = useState('guest');
  const [moderatorsMap, setModeratorsMap] = useState(new Map());
  const buildModeratorsMap = (rows = []) =>
  new Map(rows.map((row) => [String(row.user_id), true]));
  const [kickOpen, setKickOpen] = useState(false);
  const [kickTargetId, setKickTargetId] = useState(null);
  const [kickBusy, setKickBusy] = useState(false);
  async function fetchCurrentPeopleRanked(targetRoomId) {
  if (!targetRoomId) {
    setCurrentPeopleRanked([]);
    return;
  }

  const onlineUsers = Array.isArray(activeParticipants) ? activeParticipants : [];
  const onlineIds = [...new Set(onlineUsers.map((p) => p.user_id).filter(Boolean))];

  if (!onlineIds.length) {
    setCurrentPeopleRanked([]);
    return;
  }

  const { data: sendersRows, error } = await supabase
    .from("v_room_top_senders_alltime")
    .select("*")
    .eq("room_id", targetRoomId);

  if (error) {
    console.error("current people ranking error:", error);
    setCurrentPeopleRanked([]);
    return;
  }

  const sendersMap = new Map(
    (sendersRows || []).map((row) => [row.sender_id, Number(row.total_coins || 0)])
  );

  const merged = onlineUsers.map((p) => ({
    user_id: p.user_id,
    name: p.display_name || "User",
    avatar: p.avatar_url || "",
    is_host: p.user_id === room?.owner_user_id,
    support_coins: sendersMap.get(p.user_id) || 0,
  }));

  merged.sort((a, b) => {
    if ((b.support_coins || 0) !== (a.support_coins || 0)) {
      return (b.support_coins || 0) - (a.support_coins || 0);
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  setCurrentPeopleRanked(merged);
}
useEffect(() => {
  if (!roomId) return;
  fetchCurrentPeopleRanked(roomId);
}, [roomId, activeParticipants, room?.owner_user_id]);
  const [kickMinutes, setKickMinutes] = useState(10);
  const [banOpen, setBanOpen] = useState(false);
  const [banTargetId, setBanTargetId] = useState(null);
  const [banBusy, setBanBusy] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [roomAvatarUploading, setRoomAvatarUploading] = useState(false);
  const [roomBackgroundUploading, setRoomBackgroundUploading] = useState(false);
  const [bannedList, setBannedList] = useState([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [seatMenuOpen, setSeatMenuOpen] = useState(false);
  const [seatMenuSeatNo, setSeatMenuSeatNo] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTargetUserId, setInviteTargetUserId] = useState(null);
  const [inviteOnlyMode, setInviteOnlyMode] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [leaveRoomOpen, setLeaveRoomOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState("weekly");
  const [leaderboardData, setLeaderboardData] = useState([]);
  const leaderboardRefreshTimerRef = useRef(null);
  const refreshLeaderboardNow = useCallback(() => {
  if (!roomId) return;

  fetchLeaderboard(
    roomId,
    leaderboardTab === "weekly" ? "weekly" : "alltime"
  );
}, [roomId, leaderboardTab]);

const scheduleLeaderboardRefresh = useCallback((delay = 500) => {
  if (leaderboardRefreshTimerRef.current) {
    clearTimeout(leaderboardRefreshTimerRef.current);
  }

  leaderboardRefreshTimerRef.current = setTimeout(() => {
    if (!mountedRef.current) return;
    refreshLeaderboardNow();
  }, delay);
}, [refreshLeaderboardNow]);

 async function fetchLeaderboard(targetRoomId, period = "alltime") {
  if (!targetRoomId) return;

  const source =
    period === "weekly"
      ? "v_room_top_senders_24h"
      : "v_room_top_senders_alltime";

  const coinsColumn =
    period === "weekly"
      ? "coins_sent_24h"
      : "total_coins";

  const userIdColumn =
    period === "weekly"
      ? "user_id"
      : "sender_id";

  const { data, error } = await supabase
    .from(source)
    .select("*")
    .eq("room_id", targetRoomId)
    .order(coinsColumn, { ascending: false })
    .limit(50);

  if (error) {
    console.error("Leaderboard source error:", error);
    setLeaderboardData([]);
    return;
  }

  const rows = data || [];
  const userIds = rows.map((row) => row[userIdColumn]).filter(Boolean);

  if (!userIds.length) {
    setLeaderboardData([]);
    return;
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, is_vip, vip_number")
    .in("id", userIds);

  if (profilesError) {
    console.error("Leaderboard profiles error:", profilesError);
    setLeaderboardData([]);
    return;
  }

  const profilesMap = new Map(
    (profilesData || []).map((p) => [p.id, p])
  );

  const formatted = rows.map((row, index) => {
    const uid = row[userIdColumn];
    const profile = profilesMap.get(uid);

    return {
      rank: index + 1,
      user_id: uid,
      name: profile?.name || "User",
      avatar: profile?.avatar_url || "",
      coins: Number(row[coinsColumn] || 0),
      is_vip: !!profile?.is_vip,
      vip_number: profile?.vip_number || null,
      gifts_count: Number(row.gifts_count || 0),
      last_at: row.last_at || null,
    };
  });

  setLeaderboardData(formatted);
}
useEffect(() => {
  if (!roomId) return;

  fetchLeaderboard(
    roomId,
    leaderboardTab === "weekly" ? "weekly" : "alltime"
  );
}, [roomId, leaderboardTab]);
  const [miniRoomMode, setMiniRoomMode] = useState(false);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [giftTarget, setGiftTarget] = useState(null);
  const [giftTargetMode, setGiftTargetMode] = useState("all");
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftSelectedRecipient, setGiftSelectedRecipient] = useState(null);
  const [isJoinedToRoom, setIsJoinedToRoom] = useState(false);
  const [rtStatus, setRtStatus] = useState("INIT");

  const [lastSentGift, setLastSentGift] = useState(null);
  const [repeatSending, setRepeatSending] = useState(false);
  const [showRepeatButton, setShowRepeatButton] = useState(false);
  const [micGiftTotals, setMicGiftTotals] = useState({});
  const [micGiftTotalsReady, setMicGiftTotalsReady] = useState(false);

  // PK States
  const [pkSession, setPkSession] = useState(null);
  const [pkParticipants, setPkParticipants] = useState([]);
  const [pkDisplaySides, setPkDisplaySides] = useState({ A: [], B: [] });
  const [pkLoading, setPkLoading] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkRemainingMs, setPkRemainingMs] = useState(0);
  const [showPkModal, setShowPkModal] = useState(false);
  const [pkSeatA, setPkSeatA] = useState("");
  const [pkSeatB, setPkSeatB] = useState("");
  const [pkDuration, setPkDuration] = useState(5);
  const [pkScores, setPkScores] = useState({ A: 0, B: 0 });
  const [pkResultOpen, setPkResultOpen] = useState(false);
  const [pkResultData, setPkResultData] = useState(null);

  const [pkMode, setPkMode] = useState("1v1");
  const [pkSeatsA, setPkSeatsA] = useState([]);
  const [pkSeatsB, setPkSeatsB] = useState([]);

  // ==========================================
  // Helper Functions that don't depend on hooks 
  // (can be placed above memos)
  // ==========================================
  const getRequiredPkTeamSize = (mode) => {
    if (mode === "2v2") return 2;
    if (mode === "3v3") return 3;
    return 1;
  };

  const togglePkSeat = (side, seatNoStr) => {
    const requiredCount = getRequiredPkTeamSize(pkMode);

    if (side === "A") {
      setPkSeatsA((prev) => {
        if (prev.includes(seatNoStr)) {
          return prev.filter((s) => s !== seatNoStr);
        }
        if (prev.length >= requiredCount) {
          toast(`Max ${requiredCount} seats for Side A`, 1200);
          return prev;
        }
        return [...prev, seatNoStr];
      });
      return;
    }

    setPkSeatsB((prev) => {
      if (prev.includes(seatNoStr)) {
        return prev.filter((s) => s !== seatNoStr);
      }
      if (prev.length >= requiredCount) {
        toast(`Max ${requiredCount} seats for Side B`, 1200);
        return prev;
      }
      return [...prev, seatNoStr];
    });
  };

  // ==========================================
  // 4. Memos & Callbacks
  // ==========================================
  const hostUser = useMemo(() => {
    if (!room?.owner_user_id) return null;
    const p = activeParticipants.find((x) => String(x.user_id) === String(room.owner_user_id));
    if (p) {
      return {
        id: p.user_id,
        name: p.name || p.username || p.display_name || p.full_name || "Host",
        isHost: true,
        avatar_url: p.avatar_url || p.photo_url || p.profile_image || p.image || p.avatar || null
      };
    }
    return { id: room.owner_user_id, name: "Host", isHost: true, avatar_url: null };
  }, [room?.owner_user_id, activeParticipants]);

  const isOwner = useMemo(() => {
    return !!(room?.owner_user_id && user?.id && String(room.owner_user_id) === String(user.id));
  }, [room?.owner_user_id, user?.id]);

  const isModerator = useMemo(() => {
    return String(myRoomRole || "").toLowerCase() === "mod";
  }, [myRoomRole]);

  const effectiveSeats = useMemo(() => {
    return (micSeats || []).map(seat => {
      let occupant = null;
      if (seat.user_id) {
        occupant =
          activeParticipants.find(p => String(p.user_id) === String(seat.user_id)) ||
          activeParticipants.find(p => String(p.id) === String(seat.user_id)) ||
          null;
      }

      const renderedSeat = {
        ...seat,
        occupant,
        isOccupied: !!occupant,
        user_id: occupant ? seat.user_id : null
      };

      return renderedSeat;
    });
  }, [micSeats, activeParticipants]);

  const occupiedPkEligibleSeats = useMemo(() => {
    return (effectiveSeats || []).filter((s) => !!s.user_id && !!s.occupant);
  }, [effectiveSeats]);

  const micUsersForGift = useMemo(() => {
    const users = [];
    const seen = new Set();
    (effectiveSeats || []).forEach(seat => {
      if (seat.user_id && seat.user_id !== user?.id && !seen.has(seat.user_id)) {
        seen.add(seat.user_id);
        users.push(seat.occupant || { id: seat.user_id, user_id: seat.user_id, name: "User" });
      }
    });
    return users;
  }, [effectiveSeats, user?.id]);

  const roomUsersForGift = useMemo(() => {
    const users = [];
    const seen = new Set();
    (activeParticipants || []).forEach(p => {
      const uid = p.user_id || p.id;
      if (uid && uid !== user?.id && !seen.has(uid)) {
        seen.add(uid);
        users.push(p);
      }
    });
    return users;
  }, [activeParticipants, user?.id]);

  const giftPanelUsers = useMemo(() => {
    const allOption = {
      id: 'all_users_virtual',
      user_id: 'all_users_virtual',
      name: `Everyone in the room`,
      display_name: `Everyone in the room`,
      username: `Everyone in the room`,
      full_name: `Everyone in the room`,
      avatar_url: null,
    };
    const micOption = {
      id: 'mic_users_virtual',
      user_id: 'mic_users_virtual',
      name: `Everyone on mic`,
      display_name: `Everyone on mic`,
      username: `Everyone on mic`,
      full_name: `Everyone on mic`,
      avatar_url: null,
    };
    return [allOption, micOption, ...activeParticipants];
  }, [activeParticipants]);

  const pkSideA = useMemo(() => {
    const fromParticipants = (pkParticipants || []).filter((p) => p.side === "A");
    const fromDisplaySides = pkDisplaySides.A || [];

    const hasRealParticipantData =
      fromParticipants.length > 0 &&
      fromParticipants.some(
        (p) =>
          (p?.display_name && p.display_name !== "User") ||
          (p?.avatar_url && p.avatar_url !== FALLBACK_AVATAR)
      );

    // مهم: لو participants أكثر عدداً من displaySides، استخدمهم
    if (fromParticipants.length > fromDisplaySides.length) {
      return fromParticipants;
    }

    return hasRealParticipantData ? fromParticipants : fromDisplaySides;
  }, [pkParticipants, pkDisplaySides]);

  const pkSideB = useMemo(() => {
    const fromParticipants = (pkParticipants || []).filter((p) => p.side === "B");
    const fromDisplaySides = pkDisplaySides.B || [];

    const hasRealParticipantData =
      fromParticipants.length > 0 &&
      fromParticipants.some(
        (p) =>
          (p?.display_name && p.display_name !== "User") ||
          (p?.avatar_url && p.avatar_url !== FALLBACK_AVATAR)
      );

    if (fromParticipants.length > fromDisplaySides.length) {
      return fromParticipants;
    }

    return hasRealParticipantData ? fromParticipants : fromDisplaySides;
  }, [pkParticipants, pkDisplaySides]);

  console.log("[PK_DISPLAY_SIDES]", {
    fromParticipantsA: (pkParticipants || []).filter(p => p.side === "A").length,
    fromParticipantsB: (pkParticipants || []).filter(p => p.side === "B").length,
    displaySides: pkDisplaySides
  });

  console.log("[PK_DEBUG]", {
    pkParticipants,
    pkSeatA,
    pkSeatB,
    effectiveSeats
  });

  console.log("[PK_SCORE_REBUILT]", {
    sessionId: pkSession?.id || null,
    scoreA: pkScores?.A || 0,
    scoreB: pkScores?.B || 0
  });

  const pkRemainingLabel = useMemo(() => {
  const totalSec = Math.floor(pkRemainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}, [pkRemainingMs]);

  const pkUserSideMap = useMemo(() => {
    const map = new Map();
    (pkParticipants || []).forEach((p) => {
      if (p?.user_id && p?.side) map.set(String(p.user_id), p.side);
    });
    return map;
  }, [pkParticipants]);

  const pushJoinNotif = useCallback(
    (p) => {
      if (!p?.user_id) return;
      if (user?.id && String(p.user_id) === String(user.id)) return;

      const id = `${p.user_id}_${Date.now()}`;
      const name = p?.display_name || "User";
      const avatar = p?.avatar_url || FALLBACK_AVATAR;

      setJoinNotifs((prev) => {
        const next = [{ id, user_id: p.user_id, name, avatar_url: avatar, ts: Date.now() }, ...prev];
        return next.slice(0, 5);
      });

      setTimeout(() => {
        if (!mountedRef.current) return;
        setJoinNotifs((prev) => prev.filter((x) => x.id !== id));
      }, 3500);
    },
    [user?.id]
  );

  const toggleMicMute = useCallback(() => {
    const lkRoom = livekitRoomRef.current;
    if (!lkRoom) return;
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (lkRoom.localParticipant) {
      lkRoom.localParticipant.setMicrophoneEnabled(!nextMuted).catch((e) => {
        console.error("[VOICE] toggle mic failed", e);
      });
    }
  }, [isMicMuted]);

  // ==========================================
  // 5. Derived Variables
  // ==========================================
  const effectiveRole = String(roomRole || myRoomRole || "").toLowerCase();
  const canModerate =
    isOwner ||
    effectiveRole === "host" ||
    effectiveRole === "mod";
  const isMicOpenMode = micMode === "open";

  const pendingRequests = micRequests.filter((r) => String(r.status || "").toLowerCase() === "pending");
  const myPendingRequest = user?.id ? pendingRequests.find((r) => String(r.user_id) === String(user.id)) : null;

  const invites = pendingRequests.filter((r) => String(r.note || "").toLowerCase().startsWith("invite|") && user?.id && String(r.user_id) === String(user.id) && (() => { const note = String(r.note || ""); const m = note.match(/by:([0-9a-f-]+)/i); const by = m?.[1] || null; return !(by && String(by) === String(user.id)); })());

  const myInviteRequest = user?.id
    ? pendingRequests.find((r) => {
      if (String(r.user_id) !== String(user.id)) return false;

      const note = String(r.note || "");
      if (!note.toLowerCase().startsWith("invite|")) return false;

      const by = note.match(/by:([0-9a-f-]+)/i)?.[1] || null;
      if (by && String(by) === String(user.id)) return false;

      return true;
    })
    : null;

  // ==========================================
  // 6. Helper Functions
  // ==========================================
  const rebuildPkScoresNow = ({
    session,
    participants,
    roomGiftMessagesSource,
  }) => {
    const effectiveParticipants =
      (participants || []).length > 0
        ? participants
        : [
          ...(pkDisplaySidesRef.current?.A || []),
          ...(pkDisplaySidesRef.current?.B || []),
        ];

    if (!session?.id || !effectiveParticipants.length) {
      return { A: 0, B: 0 };
    }

    return getPkScoreFromEvents(
      roomGiftMessagesSource || [],
      session,
      effectiveParticipants
    );
  };

  const toast = (msg, ms = 1400) => {
    setErr(msg);
    setTimeout(() => mountedRef.current && setErr(""), ms);
  };

  const restartRepeatHideTimer = () => {
    if (repeatHideTimerRef.current) {
      clearTimeout(repeatHideTimerRef.current);
    }
    setShowRepeatButton(true);
    repeatHideTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setShowRepeatButton(false);
      }
    }, 4000);
  };

  const getSeatScreenPosition = (userId) => {
    if (!userId) return null;
    const el = micSeatRefs.current[String(userId)];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const openGiftPanelForUser = (targetUser) => {
    if (!targetUser?.id) return;
    setGiftTarget(targetUser);
    setGiftSelectedRecipient({
      id: targetUser.id,
      name: targetUser.name || targetUser.username || targetUser.display_name || targetUser.full_name || "User",
      isHost: String(targetUser.id) === String(room?.owner_user_id),
      avatar_url: targetUser.avatar_url || targetUser.photo_url || targetUser.profile_image || targetUser.image || targetUser.avatar || null
    });
    setGiftTargetMode("single");
    setGiftPanelOpen(true);
  };

  const openGiftPanelForAll = () => {
    setGiftTarget(null);
    setGiftSelectedRecipient({
      id: 'all_users_virtual',
      user_id: 'all_users_virtual',
      name: 'Everyone in the room',
      display_name: 'Everyone in the room',
      username: 'Everyone in the room',
      full_name: 'Everyone in the room',
      avatar_url: null,
    });
    setGiftTargetMode("all");
    setGiftPanelOpen(true);
  };

  const handleIncomingRoomGiftEvent = async (eventId, attempt = 0, overrideQuantity = null, shouldAffectPkDb = true) => {
    if (!eventId) return;

    if (processedRoomGiftIdsRef.current.has(eventId)) {
      return;
    }

    if (processingRoomGiftIdsRef.current.has(eventId)) {
      console.log("[ROOM_GIFT_EVENT_SKIPPED_ALREADY_PROCESSING]", { eventId, attempt });
      return;
    }

    processingRoomGiftIdsRef.current.add(eventId);
    console.log("[ROOM_GIFT_EVENT_PROCESSING_START]", { eventId, attempt });

    try {
      const fullEvent = await fetchLiveRoomGiftEventFull(eventId);

      console.log("[ROOM_GIFT_EVENT_FETCH_RESULT]", { eventId, attempt, fullEvent });

      if (!fullEvent) {
        processingRoomGiftIdsRef.current.delete(eventId);
        if (attempt < 5) {
          setTimeout(() => {
            handleIncomingRoomGiftEvent(eventId, attempt + 1, overrideQuantity, shouldAffectPkDb);
          }, 350);
        }
        return;
      }

      const effect = buildLiveRoomGiftEffect(fullEvent, "en");
      const finalQty = overrideQuantity || fullEvent?.quantity || 1;

      console.log("[ROOM_GIFT_EVENT_FULL]", fullEvent);
      console.log("[ROOM_GIFT_EFFECT_BUILT]", effect);

      processedRoomGiftIdsRef.current.add(eventId);
      processingRoomGiftIdsRef.current.delete(eventId);
      console.log("[ROOM_GIFT_EVENT_MARKED_PROCESSED]", { eventId });

      const enrichedEvent = {
        ...fullEvent,
        quantity: finalQty,
      };

      const addedCoins = getEventTotalCoins(enrichedEvent, finalQty);
      const receiverId = fullEvent?.receiver_id;

      if (receiverId && addedCoins > 0) {
        setMicGiftTotalsReady(true);
        micGiftTotalsHydratedRef.current = true;
        setMicGiftTotals(prev => {
          const nextTotal = (prev[receiverId] || 0) + addedCoins;
          console.log('[MIC_GIFT_TOTALS_UPDATED]', {
            receiverId,
            addedCoins,
            nextTotal
          });
          return {
            ...prev,
            [receiverId]: nextTotal
          };
        });
      }

      const currentPkSession = pkSessionRef.current;
      const currentPkParticipantsRaw = pkParticipantsRef.current || [];
      const currentPkDisplaySides = pkDisplaySidesRef.current || { A: [], B: [] };

      const effectivePkParticipants =
        currentPkParticipantsRaw.length > 0
          ? currentPkParticipantsRaw
          : [
            ...(currentPkDisplaySides.A || []),
            ...(currentPkDisplaySides.B || []),
          ];

      const receiverIdStr = fullEvent?.receiver_id ? String(fullEvent.receiver_id) : null;
      const participant = (effectivePkParticipants || []).find(
        (p) => String(p.user_id) === receiverIdStr
      );

      console.log("[PK_PARTICIPANT_RESOLUTION]", {
        receiverId: fullEvent?.receiver_id || null,
        fromParticipantsCount: (currentPkParticipantsRaw || []).length,
        fromDisplaySidesCount: ((currentPkDisplaySides.A || []).length + (currentPkDisplaySides.B || []).length),
        effectiveCount: (effectivePkParticipants || []).length,
        matchedSide: participant?.side || null
      });

      console.log("[PK_SCORE_PROCESS_MODE]", {
        eventId,
        shouldAffectPkDb,
        receiverId: fullEvent?.receiver_id || null,
        participantSide: participant?.side || null,
        pkSessionId: currentPkSession?.id || null,
      });

      if (shouldAffectPkDb && participant && currentPkSession?.status === "live") {
        const nowMs = Date.now();
        const endsMs = currentPkSession?.ends_at
          ? new Date(currentPkSession.ends_at).getTime()
          : 0;

        if (!endsMs || nowMs <= endsMs) {
          const pkAddedCoins = getPkEventCoins(enrichedEvent);

          if (pkAddedCoins > 0) {
            const { data: pkScoreRes, error: pkScoreErr } = await supabase.rpc(
              "increment_live_room_pk_score",
              {
                p_pk_session_id: currentPkSession.id,
                p_side: participant.side,
                p_amount: pkAddedCoins,
              }
            );

            if (pkScoreErr) {
              console.error("[PK_SCORE_RPC_ERROR]", pkScoreErr);
            } else if (pkScoreRes?.success) {
              const nextScores = {
                A: Number(pkScoreRes?.score_a || 0),
                B: Number(pkScoreRes?.score_b || 0),
              };

              setPkScores(nextScores);

              console.log("[PK_SCORE_UPDATED_FROM_DB]", {
                receiverId: fullEvent?.receiver_id,
                side: participant.side,
                pkAddedCoins,
                nextScores,
              });

              if (channelRef.current) {
                await channelRef.current.send({
                  type: "broadcast",
                  event: "pk_score_updated",
                  payload: {
                   room_id: roomId,
                    pk_session_id: currentPkSession.id,
                    score_a: nextScores.A,
                    score_b: nextScores.B,
                    ts: Date.now(),
                  },
                });
              }
            }
          }
        }
      }

      const seatTarget = getSeatScreenPosition(fullEvent?.receiver_id);
      console.log('[ROOM_GIFT_TARGET_POSITION]', {
        receiverId: fullEvent?.receiver_id,
        seatTarget
      });

      if (effect) {
        effect.quantity = finalQty;
        effect.targetPosition = seatTarget || null;
        effect.startMotion = false;

        setRoomGiftEffects((prev) => {
          if (prev.some((item) => String(item.id) === String(effect.id))) return prev;
          return [...prev, effect];
        });

        if (seatTarget) {
          setTimeout(() => {
            if (!mountedRef.current) return;
            setRoomGiftEffects((prev) =>
              prev.map((item) =>
                String(item.id) === String(effect.id)
                  ? { ...item, startMotion: true }
                  : item
              )
            );
          }, 50);
        }

        setTimeout(() => {
          setRoomGiftEffects((prev) => prev.filter((item) => String(item.id) !== String(effect.id)));
        }, effect.animation_duration_ms || 4000);
      }

      const giftMsg = {
        id: `gift-${eventId}`,
        type: "gift",
        content_type: "gift",
        created_at: fullEvent.created_at || new Date().toISOString(),
        sender_id: fullEvent.sender_id,
        sender_name: fullEvent.sender_name || "User",
        sender_avatar: fullEvent.sender_avatar,
        receiver_id: fullEvent.receiver_id,
        receiver_name: fullEvent.receiver_name || "User",
        receiver_avatar: fullEvent.receiver_avatar,
        gift_id: fullEvent.gift_id,
        gift_name:
          effect?.gift_name ||
          fullEvent.gift_name_en ||
          fullEvent.gift_name_ar ||
          "Gift",
        gift_icon:
          effect?.icon_url ||
          fullEvent.icon_url ||
          null,
        overlay_image_url: effect?.overlay_image_url,
        ticker_image_url: effect?.ticker_image_url,
        animation_asset_url: effect?.animation_asset_url,
        animation_asset_type: effect?.animation_asset_type,
        message: fullEvent.message,
        coins_spent: fullEvent.coins_spent,
        gems_awarded: fullEvent.gems_awarded,
        quantity: finalQty,
        total_coins: addedCoins,
      };

      setRoomGiftMessages((prev) => {
        if (prev.some((m) => m.id === giftMsg.id)) return prev;
        const nextMessages = [...prev, giftMsg];
        console.log("[ROOM_GIFT_MESSAGES_UPDATED]", nextMessages);
        return nextMessages;
      });
      scheduleLeaderboardRefresh(400);

      processingRoomGiftIdsRef.current.delete(eventId);
    } catch (err) {
      console.error("[ROOM_GIFT_EVENT_ERROR]", err);
      processingRoomGiftIdsRef.current.delete(eventId);

      if (attempt < 5) {
        setTimeout(() => {
          handleIncomingRoomGiftEvent(eventId, attempt + 1, overrideQuantity, shouldAffectPkDb);
        }, 350);
      }
    }
  };

  const resolveGiftTargetMode = (explicitMode, selectedUser) => {
    const selectedId = String(
      selectedUser?.id ||
      selectedUser?.user_id ||
      ''
    ).toLowerCase();

    const selectedName = String(
      selectedUser?.name ||
      selectedUser?.display_name ||
      selectedUser?.username ||
      selectedUser?.full_name ||
      ''
    ).toLowerCase();

    if (explicitMode === 'all' || selectedId === 'all_users_virtual' || selectedName.includes('everyone in the room')) {
      return 'all';
    }

    if (explicitMode === 'mic' || selectedId === 'mic_users_virtual' || selectedName.includes('everyone on mic')) {
      return 'mic';
    }

    return 'single';
  };

  const handleRoomGiftSend = async (payload) => {
    try {
      const resolvedGiftId = payload?.gift_id || payload?.giftId || null;
      const resolvedMessage = payload?.message || null;

      const selectedRecipientId =
        giftSelectedRecipient?.id ||
        giftSelectedRecipient?.user_id ||
        null;

      const effectiveTargetMode = resolveGiftTargetMode(
        payload?.target_mode || giftTargetMode,
        giftSelectedRecipient
      );

      let resolvedReceiverId =
        payload?.receiver_id ||
        payload?.recipient_id ||
        selectedRecipientId ||
        hostUser?.id ||
        null;

      if (
        String(resolvedReceiverId || '').toLowerCase() === 'all_users_virtual' ||
        String(resolvedReceiverId || '').toLowerCase() === 'mic_users_virtual'
      ) {
        resolvedReceiverId = null;
      }

      console.log('[ROOM_GIFT_SEND_MODE]', {
        payloadTargetMode: payload?.target_mode,
        giftTargetMode,
        effectiveTargetMode,
        giftSelectedRecipient,
        resolvedReceiverId,
        quantity: giftQuantity || 1,
        roomUsersCount: roomUsersForGift?.length || 0,
        micUsersCount: micUsersForGift?.length || 0,
      });

      if (!resolvedGiftId) {
        toast('Gift id is missing', 1400);
        return;
      }

      if (effectiveTargetMode === 'all') {
        const targets = (roomUsersForGift || []).filter(Boolean);

        if (!targets.length) {
          toast('No users in room', 1400);
          return;
        }

        for (const roomUser of targets) {
          const targetReceiverId = roomUser?.id || roomUser?.user_id;
          if (!targetReceiverId) continue;

          const result = await sendLiveRoomGift({
            roomId: roomId,
            receiverId: targetReceiverId,
            giftId: resolvedGiftId,
            message: resolvedMessage,
            quantity: giftQuantity || 1,
          });

          if (result?.success && result?.event_id) {
            const displayQuantity = result?.quantity_sent || result?.quantity_requested || giftQuantity || 1;
            await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

            if (channelRef.current) {
              await channelRef.current.send({
                type: "broadcast",
                event: "gift",
                payload: {
                  event_id: result.event_id,
                  room_id: roomId,
                  quantity: displayQuantity,
                  ts: Date.now()
                }
              });
            }
          }
          scheduleLeaderboardRefresh(400);
        }

        const fallbackReceiverId = hostUser?.id || targets[0]?.id || resolvedReceiverId;
        const selectedGift = payload?.gift || payload;
        setLastSentGift({
          roomId: roomId,
          receiverId: fallbackReceiverId,
          giftId: resolvedGiftId,
          message: resolvedMessage || '',
          quantity: giftQuantity || 1,
          targetMode: 'all',
          receiverName: giftSelectedRecipient?.name || giftTarget?.name || 'Everyone in the room',
          giftName: payload?.gift?.name_en || payload?.gift?.name_ar || payload?.gift?.code || payload?.giftName || 'Gift',
          giftIconUrl: selectedGift?.icon_url || selectedGift?.iconUrl || selectedGift?.image || payload?.giftIconUrl || '',
          giftEmoji: selectedGift?.emoji || ''
        });

        restartRepeatHideTimer();

        if (user?.id) {
          fetchUserWallet(user.id).catch(console.error);
        }

        if (typeof setGiftPanelOpen === "function") {
          setGiftPanelOpen(false);
        }
        return;
      }

      if (effectiveTargetMode === 'mic') {
        const targets = (micUsersForGift || []).filter(Boolean);

        if (!targets.length) {
          toast('No users on mic', 1400);
          return;
        }

        for (const micUser of targets) {
          const targetReceiverId = micUser?.id || micUser?.user_id;
          if (!targetReceiverId) continue;

          const result = await sendLiveRoomGift({
            roomId: roomId,
            receiverId: targetReceiverId,
            giftId: resolvedGiftId,
            message: resolvedMessage,
            quantity: giftQuantity || 1,
          });

          if (result?.success && result?.event_id) {
            const displayQuantity = result?.quantity_sent || result?.quantity_requested || giftQuantity || 1;
            await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

            if (channelRef.current) {
              await channelRef.current.send({
                type: "broadcast",
                event: "gift",
                payload: {
                  event_id: result.event_id,
                  room_id,
                  quantity: displayQuantity,
                  ts: Date.now()
                }
              });
            }
          }
        }

        const fallbackReceiverId = hostUser?.id || targets[0]?.id || resolvedReceiverId;
        const selectedGift = payload?.gift || payload;
        setLastSentGift({
          roomId: roomId,
          receiverId: fallbackReceiverId,
          giftId: resolvedGiftId,
          message: resolvedMessage || '',
          quantity: giftQuantity || 1,
          targetMode: 'mic',
          receiverName: giftSelectedRecipient?.name || giftTarget?.name || 'Everyone on mic',
          giftName: payload?.gift?.name_en || payload?.gift?.name_ar || payload?.gift?.code || payload?.giftName || 'Gift',
          giftIconUrl: selectedGift?.icon_url || selectedGift?.iconUrl || selectedGift?.image || payload?.giftIconUrl || '',
          giftEmoji: selectedGift?.emoji || ''
        });

        restartRepeatHideTimer();

        if (user?.id) {
          fetchUserWallet(user.id).catch(console.error);
        }

        if (typeof setGiftPanelOpen === "function") {
          setGiftPanelOpen(false);
        }
        return;
      }

      if (!resolvedReceiverId) {
        toast('Receiver user id is missing', 1400);
        return;
      }

      const result = await sendLiveRoomGift({
        roomId: roomId,
        receiverId: resolvedReceiverId,
        giftId: resolvedGiftId,
        message: resolvedMessage,
        quantity: giftQuantity || 1,
      });

      const displayQuantity = result?.quantity_sent || result?.quantity_requested || 1;

      if (result?.success && result?.event_id) {
        await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "gift",
            payload: {
              event_id: result.event_id,
              room_id: roomId,
              quantity: displayQuantity,
              ts: Date.now()
            }
          });
        }

        const selectedGift = payload?.gift || payload;
        setLastSentGift({
          roomId: roomId,
          receiverId: resolvedReceiverId,
          giftId: resolvedGiftId,
          message: resolvedMessage || '',
          quantity: giftQuantity || 1,
          targetMode: 'single',
          receiverName: giftSelectedRecipient?.name || giftTarget?.name || null,
          giftName: payload?.gift?.name_en || payload?.gift?.name_ar || payload?.gift?.code || payload?.giftName || 'Gift',
          giftIconUrl: selectedGift?.icon_url || selectedGift?.iconUrl || selectedGift?.image || payload?.giftIconUrl || '',
          giftEmoji: selectedGift?.emoji || ''
        });

        restartRepeatHideTimer();
      }

      if (user?.id) {
        fetchUserWallet(user.id).catch(console.error);
      }

      if (typeof setGiftPanelOpen === "function") {
        setGiftPanelOpen(false);
      }

    } catch (err) {
      console.error("ROOM_GIFT_EXCEPTION", err);
      toast(err?.message || "Failed to send gift", 1400);
    }
  };

  const handleRepeatLastGift = async () => {
    if (!lastSentGift) return;

    setRepeatSending(true);
    restartRepeatHideTimer();

    console.log('[ROOM_GIFT_REPEAT_SEND]', lastSentGift);

    try {
      const repeatMode = lastSentGift?.targetMode || 'single';
      const repeatQuantity = Number(lastSentGift?.quantity || 1);

      console.log('[ROOM_GIFT_REPEAT_MODE]', {
        repeatMode: repeatMode,
        quantity: repeatQuantity,
        roomUsersCount: roomUsersForGift?.length || 0,
        micUsersCount: micUsersForGift?.length || 0
      });

      if (repeatMode === 'all') {
        const targets = (roomUsersForGift || []).filter(Boolean);

        if (!targets.length) {
          throw new Error('No users in room');
        }

        for (const roomUser of targets) {
          const targetReceiverId = roomUser?.id || roomUser?.user_id;
          if (!targetReceiverId) continue;

          const result = await sendLiveRoomGift({
            roomId: lastSentGift.roomId,
            receiverId: targetReceiverId,
            giftId: lastSentGift.giftId,
            message: lastSentGift.message,
            quantity: repeatQuantity,
          });

          const displayQuantity =
            result?.quantity_sent ||
            result?.quantity_requested ||
            repeatQuantity;

          if (result?.success && result?.event_id) {
            await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

            if (channelRef.current) {
              await channelRef.current.send({
                type: "broadcast",
                event: "gift",
                payload: {
                  event_id: result.event_id,
                  room_id: lastSentGift.roomId,
                  quantity: displayQuantity,
                  ts: Date.now()
                }
              });
            }
          }
        }

        if (user?.id) {
          fetchUserWallet(user.id).catch(console.error);
        }

        return;
      }

      if (repeatMode === 'mic') {
        const targets = (micUsersForGift || []).filter(Boolean);

        if (!targets.length) {
          throw new Error('No users on mic');
        }

        for (const micUser of targets) {
          const targetReceiverId = micUser?.id || micUser?.user_id;
          if (!targetReceiverId) continue;

          const result = await sendLiveRoomGift({
            roomId: lastSentGift.roomId,
            receiverId: targetReceiverId,
            giftId: lastSentGift.giftId,
            message: lastSentGift.message,
            quantity: repeatQuantity,
          });

          const displayQuantity =
            result?.quantity_sent ||
            result?.quantity_requested ||
            repeatQuantity;

          if (result?.success && result?.event_id) {
            await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

            if (channelRef.current) {
              await channelRef.current.send({
                type: "broadcast",
                event: "gift",
                payload: {
                  event_id: result.event_id,
                  room_id: lastSentGift.roomId,
                  quantity: displayQuantity,
                  ts: Date.now()
                }
              });
            }
          }
        }

        if (user?.id) {
          fetchUserWallet(user.id).catch(console.error);
        }

        return;
      }

      if (!lastSentGift.receiverId) {
        throw new Error('Receiver user id is missing');
      }

      const result = await sendLiveRoomGift({
        roomId: lastSentGift.roomId,
        receiverId: lastSentGift.receiverId,
        giftId: lastSentGift.giftId,
        message: lastSentGift.message,
        quantity: repeatQuantity,
      });

      const displayQuantity =
        result?.quantity_sent ||
        result?.quantity_requested ||
        repeatQuantity;

      if (result?.success && result?.event_id) {
        await handleIncomingRoomGiftEvent(result.event_id, 0, displayQuantity, true);

        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "gift",
            payload: {
              event_id: result.event_id,
              room_id: lastSentGift.roomId,
              quantity: displayQuantity,
              ts: Date.now()
            }
          });
        }
      }

      if (user?.id) {
        fetchUserWallet(user.id).catch(console.error);
      }
    } catch (err) {
      console.error("ROOM_GIFT_REPEAT_EXCEPTION", err);
      toast(err?.message || "Failed to repeat gift", 1400);
    } finally {
      setRepeatSending(false);
    }
  };

  const startVoice = async () => {
    if (!roomId || !user?.id) return;
    if (livekitRoomRef.current) return;

    try {
      setVoiceError(null);
      setVoiceStatus("connecting");

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room: String(roomId), user: String(user.id) },
      });

      if (error) throw error;

      const token = data?.token;
      if (!token) throw new Error("No token returned from livekit-token");

      const roomUrl = "wss://singlesdate-voice-axhc4zy4.livekit.cloud";

      const lkRoom = await connectVoice(roomUrl, token);

      livekitRoomRef.current = lkRoom;
      setVoiceStatus("connected");

    } catch (e) {
      console.error("[VOICE] startVoice failed", e);
      setVoiceStatus("error");
      setVoiceError(e?.message || "voice failed");
    }
  };

  const stopVoice = async () => {
    try {
      setVoiceError(null);

      const lkRoom = livekitRoomRef.current;
      if (lkRoom) {
        lkRoom.disconnect();
      }

      livekitRoomRef.current = null;
      setVoiceStatus("idle");
    } catch (e) {
      console.error("Voice stop error:", e);
      setVoiceStatus("error");
      setVoiceError(e?.message || "stop voice failed");
    }
  };

  const openProfile = (userId) => {
  if (!userId) return;
  openUserCard(userId, user);
};

 const goToProfilePage = (userId) => {
  if (!userId) return;
  window.open(`/user/${userId}`, "_blank", "noopener,noreferrer");
};

  const copyRoomId = async () => {
    try {
      const copyText = room?.public_room_id ? `#${room.public_room_id}` : `#${String(roomId).slice(0, 8)}`;
      await navigator.clipboard.writeText(copyText);
      toast("✅ Room ID copied", 1200);
    } catch {
      toast("❌ Failed to copy", 1200);
    }
  };

  const fetchProfilesMap = async (ids) => {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (unique.length === 0) return new Map();

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,avatar_url,gender,age,country,living_in,plan,verified,is_vip,vip_until,vip_number,occupation,full_name,username")
      .in("id", unique);

    if (error) throw error;

    const m = new Map();
    (data || []).forEach((p) => {
      const normalized = {
        ...p,
        name: p?.name || "User",
        avatar_url: p?.avatar_url || null,
      };
      m.set(p.id, normalized);
      profilesCacheRef.current.set(p.id, normalized);
    });
    return m;
  };

  const fetchProfileOne = async (userId) => {
    if (!userId) return null;

    const cached = profilesCacheRef.current.get(userId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,avatar_url,gender,age,country,living_in,plan,verified,is_vip,vip_until,vip_number,occupation,full_name,username")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    const normalized = data
      ? {
        ...data,
        name: data?.name || "User",
        avatar_url: data?.avatar_url || null,
      }
      : null;

    if (normalized?.id) profilesCacheRef.current.set(normalized.id, normalized);
    return normalized;
  };

  const openUserCard = async (userId, seedProfile = null) => {
  if (!userId) return;

  console.log("OPEN CARD userId:", userId);
  console.log("OPEN CARD moderatorsMap:", moderatorsMap);
  console.log("OPEN CARD has mod?:", 
    moderatorsMap?.has?.(userId),
    moderatorsMap?.has?.(String(userId)),
    moderatorsMap?.has?.(Number(userId))
  );

  const seedIsMod = !!(
    moderatorsMap?.has?.(userId) ||
    moderatorsMap?.has?.(String(userId)) ||
    moderatorsMap?.has?.(Number(userId)) ||
    seedProfile?.is_moderator ||
    seedProfile?.isModerator ||
    seedProfile?.is_mod ||
    seedProfile?.role === "moderator" ||
    seedProfile?.role === "mod" ||
    seedProfile?.room_role === "moderator" ||
    seedProfile?.room_role === "mod" ||
    seedProfile?.badge === "mod"
  );

  console.log("seedIsMod:", seedIsMod);

  const normalizedSeed = seedProfile
    ? {
        ...seedProfile,
        is_mod: seedIsMod || !!seedProfile?.is_mod,
        is_moderator: seedIsMod || !!seedProfile?.is_moderator,
      }
    : seedIsMod
    ? {
        id: userId,
        is_mod: true,
        is_moderator: true,
      }
    : null;

  setIsUserCardOpen(true);
  setSelectedUserId(userId);
  setSelectedUserIsMod(seedIsMod);
  setSelectedUserProfile(normalizedSeed);
  setCardLoading(true);

  try {
    const profileData = await fetchProfileCardData(userId);

    const finalIsMod = !!(
      moderatorsMap?.has?.(userId) ||
      moderatorsMap?.has?.(String(userId)) ||
      moderatorsMap?.has?.(Number(userId)) ||
      normalizedSeed?.is_mod ||
      normalizedSeed?.is_moderator ||
      profileData?.is_moderator ||
      profileData?.isModerator ||
      profileData?.is_mod ||
      profileData?.role === "moderator" ||
      profileData?.role === "mod" ||
      profileData?.room_role === "moderator" ||
      profileData?.room_role === "mod" ||
      profileData?.badge === "mod"
    );

    console.log("profileData:", profileData);
    console.log("finalIsMod:", finalIsMod);

    const merged = {
      ...(normalizedSeed || {}),
      ...(profileData || {}),
      is_mod: finalIsMod,
      is_moderator: finalIsMod,
    };

    setSelectedUserIsMod(finalIsMod);
    setSelectedUserProfile(merged);
  } catch (err) {
    console.error("openUserCard error:", err);
  } finally {
    setCardLoading(false);
  }
};

 const closeUserCard = () => {
  setIsUserCardOpen(false);
  setSelectedUserId(null);
  setSelectedUserProfile(null);
  setSelectedUserIsMod(false);
};

  const mentionUser = (profile) => {
    const name = profile?.name || profile?.display_name || profile?.full_name || "User";
    setText((prev) => {
      const prefix = prev?.trim().length ? prev + " " : "";
      return `${prefix}@${name} `;
    });
    closeUserCard();
  };

  const broadcastKick = async ({ targetUserId, untilIso, isBan }) => {
    try {
      const ch = channelRef.current;
      if (!ch) return;

      await ch.send({
        type: "broadcast",
        event: "kick",
        payload: {
          room_id: roomId,
          user_id: targetUserId,
          until: untilIso || null,
          isBan: !!isBan,
          ts: Date.now(),
        },
      });
    } catch {
    }
  };

  const openKickConfirm = (targetUserId) => {
    if (!targetUserId) return;
    setKickTargetId(targetUserId);
    setKickMinutes(10);
    setKickOpen(true);
  };

  const closeKickConfirm = () => {
    setKickOpen(false);
    setKickTargetId(null);
    setKickBusy(false);
  };

  const kickUserNow = async () => {
    if (!kickTargetId || !roomId || !user?.id) return;
    setKickBusy(true);

    try {
      const bannedUntilIso = new Date(Date.now() + kickMinutes * 60 * 1000).toISOString();

      const { error: banErr } = await supabase.from("live_room_bans").upsert(
        {
          room_id: roomId,
          user_id: kickTargetId,
          banned_by: user.id,
          banned_until: bannedUntilIso,
          is_active: true,
          revoked_at: null,
        },
        { onConflict: "room_id,user_id" }
      );
      if (banErr) throw banErr;

      const { error: presErr } = await supabase
        .from("live_room_presence")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", kickTargetId);
      if (presErr) throw presErr;

      try {
        await supabase.rpc("remove_user_from_mic", { p_room_id: roomId, p_user_id: kickTargetId });
      } catch { }

      await broadcastKick({ targetUserId: kickTargetId, untilIso: bannedUntilIso, isBan: false });

      closeKickConfirm();
      toast(`👢 Kicked for ${kickMinutes} minutes`, 1400);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to kick user");
      setKickBusy(false);
    }
  };

  const openBanConfirm = (targetUserId) => {
    if (!targetUserId) return;
    setBanTargetId(targetUserId);
    setBanReason("");
    setBanOpen(true);
  };

  const closeBanConfirm = () => {
    setBanOpen(false);
    setBanTargetId(null);
    setBanBusy(false);
    setBanReason("");
  };

  const banUserNow = async () => {
    if (!banTargetId || !user?.id || !roomId) return;

    if (!isOwner && room?.owner_user_id && String(banTargetId) === String(room?.owner_user_id)) {
      toast("Not allowed", 1400);
      return;
    }

    setBanBusy(true);

    try {
      const reasonClean = (banReason || "").trim() || null;

      const { error: banErr } = await supabase.from("live_room_bans").upsert(
        {
          room_id: roomId,
          user_id: banTargetId,
          banned_by: user.id,
          reason: reasonClean,
          banned_until: null,
          is_active: true,
          revoked_at: null,
        },
        { onConflict: "room_id,user_id" }
      );
      if (banErr) throw banErr;

      await supabase.from("live_room_presence").delete().eq("room_id", roomId).eq("user_id", banTargetId);

      try {
        await supabase.rpc("remove_user_from_mic", { p_room_id: roomId, p_user_id: banTargetId });
      } catch { }

      await broadcastKick({ targetUserId: banTargetId, untilIso: null, isBan: true });

      closeBanConfirm();
      toast("⛔ User banned", 1400);

      if (showSettings && settingsTab === "bans") {
        const list = await fetchBans();
        if (mountedRef.current) setBannedList(list);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to ban user");
      setBanBusy(false);
    }
  };

  const fetchBans = async () => {
    if (!roomId) return [];
    setLoadingBans(true);

    try {
      const { data, error } = await supabase
        .from("live_room_bans")
        .select("room_id,user_id,banned_until,is_active,created_at,banned_by,revoked_at,reason")
        .eq("room_id", roomId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const rows = data || [];
      const ids = rows.map((r) => r.user_id);
      const map = await fetchProfilesMap(ids);

      return rows.map((r) => {
        const p = map.get(r.user_id);
        return {
          ...r,
          display_name: p?.name || "User",
          avatar_url: p?.avatar_url || null,
        };
      });
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to load bans");
      return [];
    } finally {
      setLoadingBans(false);
    }
  };

  const unbanUser = async (targetUserId) => {
    if (!targetUserId || !user?.id || !roomId) return;
    setSettingsBusy(true);

    try {
      const { error } = await supabase
        .from("live_room_bans")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);

      if (error) throw error;

      const list = await fetchBans();
      if (mountedRef.current) setBannedList(list);

      toast("✅ Unbanned", 1200);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to unban user");
    } finally {
      setSettingsBusy(false);
    }
  };

  const loadRoomCore = async () => {
    try {
      const { data, error } = await supabase
        .from("live_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Room not found");

      if (mountedRef.current) {
        setRoom(data);
        setMicMode(data?.mic_mode || "request");
      }
      return data;
    } catch (e) {
      if (mountedRef.current) {
        setErr("Room not found");
        setRoom(null);
      }
      return null;
    }
  };

  const loadRoomRole = async (ownerId) => {
    if (!roomId || !user?.id) return;

    let checkOwnerId = ownerId;
    if (!checkOwnerId) {
      checkOwnerId = room?.owner_user_id;
      if (!checkOwnerId) {
        try {
          const { data: rData } = await supabase.from('live_rooms').select('owner_user_id').eq('id', roomId).single();
          checkOwnerId = rData?.owner_user_id;
        } catch (e) { }
      }
    }

    if (checkOwnerId && String(checkOwnerId) === String(user.id)) {
      if (mountedRef.current) setRoomRole('host');
      return;
    }

    try {
      const { data, error } = await supabase
        .from("live_room_roles")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const role = data?.role || 'guest';
      if (mountedRef.current) setRoomRole(role);
    } catch (err) {
      if (mountedRef.current) setRoomRole('guest');
    }
  };

  const loadModerators = async () => {
  if (!roomId) return;

  try {
    const { data, error } = await supabase
  .from("live_room_roles")
  .select("user_id")
  .eq("room_id", roomId)
  .eq("role", "mod")
  .eq("is_active", true)
  .is("revoked_at", null);

    if (error) throw error;

    const nextMap = buildModeratorsMap(data || []);

    if (mountedRef.current) {
      setModeratorsMap(nextMap);
    }

    console.log("MODERATORS RAW:", data);
console.log("MODERATORS MAP:", nextMap);
  } catch (err) {
    console.error("[MODERATORS_LOAD_ERROR]", err);
  }
};

  const cleanupStaleMicSeats = async () => {
    if (!roomId) return;
    try {
      await supabase.rpc('release_stale_live_room_mic_seats', {
        p_room_id: roomId
      });
    } catch (e) {
      console.error('[MIC_STALE_CLEANUP_ERROR]', e);
    }
  };

  const loadMicSeats = async () => {
    try {
      await cleanupStaleMicSeats();

      let { data, error } = await supabase
        .from("live_room_mic_seats")
        .select("*")
        .eq("room_id", roomId)
        .order("seat_no", { ascending: true });

      if (error) {
        const fallbackRes = await supabase
          .from("live_room_mic_seats")
          .select("*")
          .eq("room_id", roomId)
          .order("id", { ascending: true });
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      let result = data || [];

      result = result.map((s, index) => ({
        ...s,
        seat_no: s.seat_no || (index + 1),
        locked: !!s.locked
      }));

      const occupiedUserIds = result.filter(s => s.user_id).map(s => s.user_id);
      if (occupiedUserIds.length > 0) {
        const { data: participantsData } = await supabase
          .from("live_room_participants")
          .select("user_id, left_at")
          .eq("room_id", roomId)
          .in("user_id", occupiedUserIds);

        const activeUsers = new Set(
          (participantsData || []).filter(p => p.left_at === null).map(p => p.user_id)
        );

        for (let i = 0; i < result.length; i++) {
          const seat = result[i];
          if (seat.user_id && !activeUsers.has(seat.user_id)) {
            seat.user_id = null;
          }
        }
      }

      if (result.length === 0) {
        result = [
          { seat_no: 1, user_id: null, locked: false },
          { seat_no: 2, user_id: null, locked: false },
          { seat_no: 3, user_id: null, locked: false },
          { seat_no: 4, user_id: null, locked: false },
          { seat_no: 5, user_id: null, locked: false },
          { seat_no: 6, user_id: null, locked: false }
        ];
      }

      if (mountedRef.current) {
        setMicSeats((prev) => {
          const prevMap = new Map(
            (prev || []).map(u => [u.user_id || u.id, u])
          );

          return (result || []).map(seat => {
            const id = seat.user_id || seat.id;
            const existing = prevMap.get(id);

            return {
              ...seat,
              is_self_muted: existing?.is_self_muted ?? false,
              is_forced_muted: existing?.is_forced_muted ?? false,
            };
          });
        });
        console.log('[MIC_SEATS_MERGED]', result);
      }
      return result;
    } catch (err) {
      console.error('[MIC_SEATS_ERROR]', err);
      const fallback = [
        { seat_no: 1, user_id: null, locked: false },
        { seat_no: 2, user_id: null, locked: false },
        { seat_no: 3, user_id: null, locked: false },
        { seat_no: 4, user_id: null, locked: false },
        { seat_no: 5, user_id: null, locked: false },
        { seat_no: 6, user_id: null, locked: false }
      ];
      if (mountedRef.current) {
        setMicSeats((prev) => {
          const prevMap = new Map(
            (prev || []).map(u => [u.user_id || u.id, u])
          );

          return (fallback || []).map(seat => {
            const id = seat.user_id || seat.id;
            const existing = prevMap.get(id);

            return {
              ...seat,
              is_self_muted: existing?.is_self_muted ?? false,
              is_forced_muted: existing?.is_forced_muted ?? false,
            };
          });
        });
        console.log('[MIC_SEATS_MERGED]', fallback);
      }
      return fallback;
    }
  };

  const loadActiveParticipants = async () => {
    if (!roomId) return [];
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('live_room_participants')
        .select('*')
        .eq('room_id', roomId)
        .is('left_at', null)
        .or('is_banned.eq.false,is_banned.is.null');

      if (participantsError) throw participantsError;

      const rows = participantsData || [];

      if (rows.length === 0) {
        if (mountedRef.current) {
          setActiveParticipants([]);
          setParticipantsMap({});
        }
        return [];
      }

      const ids = rows.map((r) => r.user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids);

      if (profilesError) throw profilesError;

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const newParticipantsMap = {};

      const combined = rows.map((r) => {
        const p = profilesMap.get(r.user_id) || {};
        const participantObj = {
          id: p.id || r.user_id,
          user_id: r.user_id,
          name: p.name || p.username || p.display_name || p.full_name || 'User',
          full_name: p.full_name || p.display_name || p.username || p.name || 'User',
          username: p.username || null,
          display_name: p.display_name || p.full_name || p.username || p.name || 'User',
          avatar_url: p.avatar_url || p.photo_url || p.profile_image || p.image || p.avatar || null,
          joined_at: r.joined_at || null,
          raw_profile: p,
          raw_participant: r
        };
        newParticipantsMap[r.user_id] = participantObj;
        return participantObj;
      });

      if (mountedRef.current) {
        setActiveParticipants(combined);
        setParticipantsMap(newParticipantsMap);
      }
      return combined;
    } catch (err) {
      console.error('[ROOM_ACTIVE_PARTICIPANTS_ERROR]', err);
      return [];
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("live_room_messages")
      .select("*")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    const rows = data || [];
    const ids = rows.map((m) => m.sender_user_id);
    const map = await fetchProfilesMap(ids);

    return rows.map((m) => {
      const p = map.get(m.sender_user_id);
      return {
        ...m,
        sender_name: p?.name || "User",
        sender_avatar: p?.avatar_url || null,
      };
    });
  };

  const fetchGiftHistory = async () => {
    if (!roomId) return [];

    try {
      let all = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase
          .from("v_live_room_gift_events_full")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false });

        if (room?.gift_counters_reset_at) {
          query = query.gte("created_at", room.gift_counters_reset_at);
        }

        const { data, error } = await query.range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        all = [...all, ...data];

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return all;
    } catch (err) {
      console.error("[FETCH_GIFT_HISTORY_ERROR]", err);
      return [];
    }
  };

  const fetchMutes = async () => {
    try {
      const { data, error } = await supabase.from("live_room_mutes").select("*").eq("room_id", roomId);
      if (error) throw error;
      const m = new Map();
      (data || []).forEach((row) => row?.user_id && m.set(row.user_id, row));
      return m;
    } catch {
      return new Map();
    }
  };

  const fetchMyRole = async () => {
    if (!user?.id || !roomId) return null;

    try {
      const { data, error } = await supabase
        .from("live_room_roles")
        .select("role,is_active")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data?.role || null;
    } catch {
      return null;
    }
  };

  const fetchModerators = async () => {
    try {
      const { data, error } = await supabase
        .from("live_room_roles")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("role", "mod")
        .eq("is_active", true);
      if (error) throw error;
      const m = new Map();
      (data || []).forEach((row) => m.set(row.user_id, true));
      return m;
    } catch {
      return new Map();
    }
  };

  const isInviteRow = (row) => String(row?.note || "").startsWith("invite|");

  const loadMicRequests = async () => {
  try {
    const { data, error } = await supabase
      .from("v_live_room_mic_requests")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "pending");

    if (error) throw error;

    const requests = (data || []).filter((r) => !isInviteRow(r));
    console.log("[MIC_REQUESTS_FETCHED]", requests);
    return requests;
  } catch (err) {
    console.error("[MIC_REQUESTS_ERROR]", err);
    return [];
  }
};

  const loadMyMicInvites = async () => {
  if (!roomId || !user?.id) return;

  console.log("[MY_MIC_INVITES_LOAD]", { roomId, userId: user.id });

  try {
    const { data, error } = await supabase
      .from("v_live_room_mic_requests")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "pending");

    if (error) throw error;

    const invites = (data || []).filter((r) => {
      if (!isInviteRow(r)) return false;

      const currentUserId = String(user.id);

      return (
        String(r.target_user_id || "") === currentUserId ||
        String(r.invited_user_id || "") === currentUserId ||
        String(r.receiver_user_id || "") === currentUserId ||
        String(r.to_user_id || "") === currentUserId ||
        String(r.user_id || "") === currentUserId
      );
    });

    console.log("[MY_MIC_INVITES_RESULT]", invites);

    if (mountedRef.current) {
      setMyMicInvites(invites);
    }
  } catch (err) {
    console.error("[MY_MIC_INVITES_ERROR]", err);
  }
};

  const refreshMicRequestsState = async () => {
    try {
      const req = await loadMicRequests();
      if (mountedRef.current) {
        setMicRequests(req || []);
      }
      await loadMyMicInvites();
      console.log("[MIC_REQUESTS_STATE]", {
        roomId,
        pendingCount: (req || []).length
      });
    } catch (err) {
      console.error("[MIC_REQUESTS_REFRESH_ERROR]", err);
    }
  };

  const handleAcceptMyInvite = async (invite) => {
    if (!invite || !roomId) return;
    console.log('[MIC_INVITE_ACCEPT_START]', { roomId, requestId: invite.id });
    try {
      const { data, error } = await supabase.rpc('frontend_accept_mic_invite', {
        p_room_id: roomId,
        p_request_id: invite.id
      });
      console.log('[MIC_INVITE_ACCEPT_RESULT]', { data, error });
      if (error) throw error;

      toast("Invite accepted", 1200);
      await loadMyMicInvites();
      await loadMicSeats();
      await loadMicRequests();
      await loadActiveParticipants();
    } catch (err) {
      toast(err?.message || "Failed to accept invite", 1400);
    }
  };

  const handleRejectMyInvite = async (invite) => {
    if (!invite || !roomId) return;
    console.log('[MIC_INVITE_REJECT_START]', { roomId, requestId: invite.id });
    try {
      const { data, error } = await supabase.rpc('frontend_reject_mic_invite', {
        p_room_id: roomId,
        p_request_id: invite.id
      });
      console.log('[MIC_INVITE_REJECT_RESULT]', { data, error });
      if (error) throw error;

      toast("Invite rejected", 1200);
      await loadMyMicInvites();
      await loadMicSeats();
      await loadMicRequests();
      await loadActiveParticipants();
    } catch (err) {
      toast(err?.message || "Failed to reject invite", 1400);
    }
  };

  const loadCurrentPkSession = async () => {
    if (!roomId) return null;

    try {
      const { data, error } = await supabase
        .from("live_room_pk_sessions")
        .select("*")
        .eq("room_id", roomId)
        .in("status", ["pending", "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      console.log("[PK_SESSION_DB_SCORE]", {
        pkSessionId: data?.id || null,
        scoreA: Number(data?.score_a || 0),
        scoreB: Number(data?.score_b || 0),
      });

      if (mountedRef.current) {
        setPkSession(data || null);
        if (!data) {
          setPkDisplaySides({ A: [], B: [] });
          setPkScores({ A: 0, B: 0 });
        } else {
          setPkScores({
            A: Number(data?.score_a || 0),
            B: Number(data?.score_b || 0),
          });
        }
      }

      return data || null;
    } catch (err) {
      console.error("[PK_LOAD_SESSION_ERROR]", err);
      if (mountedRef.current) {
        setPkSession(null);
        setPkDisplaySides({ A: [], B: [] });
      }
      return null;
    }
  };

  const loadPkParticipants = async (pkSessionId) => {
    if (!pkSessionId) {
      if (mountedRef.current) setPkParticipants([]);
      return [];
    }

    try {
      let { data, error } = await supabase
        .from("live_room_pk_participants")
        .select("*")
        .eq("pk_session_id", pkSessionId)
        .order("seat_no", { ascending: true });

      if (error) {
        console.warn("[PK_PARTICIPANTS_SEAT_ORDER_FAILED]", error);
        const fallbackRes = await supabase
          .from("live_room_pk_participants")
          .select("*")
          .eq("pk_session_id", pkSessionId);

        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      const rows = data || [];

      let profilesMap = new Map();
      const ids = rows.map((r) => r.user_id).filter(Boolean);

      try {
        profilesMap = await fetchProfilesMap(ids);
      } catch (err) {
        console.warn("[PK_FETCH_PROFILES_MAP_FAILED]", err);
        profilesMap = new Map();
      }

      const merged = rows.map((r) => {
        const p = profilesMap.get(r.user_id);

        const matchingSeat = (effectiveSeats || []).find(
          (s) =>
            String(s.user_id) === String(r.user_id) ||
            String(s.occupant?.user_id) === String(r.user_id) ||
            String(s.seat_no) === String(r.seat_no)
        );

        const seatOccupant = matchingSeat?.occupant || null;

        return {
          ...r,
          display_name:
            p?.name ||
            p?.full_name ||
            p?.username ||
            seatOccupant?.display_name ||
            seatOccupant?.name ||
            matchingSeat?.display_name ||
            matchingSeat?.name ||
            "User",
          avatar_url:
            p?.avatar_url ||
            seatOccupant?.avatar_url ||
            matchingSeat?.avatar_url ||
            FALLBACK_AVATAR,
        };
      });

      if (mountedRef.current) {
        setPkParticipants(merged);

        const hasRealMergedData = merged.some(
          (p) =>
            (p?.display_name && p.display_name !== "User") ||
            (p?.avatar_url && p.avatar_url !== FALLBACK_AVATAR)
        );

        if (hasRealMergedData) {
          setPkDisplaySides({
            A: merged.filter((p) => p.side === "A"),
            B: merged.filter((p) => p.side === "B"),
          });
        }
      }

      console.log("[PK_PARTICIPANTS_LOADED]", {
        pkSessionId,
        count: merged.length,
        participants: merged.map((p) => ({
          user_id: p.user_id,
          side: p.side,
          seat_no: p.seat_no,
          display_name: p.display_name,
        })),
      });

      return merged;
    } catch (err) {
      console.error("[PK_LOAD_PARTICIPANTS_ERROR]", err);
      if (mountedRef.current) {
        setPkParticipants([]);
      }
      return [];
    }
  };

  const loadPkState = async () => {
    setPkLoading(true);
    try {
      const session = await loadCurrentPkSession();
      if (session?.id) {
        await loadPkParticipants(session.id);
      } else {
        if (mountedRef.current) setPkParticipants([]);
      }
      console.log("[PK_STATE_LOADED]", {
        session: session,
        participantsCount: session?.id ? undefined : 0
      });

      setTimeout(() => {
        if (!mountedRef.current) return;

        const rebuilt = rebuildPkScoresNow({
          session: pkSessionRef.current,
          participants: pkParticipantsRef.current,
          roomGiftMessagesSource: roomGiftMessagesRef.current || [],
        });

        // setPkScores(rebuilt); // REMOVED to use DB score

        console.log("[PK_SCORE_REBUILD_AFTER_LOADPKSTATE]", {
          sessionId: pkSessionRef.current?.id || null,
          participantsCount: (pkParticipantsRef.current || []).length,
          displaySidesCount:
            (pkDisplaySidesRef.current?.A || []).length +
            (pkDisplaySidesRef.current?.B || []).length,
          roomGiftMessagesCount: (roomGiftMessagesRef.current || []).length,
          rebuiltA: rebuilt?.A || 0,
          rebuiltB: rebuilt?.B || 0,
        });
      }, 0);
    } finally {
      if (mountedRef.current) setPkLoading(false);
    }
  };

  const fetchAll = async () => {
    setErr("");
    setLoading(true);

    try {
      const roomData = await loadRoomCore();
      if (!roomData) {
        return;
      }

      const joined = await ensureJoinedToRoom();

      await loadRoomRole(roomData.owner_user_id);

      if (joined) {
        await loadActiveParticipants();
        await loadMicSeats();
      }

      await loadPkState();

      try {
        const [req, msgs, mutes, role, mods, giftHistory] = await Promise.all([
          loadMicRequests(),
          fetchMessages(),
          fetchMutes(),
          fetchMyRole(),
          fetchModerators(),
          fetchGiftHistory(),
        ]);

        await loadMyMicInvites();

        if (!mountedRef.current) return;
        setMicRequests(req);
        setMessages(msgs);
        setMutesMap(mutes);
        setMyRoomRole(role);
        setModeratorsMap(mods);

        const rebuiltTotals = rebuildMicGiftTotalsFromEvents(giftHistory);
        console.log('[MIC_GIFT_TOTALS_REBUILT]', rebuiltTotals);

        const normalizedGiftHistory = normalizeGiftHistoryForRoomMessages(giftHistory);
        setRoomGiftMessages(normalizedGiftHistory);

        console.log("[PK_HISTORY_INIT]", {
          giftHistoryCount: (giftHistory || []).length,
          normalizedGiftHistoryCount: normalizedGiftHistory.length
        });

        setTimeout(() => {
          if (!mountedRef.current) return;

          const rebuilt = rebuildPkScoresNow({
            session: pkSessionRef.current,
            participants: pkParticipantsRef.current,
            roomGiftMessagesSource: normalizedGiftHistory,
          });

          // setPkScores(rebuilt); // REMOVED to use DB score

          console.log("[PK_SCORE_REBUILD_AFTER_FETCHALL]", {
            sessionId: pkSessionRef.current?.id || null,
            participantsCount: (pkParticipantsRef.current || []).length,
            displaySidesCount:
              (pkDisplaySidesRef.current?.A || []).length +
              (pkDisplaySidesRef.current?.B || []).length,
            normalizedGiftHistoryCount: normalizedGiftHistory.length,
            rebuiltA: rebuilt?.A || 0,
            rebuiltB: rebuilt?.B || 0,
          });
        }, 0);

        setMicGiftTotals((prev) => {
          const next = { ...(prev || {}) };
          Object.entries(rebuiltTotals || {}).forEach(([userId, total]) => {
            next[userId] = Math.max(Number(next[userId] || 0), Number(total || 0));
          });
          return next;
        });

        setMicGiftTotalsReady(true);
        micGiftTotalsHydratedRef.current = true;

        console.log('[MIC_GIFT_TOTALS_READY]', {
          roomId,
          ready: true,
          totalsCount: Object.keys(rebuiltTotals || {}).length
        });

        processedRoomGiftIdsRef.current.clear();

        await refreshMicRequestsState();

      } catch (innerErr) {
        console.error('[ROOM_NON_CORE_LOAD_ERROR]', innerErr);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const bootstrapMicGiftTotals = async () => {
    if (!roomId) return;

    try {
      const giftHistory = await fetchGiftHistory();
      const rebuiltTotals = rebuildMicGiftTotalsFromEvents(giftHistory);

      setMicGiftTotals((prev) => {
        const next = { ...(prev || {}) };
        Object.entries(rebuiltTotals || {}).forEach(([userId, total]) => {
          next[userId] = Math.max(Number(next[userId] || 0), Number(total || 0));
        });
        return next;
      });

      setMicGiftTotalsReady(true);
      micGiftTotalsHydratedRef.current = true;

      console.log('[MIC_GIFT_TOTALS_BOOTSTRAPPED]', {
        roomId,
        totalsCount: Object.keys(rebuiltTotals || {}).length
      });
    } catch (err) {
      console.error('[MIC_GIFT_TOTALS_BOOTSTRAP_ERROR]', err);
      setMicGiftTotalsReady(true);
      micGiftTotalsHydratedRef.current = true;
    }
  };

  const ensureJoinedToRoom = async () => {
    if (!roomId) return false;

    try {
      const { data, error } = await supabase.rpc('join_live_room', {
        p_room_id: roomId,
        p_pin: null
      });

      if (error) throw error;
      if (!data || data.success === false) {
        throw new Error(data?.error || 'Failed to join room');
      }

      setIsJoinedToRoom(true);
      await loadActiveParticipants();
      await cleanupStaleMicSeats();
      return true;
    } catch (e) {
      setIsJoinedToRoom(false);
      setErr(e?.message || 'Failed to join room');
      return false;
    }
  };

  const touchPresence = async () => {
    if (!user?.id || !roomId) return;

    try {
      await supabase
        .from("live_room_presence")
        .update({ last_seen: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("room_id", roomId);
    } catch { }
  };

  const leaveRoomPresence = async () => {
    if (!user?.id || !roomId) return;

    try {
      const { error: rpcErr } = await supabase.rpc("leave_live_room", {
        p_room_id: roomId
      });

      if (rpcErr) {
        await supabase
          .from("live_room_participants")
          .update({
            left_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString()
          })
          .eq("room_id", roomId)
          .eq("user_id", user.id);

        await supabase
          .from("live_room_presence")
          .delete()
          .eq("user_id", user.id)
          .eq("room_id", roomId);
      }

      await loadActiveParticipants();
      await cleanupStaleMicSeats();
    } catch (e) {
      console.error('[ROOM_LEAVE_ERROR]', e);
    }
  };

  const sendText = async () => {
    if (!isJoinedToRoom) {
      setErr('not_in_room');
      return;
    }

    const v = text.trim();
    if (!v || !user?.id || !roomId) return;

    setSending(true);
    setErr('');

    try {
      const { data, error } = await supabase.rpc('send_live_room_message', {
        p_room_id: roomId,
        p_content_type: 'text',
        p_content: v,
        p_attachment_url: null
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data?.error || 'Failed to send message');
      }

      setText('');
    } catch (e) {
      setErr(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const takeSeat = async (seatNo = null) => {
    if (!user?.id) return;

    const myParticipant = participantsMap[user.id] || activeParticipants.find(p => String(p.user_id) === String(user.id));
    if (!myParticipant) {
      setErr("You are not active in the room");
      return;
    }

    if (seatNo && !canModerate) {
      const seat = micSeats.find((s) => s.seat_no === seatNo);
      if (seat?.locked) {
        toast("Seat is locked", 1200);
        return;
      }
    }

    try {
      const rpcName = canModerate ? "take_mic_seat_mod_or_owner" : "take_mic_seat";
      const rpcArgs = canModerate
        ? { p_room_id: roomId, p_seat_no: seatNo }
        : { p_room_id: roomId, p_user_id: user.id, p_seat_no: seatNo };

      const { data, error } = await supabase.rpc(rpcName, rpcArgs);

      if (error) throw error;

      const ok = data?.success ?? data?.success === true;
      if (data && ok === false) throw new Error(data?.error || "Failed to take seat");

      await loadMicSeats();
    } catch (e) {
      setErr(e?.message || "Failed to take seat");
    }
  };

  const takeMicSeat = async (seatNo) => {
    if (!user?.id || !roomId || !seatNo) return;

    const myParticipant = participantsMap[user.id] || activeParticipants.find(p => String(p.user_id) === String(user.id));
    if (!myParticipant) {
      throw new Error("You are not active in the room");
    }

    if (!canModerate) {
      const seat = micSeats.find(s => s.seat_no === seatNo);
      if (seat?.locked) throw new Error("Seat is locked");
    }

    try {
      const rpcName = canModerate ? "take_mic_seat_mod_or_owner" : "take_mic_seat";
      const rpcArgs = canModerate
        ? { p_room_id: roomId, p_seat_no: seatNo }
        : { p_room_id: roomId, p_user_id: user.id, p_seat_no: seatNo };

      const { data, error } = await supabase.rpc(rpcName, rpcArgs);

      if (error) throw error;
      const ok = data?.success ?? data?.success === true;
      if (data && ok === false) throw new Error(data?.error || "Failed to take seat");

      await loadMicSeats();
    } catch (err) {
      throw err;
    }
  };

  const setRoomMicMode = async (mode) => {
    if (!roomId) return;
    const { data, error } = await supabase.rpc("set_live_room_mic_mode", {
      p_room_id: roomId,
      p_mode: mode,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to update mic mode");
    setMicMode(mode);
  };

  const setSeatLocked = async (seatNo, locked) => {
    if (!roomId || !seatNo) return;

    const { data, error } = await supabase.rpc("set_mic_seat_locked", {
      p_room_id: roomId,
      p_seat_no: seatNo,
      p_locked: !!locked,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to update seat lock");
  };

  const moveMicSeat = async (toSeatNo) => {
    if (!user?.id || !roomId || !toSeatNo) return;

    const myParticipant = participantsMap[user.id] || activeParticipants.find(p => String(p.user_id) === String(user.id));
    if (!myParticipant) {
      throw new Error("You are not active in the room");
    }

    const mySeat = (micSeats || []).find(s => String(s.user_id) === String(user.id));
    if (!mySeat) throw new Error("You are not on mic");

    const { data, error } = await supabase.rpc("move_mic_seat", {
      p_room_id: roomId,
      p_to_seat_no: Number(toSeatNo),
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to move seat");

    await loadMicSeats();
  };

  const requestMic = async () => {
    if (!user?.id) return;

    const myParticipant = participantsMap[user.id] || activeParticipants.find(p => String(p.user_id) === String(user.id));
    if (!myParticipant) {
      setErr("You are not active in the room");
      return;
    }

    if (micMode === "open") {
      takeSeat();
      return;
    }

    try {
      const { data, error } = await supabase.rpc("request_live_room_mic", {
        p_room_id: roomId,
        p_note: null
      });

      if (error) {
        if (error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('already exists') || error.code === '23505') {
          throw new Error("You already have a pending mic request");
        }
        throw error;
      }

      const ok = data?.success ?? data?.success === true;
      if (data && ok === false) {
        if (data?.error?.toLowerCase().includes('duplicate') || data?.error?.toLowerCase().includes('already exists')) {
          throw new Error("You already have a pending mic request");
        }
        throw new Error(data?.error || "Failed to request mic");
      }

      toast("Mic request sent successfully", 1400);
    } catch (e) {
      setErr(e?.message || "Failed to request mic");
    }
  };

  const removeFromMic = async (targetUserId) => {
    if (!targetUserId) return;

    if (!isOwner && String(targetUserId) === String(room?.owner_user_id)) {
      toast("Not allowed", 1200);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("remove_user_from_mic", {
        p_room_id: roomId,
        p_user_id: targetUserId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed");

      await loadMicSeats();
    } catch (e) {
      setErr(e?.message || "Failed to remove user from mic");
    }
  };

  const leaveMySeat = async (seatNo) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc("leave_mic_seat", { p_room_id: roomId });
      if (error) throw error;
      const ok = data?.success ?? data?.success === true;
      if (data && ok === false) throw new Error(data?.error || "Failed to leave seat");

      await loadMicSeats();
    } catch (e) {
      setErr(e?.message || "Failed to leave seat");
    }
  };

  const muteUser = async (targetUserId) => {
    if (!targetUserId || !user?.id) return;

    try {
      const { error } = await supabase.from("live_room_mutes").upsert(
        {
          room_id: roomId,
          user_id: targetUserId,
          muted_by: user.id,
          muted_until: null,
          is_active: true,
          revoked_at: null,
        },
        { onConflict: "room_id,user_id" }
      );
      if (error) throw error;
    } catch (e) {
      setErr(e?.message || "Failed to mute user");
    }
  };

  const unmuteUser = async (targetUserId) => {
    if (!targetUserId || !user?.id) return;

    try {
      const { error } = await supabase
        .from("live_room_mutes")
        .update({ is_active: false, revoked_at: new Date().toISOString(), muted_by: user.id })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);

      if (error) throw error;
    } catch (e) {
      setErr(e?.message || "Failed to unmute user");
    }
  };

  const assignModerator = async (targetUserId) => {
    if (!isOwner || !targetUserId) return;
    try {
      const { error } = await supabase.from("live_room_roles").upsert(
        {
          room_id: roomId,
          user_id: targetUserId,
          role: "mod",
          is_active: true,
          revoked_at: null,
          created_by: user.id
        },
        { onConflict: "room_id,user_id" }
      );
      if (error) throw error;

      await loadRoomRole();
      await loadActiveParticipants();

      const mods = await fetchModerators();
      if (mountedRef.current) setModeratorsMap(mods);
      toast("✅ Moderator assigned", 1200);
    } catch (e) {
      setErr(e?.message || "Failed to assign moderator");
    }
  };

  const removeModerator = async (targetUserId) => {
    if (!isOwner || !targetUserId) return;
    try {
      const { error } = await supabase
        .from("live_room_roles")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);
      if (error) throw error;
      const mods = await fetchModerators();
      if (mountedRef.current) setModeratorsMap(mods);
      toast("✅ Moderator removed", 1200);
    } catch (e) {
      setErr(e?.message || "Failed to remove moderator");
    }
  };

  const inviteUserToMic = async (selectedInviteUserId) => {
    if (!user?.id || !roomId) return;

    const initialTargetUserId = inviteTargetUserId || selectedInviteUserId;

    if (!initialTargetUserId) { toast("Select user first", 1200); return; }
    if (!seatMenuSeatNo) { toast("Select seat first", 1200); return; }

    const targetUser = participantsMap[initialTargetUserId] || activeParticipants.find(p => String(p.user_id) === String(initialTargetUserId));
    if (!targetUser) {
      toast("User is no longer active in the room", 1200);
      setInviteOpen(false);
      setInviteTargetUserId(null);
      closeSeatMenu();
      return;
    }

    const finalTargetUserId = targetUser?.user_id || targetUser?.id || initialTargetUserId;
    const selectedSeatNo = seatMenuSeatNo;

    const targetAlreadyOnMic = (micSeats || []).some(
      (s) => s.user_id && String(s.user_id) === String(finalTargetUserId)
    );
    if (targetAlreadyOnMic) {
      toast("User is already on mic", 1200);
      setInviteOpen(false);
      setInviteTargetUserId(null);
      closeSeatMenu();
      return;
    }

    if (isMicOpenMode) {
      const seat = micSeats.find(s => s.seat_no === selectedSeatNo);
      if (seat && !seat.user_id) {
        const { data, error } = await supabase.rpc("take_mic_seat_mod_or_owner", {
          p_room_id: roomId,
          p_seat_no: selectedSeatNo,
          p_target_user_id: finalTargetUserId
        });
        if (error) throw error;

        await loadMicSeats();

        toast("🎤 Invited user to mic", 1200);
        setInviteOpen(false);
        setInviteTargetUserId(null);
        closeSeatMenu();
        return;
      }
    }

    const existing = micRequests.find(r =>
      String(r.user_id) === String(finalTargetUserId) &&
      String(r.status).toLowerCase() === "pending" &&
      String(r.note || "").startsWith("invite|")
    );

    if (existing) { toast("Invite already sent", 1200); return; }

    try {
      console.log('[MIC_INVITE_RPC_START]', {
        roomId,
        targetUserId: finalTargetUserId,
        selectedSeatNo
      });

      const { data, error } = await supabase.rpc('send_mic_invite', {
        p_room_id: roomId,
        p_target_user_id: finalTargetUserId,
        p_seat_no: selectedSeatNo
      });

      console.log('[MIC_INVITE_RPC_RESULT]', { data, error });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'mic_invite_failed');
      }

      const req = await loadMicRequests();
      if (mountedRef.current) setMicRequests(req);

      toast("✅ Mic invite sent", 1200);
      setInviteOpen(false);
      setInviteTargetUserId(null);
      closeSeatMenu();
    } catch (err) {
      toast(err?.message || "Failed to send invite", 1400);
    }
  };

  const acceptInvite = async (inviteReq) => {
    if (!inviteReq || !user?.id || !roomId) return;
    if (String(inviteReq.user_id) !== String(user.id)) return;
    try {
      const alreadyOnMic = (micSeats || []).some(
        (s) => s.user_id && String(s.user_id) === String(user.id)
      );
      if (alreadyOnMic) {
        toast("❌ You are already on mic", 1400);
        await supabase.rpc("frontend_reject_mic_invite", { p_room_id: roomId, p_request_id: inviteReq.id });
        return;
      }

      const { data, error } = await supabase.rpc("frontend_accept_mic_invite", {
        p_room_id: roomId,
        p_request_id: inviteReq.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to accept invite");

      toast("Invite accepted", 1200);
      await loadMyMicInvites();
      await loadMicSeats();
    } catch (e) {
      toast(e?.message || "Failed", 1400);
    }
  };

  const rejectInvite = async (inviteReq) => {
    if (!inviteReq || !user?.id || !roomId) return;
    if (String(inviteReq.user_id) !== String(user.id)) return;
    try {
      const { error } = await supabase.rpc("frontend_reject_mic_invite", { p_room_id: roomId, p_request_id: inviteReq.id });
      if (error) throw error;

      toast("Invite rejected", 1200);
      await loadMyMicInvites();
    } catch (e) {
      toast(e?.message || "Failed", 1400);
    }
  };

  const acceptRequest = async (requestId) => {
    const req = micRequests.find(r => r.id === requestId);
    if (req) {
      const targetParticipant = participantsMap[req.user_id] || activeParticipants.find(p => String(p.user_id) === String(req.user_id));
      if (!targetParticipant) {
        setErr("User is no longer active in the room");
        return;
      }
    }

    try {
      const { data, error } = await supabase.rpc("approve_mic_request", {
        p_room_id: roomId,
        p_request_id: requestId,
        p_seat_no: null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to approve");
    } catch (e) {
      setErr(e?.message || "Failed to approve mic request");
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      console.log('[MIC_REQUEST_REJECT_START]', {
        requestId: requestId
      });

      const { data, error } = await supabase.rpc('frontend_reject_live_room_mic_request', {
        p_request_id: requestId,
        p_reason: 'Rejected by host'
      });

      console.log('[MIC_REQUEST_REJECT_RESULT]', { data, error });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'mic_request_reject_failed');
      }

      const req = await loadMicRequests();
      if (mountedRef.current) setMicRequests(req);
      await loadMyMicInvites();
      await loadMicSeats();

      toast("Mic request rejected", 1400);
    } catch (e) {
      setErr(e?.message || "Failed to reject mic request");
    }
  };

  const openSettings = async () => {
    if (!canModerate) return;
    setShowSettings(true);
    setSettingsTab("general");
  };

  const closeSettings = () => {
    setShowSettings(false);
    setSettingsBusy(false);
    setRoomAvatarUploading(false);
  };

  const handleRoomAvatarUpload = async (e) => {
    if (!isOwner) {
      toast("Only room owners can change the room avatar.");
      return;
    }

    console.log('[ROOM_AVATAR_UPLOAD] User is owner, proceeding with upload', {
      userId: user?.id,
      roomOwnerId: room?.owner_user_id,
      roomId
    });

    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[ROOM_AVATAR_UPLOAD] Starting upload:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      roomId,
      userId: user?.id,
      isOwner
    });

    // Validate file size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast("File size must be less than 5MB.");
      return;
    }

    setRoomAvatarUploading(true);

    try {
      const ext = getExt(file);
      const path = `${roomId}/avatar.${ext}`;

      console.log('[ROOM_AVATAR_UPLOAD] Uploading to path:', path);

      // Check if bucket exists by trying to list its contents
      console.log('[ROOM_AVATAR_UPLOAD] Checking bucket by listing contents...');
      const { data: files, error: listContentsError } = await supabase.storage
        .from('room_avatars')
        .list('', { limit: 1 });

      if (listContentsError) {
        console.error('[ROOM_AVATAR_UPLOAD] List contents error:', listContentsError);
        // If we can't list contents, bucket might not exist or no permissions
        console.log('[ROOM_AVATAR_UPLOAD] Bucket may not exist or no list permissions, trying upload anyway...');
      } else {
        console.log('[ROOM_AVATAR_UPLOAD] Bucket exists (can list contents), files found:', files?.length || 0);
      }

      // Also try the old method
      const { data: allBuckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.error('[ROOM_AVATAR_UPLOAD] List buckets error:', listError);
      } else {
        const bucketExists = allBuckets?.some(b => b.name === 'room_avatars');
        console.log('[ROOM_AVATAR_UPLOAD] Bucket in list:', bucketExists, 'All buckets:', allBuckets?.map(b => b.name));
      }

      // Try to upload to storage
      console.log('[ROOM_AVATAR_UPLOAD] Attempting upload...');
      const { error: uploadError } = await supabase.storage
        .from('room_avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('[ROOM_AVATAR_UPLOAD] Upload error:', uploadError);

        // If bucket doesn't exist, provide helpful error message
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          throw new Error('Storage bucket "room_avatars" does not exist. Please create it in your Supabase dashboard: Storage > Create bucket > Name: "room_avatars" > Make it public > Allow PNG/GIF files. See SUPABASE_BUCKETS.md for detailed instructions.');
        }

        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('[ROOM_AVATAR_UPLOAD] Upload successful');

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('room_avatars')
        .getPublicUrl(path);

      const avatarUrl = publicUrlData.publicUrl;
      console.log('[ROOM_AVATAR_UPLOAD] Public URL:', avatarUrl);

      // Update room avatar_url
      console.log('[ROOM_AVATAR_UPLOAD] Attempting database update', {
        roomId,
        avatarUrl,
        userId: user?.id,
        roomOwnerId: room?.owner_user_id
      });

      // Get current auth user to ensure it's the same
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Authentication error: ' + authError?.message);
      }
      const authUserId = authData.user.id;
      console.log('[ROOM_AVATAR_UPLOAD] Auth user ID:', authUserId, 'matches user.id:', user?.id === authUserId);

      const { error: updateError } = await supabase
        .from('live_rooms')
        .update({ avatar_url: avatarUrl })
        .eq('id', roomId)
        .eq('owner_user_id', authUserId);

      if (updateError) {
        console.error('[ROOM_AVATAR_UPLOAD] Update error:', updateError);
        throw updateError;
      }

      console.log('[ROOM_AVATAR_UPLOAD] Database update successful');

      // Update local room state
      setRoom(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);

      toast("Room avatar updated successfully!");
    } catch (error) {
      console.error('[ROOM_AVATAR_UPLOAD] Error:', error);
      toast(`Failed to upload room avatar: ${error.message}`);
    } finally {
      setRoomAvatarUploading(false);
      // Reset input
      if (roomAvatarInputRef.current) {
        roomAvatarInputRef.current.value = '';
      }
    }
  };

  const handleRoomBackgroundUpload = async (e) => {
    if (!isOwner) {
      toast("Only room owners can change the room background.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast("File size must be less than 5MB.");
      return;
    }

    setRoomBackgroundUploading(true);

    try {
      const ext = getExt(file);
      const path = `${roomId}/background.${ext}`;

      console.log('[ROOM_BACKGROUND_UPLOAD] Starting upload', { roomId, path, fileName: file.name });

      const { error: uploadError } = await supabase.storage
        .from('room_backgrounds')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('[ROOM_BACKGROUND_UPLOAD] Upload error:', uploadError);
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          throw new Error('Storage bucket "room_backgrounds" does not exist. Please create it in your Supabase dashboard or via create-buckets.sh.');
        }
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('room_backgrounds')
        .getPublicUrl(path);

      const backgroundUrl = publicUrlData?.publicUrl;
      if (!backgroundUrl) {
        throw new Error('Failed to obtain public background URL');
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Authentication error: ' + authError?.message);
      }

      const authUserId = authData.user.id;
      const { error: updateError } = await supabase
        .from('live_rooms')
        .update({ background_url: backgroundUrl })
        .eq('id', roomId)
        .eq('owner_user_id', authUserId);

      if (updateError) {
        console.error('[ROOM_BACKGROUND_UPLOAD] Update error:', updateError);
        throw updateError;
      }

      setRoom(prev => prev ? { ...prev, background_url: backgroundUrl } : prev);
      toast("Room background updated successfully!");
    } catch (error) {
      console.error('[ROOM_BACKGROUND_UPLOAD] Error:', error);
      toast(`Failed to upload room background: ${error.message}`);
    } finally {
      setRoomBackgroundUploading(false);
      if (roomBackgroundInputRef.current) {
        roomBackgroundInputRef.current.value = '';
      }
    }
  };

  const openBansTab = async () => {
    setSettingsTab("bans");
    const list = await fetchBans();
    if (mountedRef.current) setBannedList(list);
  };

  const openSeatMenu = (seatNo) => {
    setInviteOnlyMode(false);
    setInviteTargetUserId(null);
    setSeatMenuSeatNo(seatNo);
    setSeatMenuOpen(true);
  };

  const closeSeatMenu = () => {
    setSeatMenuOpen(false);
    setSeatMenuSeatNo(null);
    setInviteOpen(false);
    setInviteTargetUserId(null);
    setInviteOnlyMode(false);
  };

  const handleExitRoom = async () => {
    setLeaveRoomOpen(false);
    await stopVoice();
    await leaveRoomPresence();
    navigate("/rooms", { replace: true });
  };

  const handleResetMicGiftCounters = async () => {
    if (!roomId || !canModerate) return;

    const confirmed = window.confirm("Are you sure you want to reset the room support counters? This will start a new round for everyone.");
    if (!confirmed) return;

    console.log('[ROOM_GIFT_RESET_CONFIRMED]', { roomId });

    try {
      const { data, error } = await supabase.rpc("reset_live_room_gift_counters", {
        p_room_id: roomId
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to reset counters");

      const resetAt = data?.reset_at || new Date().toISOString();

      setMicGiftTotals({});
      setMicGiftTotalsReady(true);

      setRoom((prev) => ({
        ...(prev || {}),
        gift_counters_reset_at: resetAt
      }));

      try {
        sessionStorage.removeItem(getMicGiftTotalsStorageKey(roomId));
      } catch { }

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "gift_counters_reset",
          payload: {
            room_id: roomId,
            reset_at: resetAt,
            ts: Date.now()
          }
        });
      }

      toast("Support counters reset", 1400);

      console.log("[ROOM_GIFT_COUNTERS_RESET]", {
        roomId,
        resetAt
      });

      await fetchAll();
    } catch (err) {
      console.error("[RESET_GIFT_COUNTERS_ERROR]", err);
      toast(err?.message || "Failed to reset counters", 1400);
    }
  };

  const handleStartPkSession = async () => {
    if (!pkSession?.id || !canModerate) return;

    const input = window.prompt("Enter PK duration in minutes", "5");
    const minutes = Number(input || 0);

    if (!minutes || minutes < 1) {
      toast("Invalid PK duration", 1400);
      return;
    }

    setPkBusy(true);
    try {
      const { data, error } = await supabase.rpc("start_live_room_pk_session", {
        p_pk_session_id: pkSession.id,
        p_duration_seconds: minutes * 60,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to start PK");

      toast("PK started", 1400);
      await loadPkState();

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "pk_updated",
          payload: {
            room_id: roomId,
            pk_session_id: pkSession.id,
            ts: Date.now(),
          }
        });
      }
    } catch (err) {
      console.error("[PK_START_ERROR]", err);
      toast(err?.message || "Failed to start PK", 1400);
    } finally {
      setPkBusy(false);
    }
  };

  const handleCancelPkSession = async () => {
    if (!pkSession?.id || !canModerate) return;

    const confirmed = window.confirm("Are you sure you want to cancel this PK?");
    if (!confirmed) return;

    setPkBusy(true);
    try {
      const { data, error } = await supabase.rpc("cancel_live_room_pk_session", {
        p_pk_session_id: pkSession.id,
        p_reason: "Cancelled from room UI"
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to cancel PK");

      toast("PK cancelled", 1400);
      await loadPkState();

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "pk_updated",
          payload: {
            room_id: roomId,
            pk_session_id: pkSession.id,
            ts: Date.now(),
          }
        });
      }
    } catch (err) {
      console.error("[PK_CANCEL_ERROR]", err);
      toast(err?.message || "Failed to cancel PK", 1400);
    } finally {
      setPkBusy(false);
    }
  };

  const handleCreatePk = async () => {
    const requiredCount = getRequiredPkTeamSize(pkMode);

    const selectedSeatsA =
      pkSeatsA && pkSeatsA.length > 0
        ? pkSeatsA
        : pkSeatA
          ? [String(pkSeatA)]
          : [];

    const selectedSeatsB =
      pkSeatsB && pkSeatsB.length > 0
        ? pkSeatsB
        : pkSeatB
          ? [String(pkSeatB)]
          : [];

    if (selectedSeatsA.length !== requiredCount || selectedSeatsB.length !== requiredCount) {
      toast(`Select exactly ${requiredCount} seat(s) for each side`, 1400);
      return;
    }

    const overlap = selectedSeatsA.some((seat) => selectedSeatsB.includes(seat));
    if (overlap) {
      toast("Same seat cannot be on both sides", 1400);
      return;
    }

    const selectedA = occupiedPkEligibleSeats.filter((s) =>
      selectedSeatsA.includes(String(s.seat_no))
    );
    const selectedB = occupiedPkEligibleSeats.filter((s) =>
      selectedSeatsB.includes(String(s.seat_no))
    );

    if (selectedA.length !== requiredCount || selectedB.length !== requiredCount) {
      toast("Selected seats must have users", 1400);
      return;
    }

    setPkBusy(true);

    try {
     const endsAt = new Date(Date.now() + serverOffsetMsRef.current + pkDuration * 60000).toISOString();
      const dbMode = pkMode === "1v1" ? "1v1" : "team";

      const { data: session, error: sessionError } = await supabase
        .from("live_room_pk_sessions")
        .insert({
          room_id: roomId,
          mode: dbMode,
          status: "live",
          created_by: user.id,
          title: `${pkMode} PK Battle`,
          started_at: new Date().toISOString(),
          ends_at: endsAt,

          seat_a: Number(selectedSeatsA?.[0] || pkSeatA || null),
          seat_b: Number(selectedSeatsB?.[0] || pkSeatB || null),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("Failed to create session");
      const participantsToInsert = [
        ...selectedA.map((s) => ({
          pk_session_id: session.id,
          user_id: s.user_id,
          side: "A",
          seat_no: Number(s.seat_no),
        })),
        ...selectedB.map((s) => ({
          pk_session_id: session.id,
          user_id: s.user_id,
          side: "B",
          seat_no: Number(s.seat_no),
        })),
      ];

      const { error: participantsError } = await supabase
        .from("live_room_pk_participants")
        .insert(participantsToInsert);

      if (participantsError) throw participantsError;

      const nextDisplaySides = {
        A: selectedA.map((s) => ({
          user_id: s.occupant?.user_id || s.user_id,
          display_name: s.occupant?.display_name || s.occupant?.name || "User",
          avatar_url: s.occupant?.avatar_url || FALLBACK_AVATAR,
          seat_no: s.seat_no,
          side: "A",
        })),
        B: selectedB.map((s) => ({
          user_id: s.occupant?.user_id || s.user_id,
          display_name: s.occupant?.display_name || s.occupant?.name || "User",
          avatar_url: s.occupant?.avatar_url || FALLBACK_AVATAR,
          seat_no: s.seat_no,
          side: "B",
        })),
      };

      setPkDisplaySides(nextDisplaySides);
      setShowPkModal(false);
      setPkSeatA("");
      setPkSeatB("");
      setPkSeatsA([]);
      setPkSeatsB([]);
      setPkMode("1v1");
      setPkScores({ A: 0, B: 0 });

      toast("PK Started!", 1400);

      await loadPkState();

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "pk_updated",
          payload: {
            room_id: roomId,
            pk_session_id: session.id,
            display_sides: nextDisplaySides,
            ts: Date.now(),
          },
        });
      }
    } catch (err) {
      console.error("[PK_CREATE_ERROR]", err);
      toast(err?.message || "Failed to start PK", 1400);
    } finally {
      setPkBusy(false);
    }
  };

  const renderRoleBadge = (uid) => {
    if (!uid) return null;
    if (String(uid) === String(room?.owner_user_id)) {
      return <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">HOST</span>;
    }
    if (moderatorsMap.has(uid)) {
      return <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">MOD</span>;
    }
    return null;
  };

const syncServerClock = async () => {
  try {
    const { data } = await supabase.rpc('get_server_time_ms');
    serverOffsetMsRef.current = Number(data) - Date.now();
  } catch (err) {
    console.error('syncServerClock error:', err);
    serverOffsetMsRef.current = 0;
  }
};
useEffect(() => {
  syncServerClock();
}, []);

useEffect(() => {
  if (!pkSession?.id) return;
  if (pkSession?.status !== 'live') return;
  if (!pkSession?.ends_at) return;

  const updateRemaining = () => {
    const now = Date.now() + serverOffsetMsRef.current;
    const end = new Date(pkSession.ends_at).getTime();
    setPkRemainingMs(Math.max(0, end - now));
  };

  updateRemaining();

  if (pkTimerIntervalRef.current) {
    clearInterval(pkTimerIntervalRef.current);
  }

  pkTimerIntervalRef.current = setInterval(updateRemaining, 100);

  return () => {
    clearInterval(pkTimerIntervalRef.current);
    pkTimerIntervalRef.current = null;
  };
}, [pkSession?.id, pkSession?.status, pkSession?.ends_at]);

useEffect(() => {
  if (!pkSession?.id) return;
  if (pkSession?.status !== 'live') return;
  if (!pkSession?.end_at) return;

  const updateRemaining = () => {
    const now = Date.now() + serverOffsetMsRef.current;
    const end = new Date(pkSession.ends_at).getTime();
    setPkRemainingMs(Math.max(0, end - now));
  };

  updateRemaining();

  if (pkTimerIntervalRef.current) {
    clearInterval(pkTimerIntervalRef.current);
  }

  pkTimerIntervalRef.current = setInterval(updateRemaining, 100);

  return () => {
    clearInterval(pkTimerIntervalRef.current);
  };
}, [pkSession?.id, pkSession?.status, pkSession?.end_at]);

  useEffect(() => {
    console.log("[PK_MULTI_STATE]", {
      pkMode,
      pkSeatsA,
      pkSeatsB,
      required: getRequiredPkTeamSize(pkMode),
    });
  }, [pkMode, pkSeatsA, pkSeatsB]);

  // ==========================================
  // 7. Effects
  // ==========================================
 useEffect(() => {
  const audio = new Audio();
  audio.preload = 'auto';
  countdownAudioRef.current = audio;

  const unlockAudio = async () => {
    if (!countdownAudioRef.current || audioUnlockedRef.current) return;

    try {
      // نستخدم أي ملف فقط لفتح صلاحية الصوت في المتصفح
      countdownAudioRef.current.src = PK_AUDIO_TRACKS[0];
      countdownAudioRef.current.muted = true;
      countdownAudioRef.current.currentTime = 0;

      await countdownAudioRef.current.play();

      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.muted = false;

      audioUnlockedRef.current = true;
    } catch (err) {}
  };

  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });

  return () => {
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);

    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.src = '';
    }
  };
}, []);

useEffect(() => {
  if (!pkSession?.id) return;
  if (pkSession?.status !== 'live') return;
  if (pkRemainingMs == null) return;

  const secondsLeft = Math.ceil(pkRemainingMs / 1000);

  // أول ما تبدأ جولة جديدة نختار ملف عشوائي واحد للجولة كلها
  if (selectedPkSessionIdRef.current !== pkSession.id) {
    selectedPkSessionIdRef.current = pkSession.id;
    selectedPkAudioRef.current =
      PK_AUDIO_TRACKS[Math.floor(Math.random() * PK_AUDIO_TRACKS.length)];

    countdownStartedRef.current = false;

    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.src = selectedPkAudioRef.current;
    }
  }

  // لو رجعنا قبل آخر 10 ثواني نعمل reset فقط
  if (secondsLeft > 10) {
    countdownStartedRef.current = false;

    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }

    return;
  }

  // عند دخول آخر 10 ثواني: شغل المقطع من بدايته
  // وطوله 15 ثانية، فيكمل تلقائيًا 5 ثواني مع كارت النتيجة
  if (secondsLeft <= 10 && secondsLeft > 0 && !countdownStartedRef.current) {
    countdownStartedRef.current = true;

    if (
      countdownAudioRef.current &&
      audioUnlockedRef.current &&
      selectedPkAudioRef.current
    ) {
      countdownAudioRef.current.src = selectedPkAudioRef.current;
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.play().catch(() => {});
    }
  }
}, [pkSession?.id, pkSession?.status, pkRemainingMs]);

  useEffect(() => {
    activeParticipantsRef.current = activeParticipants || [];
  }, [activeParticipants]);

  useEffect(() => {
    participantsMapRef.current = participantsMap || {};
  }, [participantsMap]);

  useEffect(() => {
  if (!roomId) return;

  loadModerators();
}, [roomId]);

  useEffect(() => {
    pkSessionRef.current = pkSession;
  }, [pkSession]);

  useEffect(() => {
    pkParticipantsRef.current = pkParticipants;
  }, [pkParticipants]);

  useEffect(() => {
    const bottom = chatBottomRef.current;
    if (!bottom) return;

    requestAnimationFrame(() => {
      bottom.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    });
  }, [messages, roomGiftMessages, lastSentGift, joinTime]);

  useEffect(() => {
    if (!pkSession?.id) return;
    if (!(pkParticipants || []).length) return;
    if (!(effectiveSeats || []).length) return;

    const rebuiltParticipants = (pkParticipants || []).map((p) => {
      const matchingSeat = (effectiveSeats || []).find(
        (s) =>
          String(s.user_id) === String(p.user_id) ||
          String(s.occupant?.user_id) === String(p.user_id) ||
          String(s.seat_no) === String(p.seat_no)
      );

      const occ = matchingSeat?.occupant || null;

      return {
        ...p,
        display_name:
          p?.display_name && p.display_name !== "User"
            ? p.display_name
            : occ?.display_name || occ?.name || matchingSeat?.display_name || matchingSeat?.name || "User",
        avatar_url:
          p?.avatar_url && p.avatar_url !== FALLBACK_AVATAR
            ? p.avatar_url
            : occ?.avatar_url || matchingSeat?.avatar_url || FALLBACK_AVATAR,
      };
    });

    const hasBetterData = rebuiltParticipants.some(
      (p) =>
        (p?.display_name && p.display_name !== "User") ||
        (p?.avatar_url && p.avatar_url !== FALLBACK_AVATAR)
    );

    if (!hasBetterData) return;

    const changed = rebuiltParticipants.some((p, i) => {
      const oldP = (pkParticipants || [])[i];
      return (
        oldP?.display_name !== p.display_name ||
        oldP?.avatar_url !== p.avatar_url
      );
    });

    if (!changed) return;

    setPkParticipants(rebuiltParticipants);
    setPkDisplaySides({
      A: rebuiltParticipants.filter((p) => p.side === "A"),
      B: rebuiltParticipants.filter((p) => p.side === "B"),
    });
  }, [pkSession?.id, pkParticipants, effectiveSeats]);

  useEffect(() => {
    const nextSides = {
      A: (pkParticipants || []).filter((p) => p.side === "A"),
      B: (pkParticipants || []).filter((p) => p.side === "B"),
    };

    const nextTotal = (nextSides.A?.length || 0) + (nextSides.B?.length || 0);
    const currentTotal =
      (pkDisplaySides?.A?.length || 0) + (pkDisplaySides?.B?.length || 0);

    // لا تصفر، ولا تستبدل إلا لو المشاركين أكثر أو مساويين
    if (nextTotal === 0) return;
    if (nextTotal < currentTotal) return;

    setPkDisplaySides(nextSides);
  }, [pkParticipants]);

  useEffect(() => {
    pkDisplaySidesRef.current = pkDisplaySides || { A: [], B: [] };
  }, [pkDisplaySides]);

  useEffect(() => {
    pkSessionRef.current = pkSession;
  }, [pkSession]);

  useEffect(() => {
    pkParticipantsRef.current = pkParticipants;
  }, [pkParticipants]);

  useEffect(() => {
    pkDisplaySidesRef.current = pkDisplaySides || { A: [], B: [] };
  }, [pkDisplaySides]);

  useEffect(() => {
    if (!pkSession?.seat_a && !pkSession?.seat_b) return;
    if (!effectiveSeats.length) return;

    const sides = buildPkDisplaySidesFromSeats(
      pkSession.seat_a,
      pkSession.seat_b,
      effectiveSeats
    );

    const hasAnySide =
      (sides?.A?.length || 0) > 0 ||
      (sides?.B?.length || 0) > 0;

    if (!hasAnySide) return;

    setPkDisplaySides(sides);
    pkDisplaySidesRef.current = sides;

    console.log("[PK_REBUILT_FROM_EFFECTIVE_SEATS]", sides);
  }, [effectiveSeats, pkSession?.id, pkSession?.seat_a, pkSession?.seat_b]);

  useEffect(() => {
    roomGiftMessagesRef.current = roomGiftMessages || [];
  }, [roomGiftMessages]);

  useEffect(() => {
    micGiftTotalsHydratedRef.current = false;
    setMicGiftTotalsReady(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !user?.id) return;

    startVoice();

    return () => {
      if (miniRoomActiveRef.current) return;
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  useEffect(() => {
    const lkRoom = livekitRoomRef.current;
    if (!lkRoom || voiceStatus !== "connected") return;

    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const levels = {};

      try {
        const lp = lkRoom.localParticipant;
        if (lp?.identity) {
          const level = Number(lp.audioLevel || 0);
          const speakingBoost = lp.isSpeaking ? Math.max(level, 0.18) : level;
          levels[String(lp.identity)] = speakingBoost;
        }

        lkRoom.remoteParticipants.forEach((p) => {
          const level = Number(p?.audioLevel || 0);
          const speakingBoost = p?.isSpeaking ? Math.max(level, 0.18) : level;
          levels[String(p.identity)] = speakingBoost;
        });
      } catch { }

      setActiveSpeakers((prev) => {
        const next = {};
        const ids = new Set([
          ...Object.keys(prev || {}),
          ...Object.keys(levels || {}),
        ]);

        ids.forEach((id) => {
          const prevLevel = Number(prev?.[id] || 0);
          const rawLevel = Number(levels?.[id] || 0);

          const smoothed =
            rawLevel > prevLevel
              ? prevLevel * 0.35 + rawLevel * 0.65
              : prevLevel * 0.82 + rawLevel * 0.18;

          if (smoothed > 0.02) {
            next[id] = smoothed;
          }
        });

        return next;
      });
    };

    tick();
    const interval = setInterval(tick, 120);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [voiceStatus]);

  useEffect(() => {
    const lkRoom = livekitRoomRef.current;
    if (!lkRoom || !user?.id) return;

    const mySeat = (micSeats || []).find(
      (s) => s.user_id && String(s.user_id) === String(user.id)
    );

    const shouldEnableMic = !!mySeat && !isMicMuted;

    console.log('[VOICE_SYNC_SHOULD_ENABLE]', {
      isOnSeat: !!mySeat,
      isMicMuted,
      shouldEnableMic
    });

    if (lkRoom.localParticipant) {
      lkRoom.localParticipant.setMicrophoneEnabled(shouldEnableMic).catch((e) => {
        console.error("[VOICE] sync mic state failed", e);
      });
    }
  }, [user?.id, isMicMuted, (micSeats || []).map((s) => `${s.seat_no}:${s.user_id || ""}`).join("|")]);

  useEffect(() => {
    const lkRoom = livekitRoomRef.current;
    if (!lkRoom || voiceStatus !== "connected") return;

    const syncMutedState = () => {
      const next = {};

      try {
        const localMicPub = lkRoom.localParticipant?.getTrackPublication?.("microphone");
        if (lkRoom.localParticipant?.identity) {
          next[String(lkRoom.localParticipant.identity)] = !!localMicPub?.isMuted;
        }

        lkRoom.remoteParticipants.forEach((p) => {
          const micPub = p?.getTrackPublication?.("microphone");
          if (p?.identity) {
            next[String(p.identity)] = !!micPub?.isMuted;
          }
        });
      } catch (e) {
        console.error("[VOICE] sync muted users failed", e);
      }

      setMutedUsers(next);
    };

    syncMutedState();

    lkRoom.on("localTrackPublished", syncMutedState);
    lkRoom.on("localTrackUnpublished", syncMutedState);
    lkRoom.on("trackPublished", syncMutedState);
    lkRoom.on("trackUnpublished", syncMutedState);
    lkRoom.on("participantConnected", syncMutedState);
    lkRoom.on("participantDisconnected", syncMutedState);
    lkRoom.on("trackMuted", syncMutedState);
    lkRoom.on("trackUnmuted", syncMutedState);

    const interval = setInterval(syncMutedState, 1000);

    return () => {
      lkRoom.off("localTrackPublished", syncMutedState);
      lkRoom.off("localTrackUnpublished", syncMutedState);
      lkRoom.off("trackPublished", syncMutedState);
      lkRoom.off("trackUnpublished", syncMutedState);
      lkRoom.off("participantConnected", syncMutedState);
      lkRoom.off("participantDisconnected", syncMutedState);
      lkRoom.off("trackMuted", syncMutedState);
      lkRoom.off("trackUnmuted", syncMutedState);
      clearInterval(interval);
    };
  }, [voiceStatus]);

  useEffect(() => {
    const onVis = () => {
      if (!user?.id) return;
      if (document.visibilityState === "visible") ensureJoinedToRoom();
      else touchPresence();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId || !user?.id || !isJoinedToRoom) return;

    const interval = setInterval(async () => {
      try {
        await supabase
          .from('live_room_participants')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .is('left_at', null);
      } catch (err) {
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [roomId, user?.id, isJoinedToRoom]);

  useEffect(() => {
    if (!roomId || !user?.id) {
      return () => {
        mountedRef.current = false;
        if (repeatHideTimerRef.current) clearTimeout(repeatHideTimerRef.current);
      };
    }

    mountedRef.current = true;

    const init = async () => {
      fetchAll();
    };

    init();

    const heartbeat = setInterval(async () => {
      await touchPresence();
    }, 20000);

    const onBeforeUnload = () => {
      if (miniRoomActiveRef.current) return;
      leaveRoomPresence();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      mountedRef.current = false;
      if (repeatHideTimerRef.current) clearTimeout(repeatHideTimerRef.current);
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (miniRoomActiveRef.current) return;
      leaveRoomPresence();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId) return;
    if (!micGiftTotalsHydratedRef.current) return;

    try {
      sessionStorage.setItem(
        getMicGiftTotalsStorageKey(roomId),
        JSON.stringify(micGiftTotals || {})
      );
    } catch { }
  }, [roomId, micGiftTotals]);

  useEffect(() => {
    if (!roomId) return;

    try {
      const raw = sessionStorage.getItem(getMicGiftTotalsStorageKey(roomId));
      if (!raw) {
        micGiftTotalsHydratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        setMicGiftTotals(parsed);
        console.log('[MIC_GIFT_TOTALS_LOADED_FROM_SESSION]', parsed);
      }

      micGiftTotalsHydratedRef.current = true;
    } catch {
      micGiftTotalsHydratedRef.current = true;
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    if (!isJoinedToRoom) return;
    if (!room?.id) return;

    bootstrapMicGiftTotals();
  }, [roomId, isJoinedToRoom, room?.id, room?.gift_counters_reset_at]);

  useEffect(() => {
    const effectivePkParticipants =
      (pkParticipants || []).length > 0
        ? pkParticipants
        : [
          ...(pkDisplaySides?.A || []),
          ...(pkDisplaySides?.B || []),
        ];

    console.log("[PK_REBUILD_SOURCE]", {
      sessionId: pkSession?.id || null,
      participantsCount: (pkParticipants || []).length,
      displaySidesCount: ((pkDisplaySides?.A || []).length + (pkDisplaySides?.B || []).length),
      effectiveCount: effectivePkParticipants.length
    });

    if (!pkSession?.id || !effectivePkParticipants.length) return;

    const normalizedEventsSource = roomGiftMessages || [];

    const rebuilt = getPkScoreFromEvents(
      normalizedEventsSource,
      pkSession,
      effectivePkParticipants
    );

    console.log("[PK_SCORE_REBUILD_ON_LOAD]", {
      sessionId: pkSession?.id || null,
      participantsCount: effectivePkParticipants.length,
      roomGiftMessagesCount: (roomGiftMessages || []).length,
      rebuiltA: rebuilt?.A || 0,
      rebuiltB: rebuilt?.B || 0
    });

    // setPkScores(rebuilt); // REMOVED to use DB score
  }, [pkSession?.id, pkSession?.started_at, pkSession?.ends_at, pkSession?.status, pkParticipants, pkDisplaySides, roomGiftMessages]);

  useEffect(() => {
    if (!pkSession?.id) {
      setPkScores({ A: 0, B: 0 });
    }
  }, [pkSession?.id]);

  useEffect(() => {
  if (!pkSession?.id) return;
  const t = setTimeout(() => {
    pkFinishTriggeredRef.current = false;
  }, 500); // 500ms كافية إن الـ timer يبدأ
  return () => clearTimeout(t);

}, [pkSession?.id]);
 useEffect(() => {
  if (!pkSession?.id) return;

  // اقفل النتيجة فقط عند بداية PK جديدة أو أثناء التحضير
  if (
    (pkSession?.status === "pending" || pkSession?.status === "live") &&
    !pkResultData
  ) {
    setPkResultOpen(false);
  }
}, [pkSession?.id, pkSession?.status, pkResultData]);

 useEffect(() => {
  if (!pkSession?.id) return;
  if (pkSession.status !== "live") return;
  if (pkFinishTriggeredRef.current) return;

  // تأكد إن الوقت خلص فعلاً من خلال ends_at مباشرةً
  if (pkSession?.ends_at) {
    const endsMs = new Date(pkSession.ends_at).getTime();
    const now = Date.now() + (serverOffsetMsRef.current || 0);
    if (endsMs > now) return; // الجولة لسه شغالة
  } else {
    if (pkRemainingMs > 0) return;
  }

  const finishPk = async () => {
    let winnerSide = "draw";
    if (pkScores.A > pkScores.B) winnerSide = "A";
    else if (pkScores.B > pkScores.A) winnerSide = "B";

    let winnerUserId = null;
    if (winnerSide !== "draw") {
      const participants =
        (pkParticipants || []).length > 0
          ? pkParticipants
          : (pkDisplaySides?.[winnerSide] || []);

      const winner = participants.find((p) => p.side === winnerSide);
      if (winner) {
        winnerUserId = winner.user_id || winner.id;
      }
    }

    console.log("[PK_FINISH_RESULT]", {
      pkSessionId: pkSession.id,
      winnerSide,
      scoreA: Number(pkScores?.A || 0),
      scoreB: Number(pkScores?.B || 0),
      winnerUserId: winnerUserId || null,
    });

    const finalResult = {
      winnerSide,
      scoreA: Number(pkScores?.A || 0),
      scoreB: Number(pkScores?.B || 0),
      session: pkSession,
      sideAPlayers: (pkSideA || []).map((p) => ({
        user_id: p.user_id || p.id,
        display_name: p.display_name || p.name || "User",
        avatar_url: p.avatar_url || FALLBACK_AVATAR,
        seat_no: p.seat_no,
        side: "A",
      })),
      sideBPlayers: (pkSideB || []).map((p) => ({
        user_id: p.user_id || p.id,
        display_name: p.display_name || p.name || "User",
        avatar_url: p.avatar_url || FALLBACK_AVATAR,
        seat_no: p.seat_no,
        side: "B",
      })),
    };

    try {
      const { error } = await supabase.rpc("finish_live_room_pk_session", {
        p_pk_session_id: pkSession.id,
        p_winner_side: winnerSide,
        p_winner_user_id: winnerUserId,
      });

      if (error) throw error;

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "pk_updated",
          payload: {
            room_id: roomId,
            pk_session_id: pkSession.id,
            ts: Date.now(),
          },
        });

        await channelRef.current.send({
          type: "broadcast",
          event: "pk_result",
          payload: {
            room_id: roomId,
            pk_session_id: pkSession.id,
            result: finalResult,
            ts: Date.now(),
          },
        });
      }

      setTimeout(() => {
        loadPkState();
      }, 300);
    } catch (err) {
      console.error("[PK_FINISH_ERROR]", err);
    }
  };

  // ✅ بعد تعريف finishPk
  pkFinishTriggeredRef.current = true;
  finishPk();

}, [
  pkSession?.id,
  pkSession?.status,
  pkSession?.ends_at,
  pkRemainingMs,
  pkScores,
  pkParticipants,
  pkDisplaySides,
  pkSideA,
  pkSideB,
  roomId,
]);

  useEffect(() => {
    if (!roomId) return;

    mountedRef.current = true;

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const ppl = await loadActiveParticipants();
          const [, req, msgs, mutes] = await Promise.all([
            loadMicSeats(),
            loadMicRequests(),
            fetchMessages(),
            fetchMutes(),
          ]);
          if (!mountedRef.current) return;
          setMicRequests(req);
          setMessages(msgs);
          setMutesMap(mutes);

          const currentIds = new Set((ppl || []).map((x) => String(x.user_id)));
          const prevIds = lastJoinIdsRef.current || new Set();

          (ppl || []).forEach((p) => {
            const id = String(p.user_id);
            if (!prevIds.has(id)) {
              if (user?.id && String(user.id) !== id) {
                try { pushJoinNotif(p); } catch { }
              }
            }
          });

          lastJoinIdsRef.current = currentIds;
        } catch {
        }
      }, 2500);
    };

    const cleanupChannel = async () => {
      try {
        if (channelRef.current) {
          try { await channelRef.current.unsubscribe(); } catch { }
          try { await supabase.removeChannel(channelRef.current); } catch { }
          channelRef.current = null;
        }
        if (messagesChannelRef.current) {
          try { await messagesChannelRef.current.unsubscribe(); } catch { }
          try { await supabase.removeChannel(messagesChannelRef.current); } catch { }
          messagesChannelRef.current = null;
        }
        if (participantsChannelRef.current) {
          try { await participantsChannelRef.current.unsubscribe(); } catch { }
          try { await supabase.removeChannel(participantsChannelRef.current); } catch { }
          participantsChannelRef.current = null;
        }
        if (micSeatsChannelRef.current) {
          try { await micSeatsChannelRef.current.unsubscribe(); } catch { }
          try { await supabase.removeChannel(micSeatsChannelRef.current); } catch { }
          micSeatsChannelRef.current = null;
        }
        if (micRequestsChannelRef.current) {
          try { await micRequestsChannelRef.current.unsubscribe(); } catch { }
          try { await supabase.removeChannel(micRequestsChannelRef.current); } catch { }
          micRequestsChannelRef.current = null;
        }
      } catch { }
    };

    const run = async () => {
      if (rtRoomIdRef.current !== roomId) {
        rtRoomIdRef.current = roomId;
        rtStartedRef.current = false;
        lastJoinIdsRef.current = new Set();
      }

      startPolling();

      if (rtStartedRef.current) return;
      rtStartedRef.current = true;

      await cleanupChannel();

      const ch = supabase.channel(`lr_${roomId}`, {
        config: {
          broadcast: { self: true },
        },
      });

      console.log("[ROOM_GIFT_RT_MODE]", {
        mode: "broadcast_only",
        roomId
      });

      console.log("[ROOM_GIFT_PK_MODE]", {
        roomId,
        giftBroadcastMode: "ui_only_for_receivers",
        localSendMode: "authoritative_pk_write",
      });

      ch.on("broadcast", { event: "kick" }, async ({ payload }) => {
        try {
          const targetId = payload?.user_id;
          if (!targetId || !user?.id) return;
          if (String(targetId) !== String(user.id)) return;

          await leaveRoomPresence();

          if (payload?.isBan) setErr("⛔ You have been banned from this room.");
          else if (payload?.until) setErr(`👢 You were kicked until ${new Date(payload.until).toLocaleString()}`);
          else setErr("👢 You were kicked.");

          setTimeout(() => navigate("/rooms", { replace: true }), 600);
        } catch { }
      });

      ch.on("broadcast", { event: "gift" }, async ({ payload }) => {
        try {
          console.log("[ROOM_GIFT_BROADCAST_RECEIVED]", payload);

          const eventId = payload?.event_id;
          const payloadRoomId = payload?.room_id;
          const qty = payload?.quantity || 1;

          if (!eventId) return;
          if (payloadRoomId && String(payloadRoomId) !== String(roomId)) return;

          await handleIncomingRoomGiftEvent(eventId, 0, qty, false);
        } catch (err) {
          console.error("[ROOM_GIFT_BROADCAST_ERROR]", err);
        }
      });

      ch.on("broadcast", { event: "gift_counters_reset" }, async ({ payload }) => {
        try {
          if (payload?.room_id && String(payload.room_id) !== String(roomId)) return;

          const resetAt = payload?.reset_at || new Date().toISOString();

          setMicGiftTotals({});
          setMicGiftTotalsReady(true);
          setRoom((prev) => ({
            ...(prev || {}),
            gift_counters_reset_at: resetAt
          }));

          try {
            sessionStorage.removeItem(getMicGiftTotalsStorageKey(roomId));
          } catch { }

          await fetchAll();
        } catch (err) {
          console.error("[ROOM_GIFT_COUNTERS_RESET_BROADCAST_ERROR]", err);
        }
      });

      ch.on("broadcast", { event: "pk_score_updated" }, async ({ payload }) => {
        try {
          if (payload?.room_id && String(payload.room_id) === String(roomId)) {
            setPkScores({
              A: Number(payload?.score_a || 0),
              B: Number(payload?.score_b || 0),
            });
          }
        } catch (err) {
          console.error("[PK_SCORE_UPDATED_BROADCAST_ERROR]", err);
        }
      });

      ch.on("broadcast", { event: "pk_updated" }, async ({ payload }) => {
        try {
          if (payload?.room_id && String(payload.room_id) === String(roomId)) {
            console.log("[PK_BROADCAST_DISPLAY_SYNC]", {
              hasDisplaySides: !!payload?.display_sides,
              displaySides: payload?.display_sides || null
            });
            if (payload?.display_sides) {
              setPkDisplaySides(payload.display_sides);
            }
            await loadPkState();
            await loadCurrentPkSession();
          }
        } catch (err) {
          console.error("[PK_UPDATED_BROADCAST_ERROR]", err);
        }
      });

      ch.on("broadcast", { event: "pk_result" }, async ({ payload }) => {
        try {
          console.log("[PK_RESULT_BROADCAST_RECEIVED]", {
            roomId,
            payloadRoomId: payload?.room_id || null,
            winnerSide: payload?.result?.winnerSide || null,
            scoreA: payload?.result?.scoreA || 0,
            scoreB: payload?.result?.scoreB || 0,
            sideACount: (payload?.result?.sideAPlayers || []).length,
            sideBCount: (payload?.result?.sideBPlayers || []).length,
          });

          if (payload?.room_id && String(payload.room_id) === String(roomId)) {
            if (payload?.result) {
              setPkResultData(payload.result);
              setPkResultOpen(true);
            }
          }
        } catch (err) {
          console.error("[PK_RESULT_BROADCAST_ERROR]", err);
        }
      });

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_mic_seats", filter: `room_id=eq.${roomId}` },
        async () => {
          try {
            await loadMicSeats();
          } catch { }
        }
      );

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_presence", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          try {
            const ppl = await loadActiveParticipants();

            if (payload?.eventType === "INSERT") {
              const uid = payload?.new?.user_id;
              if (uid) {
                const joined = ppl.find((x) => String(x.user_id) === String(uid));
                if (joined) pushJoinNotif(joined);
              }
            }
          } catch { }
        }
      );

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_mutes", filter: `room_id=eq.${roomId}` },
        async () => {
          try {
            const m = await fetchMutes();
            if (mountedRef.current) setMutesMap(m);
          } catch { }
        }
      );

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_roles", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          try {
            await loadRoomRole();
          } catch { }
        }
      );

      channelRef.current = ch;

      ch.subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === "SUBSCRIBED") {
          setRtStatus("SUBSCRIBED");
          stopPolling();
        } else if (status === "CLOSED") {
          setRtStatus("CLOSED");
          startPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRtStatus("ERROR");
          startPolling();
        }
      });

      const messagesChannel = supabase
        .channel(`live-room-messages-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_room_messages',
            filter: `room_id=eq.${roomId}`
          },
          async (payload) => {
            try {
              if (payload.new) {
                const senderUserId = payload.new.sender_user_id;
                let senderProfile = null;

                if (senderUserId) {
                  const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, display_name, avatar_url, photo_url, profile_image')
                    .eq('id', senderUserId)
                    .maybeSingle();

                  if (!profileError) {
                    senderProfile = profileData;
                  }
                }

                const newMsg = {
                  id: payload.new.id,
                  room_id: payload.new.room_id,
                  sender_user_id: payload.new.sender_user_id,
                  content_type: payload.new.content_type,
                  content: payload.new.content,
                  attachment_url: payload.new.attachment_url || null,
                  created_at: payload.new.created_at,
                  sender_name:
                    senderProfile?.full_name ||
                    senderProfile?.username ||
                    senderProfile?.display_name ||
                    'User',
                  sender_avatar:
                    senderProfile?.avatar_url ||
                    senderProfile?.photo_url ||
                    senderProfile?.profile_image ||
                    null
                };

                if (mountedRef.current) {
                  setMessages((prev) => {
                    const exists = prev.some((m) => String(m.id) === String(newMsg.id));
                    if (exists) return prev;
                    return [...prev, newMsg];
                  });
                }
              }

              const msgs = await fetchMessages();
              if (mountedRef.current) setMessages(msgs);

            } catch { }
          }
        )
        .subscribe();

      messagesChannelRef.current = messagesChannel;

      const participantsChannel = supabase
        .channel(`live-room-participants-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_room_participants',
            filter: `room_id=eq.${roomId}`
          },
          async (payload) => {
            const userId = payload.new?.user_id;
            await loadActiveParticipants();

            let displayName = "User";
            let avatarUrl = null;

            if (userId) {
              const joinedUser =
                participantsMapRef.current?.[String(userId)] ||
                activeParticipantsRef.current.find(p => String(p.user_id) === String(userId)) ||
                null;

              let profileRow = null;
              if (!joinedUser) {
                const { data } = await supabase
                  .from('profiles')
                  .select('id, name, avatar_url')
                  .eq('id', userId)
                  .limit(1)
                  .maybeSingle();
                profileRow = data;
              }

              displayName =
                joinedUser?.display_name ||
                joinedUser?.full_name ||
                joinedUser?.raw_profile?.name ||
                profileRow?.name ||
                'User';

              avatarUrl =
                joinedUser?.avatar_url ||
                joinedUser?.raw_profile?.avatar_url ||
                profileRow?.avatar_url ||
                null;
            }

            if (userId && (!user?.id || String(userId) !== String(user.id))) {
              toast(`${displayName} joined the room`, 1400);
              pushJoinNotif({ user_id: userId, display_name: displayName, avatar_url: avatarUrl });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'live_room_participants',
            filter: `room_id=eq.${roomId}`
          },
          async (payload) => {
            if (payload.new?.left_at === null && payload.old?.left_at !== null) {
              const userId = payload.new?.user_id;
              await loadActiveParticipants();

              let displayName = "User";
              let avatarUrl = null;

              if (userId) {
                const joinedUser =
                  participantsMapRef.current?.[String(userId)] ||
                  activeParticipantsRef.current.find(p => String(p.user_id) === String(userId)) ||
                  null;

                let profileRow = null;
                if (!joinedUser) {
                  const { data } = await supabase
                    .from('profiles')
                    .select('id, name, avatar_url')
                    .eq('id', userId)
                    .limit(1)
                    .maybeSingle();
                  profileRow = data;
                }

                displayName =
                  joinedUser?.display_name ||
                  joinedUser?.full_name ||
                  joinedUser?.raw_profile?.name ||
                  profileRow?.name ||
                  'User';

                avatarUrl =
                  joinedUser?.avatar_url ||
                  joinedUser?.raw_profile?.avatar_url ||
                  profileRow?.avatar_url ||
                  null;
              }

              if (userId && (!user?.id || String(userId) !== String(user.id))) {
                toast(`${displayName} joined the room`, 1400);
                pushJoinNotif({ user_id: userId, display_name: displayName, avatar_url: avatarUrl });
              }
            } else if (payload.new?.left_at && !payload.old?.left_at) {
              await loadActiveParticipants();
            }
          }
        )
        .subscribe();

      participantsChannelRef.current = participantsChannel;

      const micSeatsChannel = supabase
        .channel(`live-room-mic-seats-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_room_mic_seats',
            filter: `room_id=eq.${roomId}`
          },
          async () => {
            try {
              await loadMicSeats();
            } catch { }
          }
        )
        .subscribe();

      micSeatsChannelRef.current = micSeatsChannel;

      const micRequestsChannel = supabase
        .channel(`live-room-mic-requests-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_room_mic_requests',
            filter: `room_id=eq.${roomId}`
          },
          async () => {
            await refreshMicRequestsState();
          }
        )
        .subscribe();

      micRequestsChannelRef.current = micRequestsChannel;
    };

    run();

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (miniRoomActiveRef.current) return;
      cleanupChannel();
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    if (!canModerate) return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      await refreshMicRequestsState();
    };

    tick();
    const id = setInterval(tick, 3000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [roomId, user?.id, canModerate]);
  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();

      if (leaveRoomOpen) {
        setLeaveRoomOpen(false);
        window.history.pushState(null, "", window.location.href);
        return;
      }

      setLeaveRoomOpen(true);
      window.history.pushState(null, "", window.location.href);
    };

    // أول ما الصفحة تفتح
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, []);

  // ==========================================
  // 8. Early Returns
  // ==========================================
  if (loading) {
    return (
      <div className="fixed inset-0 w-screen overflow-hidden overscroll-none bg-gray-50 flex flex-col items-center justify-center p-6" style={fullscreenRoomStyle}>
        <div className="bg-white border rounded-xl p-10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-slate-600">Loading room…</span>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="fixed inset-0 w-screen overflow-hidden overscroll-none bg-gray-50 flex flex-col p-6" style={fullscreenRoomStyle}>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 shrink-0">Room not found</div>
      </div>
    );
  }

  // ==========================================
  // 9. Render Variables
  // ==========================================
  const isSelfCard = !!(user?.id && selectedUserId && String(user.id) === String(selectedUserId));
  const isTargetOwner = !!(selectedUserId && room?.owner_user_id && String(selectedUserId) === String(room.owner_user_id));
  const canShowOwnerTools = canModerate && !isSelfCard && (isOwner || !isTargetOwner);

  const cardName = selectedUserProfile?.name || selectedUserProfile?.display_name || selectedUserProfile?.full_name || "User";
  const cardAvatar = selectedUserProfile?.avatar_url || FALLBACK_AVATAR;
  const cardVip = isVipActive(selectedUserProfile);
  const cardVerified = !!selectedUserProfile?.verified;
  const cardPlan = selectedUserProfile?.plan || "free";
  const cardIsMod = !!selectedUserIsMod;
  console.log("selectedUserIsMod:", selectedUserIsMod);
  const cardAge = selectedUserProfile?.age ?? null;
  const cardGender = selectedUserProfile?.gender ?? null;
  const cardCountry = selectedUserProfile?.country ?? null;
  const cardLiving = selectedUserProfile?.living_in ?? null;
  const cardOcc = selectedUserProfile?.occupation ?? null;

  const targetMute = selectedUserId ? mutesMap.get(selectedUserId) : null;
  const targetMutedActive =
    !!targetMute?.is_active && (!targetMute?.muted_until || new Date(targetMute.muted_until).getTime() > Date.now());

  const myMute = user?.id ? mutesMap.get(user.id) : null;
  const myMutedActive =
    !!myMute?.is_active && (!myMute?.muted_until || new Date(myMute.muted_until).getTime() > Date.now());

  const seatMenuSeatLocked = !!effectiveSeats.find(s => s.seat_no === seatMenuSeatNo)?.locked;

  const combinedMessages = [...messages, ...roomGiftMessages]
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const visibleMessages = combinedMessages.filter(m => new Date(m.created_at).getTime() >= joinTime);

  const myIncomingInvites = (myMicInvites || []).filter(invite =>
    String(invite.user_id) === String(user?.id) &&
    String(invite.status || '').toLowerCase() === 'pending' &&
    String(invite.note || '').startsWith('invite|')
  );

  console.log('[MY_MIC_INVITES_CURRENT_USER_ID]', user?.id);
  console.log('[MY_MIC_INVITES_FILTERED_FOR_CURRENT_USER]', myIncomingInvites);

  if (miniRoomMode) {
    return (
      <div className="fixed inset-0 w-screen overflow-hidden overscroll-none bg-gray-50 flex flex-col p-4" style={fullscreenRoomStyle}>
        <div className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">Leave room?</div>

                <button
                  onClick={() => setLeaveRoomOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-500 truncate">Live room is running</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setMiniRoomMode(false)}>
              Return to room
            </Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" size="sm" onClick={handleExitRoom}>
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 10. Return JSX
  // ==========================================
  if (pkSession) {
    console.log("[PK_PANEL_RENDER]", {
      sideA: pkSideA?.map(p => ({ name: p.display_name, seat: p.seat_no })),
      sideB: pkSideB?.map(p => ({ name: p.display_name, seat: p.seat_no }))
    });
  }

  console.log("[PK_RESULT_MODAL_STATE]", {
    pkSessionId: pkSession?.id || null,
    pkSessionStatus: pkSession?.status || null,
    pkResultOpen,
    hasResultData: !!pkResultData,
  });

  return (
    <div className="fixed inset-0 w-screen overflow-hidden overscroll-none bg-gray-50 flex flex-col"
         style={{
           backgroundImage: room?.background_url ? `url(${room.background_url})` : undefined,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat'
         }}>
      <style>{SPARKLE_CSS}</style>
      {room?.background_url ? <div className="fixed inset-0 bg-black/40 pointer-events-none z-0" /> : null}
      {roomGiftEffects.length > 0 ? (
        <div className="fixed inset-0 z-[65] pointer-events-none flex flex-col items-center justify-start pt-24 gap-4">
          {roomGiftEffects.map((effect) => {
            const isSmall = isSmallRoomGift(effect);
            console.log('[ROOM_GIFT_EFFECT_RENDER_MODE]', {
              giftName: effect?.gift_name,
              price: effect?.price || effect?.coins_spent || effect?.gift_cost || effect?.cost || 0,
              small: isSmall,
            });

            const assetUrl = effect?.animation_asset_url?.toString().trim() || effect?.overlay_image_url?.toString().trim() || effect?.icon_url?.toString().trim() || '';
            const animationType = effect?.animation_type?.toString().trim().toLowerCase() || 'floating';
            const hasAsset = !!assetUrl;

            const levelClass = effect.effect_level === "global" ? "scale-125" : effect.effect_level === "medium" ? "scale-110" : "scale-90";

            if (isSmall) {
              if (effect.targetPosition) {
                const isMoving = effect.startMotion;
                return (
                  <div
                    key={effect.id}
                    style={{
                      position: 'fixed',
                      left: isMoving ? effect.targetPosition.x : '50%',
                      top: isMoving ? effect.targetPosition.y : 'calc(100vh - 140px)',
                      transform: isMoving ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.5)',
                      opacity: isMoving ? 1 : 0,
                      transition: 'all 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                      zIndex: 9999,
                      pointerEvents: 'none'
                    }}
                  >
                    <div className="animate-[bounce_1s_ease-in-out_infinite]">
                      {hasAsset ? (
                        <img
                          src={assetUrl}
                          alt={effect?.gift_name || 'gift animation'}
                          className="w-16 h-16 object-contain cursor-pointer pointer-events-auto drop-shadow-lg"
                          onClick={() => {
  const user =
    activeParticipantsRef.current?.find(
      (x) => String(x.user_id) === String(effect.sender_id)
    ) || null;

  openUserCard(effect.sender_id, user);
}}
                        />
                      ) : (
                        <span
                          className="text-4xl cursor-pointer pointer-events-auto drop-shadow-lg"
                          onClick={() => {
  const user =
    activeParticipantsRef.current?.find(
      (x) => String(x.user_id) === String(effect.sender_id)
    ) || null;

  openUserCard(effect.sender_id, user);
}}
                        >🌹</span>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={effect.id} className={`animate-in slide-in-from-bottom-12 fade-in duration-1000 shrink-0 pointer-events-none ${levelClass}`}>
                  <div className="animate-[bounce_2s_ease-in-out_infinite]">
                    {hasAsset ? (
                      <img
                        src={assetUrl}
                        alt={effect?.gift_name || 'gift animation'}
                        className="w-20 h-20 object-contain cursor-pointer pointer-events-auto drop-shadow-lg"
                        onClick={() => openUserCard(effect.sender_id)}
                      />
                    ) : (
                      <span
                        className="text-5xl cursor-pointer pointer-events-auto drop-shadow-lg"
                        onClick={() => openUserCard(effect.sender_id)}
                      >🌹</span>
                    )}
                  </div>
                </div>
              );
            }

            if (animationType === 'fullscreen' && hasAsset) {
              return (
                <div
                  key={effect.id}
                  className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-black/20" />
                  <img
                    src={assetUrl}
                    alt={effect?.gift_name || 'gift animation'}
                    className="relative max-w-[90vw] max-h-[90vh] object-contain"
                  />
                </div>
              );
            }

            if (animationType === "burst") {
              return (
                <div key={effect.id} className={`animate-in zoom-in-50 fade-in duration-500 shrink-0 pointer-events-none mt-8 ${levelClass}`}>
                  <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 p-[3px] rounded-full shadow-[0_0_40px_rgba(244,63,94,0.5)]">
                    <div className="bg-white/95 backdrop-blur-md rounded-full px-8 py-4 flex items-center gap-4">
                      <div className="animate-[ping_1.5s_ease-in-out_infinite]">
                        {hasAsset ? (
                          <img
                            src={assetUrl}
                            alt={effect?.gift_name || 'gift animation'}
                            className="w-24 h-24 object-contain drop-shadow-md cursor-pointer pointer-events-auto"
                            onClick={() => openUserCard(effect.sender_id)}
                          />
                        ) : (
                          <span
                            className="text-5xl cursor-pointer pointer-events-auto"
                            onClick={() => openUserCard(effect.sender_id)}
                          >💖</span>
                        )}
                      </div>
                      <div className="flex flex-col justify-center">
                        <div
                          className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-pink-600 cursor-pointer pointer-events-auto"
                          onClick={() => openUserCard(effect.sender_id)}
                        >
                          {effect.sender_name} sent {effect.gift_name} ×{effect.quantity || 1}
                        </div>
                        {effect.recipient_name && (
                          <div
                            className="text-sm font-bold text-slate-500 uppercase tracking-wider cursor-pointer pointer-events-auto"
                            onClick={() => openUserCard(effect.receiver_id)}
                          >
                            to {effect.recipient_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (animationType === "sparkle") {
              console.log('[MEDIUM_GIFT_SPARKLE_RENDER]', {
                sender: effect.sender_name,
                receiver: effect.recipient_name,
                gift: effect.gift_name,
                quantity: effect.quantity
              });

              return (
                <div key={effect.id} className={`animate-in slide-in-from-bottom-8 fade-in duration-700 shrink-0 pointer-events-none ${levelClass}`}>
                  <div className="relative bg-gradient-to-br from-amber-100 to-orange-50 shadow-[0_10px_30px_rgba(245,158,11,0.3)] border-2 border-amber-300 rounded-3xl px-5 py-4 flex items-center justify-between gap-4 min-w-[320px] max-w-[90vw]">
                    <div className="absolute -top-3 -left-3 text-amber-500 animate-[spin_3s_linear_infinite] text-2xl drop-shadow-md">✨</div>
                    <div className="absolute -bottom-3 -right-3 text-amber-500 animate-[spin_2s_linear_infinite_reverse] text-2xl drop-shadow-md">✨</div>
                    <div className="absolute top-1/2 -right-5 text-amber-400 animate-pulse text-xl delay-150">✨</div>
                    <div className="absolute -top-5 left-1/2 text-amber-400 animate-bounce text-3xl delay-300">✨</div>

                    <div className="relative z-10 flex items-center justify-between gap-4 w-full">
                      <button
                        onClick={() => openUserCard(effect.sender_id)}
                        className="pointer-events-auto flex flex-col items-center gap-1 min-w-[72px]"
                      >
                        <img
                          src={effect.sender_avatar_url || effect.sender_avatar || FALLBACK_AVATAR}
                          alt={effect.sender_name || 'sender'}
                          onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-amber-300"
                        />
                        <span className="text-xs font-bold text-amber-800 text-center leading-tight max-w-[72px] truncate">
                          {effect.sender_name || 'Sender'}
                        </span>
                      </button>

                      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
                        <div className="text-amber-500 text-xl font-bold arrow-anim">→</div>

                        <div className="relative flex flex-col items-center justify-center min-w-[90px]">
                          {hasAsset ? (
                            <img
                              src={assetUrl}
                              alt={effect?.gift_name || 'gift animation'}
                              className="w-20 h-20 object-contain drop-shadow-lg pointer-events-auto gift-bounce"
                              onClick={() => openUserCard(effect.sender_id)}
                            />
                          ) : (
                            <span className="text-4xl gift-bounce">✨</span>
                          )}

                          <div className="text-sm font-extrabold text-amber-700 text-center leading-tight mt-1">
                            {effect.gift_name || 'Gift'}
                          </div>

                          <div className="mt-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black shadow">
                            ×{effect.quantity || 1}
                          </div>
                        </div>

                        <div className="text-amber-500 text-xl font-bold arrow-anim">→</div>
                      </div>

                      <button
                        onClick={() => openUserCard(effect.receiver_id)}
                        className="pointer-events-auto flex flex-col items-center gap-1 min-w-[72px]"
                      >
                        <img
                          src={effect.receiver_avatar_url || effect.receiver_avatar || FALLBACK_AVATAR}
                          alt={effect.recipient_name || 'receiver'}
                          onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-pink-300"
                        />
                        <span className="text-xs font-bold text-amber-800 text-center leading-tight max-w-[72px] truncate">
                          {effect.receiver_name || effect.recipient_name || 'User'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (effect.targetPosition) {
              const isMoving = effect.startMotion;
              return (
                <div
                  key={effect.id}
                  style={{
                    position: 'fixed',
                    left: isMoving ? effect.targetPosition.x : '50%',
                    top: isMoving ? effect.targetPosition.y : 'calc(100vh - 140px)',
                    transform: isMoving ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.5)',
                    opacity: isMoving ? 1 : 0,
                    transition: 'all 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                    zIndex: 9999,
                    pointerEvents: 'none'
                  }}
                >
                  <div className="bg-white/95 backdrop-blur-sm shadow-xl border border-rose-200 rounded-full px-4 py-2 flex items-center gap-3">
                    <div className="animate-[bounce_1s_ease-in-out_infinite]">
                      {hasAsset ? (
                        <img
                          src={assetUrl}
                          alt={effect?.gift_name || 'gift animation'}
                          className="w-16 h-16 object-contain cursor-pointer pointer-events-auto"
                          onClick={() => openUserCard(effect.sender_id)}
                        />
                      ) : (
                        <span
                          className="text-2xl cursor-pointer pointer-events-auto"
                          onClick={() => openUserCard(effect.sender_id)}
                        >🌹</span>
                      )}
                    </div>
                    <div className="flex flex-col pr-2 whitespace-nowrap">
                      <div
                        className="text-sm font-bold text-slate-700 cursor-pointer pointer-events-auto"
                        onClick={() => openUserCard(effect.sender_id)}
                      >
                        <span className="text-rose-500">{effect.sender_name}</span> sent {effect.gift_name} <span className="text-rose-500 font-black">×{effect.quantity || 1}</span>
                      </div>
                      {effect.recipient_name && (
                        <div
                          className="text-[10px] text-slate-500 font-medium cursor-pointer pointer-events-auto"
                          onClick={() => openUserCard(effect.receiver_id)}
                        >
                          to {effect.recipient_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={effect.id} className={`animate-in slide-in-from-bottom-12 fade-in duration-1000 shrink-0 pointer-events-none ${levelClass}`}>
                <div className="bg-white/80 backdrop-blur-md shadow-lg border border-white/60 rounded-2xl px-4 py-2 flex items-center gap-3 opacity-95 hover:scale-[1.02] transition">
                  <div className="animate-[bounce_2s_ease-in-out_infinite]">
                    {hasAsset ? (
                      <img
                        src={assetUrl}
                        alt={effect?.gift_name || 'gift animation'}
                        className="w-20 h-20 object-contain cursor-pointer pointer-events-auto"
                        onClick={() => openUserCard(effect.sender_id)}
                      />
                    ) : (
                      <span
                        className="text-2xl cursor-pointer pointer-events-auto"
                        onClick={() => openUserCard(effect.sender_id)}
                      >🌹</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div
                      className="text-sm font-bold text-slate-700 cursor-pointer pointer-events-auto"
                      onClick={() => openUserCard(effect.sender_id)}
                    >
                      <span className="text-rose-500">{effect.sender_name}</span> sent {effect.gift_name} <span className="text-rose-500 font-black">×{effect.quantity || 1}</span>
                    </div>
                    {effect.recipient_name && (
                      <div
                        className="text-[10px] text-slate-500 font-medium cursor-pointer pointer-events-auto"
                        onClick={() => openUserCard(effect.receiver_id)}
                      >
                        to {effect.recipient_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
      {joinNotifs.length > 0 ? (
        <div className="fixed top-3 left-0 right-0 z-[60] flex justify-center pointer-events-none">
          <div className="w-full max-w-md px-3 space-y-2">
            {joinNotifs.map((n) => (
              <div
                key={n.id}
                className="pointer-events-auto bg-white/95 backdrop-blur border shadow-sm rounded-2xl px-3 py-2 flex items-center gap-2"
              >
                <img
                  src={n.avatar_url || FALLBACK_AVATAR}
                  onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                  alt={n.name}
                  className="w-9 h-9 rounded-full object-cover border bg-white cursor-pointer"
                  onClick={() => openUserCard(n.user_id)}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold text-slate-900 truncate cursor-pointer"
                    onClick={() => openUserCard(n.user_id)}
                  >
                    {n.name}
                  </div>
                  <div className="text-xs text-slate-500">joined the room</div>
                </div>
                <button
                  onClick={() => setJoinNotifs((prev) => prev.filter((x) => x.id !== n.id))}
                  className="p-1 rounded-lg hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <RoomHeader
  room={room}
  hostUser={hostUser}
        setLeaveRoomOpen={setLeaveRoomOpen}
        openUserCard={openUserCard}
        copyRoomId={copyRoomId}
        toggleFavoriteRoom={toggleFavoriteRoom}
        isFavorite={isFavorite}
        currentPeopleRanked={currentPeopleRanked}
        setShowPeople={setShowPeople}
        canModerate={canModerate}
        pendingRequests={pendingRequests}
        setRequestsOpen={setRequestsOpen}
        pkSession={pkSession}
        pkBusy={pkBusy}
        setShowPkModal={setShowPkModal}
        setShowLeaderboard={setShowLeaderboard}
        handleResetMicGiftCounters={handleResetMicGiftCounters}
        openSettings={openSettings}
        myIncomingInvites={myIncomingInvites}
        handleAcceptMyInvite={handleAcceptMyInvite}
        handleRejectMyInvite={handleRejectMyInvite}
      />

      <div
  className="relative flex-1 min-h-0 flex flex-col bg-transparent sm:border sm:rounded-xl sm:mx-4 sm:mb-4 overflow-hidden"
>

        {err ? <div className="shrink-0 px-4 py-2 text-sm border-b bg-rose-50 text-rose-700">{err}</div> : null}

        {pkSession ? (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 w-[96%] max-w-md z-50 rounded-[32px] p-1.5 sm:p-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] transition-all duration-300">
            <style>{`
              @keyframes scorePop {
                0% { transform: scale(1); }
                50% { transform: scale(1.15); }
                100% { transform: scale(1); }
              }
              .animate-score-pop {
                animation: scorePop 0.3s ease-out;
              }
              @keyframes giftGlow {
                0%, 100% { filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.3)); transform: scale(1); }
                50% { filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8)); transform: scale(1.08); }
              }
              .animate-gift-glow {
                animation: giftGlow 2.5s ease-in-out infinite;
              }
              @keyframes ribbonShine {
                0% { transform: translateX(-150%) skewX(-20deg); }
                50%, 100% { transform: translateX(250%) skewX(-20deg); }
              }
              .animate-ribbon-shine {
                animation: ribbonShine 2.5s ease-in-out infinite;
              }
            `}</style>

            <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-1.5 sm:gap-3 rounded-[24px] bg-white/20 shadow-inner px-2 py-4 sm:px-4 sm:py-6 overflow-hidden border border-white/80 backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-[50%] h-full bg-gradient-to-r from-fuchsia-400/10 via-fuchsia-300/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-[50%] h-full bg-gradient-to-l from-cyan-400/10 via-cyan-300/5 to-transparent pointer-events-none" />

              <div className="relative z-10 min-w-0 flex flex-col items-start text-left">
                <div className="inline-flex items-center rounded-full bg-fuchsia-100/80 border border-fuchsia-200/50 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-fuchsia-600 shadow-sm">
                  Side A
                </div>

                <div
                  key={pkScores?.A}
                  className="mt-1.5 sm:mt-2 text-3xl sm:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-500 to-pink-600 drop-shadow-[0_2px_8px_rgba(217,70,239,0.3)] animate-score-pop origin-left"
                >
                  {Number(pkScores?.A || 0).toLocaleString()}
                </div>

                {pkSideA.length === 0 ? (
                  <div className="mt-3 flex items-center justify-center h-9 sm:h-10 rounded-xl border border-dashed border-fuchsia-200 bg-fuchsia-50/50 px-3 w-full max-w-[120px]">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-fuchsia-400">
                      No player
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 items-start min-w-0 w-full">
                    {pkSideA.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => openUserCard(p.user_id)}
                        title="Open user card"
                        className="group relative flex items-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl border border-fuchsia-100/80 bg-gradient-to-r from-fuchsia-50/60 to-white/90 p-1.5 sm:p-2 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition cursor-pointer w-full text-left"
                      >
                        <img
                          src={p.avatar_url || FALLBACK_AVATAR}
                          alt={p.display_name || "User"}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-2 ring-fuchsia-100 shadow-sm"
                        />

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="truncate text-[11px] sm:text-[13px] font-extrabold text-slate-800">
                            {p.display_name || "User"}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-fuchsia-600/70">
                            #{p.seat_no}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openGiftPanelForUser({
                              id: p.user_id,
                              name: p.display_name || "User",
                              username: p.display_name || "User",
                              avatar_url: p.avatar_url || FALLBACK_AVATAR,
                            });
                          }}
                          title="Send gift"
                          className={`shrink-0 relative overflow-hidden inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-pink-400 to-rose-600 text-white border border-pink-300/60 hover:scale-110 active:scale-95 transition-all duration-300 ${pkSession.status === "live"
                            ? "shadow-[0_4px_10px_rgba(225,29,72,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_14px_rgba(225,29,72,0.5),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                            : "shadow-sm opacity-80 hover:opacity-100 saturate-[0.85]"
                            }`}
                        >
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />

                          <div className={`relative z-10 w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ${pkSession.status === "live"
                            ? "drop-shadow-md animate-gift-glow brightness-110"
                            : "drop-shadow-sm brightness-90 opacity-85"
                            }`}>
                            <div className="absolute bottom-0 left-[5%] w-[90%] h-[60%] bg-gradient-to-b from-purple-400 to-purple-600 rounded-[3px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)] overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
                              <div className="absolute left-1/2 -translate-x-1/2 w-[24%] h-full bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 shadow-[0_0_2px_rgba(0,0,0,0.4),inset_0_0_4px_rgba(255,255,255,0.6)] border-x border-amber-200/50 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>

                            <div className="absolute top-[20%] left-0 w-full h-[24%] bg-gradient-to-b from-purple-300 to-purple-500 rounded-[3px] shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.7)] overflow-hidden z-10">
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
                              <div className="absolute left-1/2 -translate-x-1/2 w-[24%] h-full bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border-x border-amber-200/60 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>

                            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[75%] h-[28%] flex justify-center z-20">
                              <div className="relative overflow-hidden w-[45%] h-full border-[1px] border-amber-400/90 rounded-tl-full rounded-bl-full rounded-tr-[2px] rounded-br-[2px] bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] -rotate-12 translate-x-[15%] translate-y-[10%]">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                              <div className="relative overflow-hidden w-[45%] h-full border-[1px] border-amber-400/90 rounded-tr-full rounded-br-full rounded-tl-[2px] rounded-bl-[2px] bg-gradient-to-bl from-yellow-200 via-amber-400 to-amber-600 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] rotate-12 -translate-x-[15%] translate-y-[10%]">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] h-[80%] bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-amber-300/80 z-30 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/90 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative z-10 flex flex-col items-center justify-start pt-1 sm:pt-2 px-1">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
                  {pkSession.status}
                </div>

                <div className="relative flex items-center justify-center w-full">
                  <div className="absolute right-[50%] w-[100px] sm:w-[140px] h-[2px] bg-gradient-to-l from-fuchsia-500/50 to-transparent pointer-events-none" />
                  <div className="absolute left-[50%] w-[100px] sm:w-[140px] h-[2px] bg-gradient-to-r from-cyan-500/50 to-transparent pointer-events-none" />

                  <div className={`relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-slate-900 via-black to-slate-800 shadow-[0_0_25px_rgba(245,158,11,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)] border-[2px] sm:border-[3px] border-amber-500/80 z-10 ${pkSession.status === "live" ? "animate-pulse" : ""}`}>
                    <span className="text-xl sm:text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      VS
                    </span>
                  </div>
                </div>

                <div className="mt-2 sm:mt-3 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/90 shadow-sm border border-slate-200/60 backdrop-blur-md">
                  <span className="text-[11px] sm:text-sm font-black text-slate-700 tabular-nums tracking-tight">
                    {pkSession.status === "live" ? pkRemainingLabel : "PK"}
                  </span>
                </div>

                {pkSession.title ? (
                  <div className="mt-1.5 truncate max-w-[70px] sm:max-w-[100px] text-[9px] sm:text-[11px] font-bold text-slate-500 text-center">
                    {pkSession.title}
                  </div>
                ) : null}
              </div>

              <div className="relative z-10 min-w-0 flex flex-col items-end text-right">
                <div className="inline-flex items-center rounded-full bg-cyan-100/80 border border-cyan-200/50 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-cyan-600 shadow-sm">
                  Side B
                </div>

                <div
                  key={pkScores?.B}
                  className="mt-1.5 sm:mt-2 text-3xl sm:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-blue-600 drop-shadow-[0_2px_8px_rgba(6,182,212,0.3)] animate-score-pop origin-right"
                >
                  {Number(pkScores?.B || 0).toLocaleString()}
                </div>

                {pkSideB.length === 0 ? (
                  <div className="mt-3 flex items-center justify-center h-9 sm:h-10 rounded-xl border border-dashed border-cyan-200 bg-cyan-50/50 px-3 w-full max-w-[120px]">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-cyan-400">
                      No player
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 items-end min-w-0 w-full">
                    {pkSideB.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => openUserCard(p.user_id)}
                        title="Open user card"
                        className="group relative flex items-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl border border-cyan-100/80 bg-gradient-to-l from-cyan-50/60 to-white/90 p-1.5 sm:p-2 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition cursor-pointer w-full flex-row-reverse text-right"
                      >
                        <img
                          src={p.avatar_url || FALLBACK_AVATAR}
                          alt={p.display_name || "User"}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-2 ring-cyan-100 shadow-sm"
                        />

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="truncate text-[11px] sm:text-[13px] font-extrabold text-slate-800">
                            {p.display_name || "User"}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-cyan-600/70">
                            #{p.seat_no}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openGiftPanelForUser({
                              id: p.user_id,
                              name: p.display_name || "User",
                              username: p.display_name || "User",
                              avatar_url: p.avatar_url || FALLBACK_AVATAR,
                            });
                          }}
                          title="Send gift"
                          className={`shrink-0 relative overflow-hidden inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-pink-400 to-rose-600 text-white border border-pink-300/60 hover:scale-110 active:scale-95 transition-all duration-300 ${pkSession.status === "live"
                            ? "shadow-[0_4px_10px_rgba(225,29,72,0.4),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_14px_rgba(225,29,72,0.5),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                            : "shadow-sm opacity-80 hover:opacity-100 saturate-[0.85]"
                            }`}
                        >
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />

                          <div className={`relative z-10 w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ${pkSession.status === "live"
                            ? "drop-shadow-md animate-gift-glow brightness-110"
                            : "drop-shadow-sm brightness-90 opacity-85"
                            }`}>
                            <div className="absolute bottom-0 left-[5%] w-[90%] h-[60%] bg-gradient-to-b from-purple-400 to-purple-600 rounded-[3px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)] overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
                              <div className="absolute left-1/2 -translate-x-1/2 w-[24%] h-full bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 shadow-[0_0_2px_rgba(0,0,0,0.4),inset_0_0_4px_rgba(255,255,255,0.6)] border-x border-amber-200/50 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>

                            <div className="absolute top-[20%] left-0 w-full h-[24%] bg-gradient-to-b from-purple-300 to-purple-500 rounded-[3px] shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.7)] overflow-hidden z-10">
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
                              <div className="absolute left-1/2 -translate-x-1/2 w-[24%] h-full bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] border-x border-amber-200/60 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>

                            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[75%] h-[28%] flex justify-center z-20">
                              <div className="relative overflow-hidden w-[45%] h-full border-[1px] border-amber-400/90 rounded-tl-full rounded-bl-full rounded-tr-[2px] rounded-br-[2px] bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] -rotate-12 translate-x-[15%] translate-y-[10%]">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                              <div className="relative overflow-hidden w-[45%] h-full border-[1px] border-amber-400/90 rounded-tr-full rounded-br-full rounded-tl-[2px] rounded-bl-[2px] bg-gradient-to-bl from-yellow-200 via-amber-400 to-amber-600 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] rotate-12 -translate-x-[15%] translate-y-[10%]">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-ribbon-shine" />
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] h-[80%] bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-amber-300/80 z-30 overflow-hidden">
                                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/90 to-transparent animate-ribbon-shine" />
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {canModerate ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {pkSession.status === "pending" ? (
                  <Button
                    size="sm"
                    onClick={handleStartPkSession}
                    disabled={pkBusy}
                    className="rounded-full px-5 sm:px-6 font-bold bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md hover:shadow-lg transition-all"
                  >
                    Start PK
                  </Button>
                ) : null}

                {pkSession.status === "pending" || pkSession.status === "live" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelPkSession}
                    disabled={pkBusy}
                    className="rounded-full px-5 sm:px-6 font-bold border-slate-200 bg-white/80 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                  >
                    Cancel PK
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row relative overflow-hidden">
          <RoomSeats
            loading={loading}
            effectiveSeats={effectiveSeats}
            user={user}
            mutedUsers={mutedUsers}
            activeSpeakers={activeSpeakers}
            pkUserSideMap={pkUserSideMap}
            canModerate={canModerate}
            isOwner={isOwner}
            room={room}
            micSeatRefs={micSeatRefs}
            removeFromMic={removeFromMic}
            leaveMySeat={leaveMySeat}
            openSeatMenu={openSeatMenu}
            openUserCard={openUserCard}
            toast={toast}
            micMode={micMode}
            takeSeat={takeSeat}
            renderRoleBadge={renderRoleBadge}
            micGiftTotals={micGiftTotals}
            micGiftTotalsReady={micGiftTotalsReady}
          />

          <RoomChat
            chatScrollRef={chatScrollRef}
            chatBottomRef={chatBottomRef}
            visibleMessages={visibleMessages}
            participantsMap={participantsMap}
            openUserCard={openUserCard}
            renderRoleBadge={renderRoleBadge}
            lastSentGift={lastSentGift}
            showRepeatButton={showRepeatButton}
            handleRepeatLastGift={handleRepeatLastGift}
            isJoinedToRoom={isJoinedToRoom}
            repeatSending={repeatSending}
            myMutedActive={myMutedActive}
            effectiveSeats={effectiveSeats}
            user={user}
            toggleMicMute={toggleMicMute}
            isMicMuted={isMicMuted}
            requestMic={requestMic}
            myPendingRequest={myPendingRequest}
            text={text}
            setText={setText}
            sendText={sendText}
            openGiftPanelForAll={openGiftPanelForAll}
            sending={sending}
            canModerate={canModerate}
          />
        </div>
      </div>
      
      <RoomModals
        showPeople={showPeople}
        setShowPeople={setShowPeople}
        currentPeopleRanked={currentPeopleRanked}
        openUserCard={openUserCard}
        seatMenuOpen={seatMenuOpen}
        closeSeatMenu={closeSeatMenu}
        effectiveSeats={effectiveSeats}
        user={user}
        seatMenuSeatNo={seatMenuSeatNo}
        setSeatMenuSeatNo={setSeatMenuSeatNo}
        canModerate={canModerate}
        inviteOnlyMode={inviteOnlyMode}
        setInviteOnlyMode={setInviteOnlyMode}
        inviteTargetUserId={inviteTargetUserId}
        setInviteTargetUserId={setInviteTargetUserId}
        inviteOpen={inviteOpen}
        setInviteOpen={setInviteOpen}
        takeMicSeat={takeMicSeat}
        moveMicSeat={moveMicSeat}
        setSeatLocked={setSeatLocked}
        seatMenuSeatLocked={seatMenuSeatLocked}
        activeParticipants={activeParticipants}
        inviteUserToMic={inviteUserToMic}
        toast={toast}
        showSettings={showSettings}
        closeSettings={closeSettings}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        openBansTab={openBansTab}
        room={room}
        isOwner={isOwner}
        roomAvatarInputRef={roomAvatarInputRef}
        handleRoomAvatarUpload={handleRoomAvatarUpload}
        roomAvatarUploading={roomAvatarUploading}
        roomBackgroundInputRef={roomBackgroundInputRef}
        handleRoomBackgroundUpload={handleRoomBackgroundUpload}
        roomBackgroundUploading={roomBackgroundUploading}
        loadingBans={loadingBans}
        bannedList={bannedList}
        setBannedList={setBannedList}
        settingsBusy={settingsBusy}
        fetchBans={fetchBans}
        mountedRef={mountedRef}
        unbanUser={unbanUser}
        requestsOpen={requestsOpen}
        setRequestsOpen={setRequestsOpen}
        pendingRequests={pendingRequests}
        acceptRequest={acceptRequest}
        rejectRequest={rejectRequest}
        leaveRoomOpen={leaveRoomOpen}
        setLeaveRoomOpen={setLeaveRoomOpen}
        roomId={roomId}
        setRoomData={setRoomData}
        miniRoomActiveRef={miniRoomActiveRef}
        setMiniRoomActive={setMiniRoomActive}
        navigate={navigate}
        handleExitRoom={handleExitRoom}
        showLeaderboard={showLeaderboard}
        setShowLeaderboard={setShowLeaderboard}
        leaderboardTab={leaderboardTab}
        setLeaderboardTab={setLeaderboardTab}
        leaderboardData={leaderboardData}
        showPkModal={showPkModal}
        setShowPkModal={setShowPkModal}
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
        handleCreatePk={handleCreatePk}
        pkResultOpen={pkResultOpen}
        pkResultData={pkResultData}
        setPkResultOpen={setPkResultOpen}
        setPkResultData={setPkResultData}
        giftPanelOpen={giftPanelOpen}
        setGiftPanelOpen={setGiftPanelOpen}
        giftTargetMode={giftTargetMode}
        giftSelectedRecipient={giftSelectedRecipient}
        giftTarget={giftTarget}
        handleRoomGiftSend={handleRoomGiftSend}
        giftQuantity={giftQuantity}
        setGiftQuantity={setGiftQuantity}
        giftPanelUsers={giftPanelUsers}
        hostUser={hostUser}
        resolveGiftTargetMode={resolveGiftTargetMode}
        setGiftTargetMode={setGiftTargetMode}
        setGiftSelectedRecipient={setGiftSelectedRecipient}
        setGiftTarget={setGiftTarget}
        isUserCardOpen={isUserCardOpen}
        closeUserCard={closeUserCard}
        cardLoading={cardLoading}
        selectedUserProfile={selectedUserProfile}
        selectedUserId={selectedUserId}
        selectedUserIsMod={selectedUserIsMod}
        isSelfCard={isSelfCard}
        canShowOwnerTools={canShowOwnerTools}
        targetMutedActive={targetMutedActive}
        moderatorsMap={moderatorsMap}
        mentionUser={mentionUser}
        openGiftPanelForUser={openGiftPanelForUser}
        goToProfilePage={goToProfilePage}
        muteUser={muteUser}
        unmuteUser={unmuteUser}
        openKickConfirm={openKickConfirm}
        openBanConfirm={openBanConfirm}
        assignModerator={assignModerator}
        removeModerator={removeModerator}
        setSeatMenuOpen={setSeatMenuOpen}
      />
      </div>
    </div>
  );
}