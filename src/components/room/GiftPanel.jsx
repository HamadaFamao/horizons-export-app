import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { GIFT_CATEGORIES } from '@/lib/giftCategories';
import { Loader2 } from 'lucide-react';

const QUANTITY_PRESETS = [5, 10, 15, 20, 50, 100, 150, 250, 500, 1000];

export default function GiftPanel({
  user,
  room,
  targetUserId,
  onClose,
  onGiftSent,
  isVIP,
  userCoins,
  seatedUsers,
  roomOwnerId,
}) {
  const [activeCategory, setActiveCategory] = useState('general');
  const [gifts, setGifts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGift, setSelectedGift] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [bagGifts, setBagGifts] = useState([]);
  const scrollRef = useRef(null);

  // Recipient
  const [recipientMode, setRecipientMode] = useState('all');
  const [specificRecipient, setSpecificRecipient] = useState(null);

  // Quantity picker
  const [showQuantityPicker, setShowQuantityPicker] = useState(false);
  const [customQty, setCustomQty] = useState('');

  useEffect(() => {
    const fetchGifts = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('gift_catalog')
          .select('*')
          .eq('is_active', true)
          .eq('is_room_gift_enabled', true)
          .order('sort_order', { ascending: true });

        const grouped = {
          general: (data || []).filter(g =>
            g.category === 'general' && !g.is_vip_only && !g.is_lucky && !g.bag_only
          ),
          vip: (data || []).filter(g => g.is_vip_only),
          lucky: (data || []).filter(g => g.is_lucky),
          bag: bagGifts,
          store: (data || []).filter(g => g.category === 'store'),
        };
        setGifts(grouped);
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, [bagGifts]);


  const handleSend = async () => {
    if (!selectedGift || !user?.id || sending) return;

    if (selectedGift.is_vip_only && !isVIP) {
      alert('This gift is for VIP members only');
      return;
    }

    const totalCost = selectedGift.cost * quantity;
    if (userCoins < totalCost) {
      alert(`Not enough coins. Need ${totalCost} coins.`);
      return;
    }

    // Determine recipient
    let recipientId = null;
    if (recipientMode === 'specific') {
      if (!specificRecipient) {
        alert('Please select a recipient');
        return;
      }
      recipientId = specificRecipient;
    } else if (recipientMode === 'mic') {
      const firstSeated = seatedUsers?.[0];
      if (!firstSeated) {
        alert('No one is on mic');
        return;
      }
      recipientId = firstSeated.user_id;
    } else {
      // 'all' — send to room owner as default
      recipientId = roomOwnerId || targetUserId;
    }

    if (!recipientId) {
      alert('No recipient found');
      return;
    }

    setSending(true);
    try {
      console.log('[GIFT_SEND]', {
        p_room_id: room?.id,
        p_receiver_id: recipientId,
        p_gift_id: selectedGift.id,
        p_quantity: quantity,
      });

      const { data, error } = await supabase.rpc(
        'frontend_send_live_room_gift',
        {
          p_room_id: room?.id,
          p_receiver_id: recipientId,
          p_gift_id: selectedGift.id,
          p_message: null,
          p_quantity: quantity,
        }
      );

      console.log('[GIFT_SEND_RESULT]', data, error);

      if (error) throw error;

      onGiftSent?.(selectedGift, quantity);
      setSelectedGift(null);
      setQuantity(1);
      setShowQuantityPicker(false);
    } catch (err) {
      console.error('[GIFT_SEND_ERROR]', err);
      alert(err.message || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex flex-col bg-black/90 backdrop-blur-md rounded-t-3xl overflow-hidden"
      style={{ maxHeight: '55vh' }}
    >
      {/* Header: coins + drag handle + close */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
          <span className="text-yellow-400 text-sm">🪙</span>
          <span className="text-white text-sm font-bold">
            {(userCoins ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="w-8 h-1 bg-white/20 rounded-full mx-auto" />
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white text-lg w-8 h-8 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none shrink-0">
        {GIFT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
              activeCategory === cat.id
                ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            } ${cat.id === 'vip' && !isVIP ? 'opacity-60' : ''}`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
            {cat.id === 'vip' && !isVIP && <span>🔒</span>}
          </button>
        ))}
      </div>

      {/* Recipient Selector */}
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        <span className="text-[10px] text-white/40 shrink-0">Send to:</span>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'all',      label: '👥 All' },
            { id: 'mic',      label: '🎤 On Mic' },
            { id: 'specific', label: '👤 Specific' },
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                setRecipientMode(mode.id);
                if (mode.id !== 'specific') setSpecificRecipient(null);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                recipientMode === mode.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Specific user list */}
      {recipientMode === 'specific' && (
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto scrollbar-none shrink-0">
          {(seatedUsers || []).length === 0 ? (
            <p className="text-[10px] text-white/30 py-2">No one on mic</p>
          ) : (
            (seatedUsers || []).map(su => (
              <button
                key={su.user_id}
                onClick={() => setSpecificRecipient(su.user_id)}
                className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl transition ${
                  specificRecipient === su.user_id
                    ? 'bg-blue-500/30 border border-blue-400/60'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <img
                  src={su.avatar_url || '/default-avatar.svg'}
                  alt={su.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-[9px] text-white/70 truncate w-12 text-center">
                  {su.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Gift Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : activeCategory === 'bag' && bagGifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-3xl">🎒</span>
            <p className="text-white/40 text-sm">Your bag is empty</p>
            <p className="text-white/30 text-xs">Win gifts from games &amp; competitions</p>
          </div>
        ) : activeCategory === 'store' ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-3xl">🏪</span>
            <p className="text-white/40 text-sm">Store coming soon</p>
          </div>
        ) : (gifts[activeCategory] || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32">
            <p className="text-white/40 text-sm">No gifts available</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {(gifts[activeCategory] || []).map(gift => (
              <button
                key={gift.id}
                onClick={() =>
                  setSelectedGift(selectedGift?.id === gift.id ? null : gift)
                }
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition active:scale-95 ${
                  selectedGift?.id === gift.id
                    ? 'bg-amber-500/30 border border-amber-500/60'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="w-14 h-14 flex items-center justify-center">
                  {gift.animation_asset_url ? (
                    <img
                      src={gift.animation_asset_url}
                      alt={gift.name_en}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : gift.icon_url ? (
                    <img
                      src={gift.icon_url}
                      alt={gift.name_en}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-3xl">🎁</span>
                  )}
                </div>

                <p className="text-[10px] text-white/70 font-medium truncate w-full text-center leading-tight">
                  {gift.name_en}
                </p>

                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-yellow-400">🪙</span>
                  <span className="text-[10px] text-yellow-300 font-bold">
                    {gift.cost}
                  </span>
                </div>

                {gift.is_lucky && (
                  <div className="text-[9px] bg-purple-500/40 text-purple-300 rounded-full px-1.5 py-0.5 font-bold">
                    🎲 Lucky
                  </div>
                )}

                {gift.is_vip_only && (
                  <div className="text-[9px] bg-amber-500/40 text-amber-300 rounded-full px-1.5 py-0.5 font-bold">
                    👑 VIP
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer: selected gift + quantity picker + send */}
      {selectedGift && (
        <div className="shrink-0 px-3 py-3 border-t border-white/10 bg-black/40 flex items-center gap-3">
          {/* Selected gift preview */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src={selectedGift.animation_asset_url || selectedGift.icon_url}
              alt={selectedGift.name_en}
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">
                {selectedGift.name_en}
              </p>
              <p className="text-yellow-400 text-xs">
                🪙 {(selectedGift.cost * quantity).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quantity selector with preset popup */}
          <div className="relative flex items-center gap-1 shrink-0">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              −
            </button>

            <button
              onClick={() => setShowQuantityPicker(prev => !prev)}
              className="min-w-[40px] text-center text-white font-bold text-sm bg-white/10 rounded-lg px-2 py-1 hover:bg-white/20"
            >
              {quantity}
              <span className="text-[9px] text-white/40 ml-0.5">▲</span>
            </button>

            <button
              onClick={() => setQuantity(q => Math.min(9999, q + 1))}
              className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              +
            </button>

            {/* Quantity picker popup */}
            {showQuantityPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-3 z-50 w-[220px]">
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {QUANTITY_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => {
                        setQuantity(preset);
                        setShowQuantityPicker(false);
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition ${
                        quantity === preset
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customQty}
                    onChange={e => setCustomQty(e.target.value)}
                    placeholder="Custom..."
                    min={1}
                    max={9999}
                    className="flex-1 bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none placeholder:text-white/30"
                  />
                  <button
                    onClick={() => {
                      const val = parseInt(customQty);
                      if (val > 0 && val <= 9999) {
                        setQuantity(val);
                        setCustomQty('');
                        setShowQuantityPicker(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-400"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || userCoins < selectedGift.cost * quantity}
            className="shrink-0 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-black text-sm shadow-lg disabled:opacity-40 transition active:scale-95 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Send 🎁'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
