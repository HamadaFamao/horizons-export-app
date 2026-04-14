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

const formatMessageTimestamp = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (msgDate.getTime() === today.getTime()) {
    return timeStr;
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${timeStr}`;
  } else {
    return date.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: msgDate.getFullYear() !== now.getFullYear()
        ? 'numeric'
        : undefined,
    }) + ` ${timeStr}`;
  }
};

// Sub-component for individual messages to allow Hooks usage
const MessageItem = ({
  message,
  currentUser,
  userRole,
  onDelete,
  setContextMenu,
  contextMenu,
  setEmojiBurst
}) => {
  const isOwn = message.sender_id === currentUser?.id;
  const isVoiceMessage = message.body?.startsWith('VOICE_MESSAGE:');
  const voiceUrl = isVoiceMessage
    ? message.body.replace('VOICE_MESSAGE:', '')
    : null;
  const isGift =
    message.body?.startsWith('🎁') ||
    message.body?.includes('SENT_GIFT:') ||
    message.body?.includes('SENT_GIFT_JSON:');
  const emoji = getEmojiFromMessage(message.body);
  const isEmojiMessage = emoji !== null;
  const messageRef = useRef(null);

  // Trigger burst effect for emoji messages
  useEffect(() => {
    if (isEmojiMessage && shouldTriggerBurst(emoji)) {
      // Small delay to ensure layout is done
      const timer = setTimeout(() => {
        if (messageRef.current) {
          const rect = messageRef.current.getBoundingClientRect();
          setEmojiBurst({
            x: rect.left + rect.width / 2,
            y: rect.top,
            key: message.id,
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEmojiMessage, emoji, message.id, setEmojiBurst]);

  // Check if deleted for me
  const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
  if (message[deleteFlag]) return null;

  if (isVoiceMessage) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${
          isOwn
            ? 'bg-blue-500 rounded-br-none'
            : 'bg-white border rounded-bl-none shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎙️</span>
            <span className={`text-xs font-medium ${
              isOwn ? 'text-blue-100' : 'text-gray-500'
            }`}>
              Voice Message
            </span>
          </div>
          <audio
            src={voiceUrl}
            controls
            className="max-w-[200px] h-8"
          />
        </div>
      </div>
    );
  }

  if (isGift) {
    let displayBody = message.body;
    let giftEmoji = '🎁';
    let giftName = 'Gift';
    let giftIconUrl = '';

    // Attempt to parse special gift format
    if (message.body?.includes('SENT_GIFT_JSON:')) {
      try {
        const raw = message.body.split('SENT_GIFT_JSON:')[1] || '';
        const parsed = JSON.parse(raw);

        giftName = parsed?.giftName || 'Gift';
        giftIconUrl = parsed?.iconUrl || '';
        displayBody = parsed?.message || '';

        console.log('[CHAT_GIFT_PARSED]', {
          giftName,
          giftIconUrl,
          displayBody
        });
      } catch (e) {
        console.error('[CHAT_GIFT_PARSE_ERROR]', e);
      }
    } else if (message.body.includes('SENT_GIFT:')) {
      const parts = message.body.split(':');
      if (parts.length >= 2) {
        giftName = parts[1];
        giftEmoji = parts[2] || '🎁';
        displayBody = parts.slice(3).join(':') || '';
      }
    }

    // If the message body is just the standard system message, don't show it as a quote
    const isSystemMessage = displayBody === '🎁 A gift was sent' || displayBody === '🎁 You sent a gift';

    return (
      <div className="flex justify-center my-4">
        <div className="max-w-[220px] rounded-3xl border border-pink-200 bg-pink-50 shadow-sm px-4 py-4 text-center relative group transition-all duration-200 hover:scale-[1.01]">
          {giftIconUrl ? (
            <img
              src={giftIconUrl}
              alt={giftName}
              className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="text-4xl mb-3">{giftEmoji}</div>
          )}
          <p className="text-[28px] font-bold text-pink-900 leading-tight">{giftName}</p>
          <p className="mt-2 text-sm text-pink-700">
            {isOwn ? '✓ You sent a gift' : '✓ A gift was sent'}
          </p>
          {displayBody && !isSystemMessage && (
            <div className="mt-2 text-sm pt-2 border-t border-pink-200/60 text-pink-900 italic">
              "{displayBody}"
            </div>
          )}
          <p className="mt-2 text-xs text-pink-400">
            {formatMessageTimestamp(message.created_at)}
          </p>

          {/* Message actions menu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(
                contextMenu?.messageId === message.id ? null : { messageId: message.id }
              );
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-pink-100 rounded text-pink-400"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {contextMenu?.messageId === message.id && (
            <div className="absolute top-8 right-[-80px] bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden">
              <button
                onClick={() => onDelete(message.id)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Delete for me
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
      <div
        ref={messageRef}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-6 group`}
      >
        <div className="flex flex-col items-center gap-1 relative">
          <div
            className={`w-24 h-24 flex items-center justify-center rounded-2xl animate-emoji-pop shadow-md ${isOwn
              ? 'bg-blue-100 border-2 border-blue-300'
              : 'bg-white border-2 border-gray-100'
              }`}
            style={{
              animation: 'emoji-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <span className="text-6xl select-none">{emoji}</span>
          </div>
          <p className="text-xs text-gray-400">
            {formatMessageTimestamp(message.created_at)}
          </p>

          {/* Message actions menu - Floating outside for big emoji */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(
                contextMenu?.messageId === message.id ? null : { messageId: message.id }
              );
            }}
            className="absolute top-0 -right-6 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {contextMenu?.messageId === message.id && (
            <div className="absolute top-6 -right-32 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden">
              <button
                onClick={() => onDelete(message.id)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Delete for me
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal text message
  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 group`}
    >
      <div
        className={`max-w-[80%] px-4 py-2 rounded-2xl relative shadow-sm ${isOwn
          ? 'bg-blue-500 text-white rounded-br-none'
          : 'bg-white text-gray-900 border border-gray-100 rounded-bl-none'
          }`}
      >
        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div className={`flex items-center justify-between mt-1 gap-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
          <p className="text-[10px]">
            {formatMessageTimestamp(message.created_at)}
          </p>
          {isOwn && message.seen_at && (
            <span className="text-[10px]">✓ Seen</span>
          )}
          {isOwn && !message.seen_at && (
            <span className="text-[10px]">✓</span>
          )}
        </div>

        {/* Message actions menu */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu(
              contextMenu?.messageId === message.id ? null : { messageId: message.id }
            );
          }}
          className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full`}
        >
          <MoreVertical className="w-3 h-3" />
        </button>

        {contextMenu?.messageId === message.id && (
          <div className={`absolute top-6 ${isOwn ? 'left-0' : 'right-0'} bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden`}>
            <button
              onClick={() => onDelete(message.id)}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" />
              Delete for me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. REAL-TIME BLOCK SYNC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
      if (!currentUser?.id || !recipientId) return;
      const channel = supabase
        .channel(`blocks_rt_${currentUser.id}_${recipientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocks',
          },
          (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            const isMyBlock = 
              String(row.blocker) === String(currentUser.id) &&
              String(row.blocked) === String(recipientId);
            const isTheirBlock = 
              String(row.blocker) === String(recipientId) &&
              String(row.blocked) === String(currentUser.id);
            if (isMyBlock) {
              setIsBlocked(payload.eventType === 'INSERT');
            }
            if (isTheirBlock) {
              setBlockedByOther(payload.eventType === 'INSERT');
            }
          }
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }, [currentUser?.id, recipientId]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. REAL-TIME DND SYNC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
      if (!recipientId) return;
      const channel = supabase
        .channel(`dnd_rt_${recipientId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${recipientId}`,
          },
          (payload) => {
            if (payload?.new?.do_not_disturb !== undefined) {
              setOtherUserDND(!!payload.new.do_not_disturb);
            }
          }
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }, [recipientId]);
  const { threadId: routeParamId } = useParams();

  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [language] = useState('en');

  // Use last seen update hook for current user
  useLastSeenUpdate(currentUser?.id);

  // State
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

  // Chat locking state
  const [isChatUnlocked, setIsChatUnlocked] = useState(true);
  const [userIsVIP, setUserIsVIP] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState(null);
  const [openUntil, setOpenUntil] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [openUntilLabel, setOpenUntilLabel] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [otherUserDND, setOtherUserDND] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);

  // Refs
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

  // Helper: Play notification sound
  const playNotificationSound = () => {
    if (isMuted) {
      console.log('[MUTE] Notification sound blocked by mute');
      return;
    }
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800 Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.debug('Audio notification not available');
    }
  };

  // Auto-scroll to bottom when messages load or change
  useEffect(() => {
    if (!loading && messages && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      });
    }
  }, [thread?.id, loading, messages?.length]);

  // Update countdown timer
  useEffect(() => {
    if (!openUntil) {
      setTimeRemaining(null);
      setOpenUntilLabel(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = formatTimeRemaining(openUntil);
      const label = formatOpenUntilTime(openUntil);

      setTimeRemaining(remaining);
      setOpenUntilLabel(label);

      // If time has expired, trigger a refresh
      if (!remaining) {
        // console.log('⏰ Chat unlock time has expired');
        // The auto-refresh will handle locking the chat
      }
    };

    // Update immediately
    updateCountdown();

    // Update every 30 seconds
    countdownIntervalRef.current = setInterval(updateCountdown, 30000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [openUntil]);

  // Function to fetch and update thread data (locking logic)
  const fetchThreadData = async () => {
    if (!thread?.id) return;

    try {
      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select('open_until, user_a, user_b')
        .eq('id', thread.id)
        .single();

      if (threadError) {
        console.error('Error fetching thread:', threadError);
        return;
      }

      if (threadData) {
        // console.log('🔄 Refreshed thread data:', threadData);
        setThread((prev) => ({ ...prev, ...threadData }));

        // Store open_until for countdown
        setOpenUntil(threadData.open_until ? new Date(threadData.open_until) : null);

        // Get VIP status from state or fetch if not available
        let vipUntil = null;
        if (wallet && wallet.vip_expires_at) { // fallback check if we add it to wallet later
          vipUntil = wallet.vip_expires_at;
        }
        // The rest of the logic is handled in the main useEffect below. This block was duplicated and caused syntax errors.
        // Removed duplicate try/catch/finally and async logic.
      }
    } catch (err) {
      console.error('Error fetching thread:', err);
    }
  };

  // Auto-refresh thread unlock state every 30 seconds
  useEffect(() => {
    if (!thread?.id) return;
    threadRefreshIntervalRef.current = setInterval(() => {
      fetchThreadData();
    }, 30000);
    return () => {
      if (threadRefreshIntervalRef.current) {
        clearInterval(threadRefreshIntervalRef.current);
      }
    };
  }, [thread?.id]);

  // Periodically refresh other user's last_seen
  useEffect(() => {
    if (!recipientId) return;

    // console.log('🔄 Setting up last_seen refresh interval');

    const refreshLastSeen = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('last_seen')
          .eq('id', recipientId)
          .single();

        if (data) {
          // console.log('🔄 Refreshed other user last_seen:', data.last_seen);
          setOtherUserLastSeen(data.last_seen);
        }
      } catch (err) {
        console.error('Error refreshing last_seen:', err);
      }
    };

    // Refresh immediately
    refreshLastSeen();

    // Refresh every 20 seconds
    lastSeenRefreshIntervalRef.current = setInterval(refreshLastSeen, 20000);

    return () => {
      if (lastSeenRefreshIntervalRef.current) {
        clearInterval(lastSeenRefreshIntervalRef.current);
      }
    };
  }, [recipientId]);

  // Realtime Subscription (Messages)
  useEffect(() => {
    if (!thread?.id || !currentUser?.id || !userRole) return;

    // console.log('🔴 Setting up realtime subscription for thread:', thread.id);

    // Clean up previous subscription if any
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`messages:${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          // console.log('📨 New message received:', payload.new);
          const newMessage = payload.new;

          console.log('[CHAT_RT_NEW_MESSAGE]', newMessage);

          const isGiftMessage =
            newMessage?.body?.includes('SENT_GIFT_JSON:') ||
            newMessage?.body?.includes('SENT_GIFT:') ||
            newMessage?.body?.startsWith('🎁');

          // Ignore if this is our own message (already added locally) AND not a gift
          if (newMessage.sender_id === currentUser.id && !isGiftMessage) {
            // console.log('✅ Ignoring own message (already in state)');
            return;
          }

          const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
          // Check if message should be visible to current user
          if (newMessage[deleteFlag]) {
            // console.log('🚫 Message deleted for current user, ignoring');
            return;
          }

          // Add to messages state
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [newMessage];
            const messageExists = prev.some((msg) => msg.id === newMessage.id);
            if (messageExists) {
              return prev;
            }
            playNotificationSound();
            setOtherUserTyping(false);
            return [...prev, newMessage];
          });

          // Mark as seen if from other user
          markMessagesAsSeen(thread.id, currentUser.id);
        }
      )
      .subscribe((status) => {
        // console.log('📡 Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    return () => {
      // console.log('🔴 Cleaning up realtime subscription');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [thread?.id, currentUser?.id, userRole, isMuted]);

  // Realtime Subscription (Typing)
  useEffect(() => {
    if (!thread?.id || !currentUser?.id) return;

    // console.log('⌨️ Setting up typing subscription for thread:', thread.id);

    const channel = supabase.channel(`typing:${thread.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== currentUser.id) {
          // console.log(`⌨️ Other user typing: ${payload.payload.isTyping}`);
          setOtherUserTyping(payload.payload.isTyping);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      // console.log('⌨️ Cleaning up typing subscription');
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [thread?.id, currentUser?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showMenu]);

  useEffect(() => {
    if (!thread?.id) {
      setIsMuted(false);
      return;
    }
    const muted = localStorage.getItem(`muted_thread_${thread.id}`) === 'true';
    setIsMuted(muted);
    console.log('[MUTE]', { threadId: thread.id, muted });
  }, [thread?.id]);

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Handle typing indicator broadcast


    // Add missing initializeChat useEffect
    useEffect(() => {
      if (!currentUser?.id || !routeParamId) return;
      const initializeChat = async () => {
        try {
          setLoading(true);
          // Load thread
          const { data: threadData, error: threadError } = await supabase
            .from('threads')
            .select('*')
            .eq('id', routeParamId)
            .maybeSingle();
          if (threadError || !threadData) return;
          setThread(threadData);
          // Set recipientId
          const targetUserId = threadData.user_a === currentUser.id ? threadData.user_b : threadData.user_a;
          setRecipientId(targetUserId);
          // Load messages
          const messagesResult = await loadThreadMessages(threadData.id, currentUser.id);
          if (messagesResult && messagesResult.status === 'ok') {
            setMessages(Array.isArray(messagesResult.messages) ? messagesResult.messages : []);
          } else {
            setMessages([]);
          }
          // Clear unread count for this thread
          if (threadData?.id && currentUser?.id) {
            await supabase
              .from('unread_messages')
              .update({ unread_count: 0 })
              .eq('user_id', currentUser.id)
              .eq('thread_id', threadData.id);
            await markMessagesAsSeen(threadData.id, currentUser.id);
          }
          // Load other user profile
          const { data: otherUserProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle();
          setOtherUser(otherUserProfile);
          // Load wallet
          const { data: walletData } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          setWallet(walletData);
          // Get user role
          setUserRole(getUserRole(threadData, currentUser.id));
          // Check block status for current user → blocked recipient
          const { data: blockData } = await supabase
            .from('blocks')
            .select('id')
            .eq('blocker', currentUser.id)
            .eq('blocked', targetUserId)
            .maybeSingle();
          setIsBlocked(!!blockData);
          // Check block status for recipient → blocked current user
          const { data: blockedByData } = await supabase
            .from('blocks')
            .select('id')
            .eq('blocker', targetUserId)
            .eq('blocked', currentUser.id)
            .maybeSingle();
          setBlockedByOther(!!blockedByData);
          // Check DND
          const { data: otherProfileDND } = await supabase
            .from('profiles')
            .select('do_not_disturb')
            .eq('id', targetUserId)
            .maybeSingle();
          setOtherUserDND(!!otherProfileDND?.do_not_disturb);
        } finally {
          setLoading(false);
        }
      };
      initializeChat();
    }, [currentUser?.id, routeParamId]);
  const broadcastTypingStatus = (isTyping) => {
    if (!typingChannelRef.current || !thread?.id || !currentUser?.id) return;

    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        isTyping: isTyping,
      },
    });
  };

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const now = Date.now();
    if (now - lastTypingEventRef.current > 300) {
      if (newValue.trim().length > 0) {
        broadcastTypingStatus(true);
        lastTypingEventRef.current = now;
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      broadcastTypingStatus(false);
    }, 1000);
  };

  const handleInputClear = () => {
    setInputValue('');
    broadcastTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Correct placement for startRecording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setVoiceBlob(blob);
        }
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone',
        variant: 'destructive',
      });
    }
  };

  // 6. stopRecording (already present)

  // 7. cancelRecording
  const cancelRecording = () => {
    if (isRecording) {
      stopRecording();
      setVoiceBlob(null);
      setRecordingSeconds(0);
    }
  };

  // 8. sendVoiceMessage
  const sendVoiceMessage = async () => {
    if (!voiceBlob || sendingVoice || !thread?.id) return;
    setSendingVoice(true);
    try {
      const formData = new FormData();
      formData.append('file', voiceBlob, 'voice-message.webm');
      // Replace with your upload logic or API endpoint
      // For now, just simulate upload and message send
      const url = URL.createObjectURL(voiceBlob);
      const { error } = await supabase.from('messages').insert([
        {
          thread_id: thread.id,
          sender_id: currentUser.id,
          body: `VOICE_MESSAGE:${url}`,
        },
      ]);
      if (error) throw error;
      setVoiceBlob(null);
      setRecordingSeconds(0);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSendingVoice(false);
    }
  };

  // 9. handleSendMessage
  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isSending || !thread?.id || !currentUser?.id) return;
    // Block checks
    if (isBlocked) {
      toast({
        title: 'Cannot send',
        description: 'You have blocked this user.',
        variant: 'destructive',
      });
      return;
    }
    if (blockedByOther) {
      toast({
        title: 'Cannot send',
        description: 'You cannot message this person right now.',
        variant: 'destructive',
      });
      return;
    }
    if (otherUserDND) {
      toast({
        title: 'Cannot send',
        description: `${otherUser?.name} is not accepting messages right now.`,
        variant: 'destructive',
      });
      return;
    }
    // existing locked check...
    if (!isChatUnlocked) {
      toast({
        title: 'Chat is locked',
        description: 'You cannot send messages while the chat is locked.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.from('messages').insert([
        {
          thread_id: thread.id,
          sender_id: currentUser.id,
          body: trimmedInput,
        },
      ]);
      if (error) throw error;
      setInputValue('');
      broadcastTypingStatus(false);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // 10. handleSendGift
  const handleSendGift = async (gift) => {
    if (!thread?.id || !currentUser?.id || isSendingGift) return;
    setIsSendingGift(true);
    try {
      await sendGiftSecure({
        threadId: thread.id,
        senderId: currentUser.id,
        recipientId,
        gift,
      });
      handleGiftSendSuccess();
      setShowGiftModal(false);
    } catch (err) {
      handleGiftSendError(err);
    } finally {
      setIsSendingGift(false);
    }
  };

  // 11. handleDeleteMessage
  const handleDeleteMessage = async (messageId) => {
    if (!thread?.id || !userRole) return;
    try {
      await deleteMessageForUser(thread.id, messageId, userRole);
      setMessages((prev) => Array.isArray(prev) ? prev.filter((msg) => msg.id !== messageId) : []);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // 12. handleClearChat
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  // 13. confirmClearChat
  const confirmClearChat = async () => {
    if (!thread?.id || !userRole || clearingChat) return;
    setClearingChat(true);
    try {
      const deleteFlag = userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
      const { error } = await supabase.from('messages').update({ [deleteFlag]: true }).eq('thread_id', thread.id);
      if (error) throw error;
      setMessages([]);
      setShowClearConfirm(false);
      toast({ title: 'Chat cleared' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setClearingChat(false);
    }
  };

  // 14. toggleMute
  const toggleMute = () => {
    if (!thread?.id) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(`muted_thread_${thread.id}`, newMuted ? 'true' : 'false');
    toast({ title: newMuted ? 'Muted' : 'Unmuted', description: newMuted ? 'Notifications muted' : 'Notifications enabled' });
  };

  // 15. handleBlock
  const handleBlock = async () => {
    if (!currentUser?.id || !recipientId || blocking) return;
    setBlocking(true);
    try {
      const { error } = await supabase.from('blocks').insert([
        { blocker: currentUser.id, blocked: recipientId },
      ]);
      if (error) throw error;
      setIsBlocked(true);
      setShowBlockConfirm(false);
      toast({ title: 'Blocked', description: `${otherUser?.name} has been blocked.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  // 16. handleUnblock
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

  // 17. handleEmojiSelect
  const handleEmojiSelect = (emoji) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/user/${otherUser?.id}`)}>
            <UserAvatar user={otherUser} size="md" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-900">{otherUser?.name}</p>
              </div>
              {otherUserTyping ? (
                <p className="text-xs text-blue-500 animate-pulse">typing...</p>
              ) : (
                <OnlineStatus lastSeen={otherUserLastSeen} />
              )}
            </div>
          </div>
        </div>
        {/* Header right side - menu */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(prev => !prev); }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[180px] overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); handleClearChat(); }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-4" />
                Clear Chat
              </button>
              <button
                onClick={() => { setShowMenu(false); toggleMute(); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {isMuted ? '🔔 Unmute Chat' : '🔕 Mute Chat'}
              </button>
              <button
                onClick={() => { setShowMenu(false); if (isBlocked) handleUnblock(); else setShowBlockConfirm(true); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {isBlocked ? '✅ Unblock User' : '🚫 Block User'}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Chat?</h3>
              <p className="text-sm text-gray-500 mb-6">This will clear the chat for you only.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearChat}
                  disabled={clearingChat}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold disabled:opacity-50"
                >
                  {clearingChat ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* EXISTING JSX: Block confirm modal, messages list, input area */}
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
                <button onClick={handleBlock} disabled={blocking} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50">
                  {blocking ? (<Loader2 className="w-4 h-4 animate-spin mx-auto" />) : ('Block')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100/50" onClick={() => setShowEmojiPicker(false)}>
        {Array.isArray(messages) && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center mt-[-40px]">
            <div className="bg-white p-4 rounded-full shadow-sm mb-3">
              <span className="text-4xl">👋</span>
            </div>
            <p className="text-gray-900 font-medium">No messages yet</p>
            <p className="text-sm text-gray-500 mt-1">Start the conversation with {otherUser?.name}!</p>
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
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: new Date(message.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                      })}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  currentUser={currentUser}
                  userRole={userRole}
                  onDelete={handleDeleteMessage}
                  setContextMenu={setContextMenu}
                  contextMenu={contextMenu}
                  setEmojiBurst={setEmojiBurst}
                />
              </React.Fragment>
            );
          })
        )}
        {/* Typing indicator */}
        {otherUserTyping && (<TypingIndicator userName={otherUser?.name} />)}
        <div ref={messagesEndRef} />
        {/* Emoji burst effect - Rendered at ChatPage level to be over everything */}
        {emojiBurst && (<EmojiBurst x={emojiBurst.x} y={emojiBurst.y} key={emojiBurst.key} />)}
      </div>
      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-3 safe-area-bottom z-20">
        {isBlocked && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
            <span className="text-sm text-red-600 font-medium">🚫 You blocked {otherUser?.name}</span>
            <button onClick={handleUnblock} className="text-xs text-red-500 underline hover:text-red-700">Unblock</button>
          </div>
        )}
        {blockedByOther && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
            <span className="text-lg">💬</span>
            <span className="text-sm text-slate-500 font-medium">
              You cannot send messages to this person right now.
            </span>
          </div>
        )}
        {otherUserDND && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
            <span className="text-lg">🔕</span>
            <span className="text-sm text-amber-700 font-medium">{otherUser?.name} has Do Not Disturb enabled. You cannot send messages right now.</span>
          </div>
        )}
        {/* Voice Recording State */}
        {isRecording && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-600 flex-1">Recording... {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
            <button onClick={cancelRecording} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
            <button onClick={stopRecording} className="bg-red-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-red-600">Stop</button>
          </div>
        )}
        {/* Voice Preview State */}
        {voiceBlob && !isRecording && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl mb-2">
            <audio src={URL.createObjectURL(voiceBlob)} controls className="flex-1 h-8" />
            <button onClick={() => setVoiceBlob(null)} className="text-gray-500 hover:text-gray-700 text-sm">✕</button>
            <button onClick={sendVoiceMessage} disabled={sendingVoice} className="bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-blue-600 disabled:opacity-50">{sendingVoice ? (<Loader2 className="w-4 h-4 animate-spin" />) : 'Send'}</button>
          </div>
        )}
        {/* Chat unlock countdown banner - show only if unlocked by time and not VIP */}
        {isChatUnlocked && !userIsVIP && openUntil && timeRemaining && (
          <ChatUnlockCountdownBanner timeRemaining={timeRemaining} openUntilLabel={openUntilLabel} />
        )}
        {/* Chat locked banner */}
        {!isChatUnlocked && (<ChatLockedBanner timeRemaining={timeUntilLock} userIsVIP={userIsVIP} />)}
        {/* Improved emoji picker */}
        <ImprovedEmojiPicker isOpen={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onEmojiSelect={handleEmojiSelect} />
        {/* Input controls */}
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          {/* Emoji button - disabled when locked */}
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={!isChatUnlocked} className={`flex-shrink-0 p-2.5 rounded-xl transition-colors ${showEmojiPicker ? 'bg-gray-100 text-gray-800' : 'text-gray-500'} ${!isChatUnlocked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : 'hover:bg-gray-50'}`} title={isChatUnlocked ? 'Add emoji' : 'Chat is locked'}>
            <span className="text-xl leading-none">😀</span>
          </button>
          {!isRecording && !voiceBlob && (
            <button onClick={startRecording} disabled={!isChatUnlocked || isBlocked || blockedByOther || otherUserDND} className="flex-shrink-0 p-2.5 hover:bg-gray-100 text-gray-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Record voice message">
              <span className="text-xl">🎙️</span>
            </button>
          )}
          {isRecording && (
            <button onClick={stopRecording} className="flex-shrink-0 p-2.5 bg-red-100 text-red-500 rounded-xl animate-pulse">
              <span className="text-xl">⏹️</span>
            </button>
          )}
          {/* Text input - disabled when locked */}
          <textarea ref={inputRef} value={inputValue} onChange={handleInputChange} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={!isChatUnlocked || isBlocked || blockedByOther || otherUserDND} placeholder={blockedByOther ? 'You cannot message this person...' : (otherUserDND ? 'This user has Do Not Disturb enabled...' : (isBlocked ? 'You blocked this user...' : (isChatUnlocked ? 'Type a message...' : 'Chat is locked...')))} className={`flex-1 px-4 py-3 border rounded-2xl resize-none focus:outline-none focus:ring-2 transition-all text-sm md:text-base min-h-[48px] max-h-[120px] ${isChatUnlocked ? 'bg-gray-50 border-gray-200 focus:ring-blue-100 focus:border-blue-300 focus:bg-white' : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed placeholder:text-gray-400'}`} rows={1} />
          {/* Gift button - always enabled */}
          <button onClick={() => setShowGiftModal(true)} className="flex-shrink-0 p-2.5 hover:bg-pink-50 text-pink-500 rounded-xl transition-colors" title="Send a gift">
            <span className="text-xl leading-none">🎁</span>
          </button>
          {/* Send button - disabled when locked */}
          <button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending || !isChatUnlocked || isBlocked || blockedByOther || otherUserDND} className={`flex-shrink-0 w-12 h-12 flex items-center justify-center text-white rounded-xl font-bold transition-all shadow-sm ${!isChatUnlocked ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400'}`}>
            {isSending ? (<Loader2 className="w-5 h-5 animate-spin" />) : (<Send className="w-5 h-5 ml-0.5" />)}
          </button>
        </div>
      </div>
      {/* Gift modal */}
      <ChatGiftModal isOpen={showGiftModal} onClose={() => setShowGiftModal(false)} recipientId={recipientId} recipientName={otherUser?.name} onGiftSelected={handleSendGift} isLoading={isSendingGift} />
      {/* Global styles for emoji animations */}
      <style>{`
        @keyframes emoji-pop {
          0% {
            transform: scale(0.3) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.1) rotate(5deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );


  // (Removed duplicate and misplaced confirmClearChat and modal JSX)
}

