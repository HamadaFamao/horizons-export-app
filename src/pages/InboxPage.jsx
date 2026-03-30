import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import AppHeader from '@/components/AppHeader';
import { Loader2, Inbox as InboxIcon, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

const InboxPage = () => {
    const { user, loading: authLoading } = useAuth();
    const { t } = useTranslation('common');
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchThreads = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            
            setLoading(true);
            const { data, error } = await supabase
                .rpc('get_user_threads_with_details', { p_user_id: user.id });

            if (error) {
                console.error('Error fetching threads:', error);
            } else {
                setThreads(data);
            }
            setLoading(false);
        };

        if (!authLoading) {
            fetchThreads();
        }
    }, [user, authLoading]);

    if (authLoading) {
        return (
            <>
                <Helmet><title>{t('inbox')} - Singles</title></Helmet>
                <AppHeader />
                <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
                    <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                </div>
            </>
        );
    }
    
    if (!user) {
         return (
             <>
                 <Helmet><title>{t('inbox')} - Singles</title></Helmet>
                 <AppHeader />
                 <main className="container mx-auto px-4 py-8 text-center">
                     <h1 className="text-3xl font-bold gradient-text mb-4">{t('inbox')}</h1>
                     <p className="text-gray-600 mb-6">{t('login_to_view_inbox')}</p>
                     <Button asChild className="btn-gradient text-white">
                         <Link to="/auth">{t('login')}</Link>
                     </Button>
                 </main>
             </>
         );
     }

    return (
        <>
            <Helmet>
                <title>{t('inbox')} - Singles</title>
                <meta name="description" content={t('inbox_description')} />
            </Helmet>
            <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
                <AppHeader />
                <main className="container mx-auto px-4 py-8">
                    <h1 className="text-3xl font-bold gradient-text mb-6">{t('inbox')}</h1>
                    {loading ? (
                         <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                        </div>
                    ) : threads.length > 0 ? (
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                           {threads.map(thread => (
                               <Link key={thread.thread_id} to={`/messages?thread=${thread.thread_id}`}>
                                   <div className="flex items-center p-4 border-b hover:bg-gray-50 transition-colors">
                                       <Avatar className="h-12 w-12 mr-4">
                                           <AvatarImage src={thread.other_user_avatar_url} />
                                           <AvatarFallback>{thread.other_user_name?.[0]}</AvatarFallback>
                                       </Avatar>
                                       <div className="flex-grow">
                                           <h3 className="font-semibold">{thread.other_user_name}</h3>
                                           <p className="text-sm text-gray-500 truncate">{thread.last_message_body}</p>
                                       </div>
                                       <div className="text-xs text-gray-400">
                                           {new Date(thread.last_message_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                       </div>
                                   </div>
                               </Link>
                           ))}
                       </div>
                    ) : (
                        <div className="text-center py-20 bg-white/50 rounded-lg shadow-sm">
                            <InboxIcon className="mx-auto h-16 w-16 text-gray-400" />
                            <p className="mt-4 text-xl font-semibold text-gray-700">{t('no_messages_yet')}</p>
                            <p className="mt-2 text-gray-500">Start a conversation to see your messages here.</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default InboxPage;