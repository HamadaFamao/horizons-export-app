import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Coins, Plus } from 'lucide-react';
import CoinsBadge from '@/components/CoinsBadge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserWallet } from '@/lib/walletUtils';
import { insertGiftMessage } from '@/lib/giftMessageHelper';

export default function ChatGiftModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  onGiftSelected,
}) {
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Wallet state for the modal
  const [walletCoins, setWalletCoins] = useState(0);

  // Load wallet info when modal opens
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadWallet = async () => {
      const { data } = await supabase
        .from('wallets')
        .select('coins')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setWalletCoins(data.coins);
      }
    };
    
    loadWallet();
  }, [isOpen, user]);

  // Load gifts on mount - filter only chat-enabled general gifts
  useEffect(() => {
    if (!isOpen) return;

    const loadGifts = async () => {
      try {
        setLoadingGifts(true);
        const { data, error } = await supabase
          .from('gift_catalog')
          .select('id, name_en, name_ar, icon_url, cost, category, is_vip_only, is_lucky, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('Error loading gifts:', error);
          toast({
            title: 'Error',
            description: 'Failed to load gifts',
            variant: 'destructive',
          });
          return;
        }

        setGifts(data || []);
      } catch (err) {
        console.error('Exception loading gifts:', err);
        toast({
          title: 'Error',
          description: 'Failed to load gifts',
          variant: 'destructive',
        });
      } finally {
        setLoadingGifts(false);
      }
    };

    loadGifts();
  }, [isOpen, toast]);

    // Filter: only show general gifts in chat (no VIP/Lucky/Exclusive)
  const filteredGifts = gifts.filter(g => 
    g.category === 'general' && 
    !g.is_vip_only && 
    !g.is_lucky
  );

  const handleSendGift = async () => {
    if (!selectedGift || !user) {
      toast({
        title: 'Error',
        description: 'Please select a gift',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      // Check if recipient has do_not_disturb enabled
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('do_not_disturb, name')
        .eq('id', recipientId)
        .maybeSingle();

      if (recipientProfile?.do_not_disturb) {
        toast({
          title: '🔕 Not Available',
          description: `${recipientName} is not accepting gifts at the moment.`,
          variant: 'destructive',
        });
        setIsSending(false);
        return;
      }

      // 1. Call RPC directly with standard error handling
      const { data, error } = await supabase.rpc('send_gift_secure', {
        p_gift_id: selectedGift.id,
        p_recipient_id: recipientId,
        p_sender_id: user.id
      });

      // 2. Check error first
      if (error) {
        console.error('❌ Gift send error:', error);
        
        toast({
          title: 'Transaction Failed',
          description: error.message || 'Failed to send gift',
          variant: 'destructive',
        });
        setIsSending(false); // Re-enable button
        return;
      }

      // 3. Success path
      toast({
        title: 'Gift Sent! 🎁',
        description: `Successfully sent ${selectedGift.name_en} to ${recipientName}`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      // 4. Refresh global wallet state (best effort)
      fetchUserWallet(user.id).catch(console.error);
      
      // 5. Refresh local wallet state in modal
      const { data: walletData } = await supabase
        .from('wallets')
        .select('coins')
        .eq('user_id', user.id)
        .single();
      if (walletData) {
        setWalletCoins(walletData.coins);
      }


      // 6. Create gift message in chat with custom message
      try {
        await insertGiftMessage({
          senderId: user.id,
          recipientId: recipientId,
          giftId: selectedGift.id,
          giftName: selectedGift.name_en,
          iconUrl: selectedGift.icon_url,
          message: customMessage || '',
        });
      } catch (err) {
        console.error('⚠️ Error creating gift message in chat:', err);
        // Don't fail if message creation fails
      }
      // 7. Close modal
      onClose();

      // 8. Notify parent
      if (typeof onGiftSelected === 'function') {
        onGiftSelected({ sent: true, gift: selectedGift, message: customMessage });
      }

      // Reset local state
      setSelectedGift(null);
      setCustomMessage('');
      
    } catch (err) {
      console.error('Exception sending gift:', err);
      toast({
        title: 'Error',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setIsSending(false);
    }
  };

  const handleNavigateToCoins = () => {
    onClose();
    navigate('/plans?tab=coins');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-900">Send a gift to {recipientName}</h2>
              <p className="text-xs text-gray-500">Unlock chat & rewards</p>
            </div>
          
            <div className="flex items-center gap-3">
                 <CoinsBadge 
                    coins={walletCoins} 
                    onClick={handleNavigateToCoins} 
                    className="flex-shrink-0"
                 />
                 <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {loadingGifts ? (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-2" />
              <p className="text-gray-500">Loading gifts...</p>
            </div>
          ) : filteredGifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
               <p>No gifts available currently.</p>
            </div>
          ) : (
            <>
              {/* Gift grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {filteredGifts.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    disabled={isSending}
                    className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                      selectedGift?.id === gift.id
                        ? 'border-rose-500 bg-rose-50 shadow-md transform scale-105'
                        : 'border-gray-100 bg-white hover:border-rose-200 hover:shadow-sm'
                    } ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 relative">
                        <img 
                            src={gift.icon_url} 
                            alt={gift.name_en}
                            className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
                            onError={(e) => { e.target.src = 'https://placehold.co/64x64?text=Gift' }} 
                        />
                    </div>
                    
                    <div className="text-center w-full">
                        <p className="text-xs font-semibold text-gray-900 truncate w-full">{gift.name_en}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center justify-center gap-0.5">
                            <Coins className="w-3 h-3" />
                            {gift.cost}
                        </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  disabled={isSending}
                  placeholder="Write a nice message..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white text-sm disabled:opacity-50"
                  rows="2"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
             {/* Send Button */}
            <button
                onClick={handleSendGift}
                disabled={!selectedGift || isSending || loadingGifts}
                className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    !selectedGift || isSending || loadingGifts
                    ? 'bg-gray-200 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-md hover:shadow-lg'
                }`}
            >
                {isSending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                    </>
                ) : (
                    'Send Gift'
                )}
            </button>

             {/* Top Up Button */}
             <button
                onClick={handleNavigateToCoins}
                disabled={isSending}
                className="px-4 py-3.5 rounded-xl font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1 border border-amber-200 disabled:opacity-50"
                title="Top up your coins"
            >
                 <Plus className="w-4 h-4" strokeWidth={3} />
                 Top Up
            </button>
        </div>
      </div>
    </div>
  );
}