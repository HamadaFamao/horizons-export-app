import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Star, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AVATAR } from '@/lib/constants';

const ProfileCard = ({ profile }) => (
    <Link to={`/user/${profile.profile_id}`}>
        <motion.div
            className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg group"
            whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
        >
            <img
                src={profile.avatar_url || DEFAULT_AVATAR}
                onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                alt={profile.name}
                className="w-full h-full object-cover bg-gray-200"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <h3 className="text-white text-2xl font-bold flex items-center">
                    {profile.name}{profile.age ? `, ${profile.age}`: ''}
                    {profile.verified && <Star className="ml-2 w-5 h-5 text-blue-400 fill-current" />}
                </h3>
            </div>
        </motion.div>
    </Link>
);

const HomePage = () => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { t } = useTranslation('common');
    
    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('v_profiles_discover')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching profiles:', error);
        } else {
            setProfiles(data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    return (
        <>
            <Helmet>
                <title>{t('home_page_title')} - Famo</title>
                <meta name="description" content={t('home_page_meta_description')} />
            </Helmet>
            <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
                <AppHeader />
                <main className="container mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold gradient-text">{t('home_title')}</h1>
                        <div className="flex items-center gap-2">
                           <Button variant="ghost" size="icon" onClick={() => navigate('/search')}>
                             <SlidersHorizontal className="w-5 h-5"/>
                           </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                        </div>
                    ) : profiles.length > 0 ? (
                         <motion.div 
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {profiles.map(profile => (
                                <ProfileCard key={profile.profile_id} profile={profile} />
                            ))}
                        </motion.div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-xl font-semibold text-gray-700">{t('no_profiles_found')}</p>
                            <p className="mt-2 text-gray-500">{t('no_profiles_found_subtext')}</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default HomePage;