import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Helmet } from 'react-helmet';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Unlock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';

const BlockedUsersPage = () => {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch blocked users with profile details
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_user:profiles!blocks_blocked_fkey(*)')
        .eq('blocker', user.id);

      if (error) {
          console.error("Error fetching blocked users:", error);
      } else if (data) {
        setBlockedUsers(data.map(item => item.blocked_user));
      }

      setLoading(false);
    };

    fetchBlockedUsers();
  }, [navigate]);

  const handleUnblock = async (blockedUserId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker', user.id)
      .eq('blocked', blockedUserId);

    if (!error) {
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
      toast({ title: "User Unblocked", description: "User has been removed from your block list." });
    } else {
        toast({ title: "Error", description: "Failed to unblock user.", variant: "destructive" });
    }
  };

  if (loading) {
      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      );
  }

  return (
    <>
        <Helmet><title>Blocked Users - Singles</title></Helmet>
        <AppHeader />
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 py-8">
            <div className="container mx-auto px-4 max-w-2xl">
                 <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => navigate('/settings')}>
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back
                    </Button>
                    <h1 className="text-2xl font-bold gradient-text">Blocked Users</h1>
                 </div>

                 <div className="space-y-4">
                    {blockedUsers.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
                            <Unlock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>You haven't blocked anyone yet.</p>
                        </div>
                    ) : (
                        blockedUsers.map((user) => (
                            <div key={user.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm flex items-center justify-between border border-white">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={user.avatar_url || DEFAULT_AVATAR} />
                                        <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{user.name}</h3>
                                        <p className="text-xs text-gray-500">
                                            {user.age ? `${user.age} • ` : ''}
                                            {user.living_in || 'Unknown location'}
                                        </p>
                                    </div>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={() => handleUnblock(user.id)}
                                    className="text-xs"
                                >
                                    Unblock
                                </Button>
                            </div>
                        ))
                    )}
                 </div>
            </div>
        </div>
    </>
  );
};

export default BlockedUsersPage;