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
      const thread = await getOrCreateThread(currentUser.id, profile.id);
      navigate(`/messages/${thread.id}`);
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setCreatingThread(false); }
  };

  const handleGiftSent = async () => {
    setShowGiftPanel(false);
    setWalletRefresh(w => w + 1);
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
    <Layout><div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-rose-500" /></div></Layout>
  );
  if (error || !profile) return (
    <Layout><div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-gray-500">{error || 'Profile not found'}</p>
      <button onClick={() => navigate(-1)} className="text-rose-500 font-medium">Go Back</button>
    </div></Layout>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-20">

        {/* Cover + Back */}
        <div className="relative">
          <div className="h-40 bg-gradient-to-br from-rose-400 via-pink-400 to-orange-400" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* More Menu */}
          {!isOwnProfile && (
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border overflow-hidden w-40 z-50">
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowReport(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    🚩 Report
                  </button>
                  <button
                    onClick={handleBlock}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                  >
                    🚫 Block
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Profile Card */}
          <div className="max-w-lg mx-auto px-4 -mt-16 relative z-10">
            <div className="bg-white rounded-3xl shadow-xl p-5">
              {/* Avatar + Info */}
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={profile.avatar_url || '/default-avatar.svg'}
                    alt={profile.name}
                    className={cn(
                      'w-20 h-20 rounded-full object-cover border-4 border-white shadow-md',
                      vipStyle.avatarRingClassName
                    )}
                    onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }}
                  />
                  {onlineStatus?.isOnline && (
                    <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 truncate">
                    {profile.name}{profile.age ? `, ${profile.age}` : ''}
                  </h1>

                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {displayLevel > 0 && (
                      <LevelBadge level={displayLevel} size="sm" showName={false} />
                    )}
                    {adminBadge && (
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', adminBadge.className)}>
                        <adminBadge.icon className="w-3 h-3" />
                        {adminBadge.label}
                      </span>
                    )}
                    {vipInfo.isVip && (
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', vipStyle.badgeClassName)}>
                        {vipInfo.label} 👑
                      </span>
                    )}
                  </div>

                  {/* ID + Country */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {profile.profile_id && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        #{profile.profile_id}
                      </span>
                    )}
                    {profile.country_code && (
                      <CountryDisplay code={profile.country_code} />
                    )}
                  </div>
                </div>
              </div>

              {/* Social Stats */}
              {socialStats && (
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center flex-1">
                    <p className="font-bold text-gray-900">{socialStats.followers?.toLocaleString() || 0}</p>
                    <p className="text-xs text-gray-400">Followers</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center flex-1">
                    <p className="font-bold text-gray-900">{socialStats.following?.toLocaleString() || 0}</p>
                    <p className="text-xs text-gray-400">Following</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center flex-1">
                    <p className="font-bold text-gray-900">{socialStats.friends?.toLocaleString() || 0}</p>
                    <p className="text-xs text-gray-400">Friends</p>
                  </div>
                </div>
              )}

              {/* About Me */}
              {profile.bio && (
                <p className="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-100 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Action Buttons - Icon Style */}
              {!isOwnProfile && currentUser && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-around">
                    {/* Message */}
                    <button
                      onClick={handleMessage}
                      disabled={creatingThread}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className="w-11 h-11 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition">
                        {creatingThread ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <MessageCircle className="w-5 h-5 text-white" />}
                      </div>
                      <span className="text-[10px] text-gray-500">Message</span>
                    </button>

                    {/* Gift */}
                    <button
                      onClick={() => setShowGiftPanel(true)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className="w-11 h-11 bg-rose-500 rounded-full flex items-center justify-center shadow-sm group-hover:bg-rose-600 transition">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] text-gray-500">Gift</span>
                    </button>

                    {/* Follow */}
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition',
                        isFollowing ? 'bg-gray-200' : 'bg-purple-600 group-hover:bg-purple-700'
                      )}>
                        {followLoading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> :
                          isFollowing ? <UserMinus className="w-5 h-5 text-gray-600" /> : <Users className="w-5 h-5 text-white" />}
                      </div>
                      <span className="text-[10px] text-gray-500">{isFollowing ? 'Unfollow' : 'Follow'}</span>
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
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition',
                        friendStatus === 'friends' ? 'bg-green-100' :
                        friendStatus === 'pending_sent' ? 'bg-gray-200' :
                        friendStatus === 'pending_received' ? 'bg-amber-500 group-hover:bg-amber-600' :
                        'bg-teal-600 group-hover:bg-teal-700'
                      )}>
                        {friendLoading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> :
                          friendStatus === 'friends' ? <UserCheck className="w-5 h-5 text-green-600" /> :
                          <UserPlus className="w-5 h-5 text-white" />}
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {friendStatus === 'friends' ? 'Friends' :
                         friendStatus === 'pending_sent' ? 'Pending' :
                         friendStatus === 'pending_received' ? 'Accept' : 'Add'}
                      </span>
                    </button>

                    {/* Track */}
                    {activeRoom?.success && (
                      <button
                        onClick={() => navigate(`/room/${activeRoom.room_id}`)}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div className="w-11 h-11 bg-cyan-600 rounded-full flex items-center justify-center shadow-sm group-hover:bg-cyan-700 transition">
                          <Navigation className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-500">Track</span>
                      </button>
                    )}

                    {/* Enter Room */}
                    {activeRoom?.success && activeRoom.is_owner && (
                      <button
                        onClick={() => navigate(`/room/${activeRoom.room_id}`)}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div className="w-11 h-11 bg-amber-500 rounded-full flex items-center justify-center shadow-sm group-hover:bg-amber-600 transition">
                          <Home className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-gray-500">Room</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="max-w-lg mx-auto px-4 mt-4">
          {(profile.occupation || profile.gender) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                {profile.occupation && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Occupation</p>
                    <p className="text-sm font-semibold text-gray-800">💼 {profile.occupation}</p>
                  </div>
                )}
                {profile.gender && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gender</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {profile.gender === 'Male' ? '👨' : profile.gender === 'Female' ? '👩' : '🧑'} {profile.gender}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interests */}
          {Array.isArray(profile.interests) && profile.interests.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, i) => (
                  <span key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-4">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-medium transition',
                  activeTab === tab.key
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'posts' && (
            <UserWall profileId={profile.profile_id} isOwner={false} />
          )}
          {activeTab === 'photos' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <PhotoGallery
                userId={profile.id}
                photos={Array.isArray(profile.photos) ? profile.photos : []}
                isOwner={false}
              />
            </div>
          )}
          {activeTab === 'achievements' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="py-8 text-center">
                <p className="text-4xl mb-2">🏆</p>
                <p className="text-gray-400 text-sm">Achievements coming soon</p>
              </div>
            </div>
          )}
        </div>

        {/* Gift Panel */}
        {showGiftPanel && profile && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
            <div className="bg-white w-full rounded-t-3xl max-h-[70vh] overflow-y-auto">
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