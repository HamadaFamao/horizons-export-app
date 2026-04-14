import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLastSeenUpdate } from '@/hooks/useLastSeenUpdate';
import {
  loadThreadMessages,
  markMessagesAsSeen,
  deleteMessageForUser,
  getUserRole,
  getOrCreateThread,
} from '@/lib/messageUtils';
import { sendGiftSecure } from '@/lib/sendGiftSecure';
import { handleGiftSendSuccess, handleGiftSendError } from '@/lib/giftUIHelpers';
import { getEmojiFromMessage, shouldTriggerBurst } from '@/lib/emojiUtils';
import {
  shouldChatBeUnlocked,
  getTimeUntilLock,
  formatTimeRemaining,
  formatOpenUntilTime,
} from '@/lib/chatLockUtils';
import ChatGiftModal from '@/components/ChatGiftModal';
import ChatLockedBanner from '@/components/ChatLockedBanner';
import ChatUnlockCountdownBanner from '@/components/ChatUnlockCountdownBanner';
import ImprovedEmojiPicker from '@/components/ImprovedEmojiPicker';
import EmojiBurst from '@/components/EmojiBurst';
import UserAvatar from '@/components/UserAvatar';
import TypingIndicator from '@/components/TypingIndicator';
import OnlineStatus from '@/components/OnlineStatus';
import { Loader2, ArrowLeft, Send, MoreVertical, Trash2 } from 'lucide-react';
import { getVipInfo } from '@/utils/vip';

// ─── Timestamp formatter ───────────────────────────────────────────────────
const formatMessageTimestamp = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (msgDate.getTime() === today.getTime()) return timeStr;
  if (msgDate.getTime() === yesterday.getTime()) return `Yesterday ${timeStr}`;
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: msgDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }) + ` ${timeStr}`;
};

// ─── MessageItem ───────────────────────────────────────────────────────────
const MessageItem = ({ message, currentUser, userRole, onDelete, setContextMenu, contextMenu, setEmojiBurst }) => {
  const isOwn = message.sender_id === currentUser?.id;
  const isVoiceMessage = message.body?.startsWith('VOICE_MESSAGE:');
  const voiceUrl = isVoiceMessage ? message.body.replace('VOICE_MESSAGE:', '') : null;
  const isGift =
    message.body?.startsWith('🎁') ||
    message.body?.includes('SENT_GIFT:') ||
    message.body?.includes('SENT_GIFT_JSON:');
  const emoji = getEmojiFromMessage(message.body);
  const isEmojiMessage = emoji !== null;
  const messageRef = useRef(null);

  useEffect(() => {
    if (isEmojiMessage && shouldTriggerBurst(emoji)) {
      const timer = setTimeout(() => {
        if (messageRef.current) {
          const rect = messageRef.current.getBoundingClientRect();
          setEmojiBurst({ x: rect.left + rect.width / 2, y: rect.top, key: message.id });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEmojiMessage, emoji, message.id, setEmojiBurst]);

  const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
  if (message[deleteFlag]) return null;

  // Voice message
  if (isVoiceMessage) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${isOwn ? 'bg-blue-500 rounded-br-none' : 'bg-white border rounded-bl-none shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎙️</span>
            <span className={`text-xs font-medium ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>Voice Message</span>
          </div>
          <audio src={voiceUrl} controls className="max-w-[200px] h-8" />
          <div className={`text-[10px] mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
            {formatMessageTimestamp(message.created_at)}
          </div>
        </div>
      </div>
    );
  }

  // Gift message
  if (isGift) {
    let displayBody = message.body;
    let giftEmoji = '🎁';
    let giftName = 'Gift';
    let giftIconUrl = '';
    if (message.body?.includes('SENT_GIFT_JSON:')) {
      try {
        const raw = message.body.split('SENT_GIFT_JSON:')[1] || '';
        const parsed = JSON.parse(raw);
        giftName = parsed?.giftName || 'Gift';
        giftIconUrl = parsed?.iconUrl || '';
        displayBody = parsed?.message || '';
      } catch (e) { console.error('[CHAT_GIFT_PARSE_ERROR]', e); }
    } else if (message.body.includes('SENT_GIFT:')) {
      const parts = message.body.split(':');
      if (parts.length >= 2) { giftName = parts[1]; giftEmoji = parts[2] || '🎁'; displayBody = parts.slice(3).join(':') || ''; }
    }
    const isSystemMessage = displayBody === '🎁 A gift was sent' || displayBody === '🎁 You sent a gift';
    return (
      <div className="flex justify-center my-4">
        <div className="max-w-[220px] rounded-3xl border border-pink-200 bg-pink-50 shadow-sm px-4 py-4 text-center relative group transition-all duration-200 hover:scale-[1.01]">
          {giftIconUrl ? (
            <img src={giftIconUrl} alt={giftName} className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="text-4xl mb-3">{giftEmoji}</div>
          )}
          <p className="text-[28px] font-bold text-pink-900 leading-tight">{giftName}</p>
          <p className="mt-2 text-sm text-pink-700">{isOwn ? '✓ You sent a gift' : '✓ A gift was sent'}</p>
          {displayBody && !isSystemMessage && (
            <div className="mt-2 text-sm pt-2 border-t border-pink-200/60 text-pink-900 italic">"{displayBody}"</div>
          )}
          <p className="mt-2 text-xs text-pink-400">{formatMessageTimestamp(message.created_at)}</p>
          <button onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu?.messageId === message.id ? null : { messageId: message.id }); }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-pink-100 rounded text-pink-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {contextMenu?.messageId === message.id && (
            <div className="absolute top-8 right-[-80px] bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden">
              <button onClick={() => onDelete(message.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 className="w-3 h-3" /> Delete for me
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Big emoji message
  if (isEmojiMessage) {
    return (
      <div ref={messageRef} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-6 group`}>
        <div className="flex flex-col items-center gap-1 relative">
          <div className={`w-24 h-24 flex items-center justify-center rounded-2xl shadow-md ${isOwn ? 'bg-blue-100 border-2 border-blue-300' : 'bg-white border-2 border-gray-100'}`}
            style={{ animation: 'emoji-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <span className="text-6xl select-none">{emoji}</span>
          </div>
          <p className="text-xs text-gray-400">{formatMessageTimestamp(message.created_at)}</p>
          <button onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu?.messageId === message.id ? null : { messageId: message.id }); }}
            className="absolute top-0 -right-6 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded text-gray-500">
            <MoreVertical className="w-4 h-4" />
          </button>
          {contextMenu?.messageId === message.id && (
            <div className="absolute top-6 -right-32 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden">
              <button onClick={() => onDelete(message.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 className="w-3 h-3" /> Delete for me
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal text message
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-2xl relative shadow-sm ${isOwn ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-gray-900 border border-gray-100 rounded-bl-none'}`}>
        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div className={`flex items-center justify-between mt-1 gap-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
          <p className="text-[10px]">{formatMessageTimestamp(message.created_at)}</p>
          {isOwn && message.seen_at && <span className="text-[10px]">✓ Seen</span>}
          {isOwn && !message.seen_at && <span className="text-[10px]">✓</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu?.messageId === message.id ? null : { messageId: message.id }); }}
          className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full`}>
          <MoreVertical className="w-3 h-3" />
        </button>
        {contextMenu?.messageId === message.id && (
          <div className={`absolute top-6 ${isOwn ? 'left-0' : 'right-0'} bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden`}>
            <button onClick={() => onDelete(message.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Trash2 className="w-3 h-3" /> Delete for me
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ChatPage ──────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { threadId: routeParamId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [language] = useState('en');

  useLastSeenUpdate(currentUser?.id);

  // ── State ──────────────────────────────────────────────────────────────
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState(null);
  const [emojiBurst, setEmojiBurst] = useState(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Chat locking
  const [isChatUnlocked, setIsChatUnlocked] = useState(true);
  const [userIsVIP, setUserIsVIP] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState(null);
  const [openUntil, setOpenUntil] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [openUntilLabel, setOpenUntilLabel] = useState(null);

  // Menu & clear
  const [showMenu, setShowMenu] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Block / Mute / DND
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [otherUserDND, setOtherUserDND] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const typingChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEventRef = useRef(0);
  const lastSeenRefreshIntervalRef = useRef(null);
  const threadRefreshIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────────────
  const playNotificationSound = () => {
    if (isMuted) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.debug('Audio notification not available');
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────

  // Auto-scroll
  useEffect(() => {
    if (!loading && messages && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [thread?.id, loading, messages?.length]);

  // Countdown timer
  useEffect(() => {
    if (!openUntil) { setTimeRemaining(null); setOpenUntilLabel(null); return; }
    const update = () => { setTimeRemaining(formatTimeRemaining(openUntil)); setOpenUntilLabel(formatOpenUntilTime(openUntil)); };
    update();
    countdownIntervalRef.current = setInterval(update, 30000);
    return () => clearInterval(countdownIntervalRef.current);
  }, [openUntil]);

  // Load mute from localStorage when thread is ready
  useEffect(() => {
    if (!thread?.id) return;
    const muted = localStorage.getItem(`muted_thread_${thread.id}`) === 'true';
    setIsMuted(muted);
  }, [thread?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showMenu]);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => clearInterval(recordingTimerRef.current);
  }, []);

  // ── Initial data load ──────────────────────────────────────────────────
  const fetchThreadData = async (threadId, userId) => {
    if (!threadId || !userId) return;
    try {
      const { data: threadData, error } = await supabase
        .from('threads').select('open_until, user_a, user_b').eq('id', threadId).single();
      if (error) return;
      setThread((prev) => ({ ...prev, ...threadData }));
      setOpenUntil(threadData.open_until ? new Date(threadData.open_until) : null);
      const { data: profile } = await supabase.from('profiles').select('vip_until').eq('id', userId).single();
      const vipUntil = profile?.vip_until;
      setIsChatUnlocked(shouldChatBeUnlocked(threadData.open_until, vipUntil));
      setTimeUntilLock(getTimeUntilLock(threadData.open_until));
    } catch (err) {
      console.error('Exception fetching thread:', err);
    }
  };

  useEffect(() => {
    if (!currentUser?.id || !routeParamId) return;

    const initializeChat = async () => {
      try {
        setLoading(true);
        let threadData = null;
        let targetUserId = null;

        const { data: existingThread } = await supabase.from('threads').select('*').eq('id', routeParamId).single();
        if (existingThread) {
          threadData = existingThread;
          targetUserId = existingThread.user_a === currentUser.id ? existingThread.user_b : existingThread.user_a;
        } else {
          targetUserId = routeParamId;
          const threadResult = await getOrCreateThread(currentUser.id, targetUserId);
          if (threadResult.status === 'error') {
            const { data: userCheck } = await supabase.from('profiles').select('id').eq('id', targetUserId).single();
            if (!userCheck) { toast({ title: 'Error', description: 'Chat not found', variant: 'destructive' }); navigate('/messages'); return; }
          } else {
            threadData = threadResult.thread;
          }
        }

        setThread(threadData);
        setRecipientId(targetUserId);
        setOpenUntil(threadData?.open_until ? new Date(threadData.open_until) : null);

        // VIP
        const { data: userProfile } = await supabase.from('profiles').select('vip_until').eq('id', currentUser.id).single();
        const vipUntil = userProfile?.vip_until;
        if (vipUntil && new Date(vipUntil) > new Date()) setUserIsVIP(true);

        if (threadData) {
          const role = getUserRole(threadData, currentUser.id);
          setUserRole(role);
          setIsChatUnlocked(shouldChatBeUnlocked(threadData.open_until, vipUntil));
          setTimeUntilLock(getTimeUntilLock(threadData.open_until));

          const messagesResult = await loadThreadMessages(threadData.id, currentUser.id);
          if (messagesResult.status === 'ok') {
            setMessages(Array.isArray(messagesResult.messages) ? messagesResult.messages : []);
          }

          await markMessagesAsSeen(threadData.id, currentUser.id);

          // Clear unread badge
          await supabase.from('unread_messages')
            .update({ unread_count: 0 })
            .eq('user_id', currentUser.id)
            .eq('thread_id', threadData.id);
        }

        // Other user profile
        const { data: userData } = await supabase
          .from('profiles').select('id, name, avatar_url, age, last_seen, is_vip, vip_number, vip_until, do_not_disturb')
          .eq('id', targetUserId).single();
        if (userData) {
          setOtherUser(userData);
          setOtherUserLastSeen(userData.last_seen);
          setOtherUserDND(!!userData.do_not_disturb);
        }

        // Wallet
        const { data: walletData } = await supabase.from('wallets').select('coins, gems, level, xp').eq('user_id', currentUser.id).single();
        if (walletData) setWallet(walletData);

        // Block status
        const { data: iBlockedThem } = await supabase.from('blocks').select('id')
          .eq('blocker', currentUser.id).eq('blocked', targetUserId).maybeSingle();
        setIsBlocked(!!iBlockedThem);

        const { data: theyBlockedMe } = await supabase.from('blocks').select('id')
          .eq('blocker', targetUserId).eq('blocked', currentUser.id).maybeSingle();
        setBlockedByOther(!!theyBlockedMe);

      } catch (err) {
        console.error('Error initializing chat:', err);
        toast({ title: 'Error', description: 'Failed to load chat', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [currentUser?.id, routeParamId, navigate, toast]);

  // Thread refresh interval
  useEffect(() => {
    if (!thread?.id || !currentUser?.id) return;
    threadRefreshIntervalRef.current = setInterval(() => fetchThreadData(thread.id, currentUser.id), 30000);
    return () => clearInterval(threadRefreshIntervalRef.current);
  }, [thread?.id, currentUser?.id]);

  // Last seen refresh
  useEffect(() => {
    if (!recipientId) return;
    const refreshLastSeen = async () => {
      const { data } = await supabase.from('profiles').select('last_seen').eq('id', recipientId).single();
      if (data) setOtherUserLastSeen(data.last_seen);
    };
    refreshLastSeen();
    lastSeenRefreshIntervalRef.current = setInterval(refreshLastSeen, 20000);
    return () => clearInterval(lastSeenRefreshIntervalRef.current);
  }, [recipientId]);

  // Real-time: Messages
  useEffect(() => {
    if (!thread?.id || !currentUser?.id || !userRole) return;
    if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);

    const channel = supabase.channel(`messages:${thread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${thread.id}` },
        (payload) => {
          const newMessage = payload.new;
          const isGiftMessage = newMessage?.body?.includes('SENT_GIFT_JSON:') || newMessage?.body?.includes('SENT_GIFT:') || newMessage?.body?.startsWith('🎁');
          if (newMessage.sender_id === currentUser.id && !isGiftMessage) return;
          const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
          if (newMessage[deleteFlag]) return;
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [newMessage];
            if (prev.some((msg) => msg.id === newMessage.id)) return prev;
            playNotificationSound();
            setOtherUserTyping(false);
            return [...prev, newMessage];
          });
          markMessagesAsSeen(thread.id, currentUser.id);
        })
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => { if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; } };
  }, [thread?.id, currentUser?.id, userRole, isMuted]);

  // Real-time: Typing
  useEffect(() => {
    if (!thread?.id || !currentUser?.id) return;
    const channel = supabase.channel(`typing:${thread.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== currentUser.id) setOtherUserTyping(payload.payload.isTyping);
      }).subscribe();
    typingChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); typingChannelRef.current = null; };
  }, [thread?.id, currentUser?.id]);

  // Real-time: Block changes
  useEffect(() => {
    if (!currentUser?.id || !recipientId) return;
    const channel = supabase.channel(`blocks_rt_${currentUser.id}_${recipientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        const isMyBlock = String(row.blocker) === String(currentUser.id) && String(row.blocked) === String(recipientId);
        const isTheirBlock = String(row.blocker) === String(recipientId) && String(row.blocked) === String(currentUser.id);
        if (isMyBlock) setIsBlocked(payload.eventType === 'INSERT');
        if (isTheirBlock) setBlockedByOther(payload.eventType === 'INSERT');
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, recipientId]);

  // Real-time: DND changes
  useEffect(() => {
    if (!recipientId) return;
    const channel = supabase.channel(`dnd_rt_${recipientId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${recipientId}` },
        (payload) => { if (payload?.new?.do_not_disturb !== undefined) setOtherUserDND(!!payload.new.do_not_disturb); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [recipientId]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const broadcastTypingStatus = (isTyping) => {
    if (!typingChannelRef.current || !thread?.id || !currentUser?.id) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUser.id, isTyping } });
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    const now = Date.now();
    if (now - lastTypingEventRef.current > 300 && newValue.trim().length > 0) {
      broadcastTypingStatus(true);
      lastTypingEventRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => broadcastTypingStatus(false), 1000);
  };

  const handleInputClear = () => {
    setInputValue('');
    broadcastTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || !thread?.id || !currentUser?.id) return;

    if (isBlocked) {
      toast({ title: 'Cannot send', description: 'You have blocked this user.', variant: 'destructive' });
      return;
    }
    if (blockedByOther) {
      toast({ title: 'Cannot send', description: 'You cannot message this person right now.', variant: 'destructive' });
      return;
    }
    if (otherUserDND) {
      toast({ title: 'Cannot send', description: `${otherUser?.name} is not accepting messages right now.`, variant: 'destructive' });
      return;
    }
    if (!isChatUnlocked) {
      toast({ title: 'Chat locked', description: 'Chat is locked. Send a gift to unlock.', variant: 'destructive' });
      return;
    }

    try {
      setIsSending(true);
      const { data, error } = await supabase.from('messages')
        .insert({ thread_id: thread.id, sender_id: currentUser.id, body: trimmedInput, created_at: new Date().toISOString() })
        .select().single();
      if (error) { toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' }); return; }
      setMessages((prev) => Array.isArray(prev) ? [...prev, data] : [data]);
      handleInputClear();
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGift = async (giftData) => {
    if (isSendingGift || !giftData?.gift_id || !currentUser?.id || !recipientId) return;
    try {
      setIsSendingGift(true);
      const result = await sendGiftSecure({ senderId: currentUser.id, recipientId, giftId: giftData.gift_id, message: giftData.message || '' });
      if (result.status === 'error') { handleGiftSendError({ result, showToast: toast, navigate, language }); return; }
      giftData.giftName = giftData?.giftName || giftData?.gift?.name_en || giftData?.name_en || 'Gift';
      giftData.iconUrl = giftData?.iconUrl || giftData?.gift?.icon_url || giftData?.icon_url || '';
      await handleGiftSendSuccess({
        result, giftData, setWallet, showToast: toast, setShowGiftModal, language,
        senderId: currentUser.id, recipientId,
        onGiftMessageCreated: (newMessage) => {
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [newMessage];
            if (prev.some((msg) => String(msg.id) === String(newMessage.id))) return prev;
            return [...prev, newMessage];
          });
        },
      });
      const freshMessages = await loadThreadMessages(thread.id, currentUser.id);
      if (freshMessages.status === 'ok' && Array.isArray(freshMessages.messages)) setMessages(freshMessages.messages);
      await fetchThreadData(thread.id, currentUser.id);
      toast({ title: 'Unlocked', description: 'Chat unlocked! You can now send messages.' });
      setShowGiftModal(false);
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' });
    } finally {
      setIsSendingGift(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!userRole) return;
    try {
      const result = await deleteMessageForUser(messageId, userRole);
      if (result.status === 'ok') {
        setMessages((prev) => Array.isArray(prev) ? prev.filter((msg) => msg.id !== messageId) : []);
        setContextMenu(null);
        toast({ title: 'Deleted', description: 'Message deleted' });
      } else {
        toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const handleClearChat = () => setShowClearConfirm(true);

  const confirmClearChat = async () => {
    if (!thread?.id || !userRole || clearingChat) return;
    setClearingChat(true);
    try {
      const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
      const { error } = await supabase.from('messages').update({ [deleteFlag]: true }).eq('thread_id', thread.id);
      if (error) throw error;
      setMessages([]);
      setShowClearConfirm(false);
      toast({ title: 'Chat cleared', description: 'Your chat history has been cleared.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear chat', variant: 'destructive' });
    } finally {
      setClearingChat(false);
    }
  };

  const toggleMute = () => {
    if (!thread?.id) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(`muted_thread_${thread.id}`, String(newMuted));
    toast({ title: newMuted ? '🔕 Chat Muted' : '🔔 Chat Unmuted', description: newMuted ? 'Notification sound muted for this chat' : 'Notifications enabled' });
  };

  const handleBlock = async () => {
    if (!currentUser?.id || !recipientId || blocking) return;
    setBlocking(true);
    try {
      const { error } = await supabase.from('blocks').insert({ blocker: currentUser.id, blocked: recipientId });
      if (error) throw error;
      setIsBlocked(true);
      setShowBlockConfirm(false);
      toast({ title: '🚫 User Blocked', description: `${otherUser?.name} has been blocked.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!currentUser?.id || !recipientId || blocking) return;
    setBlocking(true);
    try {
      const { error } = await supabase.from('blocks').delete().eq('blocker', currentUser.id).eq('blocked', recipientId);
      if (error) throw error;
      setIsBlocked(false);
      toast({ title: '✅ Unblocked', description: `${otherUser?.name} has been unblocked.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) setVoiceBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => { if (prev >= 120) { stopRecording(); return prev; } return prev + 1; });
      }, 1000);
    } catch (err) {
      toast({ title: 'Microphone Error', description: 'Could not access microphone', variant: 'destructive' });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) { audioChunksRef.current = []; mediaRecorderRef.current.stop(); }
    setIsRecording(false);
    setVoiceBlob(null);
    setRecordingSeconds(0);
    clearInterval(recordingTimerRef.current);
  };

  const sendVoiceMessage = async () => {
    if (!voiceBlob || !thread?.id || !currentUser?.id) return;
    setSendingVoice(true);
    try {
      const fileName = `voice_${currentUser.id}_${Date.now()}.webm`;
      const filePath = `voice-messages/${thread.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('profile-photos').upload(filePath, voiceBlob, { contentType: 'audio/webm', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      const { data, error } = await supabase.from('messages')
        .insert({ thread_id: thread.id, sender_id: currentUser.id, body: `VOICE_MESSAGE:${urlData.publicUrl}`, created_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      setMessages((prev) => Array.isArray(prev) ? [...prev, data] : [data]);
      setVoiceBlob(null);
      setRecordingSeconds(0);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send voice message', variant: 'destructive' });
    } finally {
      setSendingVoice(false);
    }
  };

  const isInputDisabled = !isChatUnlocked || isBlocked || blockedByOther || otherUserDND;

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!thread || !otherUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 mb-4">Chat not found</p>
        <button onClick={() => navigate('/messages')} className="text-blue-500 hover:underline">Go back to messages</button>
      </div>
    );
  }

  const vipInfo = getVipInfo(otherUser);
  const isVip = vipInfo.isVip;

  const inputPlaceholder = blockedByOther
    ? 'You cannot message this person...'
    : otherUserDND
    ? `${otherUser?.name} is not accepting messages...`
    : isBlocked
    ? 'You blocked this user...'
    : isChatUnlocked
    ? 'Type a message...'
    : 'Chat is locked...';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/user/${otherUser.id}`)}>
            <div className="relative">
              <UserAvatar user={otherUser} size="md" className={isVip ? 'ring-2 ring-yellow-400' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-900 leading-tight">{otherUser.name}</p>
                {vipInfo.isVip && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700">
                    {vipInfo.label} 👑
                  </span>
                )}
              </div>
              {otherUserTyping ? (
                <p className="text-xs text-blue-500 font-medium animate-pulse">typing...</p>
              ) : (
                <OnlineStatus lastSeen={otherUserLastSeen} />
              )}
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setShowMenu((prev) => !prev); }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[180px] overflow-hidden">
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleClearChat(); }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Clear Chat
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); toggleMute(); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                {isMuted ? '🔔 Unmute Chat' : '🔕 Mute Chat'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (isBlocked) handleUnblock(); else setShowBlockConfirm(true); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                {isBlocked ? '✅ Unblock User' : '🚫 Block User'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Chat Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Chat?</h3>
              <p className="text-sm text-gray-500 mb-6">This will clear the chat for you only. The other person will still see all messages.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition">Cancel</button>
                <button onClick={confirmClearChat} disabled={clearingChat} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center">
                  {clearingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirm Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBlockConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🚫</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Block {otherUser?.name}?</h3>
              <p className="text-sm text-gray-500 mb-6">They won't be able to send you messages anymore.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowBlockConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleBlock} disabled={blocking} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center">
                  {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100/50" onClick={() => setShowEmojiPicker(false)}>
        {Array.isArray(messages) && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center mt-[-40px]">
            <div className="bg-white p-4 rounded-full shadow-sm mb-3"><span className="text-4xl">👋</span></div>
            <p className="text-gray-900 font-medium">No messages yet</p>
            <p className="text-sm text-gray-500 mt-1">Start the conversation with {otherUser.name}!</p>
          </div>
        ) : (
          Array.isArray(messages) && messages.map((message, index) => {
            const msgDate = new Date(message.created_at).toLocaleDateString();
            const prevMsgDate = index > 0 ? new Date(messages[index - 1].created_at).toLocaleDateString() : null;
            const showDateSeparator = msgDate !== prevMsgDate;
            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium px-2">
                      {new Date(message.created_at).toLocaleDateString([], {
                        weekday: 'short', day: 'numeric', month: 'short',
                        year: new Date(message.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                      })}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <MessageItem
                  message={message} currentUser={currentUser} userRole={userRole}
                  onDelete={handleDeleteMessage} setContextMenu={setContextMenu}
                  contextMenu={contextMenu} setEmojiBurst={setEmojiBurst}
                />
              </React.Fragment>
            );
          })
        )}
        {otherUserTyping && <TypingIndicator userName={otherUser.name} />}
        <div ref={messagesEndRef} />
        {emojiBurst && <EmojiBurst x={emojiBurst.x} y={emojiBurst.y} key={emojiBurst.key} />}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-3 safe-area-bottom z-20">
        {/* Status banners */}
        {isBlocked && (
          <div className="px-4 py-2 bg-red-50 border border-red-100 rounded-xl mb-2 flex items-center justify-between">
            <span className="text-sm text-red-600 font-medium">🚫 You blocked {otherUser?.name}</span>
            <button onClick={handleUnblock} className="text-xs text-red-500 underline hover:text-red-700">Unblock</button>
          </div>
        )}
        {blockedByOther && (
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl mb-2 flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">💬 You cannot send messages to this person right now.</span>
          </div>
        )}
        {otherUserDND && (
          <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl mb-2 flex items-center gap-2">
            <span className="text-lg">🔕</span>
            <span className="text-sm text-amber-700 font-medium">{otherUser?.name} is not accepting messages right now.</span>
          </div>
        )}

        {/* Voice recording state */}
        {isRecording && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-600 flex-1">
              Recording... {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
            </span>
            <button onClick={cancelRecording} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
            <button onClick={stopRecording} className="bg-red-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-red-600">Stop</button>
          </div>
        )}

        {/* Voice preview state */}
        {voiceBlob && !isRecording && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl mb-2">
            <audio src={URL.createObjectURL(voiceBlob)} controls className="flex-1 h-8" />
            <button onClick={() => setVoiceBlob(null)} className="text-gray-500 hover:text-gray-700 text-sm">✕</button>
            <button onClick={sendVoiceMessage} disabled={sendingVoice}
              className="bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-blue-600 disabled:opacity-50">
              {sendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </button>
          </div>
        )}

        {isChatUnlocked && !userIsVIP && openUntil && timeRemaining && (
          <ChatUnlockCountdownBanner timeRemaining={timeRemaining} openUntilLabel={openUntilLabel} />
        )}
        {!isChatUnlocked && <ChatLockedBanner timeRemaining={timeUntilLock} userIsVIP={userIsVIP} />}

        <ImprovedEmojiPicker isOpen={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onEmojiSelect={handleEmojiSelect} />

        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          {/* Emoji button */}
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={isInputDisabled}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-colors ${showEmojiPicker ? 'bg-gray-100 text-gray-800' : 'text-gray-500'} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            title="Add emoji">
            <span className="text-xl leading-none">😀</span>
          </button>

          {/* Voice button */}
          {!isRecording && !voiceBlob && (
            <button onClick={startRecording} disabled={isInputDisabled}
              className="flex-shrink-0 p-2.5 hover:bg-gray-100 text-gray-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Record voice message">
              <span className="text-xl">🎙️</span>
            </button>
          )}
          {isRecording && (
            <button onClick={stopRecording} className="flex-shrink-0 p-2.5 bg-red-100 text-red-500 rounded-xl animate-pulse">
              <span className="text-xl">⏹️</span>
            </button>
          )}

          {/* Text input */}
          <textarea
            ref={inputRef} value={inputValue} onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            disabled={isInputDisabled} placeholder={inputPlaceholder}
            className={`flex-1 px-4 py-3 border rounded-2xl resize-none focus:outline-none focus:ring-2 transition-all text-sm md:text-base min-h-[48px] max-h-[120px] ${!isInputDisabled ? 'bg-gray-50 border-gray-200 focus:ring-blue-100 focus:border-blue-300 focus:bg-white' : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed placeholder:text-gray-400'}`}
            rows={1}
          />

          {/* Gift button */}
          <button onClick={() => setShowGiftModal(true)} className="flex-shrink-0 p-2.5 hover:bg-pink-50 text-pink-500 rounded-xl transition-colors" title="Send a gift">
            <span className="text-xl leading-none">🎁</span>
          </button>

          {/* Send button */}
          <button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending || isInputDisabled}
            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center text-white rounded-xl font-bold transition-all shadow-sm ${isInputDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400'}`}>
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
      </div>

      <ChatGiftModal isOpen={showGiftModal} onClose={() => setShowGiftModal(false)} recipientId={recipientId} recipientName={otherUser.name} onGiftSelected={handleSendGift} isLoading={isSendingGift} />

      <style>{`
        @keyframes emoji-pop {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
