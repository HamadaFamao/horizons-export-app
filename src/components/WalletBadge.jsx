import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import CoinsBadge from '@/components/CoinsBadge';

const WalletBadge = () => {
    const { user } = useAuth();
    const [coins, setCoins] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCoins = async () => {
            if (!user) {
                setLoading(false);
                setCoins(0);
                return;
            }
            setLoading(true);
            const { data, error } = await supabase
                .from('wallets')
                .select('coins')
                .eq('user_id', user.id)
                .single();
            
            if (data) {
                setCoins(data.coins);
            } else if (error && error.code !== 'PGRST116') { // Ignore "no rows found"
                console.error("Error fetching wallet coins:", error);
            }
            setLoading(false);
        };

        fetchCoins();

        if (!user) return;

        const channel = supabase.channel(`wallet_changes_${user.id}`)
          .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'wallets',
              filter: `user_id=eq.${user.id}`
          },
          (payload) => {
              if (payload.new && typeof payload.new.coins !== 'undefined') {
                setCoins(payload.new.coins);
              }
          })
          .subscribe();
          
        return () => {
            supabase.removeChannel(channel);
        };

    }, [user]);

    if (!user) {
        return null;
    }

    if (loading) {
        return (
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-800 font-semibold text-sm border border-amber-200/90">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            </div>
        );
    }

    return (
        <CoinsBadge coins={coins} />
    );
};

export default WalletBadge;