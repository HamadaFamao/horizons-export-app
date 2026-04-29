// ═══════════════════════════════════════════════════════════════════
// EMOJI REACTIONS PATCH — أضف الأجزاء دي في LudoGame.jsx
// ═══════════════════════════════════════════════════════════════════

// ─── PART 1: State & Refs ─────────────────────────────────────────
// أضف بعد:  const [sixFlash, setSixFlash] = useState(false);

  const [activeEmojis, setActiveEmojis] = useState({}); // { userId: { emoji, key } }
  const [openEmojiPicker, setOpenEmojiPicker] = useState(null); // userId whose picker is open
  const emojiTimersRef = useRef({});

  const LUDO_EMOJIS = ['😂', '😱', '🔥', '😭', '🎉', '👏', '💀', '🫡'];


// ─── PART 2: Broadcast helper + receiver ─────────────────────────
// أضف بعد:  useEffect(() => { soundMutedRef.current = soundMuted; }, [soundMuted]);

  // Send emoji reaction — broadcast to all viewers via Realtime
  const sendEmojiReaction = (targetUserId, emoji) => {
    setOpenEmojiPicker(null);
    showEmojiOnPlayer(targetUserId, emoji);
    // Broadcast to everyone else
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ludo_emoji',
      payload: { fromUserId: String(user?.id), targetUserId: String(targetUserId), emoji },
    });
  };

  const showEmojiOnPlayer = (targetUserId, emoji) => {
    const uid = String(targetUserId);
    // Cancel existing timer
    if (emojiTimersRef.current[uid]) clearTimeout(emojiTimersRef.current[uid]);
    const key = `${uid}-${Date.now()}`;
    setActiveEmojis(prev => ({ ...prev, [uid]: { emoji, key } }));
    emojiTimersRef.current[uid] = setTimeout(() => {
      setActiveEmojis(prev => {
        const next = { ...prev };
        if (next[uid]?.key === key) delete next[uid];
        return next;
      });
    }, 2500);
  };


// ─── PART 3: Add broadcast listener to Realtime channel ──────────
// في الـ useEffect الخاص بـ Realtime، بعد .subscribe() وقبل channelRef.current = channel
// أضف هذا الـ listener على الـ channel BEFORE .subscribe():

      .on('broadcast', { event: 'ludo_emoji' }, ({ payload }) => {
        if (payload?.targetUserId && payload?.emoji) {
          showEmojiOnPlayer(payload.targetUserId, payload.emoji);
        }
      })


// ─── PART 4: renderPlayerWithDice — أضف زر الإيموشن وعرض الإيموشن ─
// استبدل الـ return بالكامل في renderPlayerWithDice بالكود ده:

                  const emojiData = activeEmojis[String(p.user_id)];
                  const canSendEmoji = String(p.user_id) !== String(user?.id);

                  return (
                    <div key={p.id} className={`relative flex items-center gap-1 sm:gap-2 min-h-[64px] sm:min-h-[80px] ${isFinishFx ? 'animate-bounce' : ''}`}>
                      {/* Floating emoji display */}
                      {emojiData && (
                        <div
                          key={emojiData.key}
                          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 text-2xl"
                          style={{ animation: 'ludoEmojiFloat 2.5s ease-out forwards' }}
                        >
                          {emojiData.emoji}
                        </div>
                      )}

                      {diceSide === 'left' && renderDiceSlot(p)}

                      {/* Player card + emoji button wrapper */}
                      <div className="relative flex flex-col items-center">
                        {playerCard}
                        {/* Emoji button — only show for OTHER players */}
                        {canSendEmoji && currentSession?.status === 'playing' && (
                          <div className="relative mt-0.5">
                            <button
                              onPointerDown={e => { e.stopPropagation(); setOpenEmojiPicker(v => v === String(p.user_id) ? null : String(p.user_id)); }}
                              className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[11px] active:scale-90 transition border border-white/20"
                              title="Send emoji"
                            >
                              😊
                            </button>

                            {/* Emoji picker */}
                            {openEmojiPicker === String(p.user_id) && (
                              <div
                                className="absolute z-50 bottom-7 flex gap-1 p-1.5 rounded-xl bg-slate-800 border border-white/15 shadow-2xl"
                                style={{ left: diceSide === 'left' ? '0' : 'auto', right: diceSide === 'right' ? '0' : 'auto' }}
                                onClick={e => e.stopPropagation()}
                              >
                                {LUDO_EMOJIS.map(em => (
                                  <button
                                    key={em}
                                    onPointerDown={e => { e.stopPropagation(); sendEmojiReaction(p.user_id, em); }}
                                    className="w-8 h-8 text-xl rounded-lg hover:bg-white/10 active:scale-90 transition flex items-center justify-center"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {diceSide === 'right' && renderDiceSlot(p)}
                    </div>
                  );


// ─── PART 5: CSS animation — أضف داخل <style> ───────────────────
// أضف بعد آخر @keyframes في الـ <style> tag:

        @keyframes ludoEmojiFloat {
          0%   { opacity: 1;   transform: translateX(-50%) translateY(0)   scale(1);    }
          60%  { opacity: 1;   transform: translateX(-50%) translateY(-18px) scale(1.2); }
          100% { opacity: 0;   transform: translateX(-50%) translateY(-32px) scale(0.9); }
        }


// ─── PART 6: Close picker on outside click ───────────────────────
// في الـ main wrapper div الأول (fixed inset-0):
// عدّل الـ onClick ليكون:
//   onClick={() => { setShowSettingsMenu(false); setOpenEmojiPicker(null); onClose(); }}
// وفي الـ inner div (bg-slate-900):
//   onClick={e => { e.stopPropagation(); setOpenEmojiPicker(null); }}