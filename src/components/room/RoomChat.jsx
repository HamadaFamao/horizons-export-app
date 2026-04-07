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

export default function RoomChat({
  chatScrollRef,
  chatBottomRef,
  visibleMessages,
  participantsMap,
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
}) {
  return (
    <div className="flex flex-col h-full relative lg:w-2/3 bg-black/30 backdrop-blur-sm">
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto min-h-0 pb-2"
      >
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 text-center">
              <div className="text-sm font-semibold text-blue-900">Welcome to the room 🎤</div>
              <div className="text-xs text-blue-800 mt-1">
                Respect everyone and enjoy the conversation.
              </div>
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

                  const senderProfile =
                    participantsMap?.[m.sender_user_id] ||
                    participantsMap?.[m.user_id] ||
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

                  return (
                    <div key={m.id} className="bg-white border rounded-xl p-2">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => openUserCard(m.sender_user_id)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border bg-slate-50 flex items-center justify-center cursor-pointer"
                          title="Open user card"
                        >
                          <img
                            src={avatar}
                            alt={name}
                            onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
                            className="w-full h-full object-cover"
                          />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center min-w-0">
                              <button
                                onClick={() => openUserCard(m.sender_user_id)}
                                className="text-xs sm:text-sm font-semibold text-slate-900 truncate hover:underline cursor-pointer text-left"
                                title="Open user card"
                              >
                                {name}
                              </button>
                              {renderRoleBadge(m.sender_user_id)}
                            </div>

                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono whitespace-nowrap">
                              {new Date(m.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div className="text-xs sm:text-sm text-slate-900 mt-1 whitespace-pre-wrap">
                            {m.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
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
  className="bg-black/40 backdrop-blur-sm px-3 py-2.5 z-20 shrink-0"
>
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
        </div>
    </div>
  );
}
