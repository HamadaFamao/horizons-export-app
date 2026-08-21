import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { useTranslation } from 'react-i18next';
import { getVipInfo } from '@/utils/vip';

export default function MatchesPage() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/auth');
                return;
            }

            try {
                // Fetch matches where current user is either user_a or user_b, including is_vip
                const { data, error } = await supabase
                    .from('matches')
                    .select(`
                        id,
                        user_a,
                        user_b,
                        profiles_user_a:user_a (profile_id, name, avatar_url, age, is_vip, vip_number, vip_until),
                        profiles_user_b:user_b (profile_id, name, avatar_url, age, is_vip, vip_number, vip_until)
                    `)
                    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

                if (error) throw error;

                // Process data to get the 'other' user's profile
                const processedMatches = data.map(match => {
                    const otherUser = match.user_a === user.id ? match.profiles_user_b : match.profiles_user_a;
                    const vipInfo = getVipInfo(otherUser);
                    return {
                        matchId: match.id,
                        otherUserId: otherUser.profile_id,
                        name: otherUser.name,
                        avatar_url: otherUser.avatar_url,
                        age: otherUser.age,
                        is_vip: vipInfo.isVip,
                        vip_label: vipInfo.label
                    };
                });

                setMatches(processedMatches);
            } catch (err) {
                console.error('Error fetching matches:', err);
                setError('Failed to load matches.');
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 flex flex-col">
                <AppHeader />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{t('matches_page_title')} - Famo</title>
                <meta name="description" content={t('matches_page_meta_description')} />
            </Helmet>
            <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 flex flex-col">
                <AppHeader />
                <main className="container mx-auto px-4 py-8 flex-1 max-w-4xl">
                    <h1 className="text-3xl font-bold gradient-text mb-6">{t('your_matches')}</h1>

                    {error && <p className="text-red-500 text-center">{error}</p>}

                    {matches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center bg-white/70 rounded-lg shadow-md">
                            <img alt="Two people holding hands, symbolizing connection" src="https://images.unsplash.com/photo-1638619632877-6571492f13f5" />
                            <p className="text-xl font-semibold text-gray-700">{t('no_matches_yet')}</p>
                            <p className="text-md text-gray-600 mt-2">{t('explore_discover_page')}</p>
                            <Button onClick={() => navigate('/')} className="mt-6 btn-gradient text-white">
                                {t('find_matches')}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {matches.map((match) => (
                                <Link to={`/user/${match.otherUserId}`} key={match.matchId} className="block">
                                    <div className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white">
                                        {/* Avatar section */}
                                        <div className="relative">
                                            <img
                                                src={match.avatar_url || DEFAULT_AVATAR}
                                                alt={match.name}
                                                className={`w-full h-64 object-cover ${match.is_vip ? 'border-b-4 border-yellow-400' : ''}`}
                                                onError={(e) => {e.target.src = DEFAULT_AVATAR}}
                                            />
                                            {match.is_vip && (
                                                <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 rounded-full px-2 py-1 text-xs font-bold flex items-center gap-1 shadow-md z-10">
                                                    <span>{match.vip_label}</span>
                                                    <span>👑</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-white text-xl font-bold">{match.name}{match.age ? `, ${match.age}` : ''}</h2>
                                                {match.is_vip && <span className="text-sm" title="VIP User">👑</span>}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}