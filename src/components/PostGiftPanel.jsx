import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PostGiftPanel({ postId, postRecipientId, postType, onClose, onGiftSent }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  const TABS = [
    { key: 'general', label: '🎁 Gifts' },
    { key: 'vip', label: '👑 VIP' },
    { key: 'lucky', label: '🍀 Lucky' },
  ];

  useEffect(() => {
    fetchGifts();
  }, []);

  const fetchGifts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('gift_catalog')
        .select('id, name_en, name_ar, icon_url, cost, gems_awarded, is_vip_only, is_lucky, category')
        .eq('is_active', true)
        .eq('is_profile_gift_enabled', true)
        .order('cost', { ascending: true });
      setGifts(data || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredGifts = gifts.filter((g) => {
    if (activeTab === 'vip') return g.is_vip_only;
    if (activeTab === 'lucky') return g.is_lucky;
    return g.category === 'general' && !g.is_vip_only && !g.is_lucky;
  });

  const handleSendGift = async (gift) => {
    if (!user?.id) return;
    setSending(gift.id);
    try {
      const { data, error } = await supabase.rpc('send_post_gift', {
        p_post_id: postId,
        p_gift_id: gift.id,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      // Create notification for post owner
      if (postRecipientId && postRecipientId !== user.id) {
        try {
          await supabase.from('notifications').insert({
            user_id: postRecipientId,
            type: 'post_gift',
            title: `🎁 ${gift.name_en}`,
            message: `Someone sent you a ${gift.name_en} on your ${postType || 'post'}`,
            reference_id: postId,
            reference_type: 'post',
            is_read: false
          });
        } catch (notifErr) {
          console.error('⚠️ Error creating notification:', notifErr);
        }
      }

      toast({
        title: `🎁 ${gift.name_en} sent!`,
        description: `${gift.cost} coins spent • ${gift.gems_awarded} gems awarded`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      if (onGiftSent) onGiftSent();
      onClose();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message === 'insufficient_coins' ? 'Not enough coins!' : err.message,
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Send a Gift 🎁</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full" aria-label="Close gift panel">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition',
                activeTab === tab.key
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400" />
          </div>
        ) : filteredGifts.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No gifts available</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 max-h-60 overflow-y-auto">
            {filteredGifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => handleSendGift(gift)}
                disabled={!!sending}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition',
                  sending === gift.id
                    ? 'border-rose-300 bg-rose-50'
                    : 'border-gray-100 hover:border-rose-300 hover:bg-rose-50'
                )}
              >
                {sending === gift.id ? (
                  <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
                ) : gift.icon_url ? (
                  <img src={gift.icon_url} alt={gift.name_en} className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-3xl">🎁</span>
                )}
                <span className="text-xs text-gray-600 truncate w-full text-center">
                  {gift.name_en}
                </span>
                <div className="flex items-center gap-0.5">
                  <span className="text-xs font-bold text-amber-600">
                    {gift.cost.toLocaleString()}
                  </span>
                  <span className="text-xs">🪙</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
