import React, { useState, useEffect } from 'react';
import { fetchActiveGifts } from '@/lib/giftUtils';
import { fetchUserWallet } from '@/lib/walletUtils';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Coins, Lock, ChevronUp, ChevronDown } from 'lucide-react';

// Accepts both recipientId/receiverId for compatibility
export default function GiftPanel({
  recipientId,
  receiverId,
  recipientName,
  onClose,
  onGiftSent,
  onWalletUpdate,
  targetMode = 'single',
  quantity: externalQuantity,
  setQuantity: externalSetQuantity,
  roomUsers = [],
  hostUser = null,
  selectedRecipient = null,
  onRecipientChange = null,
  onOpenUserCard = null
}) {
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userWallet, setUserWallet] = useState(null);
  const [quantityMenuOpen, setQuantityMenuOpen] = useState(false);
  const [customQuantityOpen, setCustomQuantityOpen] = useState(false);
  const [customQuantityValue, setCustomQuantityValue] = useState('');
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);

  // Only show recipient selector in room mode with multiple users
  const showRecipientSelector = roomUsers && roomUsers.length > 0;

  // Filter gifts: exclude VIP/exclusive/lucky gifts from profile gift panel
  const filteredGifts = showRecipientSelector 
    ? gifts  // في الروم: اعرض كل الهدايا
    : gifts.filter(g => 
        g.category === 'general' && 
        !g.is_vip_only && 
        !g.is_lucky
      );  // في البروفايل: اعرض الهدايا العامة فقط

  // Fallback for quantity if not provided by parent
  const [localQuantity, setLocalQuantity] = useState(1);
  const quantity = externalQuantity !== undefined ? externalQuantity : localQuantity;
  const setQuantity = externalSetQuantity || setLocalQuantity;

  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const resolvedReceiverUserId =
    selectedRecipient?.user_id ||
    selectedRecipient?.id ||
    hostUser?.user_id ||
    hostUser?.id ||
    recipientId ||
    receiverId ||
    null;

  let targetId = resolvedReceiverUserId;
  if (targetMode === 'all') {
    targetId = 'all';
  }

  let currentRecipientName = '';
  if (targetMode === 'all') {
    currentRecipientName = language === 'ar' ? 'جميع الموجودين في الغرفة' : 'Everyone in the room';
  } else if (selectedRecipient) {
    currentRecipientName =
      selectedRecipient.full_name ||
      selectedRecipient.username ||
      selectedRecipient.name ||
      selectedRecipient.display_name ||
      recipientName ||
      'Unknown';
  } else if (recipientName) {
    currentRecipientName = recipientName;
  } else if (hostUser) {
    currentRecipientName = hostUser.full_name || hostUser.username || hostUser.name || 'Host';
  } else {
    currentRecipientName = language === 'ar' ? 'اختر مستلم' : 'Select recipient';
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const giftsData = await fetchActiveGifts();
        setGifts(giftsData || []);

        if (currentUser?.id) {
          const { data: walletData } = await fetchUserWallet(currentUser.id);
          setUserWallet(walletData);
        }
      } catch (error) {
        console.error('❌ Error loading gifts:', error);
        setGifts([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser?.id]);

  const handleSendGift = async () => {
    const resolvedReceiverUserId =
      selectedRecipient?.user_id ||
      hostUser?.user_id ||
      recipientId ||
      receiverId ||
      null;

    if (!resolvedReceiverUserId) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: 'Receiver user id is missing',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedGift || !currentUser?.id) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'بيانات غير صالحة' : 'Invalid data',
        variant: 'destructive'
      });
      return;
    }

    console.log("[GIFT_PANEL_SELECTED_GIFT_MINIMAL]", selectedGift);
    console.log("[GIFT_PANEL_SELECTED_RECIPIENT_RAW]", selectedRecipient);
    console.log("[GIFT_PANEL_RESOLVED_RECEIVER_USER_ID]", resolvedReceiverUserId);

    const payload = {
      gift_id: selectedGift.id,
      receiver_user_id: resolvedReceiverUserId,
      message: message || ""
    };

    console.log("[GIFT_PANEL_MINIMAL_PAYLOAD]", payload);

    try {
      setSending(true);

      // Check do_not_disturb
      if (resolvedReceiverUserId && resolvedReceiverUserId !== 'all') {
        const { data: recipientCheck } = await supabase
          .from('profiles')
          .select('do_not_disturb')
          .eq('id', resolvedReceiverUserId)
          .maybeSingle();

        if (recipientCheck?.do_not_disturb) {
          toast({
            title: '🔕 Not Available',
            description: language === 'ar'
              ? 'هذا المستخدم لا يقبل الهدايا حالياً'
              : 'This user is not accepting gifts at the moment.',
            variant: 'destructive',
          });
          setSending(false);
          return;
        }
      }

      if (onGiftSent) {
        await onGiftSent(payload);
      }

      setSelectedGift(null);
      setMessage('');
    } catch (error) {
      console.error('❌ Exception in GiftPanel.handleSendGift:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'حدث خطأ' : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-2" />
        <p className="text-gray-500">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex justify-between items-center p-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">🎁</span>
          {language === 'ar' ? 'إرسال هدية' : 'Send a Gift'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
        >
          ✕
        </button>
      </div>

      {showRecipientSelector && (


        <div className="shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-100 relative z-30">
        <p className="text-xs text-gray-500 mb-1 font-medium">
          {language === 'ar' ? 'إرسال إلى:' : 'Send to:'}
        </p>
        <div className="relative">
          <button
            onClick={() => setRecipientMenuOpen(!recipientMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <span className="truncate">{currentRecipientName}</span>
            {recipientMenuOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )}
          </button>

          {recipientMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setRecipientMenuOpen(false)}
              ></div>
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    if (onRecipientChange) onRecipientChange({ mode: 'all', user: null });
                    setRecipientMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-gray-50 flex items-center gap-2 ${targetMode === 'all'
                    ? 'bg-purple-50 text-purple-700 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span className="text-lg">👥</span>
                  {language === 'ar' ? 'جميع الموجودين في الغرفة' : 'Everyone in the room'}
                </button>

                {roomUsers.map((user) => {
                  const isHost = (hostUser && hostUser.id === user.id) || user.isHost === true;
                  const isSelected =
                    targetMode === 'single' &&
                    (selectedRecipient?.id === user.id || (!selectedRecipient && !recipientId && isHost));

                  const displayName =
                    user.name || user.username || user.display_name || user.full_name || 'User';
                  const avatarUrl =
                    user.avatar_url ||
                    user.photo_url ||
                    user.profile_image ||
                    user.image ||
                    user.avatar ||
                    null;
                  const initial = displayName.charAt(0).toUpperCase();

                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (onRecipientChange) onRecipientChange({ mode: 'single', user });
                        setRecipientMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 transition-colors border-b border-gray-50 flex items-center justify-between ${isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              if (onOpenUserCard) {
                                e.stopPropagation();
                                onOpenUserCard(user.id || user.user_id);
                              }
                            }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ffe4e6'/><text x='50' y='50' font-family='Arial' font-size='40' font-weight='bold' fill='%23e11d48' text-anchor='middle' dy='.3em'>${initial}</text></svg>`;
                            }}
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              if (onOpenUserCard) {
                                e.stopPropagation();
                                onOpenUserCard(user.id || user.user_id);
                              }
                            }}
                          >
                            {initial}
                          </div>
                        )}
                        <span
                          className="truncate font-medium text-sm cursor-pointer"
                          onClick={(e) => {
                            if (onOpenUserCard) {
                              e.stopPropagation();
                              onOpenUserCard(user.id || user.user_id);
                            }
                          }}
                        >
                          {displayName}
                        </span>
                      </div>
                      {isHost && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                          HOST
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      )}

      {userWallet && (
        <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-amber-700 text-lg">{userWallet.coins}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                LVL {userWallet.level}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/plans')}
            className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1 rounded-full hover:bg-amber-100 transition font-medium cursor-pointer"
          >
            + {language === 'ar' ? 'شحن' : 'Top Up'}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4">
          {!filteredGifts || filteredGifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-500 mb-2">
                {language === 'ar' ? 'لا توجد هدايا متاحة' : 'No gifts available'}
              </p>
              <p className="text-xs text-gray-400">
                {language === 'ar' ? 'تحقق من الاتصال بالإنترنت' : 'Check your internet connection'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredGifts.map((gift) => {
                const canAfford = userWallet ? userWallet.coins >= gift.cost * (quantity || 1) : false;

                return (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 group cursor-pointer ${selectedGift?.id === gift.id
                      ? 'border-rose-500 bg-rose-50 shadow-sm transform scale-105'
                      : 'border-gray-100 bg-white hover:border-rose-200 hover:shadow-sm'
                      } ${!canAfford ? 'opacity-60 grayscale' : ''}`}
                    disabled={sending}
                  >
                    <div className="relative mb-2">
                      <img
                        src={gift.icon_url}
                        alt={language === 'ar' ? gift.name_ar : gift.name_en}
                        className="w-12 h-12 object-contain drop-shadow-sm group-hover:scale-110 transition-transform cursor-pointer"
                        onError={(e) => {
                          e.target.src = 'https://placehold.co/64x64?text=Gift';
                        }}
                      />
                      {!canAfford && (
                        <div className="absolute -top-2 -right-2 bg-gray-100 rounded-full p-1 border border-gray-200">
                          <Lock className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
</div>
                    <p className="text-xs font-medium text-gray-700 text-center line-clamp-1 w-full cursor-pointer">
                      {language === 'ar' ? gift.name_ar : gift.name_en}
                    </p>
                    <p
                      className={`text-xs font-bold mt-1 flex items-center gap-0.5 ${canAfford ? 'text-amber-600' : 'text-gray-500'
                        }`}
                    >
                      {gift.cost} 💰
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center justify-between relative">
          <span className="text-sm font-medium text-gray-700">
            {language === 'ar' ? 'الكمية:' : 'Quantity:'}
          </span>
          <div className="relative">
            <button
              onClick={() => {
                if (customQuantityOpen) {
                  setCustomQuantityOpen(false);
                  setCustomQuantityValue('');
                }
                setQuantityMenuOpen(!quantityMenuOpen);
              }}
              className="flex items-center justify-between gap-3 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 min-w-[80px] shadow-sm transition-colors cursor-pointer"
            >
              <span>{quantity}</span>
              {quantityMenuOpen || customQuantityOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {quantityMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setQuantityMenuOpen(false)}
                ></div>

                <div className="absolute bottom-full right-0 mb-2 w-full min-w-[80px] bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-50">
                  {[1, 7, 17, 77, 777].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setQuantity(q);
                        setQuantityMenuOpen(false);
                      }}
                      className={`w-full text-center px-4 py-2.5 text-sm font-bold transition-colors border-b border-gray-50 cursor-pointer ${quantity === q
                        ? 'bg-rose-50 text-rose-600'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setQuantityMenuOpen(false);
                      setCustomQuantityOpen(true);
                    }}
                    className="w-full text-center px-4 py-2.5 text-sm font-bold transition-colors text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    {language === 'ar' ? 'مخصص' : 'Custom'}
                  </button>
                </div>
              </>
            )}

            {customQuantityOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setCustomQuantityOpen(false);
                    setCustomQuantityValue('');
                  }}
                ></div>
                <div className="absolute bottom-full right-0 mb-2 p-3 w-[200px] bg-white border border-gray-100 rounded-xl shadow-lg z-50 flex flex-col gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder={language === 'ar' ? 'أدخل الكمية' : 'Enter quantity'}
                    value={customQuantityValue}
                    onChange={(e) => setCustomQuantityValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCustomQuantityValue('');
                        setCustomQuantityOpen(false);
                      }}
                      className="flex-1 px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => {
                        const parsed = parseInt(customQuantityValue, 10);
                        if (!isNaN(parsed) && parsed >= 1) {
                          setQuantity(parsed);
                          setCustomQuantityValue('');
                          setCustomQuantityOpen(false);
                        }
                      }}
                      className="flex-1 px-2 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      {language === 'ar' ? 'تأكيد' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'رسالة مع الهدية (اختياري)...'
                : 'Add a message (optional)...'
            }
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white shadow-sm"
            disabled={!selectedGift || sending}
          />
        </div>
      </div>

      <div className="shrink-0 p-4 bg-white border-t border-gray-100">
        <button
          onClick={handleSendGift}
          disabled={
            sending ||
            !selectedGift ||
            (userWallet && selectedGift && userWallet.coins < selectedGift.cost * (quantity || 1))
          }
          className={`w-full font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${sending ||
            !selectedGift ||
            (userWallet && selectedGift && userWallet.coins < selectedGift.cost * (quantity || 1))
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white'
            }`}
        >
          {sending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}
            </>
          ) : !selectedGift ? (
            language === 'ar' ? 'اختر هدية' : 'Select a Gift'
          ) : userWallet && userWallet.coins < selectedGift.cost * (quantity || 1) ? (
            language === 'ar' ? 'رصيد غير كاف' : 'Insufficient Coins'
          ) : (
            language === 'ar' ? 'إرسال الهدية' : 'Send Gift'
          )}
        </button>
      </div>
    </div>
  );
}