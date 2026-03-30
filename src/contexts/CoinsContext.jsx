import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient'; // Corrected import path
import { toast } from '@/components/ui/use-toast';

const CoinsContext = createContext();

export const useCoins = () => {
    const context = useContext(CoinsContext);
    if (!context) {
        throw new Error('useCoins must be used within a CoinsProvider');
    }
    return context;
};

export const CoinsProvider = ({ children }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWalletData = useCallback(async () => {
        if (!user) {
            setBalance(0);
            setTransactions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: wallet, error: walletError } = await supabase
                .from('wallets')
                .select('coins')
                .eq('user_id', user.id)
                .single();

            if (walletError && walletError.code !== 'PGRST116') { // PGRST116 = no row found
                throw walletError;
            }
            setBalance(wallet?.coins || 0);

            // For now, we'll keep it simple.
            setTransactions([]);

        } catch (error) {
            console.error('Error fetching wallet data:', error.message);
            toast({
                title: 'Error',
                description: 'Could not fetch wallet balance.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchWalletData();
    }, [fetchWalletData]);

    const purchaseCoins = async (amount) => {
        if (!user) return;
        
        const newBalance = balance + amount;
        
        const { error } = await supabase
            .from('wallets')
            .upsert({ user_id: user.id, coins: newBalance }, { onConflict: 'user_id' });

        if (error) {
            toast({ title: 'Purchase Failed', description: error.message, variant: 'destructive' });
            return;
        }

        setBalance(newBalance);
        toast({
            title: 'Purchase Successful! 💎',
            description: `You've added ${amount} coins to your wallet.`,
        });
    };

    const sendGift = async (gift) => {
        if (!user || !gift.receiverId) return false;

        if (balance < gift.cost) {
            toast({
                title: 'Insufficient Coins',
                description: 'You do not have enough coins to send this gift. Please buy more.',
                variant: 'destructive',
            });
            return false;
        }
        
        const { error } = await supabase.rpc('send_gift', {
            p_sender_id: user.id,
            p_receiver_id: gift.receiverId,
            p_gift_type: gift.name,
            p_coins_spent: gift.cost
        });
        
        if (error) {
            toast({ title: 'Gift Send Failed', description: error.message, variant: 'destructive' });
            return false;
        }

        setBalance(balance - gift.cost);
        
        toast({
            title: 'Gift Sent! 🎁',
            description: `You sent a ${gift.name} to ${gift.receiverName}.`,
        });
        return true;
    };
    
    const value = {
        balance,
        transactions,
        loading,
        purchaseCoins,
        sendGift,
        fetchWalletData,
    };

    return <CoinsContext.Provider value={value}>{children}</CoinsContext.Provider>;
};