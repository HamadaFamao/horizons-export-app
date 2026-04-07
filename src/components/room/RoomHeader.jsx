import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useMiniRoom } from "@/contexts/MiniRoomContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GiftPanel from "@/components/GiftPanel";
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
  Info,
  Image as ImageIcon,
  ShieldBan,
  RefreshCw,
  Shield,
  Bell,
  LogOut,
  Share2,
  Power
} from "lucide-react";

const MOCK_SEATS = [
  { id: 1, isOccupied: true, name: 'Alex', initials: 'AL', isSpeaking: true, isMuted: false },
  { id: 2, isOccupied: true, name: 'Sarah', initials: 'SA', isSpeaking: false, isMuted: true },
  { id: 3, isOccupied: true, name: 'Mike', initials: 'MI', isSpeaking: false, isMuted: false },
  { id: 4, isOccupied: false, name: '', initials: '', isSpeaking: false, isMuted: false },
  { id: 5, isOccupied: false, name: '', initials: '', isSpeaking: false, isMuted: false },
  { id: 6, isOccupied: false, name: '', initials: '', isSpeaking: false, isMuted: false },
];

const MOCK_MESSAGES = [
  { id: 1, user: 'Alex', text: 'Hey everyone! Welcome to the room.', time: '10:00 AM' },
  { id: 2, user: 'Sarah', text: 'Hi Alex! Thanks for hosting.', time: '10:02 AM' },
  { id: 3, user: 'Mike', text: 'Can anyone hear me?', time: '10:05 AM' },
  { id: 4, user: 'System', text: 'Sarah joined the room.', time: '10:06 AM', isSystem: true },
  { id: 5, user: 'Sarah', text: 'Loud and clear Mike!', time: '10:07 AM' },
];

export default function LiveRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setMiniRoomActive, setRoomData, miniRoomActive } = useMiniRoom();
  const mountedRef = useRef(true);
  const profilesCacheRef = useRef(new Map());
  const chatScrollRef = useRef(null);
  const chatBottomRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [seats, setSeats] = useState(MOCK_SEATS);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  const FALLBACK_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <rect width="128" height="128" rx="64" fill="#f1f5f9"/>
        <circle cx="64" cy="52" r="22" fill="#cbd5e1"/>
        <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/>
      </svg>
    `);

  const fetchProfilesMap = useCallback(async (ids = []) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    const result = new Map();

    const missing = uniqueIds.filter((id) => !profilesCacheRef.current.has(id));

    if (missing.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", missing);

      if (!error && data) {
        data.forEach((p) => {
          profilesCacheRef.current.set(p.id, {
            name: p.display_name || "User",
            avatar_url: p.avatar_url || FALLBACK_AVATAR,
          });
        });
      }
    }

    uniqueIds.forEach((id) => {
      result.set(id, profilesCacheRef.current.get(id));
    });

    return result;
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    if (!roomId) return;

    try {
      const { data, error } = await supabase
        .from("v_room_top_senders_alltime")
        .select("room_id, sender_id, total_coins")
        .eq("room_id", roomId)
        .order("total_coins", { ascending: false })
        .limit(20);

      if (error) throw error;

      const ids = (data || []).map((row) => row.sender_id);
      const profilesMap = await fetchProfilesMap(ids);

      const rows = (data || []).map((row) => {
        const profile = profilesMap.get(row.sender_id);

        return {
          id: row.sender_id,
          user_id: row.sender_id,
          name: profile?.name || "User",
          avatar_url: profile?.avatar_url || FALLBACK_AVATAR,
          coins: Number(row.total_coins || 0),
        };
      });

      if (mountedRef.current) {
        setLeaderboard(rows);
      }
    } catch (err) {
      console.error("fetchLeaderboard error:", err);
    }
  }, [roomId, fetchProfilesMap]);

  useEffect(() => {
    if (!showLeaderboard) return;
    fetchLeaderboard();
  }, [showLeaderboard, fetchLeaderboard]);

  function shortId(id) {
    const s = String(id || "");
    if (s.length <= 14) return s;
    return `${s.slice(0, 8)}...${s.slice(-4)}`;
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50 overflow-hidden font-sans">
      {/* --- Top Header --- */}
      <header className="shrink-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shadow-inner">
            <Mic className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Live Room #1</h1>
            <p className="text-xs text-slate-400 font-medium">3 Participants • Public</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors" title="Room Info">
            <Info className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors" title="Settings">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <button className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-medium text-sm">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* --- Middle Section: Seat Grid --- */}
        <section className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start bg-slate-100/50">
          <div className="w-full max-w-2xl mt-4 sm:mt-10">
            <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 place-items-center">
              {seats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="relative">
                    <div className={`
                      w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300
                      ${seat.isOccupied ? 'bg-white shadow-md group-hover:shadow-lg border-2 border-slate-200' : 'bg-slate-200/50 border-2 border-dashed border-slate-300 group-hover:border-slate-400 group-hover:bg-slate-200'}
                      ${seat.isSpeaking ? 'ring-4 ring-emerald-400 border-transparent shadow-emerald-200' : ''}
                    `}>
                      {seat.isOccupied ? (
                        <span className="text-2xl sm:text-3xl font-bold text-slate-700 tracking-wider">
                          {seat.initials}
                        </span>
                      ) : (
                        <UserIcon className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    {seat.isOccupied && (
                      <div className={`
                        absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm
                        ${seat.isMuted ? 'bg-rose-500' : 'bg-slate-700'}
                      `}>
                        {seat.isMuted ? (
                          <MicOff className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <p className={`text-sm sm:text-base font-semibold truncate w-24 ${seat.isOccupied ? 'text-slate-900' : 'text-slate-400'}`}>
                      {seat.isOccupied ? seat.name : `Seat ${seat.id}`}
                    </p>
                    {seat.isOccupied && (
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Online</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Bottom/Right Section: Chat Area --- */}
        <section className="w-full md:w-80 lg:w-96 shrink-0 flex flex-col bg-white border-t md:border-t-0 md:border-l border-slate-200 shadow-sm z-0">
          <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm shrink-0">
            <h2 className="font-bold text-slate-800">Room Chat</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isSystem ? 'items-center' : 'items-start'}`}>
                {msg.isSystem ? (
                  <div className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">{msg.user}</span>
                      <span className="text-[10px] text-slate-400">{msg.time}</span>
                    </div>
                    <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm text-sm text-slate-700">
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-200 rounded-full px-4 py-2.5 text-sm transition-all outline-none"
              />
              <button className="shrink-0 w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-transform hover:scale-105 shadow-sm">
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {showLeaderboard && (
        <div
          className="fixed inset-0 z-[95]"
          onClick={() => setShowLeaderboard(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3">
            <div
              className="w-full max-w-md max-h-[88vh] bg-white rounded-3xl shadow-2xl border overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-lg">
                  <span className="text-xl">🏆</span>
                  <span>Top Supporters</span>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
                {leaderboard.length === 0 ? (
                  <div className="text-center text-slate-400 italic py-10">
                    No rankings yet...
                  </div>
                ) : (
                  leaderboard.map((item, idx) => (
                    <div
                      key={item.id || item.user_id || idx}
                      className="flex items-center justify-between rounded-2xl border bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-3xl font-extrabold text-slate-400 w-12">
                          #{idx + 1}
                        </div>
                        <img
                          src={item.avatar_url || FALLBACK_AVATAR}
                          alt={item.name || "User"}
                          className="w-14 h-14 rounded-full object-cover border"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_AVATAR;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 text-lg truncate">
                            {item.name || "User"}
                          </div>
                        </div>
                      </div>
                      <div className="font-extrabold text-amber-600 text-2xl whitespace-nowrap">
                        💰 {Number(item.coins || 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}