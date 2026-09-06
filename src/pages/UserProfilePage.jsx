import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Loader2, MessageCircle, Gift, ArrowLeft, MoreVertical, Users, UserPlus, UserCheck, UserMinus, Home, Navigation, Shield, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getLevelFromXp } from '@/lib/xpLevelUtils';
import LevelBadge from '@/components/LevelBadge';
import { getVipInfo, getVipStyle } from '@/utils/vip';
import { getOnlineStatus } from '@/lib/lastSeenUtils';
import { getOrCreateThread } from '@/lib/messagingUtils';
import GiftPanel from '@/components/GiftPanel';
import ReportModal from '@/components/ReportModal';
import UserWall from '@/components/UserWall';
import PhotoGallery from '@/components/PhotoGallery';
import CountryDisplay from '@/components/CountryDisplay';
import { cn } from '@/lib/utils';

export default function UserProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [walletRefresh, setWalletRefresh] = useState(0);

  // Social state
  const [socialStats, setSocialStats] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState('none');
  const [followLoading, setFollowLoading] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  // Room state
  const [activeRoom, setActiveRoom] = useState(null);
  const [userOwnRoomId, setUserOwnRoomId] = useState(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [profileId]);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!profileId) { setError('User ID not provided'); return; }

        const isNumeric = /^\d+$/.test(profileId);
        let query = supabase.from('v_user_profile_with_wallet').select('*');
        if (isNumeric) query = query.eq('profile_id', Number(profileId));
        else query = query.eq('id', profileId);

        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) { setError('Profile not found'); return; }
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [profileId]);

  // Fetch social stats + room
  useEffect(() => {
    if (!profile?.profile_id) return;
    const fetchExtra = async () => {
      const [socialRes, roomRes] = await Promise.all([
        supabase.rpc('get_profile_social_stats', { p_profile_id: profile.profile_id }),
        supabase.rpc('get_user_active_room', { p_profile_id: profile.profile_id }),
      ]);
      if (socialRes.data?.success) {
        setSocialStats(socialRes.data);
        setIsFollowing(socialRes.data.is_following);
        setFriendStatus(socialRes.data.friend_status || 'none');
      }
      if (roomRes.data?.success) setActiveRoom(roomRes.data);
      if (roomRes.data?.is_owner && roomRes.data?.room_id) {
        setUserOwnRoomId(roomRes.data.room_id);
      }
    };
    fetchExtra();
  }, [profile?.profile_id]);

  const isOwnProfile = currentUser?.id === profile?.id;

  const vipInfo = getVipInfo(profile);
  const vipStyle = getVipStyle(profile?.vip_number);
  const displayLevel = profile?.xp ? getLevelFromXp(profile.xp)?.currentLevel : profile?.level;
  const onlineStatus = profile ? getOnlineStatus(profile) : null;

  const getAdminBadge = () => {
    if (!profile) return null;
    const role = profile.staff_role || profile.admin_role;
    if (role === 'manager') return { label: 'Manager', icon: ShieldCheck, className: 'bg-purple-100 text-purple-800 border-purple-200' };
    if (role === 'admin') return { label: 'Admin', icon: Shield, className: 'bg-red-100 text-red-800 border-red-200' };
    if (role === 'moderator') return { label: 'Mod', icon: Shield, className: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (profile.isadmin) return { label: 'Admin', icon: Shield, className: 'bg-red-100 text-red-800 border-red-200' };
    return null;
  };
  const adminBadge = getAdminBadge();

  const handleMessage = async () => {
    if (!currentUser?.id || !profile?.id) return;
    setCreatingThread(true);
    try {
      const threadId = await getOrCreateThread(currentUser.id, profile.id);
      navigate(`/messages/${threadId}`);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingThread(false);
    }
  };

  const handleGiftSent = async (payload) => {
    try {
      const { data, error } = await supabase.rpc('send_profile_gift', {
        p_receiver_id: profile.id,
        p_gift_id: payload.gift_id,
        p_message: payload.message || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({
        title: '🎁 Gift Sent!',
        description: `Successfully sent gift to ${profile.name}`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });
      setShowGiftPanel(false);
      setWalletRefresh(w => w + 1);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message === 'insufficient_coins' ? 'Not enough coins!' : err.message,
        variant: 'destructive',
      });
    }
  };

  const handleFollow = async () => {
    if (!currentUser?.id || !profile?.id) return;
    setFollowLoading(true);
    try {
      const { data } = await supabase.rpc('toggle_follow', { p_target_id: profile.id });
      if (data?.success) {
        setIsFollowing(data.following);
        setSocialStats(prev => prev ? { ...prev, followers: data.follower_count } : prev);
      }
    } finally { setFollowLoading(false); }
  };

  const handleFriendAction = async (action) => {
    if (!currentUser?.id || !profile?.id) return;
    setFriendLoading(true);
    try {
      const { data } = await supabase.rpc('handle_friend_request', {
        p_target_id: profile.id,
        p_action: action,
      });
      if (data?.success) setFriendStatus(data.status === 'pending' ? 'pending_sent' : data.status);
    } finally { setFriendLoading(false); }
  };

  const handleBlock = async () => {
    setShowMoreMenu(false);
    if (!window.confirm('Block this user?')) return;
    await supabase.from('blocks').insert({ blocker: currentUser.id, blocked: profile.id }).catch(() => {});
    toast({ title: 'User blocked' });
    navigate(-1);
  };

  const TABS = [
    { key: 'posts', label: '📝 Posts' },
    { key: 'photos', label: '🖼️ Photos' },
    { key: 'achievements', label: '🏆 Achievements' },
  ];

  if (loading) return (
    <Layout><div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-rose-500" /></div></Layout>
  );
  if (error || !profile) return (
    <Layout><div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-gray-500 text-lg">{error || 'Profile not found'}</p>
      <button onClick={() => navigate(-1)} className="text-rose-500 font-semibold hover:text-rose-600 transition">Go Back</button>
    </div></Layout>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 pb-20">

        {/* Cover + Back */}
        <div className="relative">
          <div className="h-48 bg-gradient-to-br from-rose-400 via-fuchsia-500 to-orange-400 shadow-inner relative overflow-hidden">
            {/* Decorative subtle overlay */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
          </div>
          
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white/30 hover:scale-105 transition-all shadow-lg border border-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* More Menu */}
          {!isOwnProfile && (
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="bg-white/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white/30 hover:scale-105 transition-all shadow-lg border border-white/20"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-14 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-44 z-50 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowReport(true); }}
                    className="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <span>🚩</span> Report
                  </button>
                  <div className="h-px bg-gray-100 w-full"></div>
                  <button
                    onClick={handleBlock}
                    className="w-full text-left px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <span>🚫</span> Block
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Profile Card */}
          <div className="max-w-lg mx-auto px-4 -mt-20 relative z-10">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white p-6">
              {/* Avatar + Info */}
              <div className="flex items-start gap-5">
                <div className="relative shrink-0">
                  <img
                    src={profile.avatar_url || '/default-avatar.svg'}
                    alt={profile.name}
                    className={cn(
                      'w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg',
                      vipStyle.avatarRingClassName
                    )}
                    onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }}
                  />
                  {onlineStatus?.isOnline && (
                    <div className="absolute bottom-1.5 right-1.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-sm">
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <h1 className="text-2xl font-extrabold text-gray-900 truncate tracking-tight">
                    {profile.name}{profile.age ? <span className="text-gray-500 font-medium text-xl">, {profile.age}</span> : ''}
                  </h1>

                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {displayLevel > 0 && (
                      <div className="shadow-sm rounded-full">
                        <LevelBadge level={displayLevel} size="sm" showName={false} />
                      </div>
                    )}
                    {adminBadge && (
                      <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm', adminBadge.className)}>
                        <adminBadge.icon className="w-3.5 h-3.5" />
                        {adminBadge.label}
                      </span>
                    )}
                    {vipInfo.isVip && (
                      <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-sm', vipStyle.badgeClassName)}>
                        {vipInfo.label} 👑
                      </span>
                    )}
                  </div>

                  {/* ID + Country */}
                  <div className="flex items-center gap-2 mt-2.5">
                    {profile.profile_id && (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100/80 px-2.5 py-1 rounded-full shadow-inner">
                        ID: {profile.profile_id}
                      </span>
                    )}
                    {profile.country_code && (
                      <div className="shadow-sm rounded-sm overflow-hidden">
                        <CountryDisplay code={profile.country_code} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Stats */}
              {socialStats && (
                <div className="flex items-center gap-4 mt-6 pt-5 border-t border-gray-100/80">
                  <div className="text-center flex-1 group cursor-pointer">
                    <p className="text-xl font-black text-gray-800 group-hover:text-rose-500 transition-colors">{socialStats.followers?.toLocaleString() || 0}</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Followers</p>
                  </div>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                  <div className="text-center flex-1 group cursor-pointer">
                    <p className="text-xl font-black text-gray-800 group-hover:text-rose-500 transition-colors">{socialStats.following?.toLocaleString() || 0}</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Following</p>
                  </div>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                  <div className="text-center flex-1 group cursor-pointer">
                    <p className="text-xl font-black text-gray-800 group-hover:text-rose-500 transition-colors">{socialStats.friends?.toLocaleString() || 0}</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Friends</p>
                  </div>
                </div>
              )}

              {/* About Me */}
              {profile.bio && (
                <div className="mt-5 pt-5 border-t border-gray-100/80">
                  <p className="text-sm text-gray-600 leading-relaxed font-medium bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Action Buttons - Icon Style */}
              {!isOwnProfile && currentUser && (
                <div className="mt-6 pt-5 border-t border-gray-100/80">
                  <div className="flex items-center justify-center gap-5 flex-wrap">
                    {/* Message */}
                    <button
                      onClick={handleMessage}
                      disabled={creatingThread}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:shadow-indigo-300 group-hover:scale-110 transition-all duration-300">
                        {creatingThread ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <MessageCircle className="w-6 h-6 text-white" />}
                      </div>
                      <span className="text-[11px] font-bold text-gray-500 group-hover:text-indigo-600 transition-colors">Message</span>
                    </button>

                    {/* Gift */}
                    <button
                      onClick={() => setShowGiftPanel(true)}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 group-hover:shadow-rose-300 group-hover:scale-110 transition-all duration-300">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500 group-hover:text-rose-500 transition-colors">Gift</span>
                    </button>

                    {/* Follow */}
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
                        isFollowing 
                          ? 'bg-gray-100 shadow-inner group-hover:bg-gray-200' 
                          : 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-200 group-hover:shadow-violet-300 group-hover:scale-110'
                      )}>
                        {followLoading ? <Loader2 className={cn("w-6 h-6 animate-spin", isFollowing ? "text-gray-500" : "text-white")} /> :
                          isFollowing ? <UserMinus className="w-6 h-6 text-gray-500" /> : <Users className="w-6 h-6 text-white" />}
                      </div>
                      <span className={cn("text-[11px] font-bold transition-colors", isFollowing ? "text-gray-500" : "text-gray-500 group-hover:text-violet-600")}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </span>
                    </button>

                    {/* Add Friend */}
                    <button
                      onClick={() => {
                        if (friendStatus === 'none') handleFriendAction('send');
                        else if (friendStatus === 'pending_sent') handleFriendAction('cancel');
                        else if (friendStatus === 'pending_received') handleFriendAction('accept');
                        else if (friendStatus === 'friends') handleFriendAction('unfriend');
                      }}
                      disabled={friendLoading}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
                        friendStatus === 'friends' ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-green-200 group-hover:shadow-green-300 group-hover:scale-110' :
                        friendStatus === 'pending_sent' ? 'bg-gray-100 shadow-inner group-hover:bg-gray-200' :
                        friendStatus === 'pending_received' ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-200 group-hover:shadow-amber-300 group-hover:scale-110' :
                        'bg-gradient-to-br from-teal-400 to-emerald-600 shadow-teal-200 group-hover:shadow-teal-300 group-hover:scale-110'
                      )}>
                        {friendLoading ? <Loader2 className={cn("w-6 h-6 animate-spin", friendStatus === 'pending_sent' ? "text-gray-500" : "text-white")} /> :
                          friendStatus === 'friends' ? <UserCheck className="w-6 h-6 text-white" /> :
                          friendStatus === 'pending_sent' ? <UserCheck className="w-6 h-6 text-gray-500" /> :
                          <UserPlus className="w-6 h-6 text-white" />}
                      </div>
                      <span className={cn("text-[11px] font-bold transition-colors", 
                        friendStatus === 'friends' ? 'text-gray-500 group-hover:text-green-600' :
                        friendStatus === 'pending_sent' ? 'text-gray-500' :
                        friendStatus === 'pending_received' ? 'text-gray-500 group-hover:text-amber-600' :
                        'text-gray-500 group-hover:text-teal-600'
                      )}>
                        {friendStatus === 'friends' ? 'Friends' :
                         friendStatus === 'pending_sent' ? 'Pending' :
                         friendStatus === 'pending_received' ? 'Accept' : 'Add'}
                      </span>
                    </button>

                    {/* Room - ينقل دايماً لروم المستخدم الخاص به، يظهر للجميع لو عنده روم أصلاً */}
                    {userOwnRoomId && (
                      <button
                        onClick={() => navigate(`/rooms/${userOwnRoomId}`)}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div className="w-11 h-11 bg-amber-500 rounded-full flex items-center justify-center shadow-sm group-hover:bg-amber-600 transition">
                          <Home className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-500">Room</span>
                      </button>
                    )}

                    {/* Track - يظهر للأصدقاء بس، طالما المستخدم في أي روم دلوقتي (رومه أو روم غيره) */}
                    {activeRoom?.success && friendStatus === 'friends' && (
                      <button
                        onClick={() => {
                          if (window.confirm(
                            `${profile.name} is in "${activeRoom.room_title || 'a room'}"\nWould you like to join?`
                          )) {
                            navigate(`/rooms/${activeRoom.room_id}`);
                          }
                        }}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div className="w-11 h-11 bg-cyan-600 rounded-full flex items-center justify-center shadow-sm group-hover:bg-cyan-700 transition animate-pulse">
                          <Navigation className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-500">Track</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="max-w-lg mx-auto px-4 mt-6">
          {(profile.occupation || profile.gender) && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5 hover:shadow-md transition-shadow">
              <div className="grid grid-cols-2 gap-4">
                {profile.occupation && (
                  <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Occupation</p>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span className="text-lg">💼</span> {profile.occupation}
                    </p>
                  </div>
                )}
                {profile.gender && (
                  <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Gender</p>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold',
                        profile.gender?.toLowerCase() === 'male' ? 'bg-blue-500' : 
                        profile.gender?.toLowerCase() === 'female' ? 'bg-pink-500' : 'bg-gray-400'
                      )}>
                        {profile.gender?.toLowerCase() === 'male' ? '♂' :
                         profile.gender?.toLowerCase() === 'female' ? '♀' : '?'}
                      </span> {profile.gender}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interests */}
          {Array.isArray(profile.interests) && profile.interests.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5 hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Interests</p>
              <div className="flex flex-wrap gap-2.5">
                {profile.interests.map((interest, i) => (
                  <span key={i} className="bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100/50 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:shadow hover:scale-105 transition-all cursor-default">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-5">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300',
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-200 scale-[1.02]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {activeTab === 'posts' && (
              <UserWall profileId={profile.profile_id} isOwner={false} />
            )}
            {activeTab === 'photos' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <PhotoGallery
                  userId={profile.id}
                  photos={Array.isArray(profile.photos) ? profile.photos : []}
                  isOwner={false}
                />
              </div>
            )}
            {activeTab === 'achievements' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <p className="text-4xl">🏆</p>
                  </div>
                  <p className="text-gray-800 font-bold text-lg mb-1">Achievements</p>
                  <p className="text-gray-400 text-sm font-medium">Coming soon to this profile</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gift Panel */}
        {showGiftPanel && profile && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-300">
            <div className="bg-white w-full rounded-t-[2.5rem] max-h-[75vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-full duration-300">
              <GiftPanel
                recipientId={profile.id}
                recipientName={profile.name}
                onClose={() => setShowGiftPanel(false)}
                onGiftSent={handleGiftSent}
              />
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReport && (
          <ReportModal
            isOpen={showReport}
            onClose={() => setShowReport(false)}
            reportedUserId={profile?.id}
            reportedUserName={profile?.name}
          />
        )}
      </div>
    </Layout>
  );
}