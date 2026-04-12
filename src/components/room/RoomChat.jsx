import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Mic, MicOff, Gift } from "lucide-react";

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" rx="64" fill="#f1f5f9"/>
    <circle cx="64" cy="52" r="22" fill="#cbd5e1"/>
    <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/>
  </svg>`);

const ENABLE_GIFT_MESSAGE_TEXT = true;
const ROOM_EMOJIS = [
  { id: "e1", src: "/emojis/512 (1).webp", label: "reaction 1" },
  { id: "e2", src: "/emojis/512 (2).webp", label: "reaction 2" },
  { id: "e3", src: "/emojis/512 (3).webp", label: "reaction 3" },
];

const getVipNameStyle = (vipNumber) => {
  switch (Number(vipNumber)) {
    case 1:
      return "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent font-bold";
    case 2:
      return "bg-gradient-to-r from-slate-300 to-slate-100 bg-clip-text text-transparent font-bold";
    case 3:
      return "bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent font-black";
    case 4:
      return "bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent font-black";
    case 5:
      return "bg-gradient-to-r from-purple-400 via-pink-300 to-purple-400 bg-clip-text text-transparent font-black";
    default:
      return "text-white/90 font-bold";
  }
};

const getVipPrefix = (vipNumber) => {
  switch (Number(vipNumber)) {
    case 1: return "🔥";
    case 2: return "⚡";
    case 3: return "✨";
    case 4: return "💎";
    case 5: return "👑";
    default: return "";
  }
};

export default function RoomChat({
  room,
  chatScrollRef,
  chatBottomRef,
  visibleMessages,
  onUserScrolledUpChange,
  participantsMap,
  moderatorsMap,
  openUserCard,
  renderRoleBadge,
  lastSentGift,
  showRepeatButton,
  handleRepeatLastGift,
  isJoinedToRoom,
  repeatSending,
  myMutedActive,
  effectiveSeats,
  user,
  toggleMicMute,
  isMicMuted,
  requestMic,
  myPendingRequest,
  text,
  setText,
  sendText,
  openGiftPanelForAll,
  sending,
  canModerate,
  showEmojiPanel,
  setShowEmojiPanel,
  sendRoomEmoji,
  chatEmojiEffects,
}) {
  const [footerHeight, setFooterHeight] = React.useState(0);
  const [userScrolledUp, setUserScrolledUp] = React.useState(false);
  const footerRef = React.useRef(null);

  const handleScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isScrolledUp = distanceFromBottom > 100;
    setUserScrolledUp(isScrolledUp);
  };

  React.useEffect(() => {
    onUserScrolledUpChange?.(userScrolledUp);
  }, [userScrolledUp, onUserScrolledUpChange]);

  React.useEffect(() => {
    try {
      if (window.navigator?.virtualKeyboard) {
        window.navigator.virtualKeyboard.overlaysContent = true;
      }
    } catch {
      // no-op on unsupported browsers
    }
  }, []);

  React.useEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl || typeof window === "undefined") return;

    const updateFooterHeight = () => {
      const next = Math.ceil(footerEl.getBoundingClientRect().height || 0);
      setFooterHeight((prev) => (prev === next ? prev : next));
    };

    updateFooterHeight();

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateFooterHeight);
      resizeObserver.observe(footerEl);
    }

    window.addEventListener("resize", updateFooterHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFooterHeight);
    };
  }, []);

  React.useEffect(() => {
    if (!showEmojiPanel) return;

    const close = () => {
      setShowEmojiPanel(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", close);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [showEmojiPanel, setShowEmojiPanel]);

  return (
    <div className="flex flex-col min-h-0 h-full relative lg:w-2/3 bg-black/30 backdrop-blur-sm">
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto min-h-0"
        style={{ paddingBottom: `calc(${footerHeight + 8}px + env(safe-area-inset-bottom, 0px) + env(keyboard-inset-height, 0px))` }}
      >
          {chatEmojiEffects.length > 0 ? (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              {chatEmojiEffects.map((effect) => (
                <div
                  key={effect.id}
                  className="absolute bottom-10 animate-[chatEmojiFloat_3s_ease-out_forwards]"
                  style={{ left: `${effect.left}%` }}
                >
                  <img src={effect.src} alt="reaction" className="w-16 h-16 object-contain" />
                </div>
              ))}
            </div>
          ) : null}

           <div className="p-3 mb-3 text-center">
  <div 
    className="text-sm font-bold tracking-wide"
    style={{
      animation: 'dazzle-main 2.5s ease-in-out infinite',
    }}
  >
    Welcome to the room 🎤
  </div>
  <div
    className="text-xs mt-2 font-bold tracking-wider"
    style={{
      background: 'linear-gradient(90deg, #38bdf8, #c084fc, #f472b6, #c084fc, #38bdf8)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: 'shimmer 3s linear infinite, float-sub 3s ease-in-out infinite',
      filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.4))'
    }}
  >
    {room?.welcome_message || "Respect everyone and enjoy the conversation."}
  </div>
  <style>{`
    @keyframes dazzle-main {
      0%, 100% {
        color: #ffffff;
        text-shadow: 0 0 4px rgba(255, 255, 255, 0.8), 0 0 10px #38bdf8, 0 0 15px #38bdf8;
        transform: scale(1);
      }
      50% {
        color: #fdf4ff;
        text-shadow: 0 0 8px #ffffff, 0 0 15px #c084fc, 0 0 25px #c084fc, 0 0 35px #f472b6;
        transform: scale(1.04);
      }
    }
    @keyframes shimmer {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    @keyframes float-sub {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-3px); }
    }
    @keyframes chatEmojiFloat {
      0% { transform: translateY(0) scale(0.5); opacity: 1; }
      50% { transform: translateY(-80px) scale(1.2); opacity: 1; }
      100% { transform: translateY(-160px) scale(1); opacity: 0; }
    }
  `}</style>
</div>

            {visibleMessages.length === 0 ? (
              <div className="text-sm text-slate-500 text-center mt-4">No messages yet…</div>
            ) : (
              <div className="space-y-2">
                {visibleMessages.map((m) => {
                  if (m.type === "gift" || m.content_type === "gift") {
                    return (
                      <div key={m.id} className="bg-rose-50 border border-rose-100 rounded-xl p-2 mb-2">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => openUserCard(m.sender_id)}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border bg-white flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <img
                              src={m.sender_avatar || FALLBACK_AVATAR}
                              alt={m.sender_name}
                              onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                              className="w-full h-full object-cover"
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center min-w-0">
                                <button
                                  onClick={() => openUserCard(m.sender_id)}
                                  className="text-xs sm:text-sm font-bold text-rose-700 truncate hover:underline cursor-pointer text-left"
                                >
                                  {m.sender_name}
                                </button>
                              </div>

                              <div className="text-[10px] sm:text-[11px] text-rose-400 font-mono whitespace-nowrap">
                                {new Date(m.created_at).toLocaleString()}
                              </div>
                            </div>

                            <div className="text-xs sm:text-sm text-rose-900 mt-0.5 flex items-center flex-wrap gap-1">
                              <span>sent</span>
                              <span className="font-bold">
                                {m.gift_name} ×{m.quantity || 1}
                              </span>
                              <span>to</span>
                              <button
                                onClick={() => openUserCard(m.receiver_id)}
                                className="font-bold hover:underline cursor-pointer"
                              >
                                {m.receiver_name}
                              </button>
                              {m.gift_icon && (
                                <img
                                  src={m.gift_icon}
                                  alt="gift"
                                  className="w-5 h-5 inline-block ml-1 object-contain"
                                />
                              )}
                            </div>

                            {ENABLE_GIFT_MESSAGE_TEXT && m.message?.trim() ? (
                              <div className="mt-1 text-xs text-rose-700/80 italic break-words">
                                "{m.message.trim()}"
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const senderUserId = m.sender_user_id || m.user_id;
                  const senderProfile =
                    participantsMap?.[senderUserId] ||
                    participantsMap?.[String(senderUserId)] ||
                    null;

                  const name =
                    senderProfile?.display_name ||
                    senderProfile?.full_name ||
                    m.sender_name ||
                    "User";

                  const avatar =
                    senderProfile?.avatar_url ||
                    m.sender_avatar ||
                    m.sender_avatar_url ||
                    FALLBACK_AVATAR;

                  const vipNumber = Number(
                    senderProfile?.raw_profile?.vip_number ||
                    senderProfile?.vip_number ||
                    0
                  );
                  const hasVipFlag = Boolean(senderProfile?.raw_profile?.is_vip || senderProfile?.is_vip);
                  const vipUntilRaw = senderProfile?.raw_profile?.vip_until || senderProfile?.vip_until;
                  const isVipActive = !vipUntilRaw || new Date(vipUntilRaw).getTime() > Date.now();
                  const isVip = hasVipFlag && isVipActive;
                  const isHost = !!(senderUserId && String(senderUserId) === String(room?.owner_user_id));
                  const isMod = !!(senderUserId && moderatorsMap?.has?.(String(senderUserId)));

                  const senderNameClass =
                    isHost
                      ? "text-amber-300 font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                      : isMod
                        ? "text-blue-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                        : isVip
                          ? `${getVipNameStyle(vipNumber)} drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]`
                          : "text-white/90 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]";

                  return (
                    <div key={m.id} className="px-3 py-1 flex items-start gap-2">
                      <button
                        onClick={() => openUserCard(senderUserId)}
                        className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center cursor-pointer shrink-0 mt-0.5"
                        title="Open user card"
                      >
                        <img
                          src={avatar}
                          alt={name}
                          onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                          className="w-full h-full rounded-full object-cover shrink-0"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 break-words">
                          <button
                            onClick={() => openUserCard(senderUserId)}
                            className={`inline-flex items-center text-xs mr-1.5 hover:underline cursor-pointer text-left align-middle ${senderNameClass}`}
                            title="Open user card"
                          >
                            {isVip && !isHost && !isMod ? <span className="mr-1">{getVipPrefix(vipNumber)}</span> : null}
                            <span>{name}</span>
                          </button>
                          {renderRoleBadge(senderUserId)}
                          <span
                            className={isVip
                              ? "text-xs text-white font-medium break-words whitespace-pre-wrap"
                              : "text-xs text-white/80 break-words whitespace-pre-wrap"
                            }
                          >
                            {m.content}
                          </span>
                        </div>

                        <div className="mt-0.5 text-[10px] text-white/30 font-mono">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} className="h-1 shrink-0" />
              </div>
            )}
          </div>

      {lastSentGift && showRepeatButton && (
        <div className="fixed bottom-20 right-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={handleRepeatLastGift}
                disabled={!isJoinedToRoom || repeatSending}
                className="relative rounded-full h-12 sm:h-14 px-2 sm:px-3 pr-3 sm:pr-4 flex items-center gap-2 border border-pink-200/80 bg-white/90 backdrop-blur-md shadow-lg text-pink-600 transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed animate-[pulse_1.6s_ease-in-out_2]"
                title="Repeat Last Gift"
              >
                {Number(lastSentGift.quantity || 1) > 1 && (
                  <span className="absolute -top-1 -right-1 min-w-[24px] h-6 px-2 rounded-full bg-pink-500 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    ×{lastSentGift.quantity}
                  </span>
                )}

                {lastSentGift.giftIconUrl ? (
                  <img
                    src={lastSentGift.giftIconUrl}
                    alt="gift"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover bg-white shadow-sm shrink-0 border border-pink-100"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-pink-50 flex items-center justify-center text-lg shadow-sm shrink-0 border border-pink-100">
                    <span>{lastSentGift.giftEmoji || "🔁"}</span>
                  </div>
                )}

                <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                  {repeatSending ? "Sending..." : "Repeat"}
                </span>
              </button>
            </div>
      )}

      <div
  ref={footerRef}
  className="fixed lg:absolute left-0 right-0 bottom-0 bg-black/40 backdrop-blur-sm px-3 pt-2.5 z-20"
  style={{
    bottom: "env(keyboard-inset-height, 0px)",
    paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
  }}
>
        {showEmojiPanel ? (
          <div
            className="absolute bottom-[70px] left-2 right-2 z-50 bg-black/80 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-white/50 font-semibold mb-2 px-1">Reactions</div>
            <div className="flex items-center gap-3 justify-center">
              {ROOM_EMOJIS.map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  onClick={() => sendRoomEmoji(emoji)}
                  className="flex flex-col items-center gap-1 hover:scale-125 transition active:scale-95 p-1"
                >
                  <img src={emoji.src} alt={emoji.label} className="w-14 h-14 object-contain" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {room?.chat_disabled && !canModerate ? (
          <div className="mb-2 text-sm bg-slate-100 border border-slate-200 text-slate-700 rounded-lg p-2 text-center">
            Chat is disabled by the host 🔇
          </div>
        ) : (
          <>
        {myMutedActive ? (
          <div className="mb-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
            🔇 You are muted by room moderation.
          </div>
        ) : null}
          <div className="flex items-center gap-2">
            {((effectiveSeats || []).some((s) => s.user_id && String(s.user_id) === String(user?.id))) ? (
              <button
                type="button"
                onClick={toggleMicMute}
                className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${isMicMuted
                  ? "bg-amber-50/50 border-amber-200/50 text-amber-600 hover:bg-amber-100/50 backdrop-blur-sm"
                  : "bg-white/20 border-slate-200/50 text-slate-700 hover:bg-slate-50/50 backdrop-blur-sm"
                  }`}
                title={isMicMuted ? "Unmute" : "Mute"}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            ) : !canModerate ? (
              <button
                type="button"
                onClick={requestMic}
                disabled={!user?.id || !!myPendingRequest}
                className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur-sm ${myPendingRequest
                  ? "bg-yellow-100/50 border-yellow-200/50 text-yellow-600"
                  : "bg-white/20 border-slate-200/50 text-slate-700 hover:bg-slate-50/50"
                  }`}
                title={myPendingRequest ? "Request Sent" : "Request Mic"}
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : null}

            <Input
              className="flex-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                !isJoinedToRoom
                  ? "Joining room..."
                  : myMutedActive
                    ? "You are muted in this room…"
                    : "Write a message…"
              }
              disabled={!isJoinedToRoom || myMutedActive}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendText();
              }}
            />

            <button
              onClick={openGiftPanelForAll}
              disabled={!isJoinedToRoom}
              className="shrink-0 h-10 w-10 rounded-xl border bg-white/20 hover:bg-rose-50/50 backdrop-blur-sm flex items-center justify-center text-rose-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send Gift"
            >
              <Gift className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPanel((prev) => !prev)}
              className="shrink-0 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl hover:bg-white/20 transition active:scale-95"
            >
              😊
            </button>

            <Button
              onClick={sendText}
              disabled={!isJoinedToRoom || sending || !text.trim() || myMutedActive}
              className="gap-2 shrink-0 px-3"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          </>
        )}
        </div>
    </div>

  );
}
