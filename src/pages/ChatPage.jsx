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
};


export default function ChatPage() {
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
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`muted_thread_${thread?.id}`) === 'true';
  });
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

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

  // Helper: Play notification sound
  const playNotificationSound = () => {
    if (isMuted) return;
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
        } else {
          // Try fetching if we don't have it easily accessbile
          const { data: profile } = await supabase.from('profiles').select('vip_until').eq('id', currentUser.id).single();
          vipUntil = profile?.vip_until;
        }

        // Update chat unlock state
        const unlocked = shouldChatBeUnlocked(threadData.open_until, vipUntil);
        setIsChatUnlocked(unlocked);
        setTimeUntilLock(getTimeUntilLock(threadData.open_until));

        // console.log('🔓 Chat unlocked status updated:', unlocked);
      }
    } catch (err) {
      console.error('Exception fetching thread:', err);
    }
  };

  // Initial Data Load
  useEffect(() => {
    if (!currentUser?.id || !routeParamId) return;

    const initializeChat = async () => {
      try {
        setLoading(true);

        let threadData = null;
        let targetUserId = null;

        const { data: existingThread } = await supabase
          .from('threads')
          .select('*')
          .eq('id', routeParamId)
          .single();

        if (existingThread) {
          threadData = existingThread;
          targetUserId = existingThread.user_a === currentUser.id ? existingThread.user_b : existingThread.user_a;
        } else {
          targetUserId = routeParamId;
          const threadResult = await getOrCreateThread(currentUser.id, targetUserId);

          if (threadResult.status === 'error') {
            console.error("Could not find thread or user", threadResult.error);
            const { data: userCheck } = await supabase.from('profiles').select('id').eq('id', targetUserId).single();
            if (!userCheck) {
              toast({ title: 'Error', description: 'Chat not found', variant: 'destructive' });
              navigate('/messages');
              return;
            }
          } else {
            threadData = threadResult.thread;
          }
        }

        setThread(threadData);
        setRecipientId(targetUserId);

        // Store open_until for countdown
        setOpenUntil(threadData.open_until ? new Date(threadData.open_until) : null);

        // Load current user profile for VIP status
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('vip_until')
          .eq('id', currentUser.id)
          .single();

        const vipUntil = userProfile?.vip_until;
        if (vipUntil && new Date(vipUntil) > new Date()) {
          setUserIsVIP(true);
        }

        if (threadData) {
          const role = getUserRole(threadData, currentUser.id);
          setUserRole(role);

          // Set initial chat unlock status
          const unlocked = shouldChatBeUnlocked(threadData.open_until, vipUntil);
          setIsChatUnlocked(unlocked);
          setTimeUntilLock(getTimeUntilLock(threadData.open_until));
          // console.log('🔓 Initial Chat unlocked:', unlocked);

          const messagesResult = await loadThreadMessages(threadData.id, currentUser.id);
          if (messagesResult.status === 'ok') {
            setMessages(messagesResult.messages || []);
          }

          await markMessagesAsSeen(threadData.id, currentUser.id);
        }

        // Updated query to include vip fields
        const { data: userData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, age, last_seen, is_vip, vip_number, vip_until')
          .eq('id', targetUserId)
          .single();

        if (userData) {
          setOtherUser(userData);
          setOtherUserLastSeen(userData.last_seen);
        }

        const { data: walletData } = await supabase
          .from('wallets')
          .select('coins, gems, level, xp')
          .eq('user_id', currentUser.id)
          .single();

        if (walletData) {
          setWallet(walletData);
        }
      } catch (err) {
        console.error('Error initializing chat:', err);
        toast({
          title: 'Error',
          description: 'Failed to load chat',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [currentUser?.id, routeParamId, navigate, toast]);

  // Auto-refresh thread unlock state every 30 seconds
  useEffect(() => {
    if (!thread?.id) return;

    // console.log('🔄 Setting up thread refresh interval');

    // Refresh immediately
    // fetchThreadData(); // Already fetched in init

    // Refresh every 30 seconds
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
            const messageExists = prev.some((msg) => msg.id === newMessage.id);
            if (messageExists) {
              // console.log('⚠️ Message already in state, skipping duplicate');
              return prev;
            }

            // console.log('✨ Adding new message to state');
            playNotificationSound();
            // Clear typing indicator when message received
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
  }, [thread?.id, currentUser?.id, userRole]);

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
  }, [thread?.id]);

  useEffect(() => {
    if (!recipientId) return;
    const blocked = localStorage.getItem(
      `blocked_user_${recipientId}`
    ) === 'true';
    setIsBlocked(blocked);
  }, [recipientId]);

  // Handle typing indicator broadcast
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


  // Handle send text message
  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || !thread?.id || !currentUser?.id) return;

    // Check if chat is unlocked
    if (!isChatUnlocked) {
      toast({
        title: 'Chat locked',
        description: 'Chat is locked. Send a gift to unlock.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          thread_id: thread.id,
          sender_id: currentUser.id,
          body: trimmedInput,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Message sent:', data);
      setMessages((prev) => [...prev, data]);
      handleInputClear(); // Clear input and typing status
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Exception sending message:', err);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle send gift
  const handleSendGift = async (giftData) => {
    if (isSendingGift || !giftData?.gift_id || !currentUser?.id || !recipientId) {
      return;
    }

    try {
      setIsSendingGift(true);

      const result = await sendGiftSecure({
        senderId: currentUser.id,
        recipientId: recipientId,
        giftId: giftData.gift_id,
        message: giftData.message || '',
      });

      if (result.status === 'error') {
        handleGiftSendError({
          result,
          showToast: toast,
          navigate,
          language,
        });
        return;
      }

      giftData.giftName = giftData?.giftName || giftData?.gift?.name_en || giftData?.name_en || 'Gift';
      giftData.iconUrl = giftData?.iconUrl || giftData?.gift?.icon_url || giftData?.icon_url || '';

      console.log('[CHAT_GIFT_GIFTDATA]', giftData);

      await handleGiftSendSuccess({
        result,
        giftData,
        setWallet,
        showToast: toast,
        setShowGiftModal,
        language,
        senderId: currentUser.id,
        recipientId: recipientId,
        onGiftMessageCreated: (newMessage) => {
          console.log('[CHAT_GIFT_LOCAL_APPEND]', newMessage);

          setMessages((prevMessages) => {
            const exists = prevMessages.some(
              (msg) => String(msg.id) === String(newMessage.id)
            );
            if (exists) return prevMessages;
            return [...prevMessages, newMessage];
          });
        },
      });

      const freshMessages = await loadThreadMessages(thread.id);
      if (Array.isArray(freshMessages)) {
        setMessages(freshMessages);
        console.log('[CHAT_GIFT_MESSAGES_REFRESHED]', freshMessages.length);
      }

      // Refetch thread data to update open_until after gift sent
      await fetchThreadData();

      // Show success message
      toast({
        title: 'Unlocked',
        description: 'Chat unlocked! You can now send messages.',
      });

      setShowGiftModal(false);

    } catch (error) {
      console.error('❌ Exception in handleSendGift:', error);
      toast({
        title: 'Error',
        description: 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSendingGift(false);
    }
  };

  // Handle delete message for me
  const handleDeleteMessage = async (messageId) => {
    if (!userRole) return;

    try {
      const result = await deleteMessageForUser(messageId, userRole);
      if (result.status === 'ok') {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        setContextMenu(null);
        toast({
          title: 'Deleted',
          description: 'Message deleted',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete message',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(`muted_thread_${thread?.id}`, String(newMuted));
    toast({
      title: newMuted ? '🔕 Muted' : '🔔 Unmuted',
      description: newMuted
        ? 'Notifications muted for this chat'
        : 'Notifications enabled for this chat',
    });
  };

  const handleBlock = async () => {
    setBlocking(true);
    try {
      localStorage.setItem(`blocked_user_${recipientId}`, 'true');
      setIsBlocked(true);
      setShowBlockConfirm(false);
      toast({
        title: '🚫 User Blocked',
        description: `${otherUser?.name} has been blocked.`,
      });
      navigate('/messages');
    } finally {
      setBlocking(false);
    }
  };

  const confirmClearChat = async () => {
    if (!thread?.id || !userRole || clearingChat) return;
    
    setClearingChat(true);
    try {
      const deleteFlag = userRole === 'user_a' 
        ? 'deleted_for_user_a' 
        : 'deleted_for_user_b';

      const { error } = await supabase
        .from('messages')
        .update({ [deleteFlag]: true })
        .eq('thread_id', thread.id);

      if (error) throw error;

      setMessages([]);
      setShowClearConfirm(false);
      
      toast({
        title: 'Chat cleared',
        description: 'Your chat history has been cleared.',
      });
    } catch (err) {
      console.error('[CLEAR_CHAT_ERROR]', err);
      toast({
        title: 'Error',
        description: 'Failed to clear chat',
        variant: 'destructive',
      });
    } finally {
      setClearingChat(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Close menu on outside click

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
        <button
          onClick={() => navigate('/messages')}
          className="text-blue-500 hover:underline"
        >
          Go back to messages
        </button>
      </div>
    );
  }

  const vipInfo = getVipInfo(otherUser);

  const isVip = vipInfo.isVip;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/user/${otherUser.id}`)}
          >
            <div className="relative">
              <UserAvatar user={otherUser} size="md" className={isVip ? "ring-2 ring-yellow-400" : ""} />
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
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(prev => !prev);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[160px] overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  handleClearChat();
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Chat
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  toggleMute();
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {isMuted ? '🔔 Unmute' : '🔕 Mute Notifications'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setShowBlockConfirm(true);
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                🚫 Block User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Clear Chat?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                This will clear the chat for you only. 
                The other person will still see all messages.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearChat}
                  disabled={clearingChat}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {clearingChat ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Clear'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBlockConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🚫</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Block {otherUser?.name}?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                They won't be able to send you messages anymore.
                You can unblock them from your settings.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlock}
                  disabled={blocking}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {blocking ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    'Block'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100/50"
        onClick={() => setShowEmojiPicker(false)}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center mt-[-40px]">
            <div className="bg-white p-4 rounded-full shadow-sm mb-3">
              <span className="text-4xl">👋</span>
            </div>
            <p className="text-gray-900 font-medium">No messages yet</p>
            <p className="text-sm text-gray-500 mt-1">Start the conversation with {otherUser.name}!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const msgDate = new Date(message.created_at).toLocaleDateString();
            const prevMsgDate = index > 0
              ? new Date(messages[index - 1].created_at).toLocaleDateString()
              : null;
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
                        year: new Date(message.created_at).getFullYear() !==
                          new Date().getFullYear() ? 'numeric' : undefined,
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
        {otherUserTyping && (
          <TypingIndicator userName={otherUser.name} />
        )}

        <div ref={messagesEndRef} />

        {/* Emoji burst effect - Rendered at ChatPage level to be over everything */}
        {emojiBurst && (
          <EmojiBurst x={emojiBurst.x} y={emojiBurst.y} key={emojiBurst.key} />
        )}
      </div>

      {/* Input area */}
      <div
        className="border-t border-gray-200 bg-white p-3 safe-area-bottom z-20"
      >
        {isBlocked && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
            <span className="text-sm text-red-600 font-medium">
              🚫 You blocked {otherUser?.name}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem(`blocked_user_${recipientId}`);
                setIsBlocked(false);
                toast({ title: '✅ Unblocked' });
              }}
              className="text-xs text-red-500 underline hover:text-red-700"
            >
              Unblock
            </button>
          </div>
        )}

        {/* Chat unlock countdown banner - show only if unlocked by time and not VIP */}
        {isChatUnlocked && !userIsVIP && openUntil && timeRemaining && (
          <ChatUnlockCountdownBanner
            timeRemaining={timeRemaining}
            openUntilLabel={openUntilLabel}
          />
        )}

        {/* Chat locked banner */}
        {!isChatUnlocked && (
          <ChatLockedBanner timeRemaining={timeUntilLock} userIsVIP={userIsVIP} />
        )}

        {/* Improved emoji picker */}
        <ImprovedEmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
        />

        {/* Input controls */}
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          {/* Emoji button - disabled when locked */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={!isChatUnlocked}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-colors ${showEmojiPicker ? 'bg-gray-100 text-gray-800' : 'text-gray-500'
              } ${!isChatUnlocked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : 'hover:bg-gray-50'
              }`}
            title={isChatUnlocked ? 'Add emoji' : 'Chat is locked'}
          >
            <span className="text-xl leading-none">😀</span>
          </button>

          {/* Text input - disabled when locked */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!isChatUnlocked || isBlocked}
            placeholder={isBlocked ? 'You blocked this user...' : (isChatUnlocked ? 'Type a message...' : 'Chat is locked...')}
            className={`flex-1 px-4 py-3 border rounded-2xl resize-none focus:outline-none focus:ring-2 transition-all text-sm md:text-base min-h-[48px] max-h-[120px] ${isChatUnlocked
              ? 'bg-gray-50 border-gray-200 focus:ring-blue-100 focus:border-blue-300 focus:bg-white'
              : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed placeholder:text-gray-400'
              }`}
            rows={1}
          />

          {/* Gift button - always enabled */}
          <button
            onClick={() => setShowGiftModal(true)}
            className="flex-shrink-0 p-2.5 hover:bg-pink-50 text-pink-500 rounded-xl transition-colors"
            title="Send a gift"
          >
            <span className="text-xl leading-none">🎁</span>
          </button>

          {/* Send button - disabled when locked */}
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending || !isChatUnlocked || isBlocked}
            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center text-white rounded-xl font-bold transition-all shadow-sm ${!isChatUnlocked
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400'
              }`}
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Gift modal */}
      <ChatGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        recipientId={recipientId}
        recipientName={otherUser.name}
        onGiftSelected={handleSendGift}
        isLoading={isSendingGift}
      />

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
}