import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, Gift, Loader2, Gem } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WalletAndRewards = () => {
    const { user } = useAuth();
    const { t } = useTranslation('profile');
    const [wallet, setWallet] = useState(null);
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);

            // Fetch wallet data including gems
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('coins, gems')
                .eq('user_id', user.id)
                .single();

            if (walletError && walletError.code !== 'PGRST116') { // Ignore 'no rows found'
                console.error("Wallet error:", walletError);
            } else {
                setWallet(walletData || { coins: 0, gems: 0 });
            }

            // Fetch reward history
            const { data: rewardData, error: rewardError } = await supabase
                .from('reward_history')
                .select('type, delta, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (rewardError) {
                console.error("Reward history error:", rewardError);
            } else {
                setRewards(rewardData || []);
            }
            
            setLoading(false);
        };

        fetchData();

        // Real-time subscription for wallet changes
        const subscription = supabase
            .channel(`wallets:user_id=eq.${user.id}`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'wallets',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    if (payload.new) {
                        setWallet(prev => ({
                            ...prev,
                            coins: payload.new.coins ?? prev?.coins ?? 0,
                            gems: payload.new.gems ?? prev?.gems ?? 0
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 gap-6 mt-8">
            <Card className="rounded-2xl border bg-white/70 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{t('wallet.title')}</CardTitle>
                    <Coins className="h-6 w-6 text-amber-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold text-gray-800">
                        {wallet?.coins ?? 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('wallet.current_balance')}</p>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-white/70 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{t('rewards.title')}</CardTitle>
                    {/* Gems Badge */}
                    <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                        <Gem className="h-4 w-4 text-purple-600" />
                        <span className="font-semibold text-purple-700 text-sm">{wallet?.gems || 0}</span>
                    </div>
                </CardHeader>
                <CardContent>
                    {rewards.length > 0 ? (
                        <ul className="space-y-3">
                            {rewards.map((reward, index) => (
                                <li key={index} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-100 rounded-full">
                                            <Gift className="h-4 w-4 text-rose-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium capitalize">{t(`rewards.types.${reward.type}`, { defaultValue: reward.type })}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(reward.created_at).toLocaleDateString(document.documentElement.lang)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-semibold ${reward.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {reward.delta > 0 ? `+${reward.delta}` : reward.delta}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">{t('rewards.no_rewards')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default WalletAndRewards;