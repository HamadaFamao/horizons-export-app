import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

const RewardsContext = createContext();

export const useRewards = () => {
    const context = useContext(RewardsContext);
    if (!context) {
        throw new Error('useRewards must be used within a RewardsProvider');
    }
    return context;
};

const getLevel = (points) => {
    if (points < 100) return 1;
    if (points < 250) return 2;
    if (points < 500) return 3;
    if (points < 1000) return 4;
    return 5 + Math.floor((points - 1000) / 1000);
};

const getPointsForNextLevel = (level) => {
    if (level === 1) return 100;
    if (level === 2) return 250;
    if (level === 3) return 500;
    if (level === 4) return 1000;
    return (level - 4) * 1000 + 1000;
};

export const RewardsProvider = ({ children }) => {
    const { user } = useAuth();
    const [rewards, setRewards] = useState({
        points: 0,
        level: 1,
        streak_days: 0,
        referral_count: 0,
        last_streak_at: null,
    });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Ref to prevent double-claiming in StrictMode or rapid clicks
    const claimInProgressRef = useRef(false);

    const fetchRewardsData = useCallback(async () => {
        if (!user) {
            setRewards({ points: 0, level: 1, streak_days: 0, referral_count: 0 });
            setHistory([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: rewardsData, error: rewardsError } = await supabase
                .from('rewards')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (rewardsError && rewardsError.code !== 'PGRST116') throw rewardsError;
            
            const effectiveRewards = rewardsData || { points: 0, streak_days: 0, referral_count: 0 };
            setRewards({ ...effectiveRewards, level: getLevel(effectiveRewards.points) });

            const { data: historyData, error: historyError } = await supabase
                .from('reward_history')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (historyError) throw historyError;
            setHistory(historyData || []);

        } catch (error) {
            console.error('Error fetching rewards data:', error.message);
            toast({ title: 'Error', description: 'Could not fetch rewards.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchRewardsData();
    }, [fetchRewardsData]);

    const addPoints = async (amount, type, meta = {}) => {
        if (!user) return;
        
        try {
            const { data, error } = await supabase.rpc('add_reward_points', {
                p_user_id: user.id,
                p_points: amount,
                p_type: type,
                p_meta: meta
            });

            if (error) throw error;
            
            await fetchRewardsData(); // Refresh data from DB

            toast({
                title: `+${amount} Points! ⭐`,
                description: meta.description || `You earned points for ${type}.`,
            });
        } catch(error) {
            console.error('Error adding points:', error.message);
            toast({ title: 'Error', description: 'Could not add points.', variant: 'destructive'});
        }
    };
    
    // NEW: Manual claim function instead of auto-effect
    const claimDailyReward = useCallback(async () => {
        if (!user) return;

        // 1. Check Ref Guard
        if (claimInProgressRef.current) return;

        // 2. Check Local Storage
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `daily_reward_claimed_${user.id}_${today}`;
        
        if (localStorage.getItem(storageKey)) {
             toast({ 
                 title: 'Already Claimed', 
                 description: 'You have already claimed your daily reward today.',
                 variant: "default"
             });
             return;
        }

        // 3. Database check (optimistic)
        if (rewards.last_streak_at === today) {
            localStorage.setItem(storageKey, 'true'); // Sync if missing
            toast({ 
                 title: 'Already Claimed', 
                 description: 'You have already claimed your daily reward today.',
                 variant: "default"
             });
             return;
        }

        claimInProgressRef.current = true;

        try {
            const { error } = await supabase.rpc('claim_daily_reward', { p_user_id: user.id });
            
            if (error) {
                // If backend says already claimed, trust it and update local storage
                if (error.message && error.message.toLowerCase().includes("already claimed")) {
                    localStorage.setItem(storageKey, 'true');
                    toast({ 
                         title: 'Already Claimed', 
                         description: 'You have already claimed your daily reward today.',
                         variant: "default"
                     });
                } else {
                    throw error;
                }
            } else {
                // Success path
                localStorage.setItem(storageKey, 'true');
                await fetchRewardsData();
                toast({
                    title: 'Daily Reward Claimed! 🎉',
                    description: 'You have received points for your daily login.',
                    className: "bg-green-50 text-green-900 border-green-200"
                });
            }
        } catch (err) {
            console.error("Daily login claim failed:", err.message);
            toast({ title: 'Error', description: 'Failed to claim daily reward.', variant: 'destructive'});
        } finally {
            claimInProgressRef.current = false;
        }
    }, [user, rewards.last_streak_at, fetchRewardsData]);

    const value = {
        rewards,
        history,
        loading,
        addPoints,
        getLevel,
        getPointsForNextLevel,
        fetchRewardsData,
        claimDailyReward, // Exposed for manual trigger
    };

    return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
};