import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PhotoGallery from '@/components/PhotoGallery';
import CountryDisplay from '@/components/CountryDisplay';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Gift, ArrowLeft, Copy, Shield, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import GiftPanel from '@/components/GiftPanel';
import WalletDisplay from '@/components/WalletDisplay';
import ReportModal from '@/components/ReportModal';
import { getOnlineStatus } from '@/lib/lastSeenUtils';
import { getOrCreateThread } from '@/lib/messagingUtils';
import { getLevelFromXp } from '@/lib/xpLevelUtils';
import LevelBadge from '@/components/LevelBadge';
import { getVipInfo, getVipStyle } from '@/utils/vip';

export default function UserProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [creatingThread, setCreatingThread] = useState(false);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [profileRefreshTrigger, setProfileRefreshTrigger] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Scroll to top when page opens
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [profileId]);

  // ============================================
  // EFFECT 1: Fetch current user's profile
  // ============================================
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!currentUser?.id) {
        setCurrentUserProfile(null);
        return;
      }

      try {
        const { data: currentProfile, error } = await supabase
          .from('v_user_profile_with_wallet')
          .select('profile_id, user_id')
          .eq('user_id', currentUser.id)
          .single();

        if (!error && currentProfile) {
          setCurrentUserProfile(currentProfile);
        }
      } catch (err) {
        console.error('Error fetching current user profile:', err);
      }
    };

    fetchCurrentUserProfile();
  }, [currentUser?.id]);

  // ============================================
  // EFFECT 2: Fetch visited PROFILE + WALLET from VIEW
  // ============================================
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Validate route param
        if (!profileId) {
          setError('User ID not provided');
          setLoading(false);
          return;
        }

        // Determine if input is a numeric Public ID or a UUID
        const isNumeric = /^\d+$/.test(profileId);
        const publicId = Number(profileId);

        let query = supabase.from('v_user_profile_with_wallet').select('*');
        
        if (isNumeric) {
           query = query.eq('profile_id', publicId);
        } else {
           query = query.eq('id', profileId);
        }

        const { data: profileData, error: profileError } = await query.single();

        // If profile not found, show error
        if (profileError || !profileData) {
          console.warn('Profile not found for ID:', profileId);
          setError('User not found');
          setLoading(false);
          return;
        }

        // Fetch photos for this profile
        const { data: photosData } = await supabase
          .from('photos')
          .select('url')
          .eq('user_id', profileData.id) 
          .eq('is_public', true)
          .order('is_primary', { ascending: false });

        if (photosData) {
          profileData.photos = photosData.map(p => p.url);
        }

        setProfile(profileData);
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setError('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, profileRefreshTrigger]);

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!currentUser?.id || !profile?.id) return;
      try {
        const { data } = await supabase
          .from('blocks')
          .select('id')
          .eq('blocker', currentUser.id)
          .eq('blocked', profile.id)
          .maybeSingle();
        setIsBlocked(!!data);
      } catch (err) {
        console.error('Error checking block status:', err);
      }
    };

    checkBlockStatus();
  }, [currentUser?.id, profile?.id]);

  const handleMessageClick = async () => {
      if (!currentUser || !profile) {
        toast({ title: "Error", description: "You must be logged in to send messages.", variant: "destructive" });
        return;
      }
      setCreatingThread(true);
      
      try {
          const threadId = await getOrCreateThread(currentUser.id, profile.id);
          if (threadId) {
              navigate(`/messages/${threadId}`);
          }
      } catch (err) {
          console.error("Error starting chat:", err);
          toast({ title: "Error", description: "Could not start chat", variant: "destructive" });
      } finally {
          setCreatingThread(false);
      }
  };

  const handleSendGift = async (giftData) => {
    if (isSendingGift || !currentUser || !profile) return;
    if (!giftData || !giftData.gift_id) {
        toast({ title: "Error", description: "Invalid gift data", variant: 'destructive' });
        return;
    }

    setIsSendingGift(true);

    try {
      // 1. Call RPC directly
      const { data, error } = await supabase.rpc('send_gift_secure', {
        p_sender_id: currentUser.id,
        p_recipient_id: profile.id,
        p_gift_id: giftData.gift_id
      });

      // 2. Error handling
      if (error) {
        toast({
            title: language === 'ar' ? 'خطأ' : 'Transaction Failed',
            description: error.message || 'Failed to send gift',
            variant: 'destructive',
        });
        setIsSendingGift(false);
        return;
      }

      // 3. Success handling
      toast({
        title: language === 'ar' ? 'تم الإرسال!' : 'Gift Sent! 🎁',
        description: language === 'ar' ? 'تم إرسال الهدية بنجاح' : `Successfully sent gift to ${profile.name}`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      // 4. Close modal
      setShowGiftPanel(false);

      // 5. Refresh sender wallet
      setWalletRefresh(prev => prev + 1);

      // 6. Refresh recipient profile/gems
      setProfileRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('❌ Exception in handleSendGift:', error);
      toast({
          title: 'Error',
          description: error.message || 'An unexpected error occurred.',
          variant: 'destructive',
      });
    } finally {
      setIsSendingGift(false);
    }
  };

  const handleBlock = async () => {
    if (!currentUser?.id || !profile?.id) return;
    setBlocking(true);
    try {
      const { error } = await supabase
        .from('blocks')
        .insert({ blocker: currentUser.id, blocked: profile.id });
      if (error) throw error;
      setIsBlocked(true);
      toast({
        title: '🚫 User Blocked',
        description: `${profile?.name} has been blocked.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!currentUser?.id || !profile?.id) return;
    setBlocking(true);
    try {
      await supabase
        .from('blocks')
        .delete()
        .eq('blocker', currentUser.id)
        .eq('blocked', profile.id);
      setIsBlocked(false);
      toast({
        title: '✅ Unblocked',
        description: `${profile?.name} has been unblocked.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setBlocking(false);
    }
  };

  const handleCopyId = () => {
    if (profile?.profile_id) {
      navigator.clipboard.writeText(String(profile.profile_id));
      toast({
        description: "ID copied to clipboard",
        className: "bg-gray-800 text-white border-none h-10 px-4",
        duration: 2000,
      });
    }
  };

  const getAdminBadge = () => {
    if (!profile) return null;
    
    // Check specific roles first
    if (profile.admin_role === 'admin') {
      return { 
        label: language === 'ar' ? 'مسؤول' : 'Admin', 
        icon: Shield, 
        className: 'bg-red-100 text-red-800 border-red-200' 
      };
    }
    if (profile.admin_role === 'manager') {
      return { 
        label: language === 'ar' ? 'مدير' : 'Manager', 
        icon: ShieldCheck, 
        className: 'bg-purple-100 text-purple-800 border-purple-200' 
      };
    }
    // Fallback for generic admins
    if (profile.isadmin) {
      return { 
        label: language === 'ar' ? 'مسؤول' : 'Admin', 
        icon: Shield, 
        className: 'bg-red-100 text-red-800 border-red-200' 
      };
    }
    return null;
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
          <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
        </div>
      </Layout>
    );
  }

  if (error || !profile) {
    return (
      <Layout>
         <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 mb-6">{error || 'This user does not exist or has been removed.'}</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </Layout>
    );
  }

  // Determine if this is the logged-in user's own profile
  const isOwnProfile = 
    (currentUser?.id === profile.id) || 
    (currentUserProfile && Number(profileId) === currentUserProfile.profile_id);
  
  const vipInfo = getVipInfo(profile);
  const isVip = vipInfo.isVip;
  const vipStyle = getVipStyle(profile?.vip_number);

  const calculatedLevelInfo = profile?.xp !== undefined ? getLevelFromXp(profile.xp) : null;
  const displayLevel = calculatedLevelInfo?.currentLevel ?? profile?.level;

  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const photos = Array.isArray(profile?.photos) ? profile.photos : [];
  
  const adminBadgeData = getAdminBadge();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="relative">
            <div className="h-48 md:h-64 bg-gradient-to-br from-rose-400 via-pink-400 to-orange-400 rounded-b-[3rem] shadow-md overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
            </div>
            
            <button 
                onClick={() => navigate(-1)} 
                className="absolute top-4 left-4 md:hidden bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30"
            >
                <ArrowLeft size={24} />
            </button>

            <div className="max-w-3xl mx-auto px-4 -mt-20 relative z-10">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden p-6 md:p-8 text-center">
                    
                    <div className="relative inline-block mb-4">
                        <img
                            src={profile.avatar_url || '/default-avatar.svg'}
                            alt={profile.name}
                            className={`w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover mx-auto ${vipStyle.avatarRingClassName}`}
                        />
                        {(() => {
                            const status = getOnlineStatus(profile);
                            return status.isOnline && (
                                <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Online"></div>
                            );
                        })()}
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {profile.name}, <span className="text-gray-500 text-2xl font-normal">{profile.age}</span>
                    </h1>
                    
                    {/* Public Profile Stats - Show Level, VIP, and Admin Badge */}
                    <div className="mb-4 flex flex-wrap justify-center gap-2">
                      {/* Admin/Manager Badge */}
                      {adminBadgeData && (
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border shadow-sm ${adminBadgeData.className}`}>
                           <adminBadgeData.icon className="w-3.5 h-3.5" />
                           <span>{adminBadgeData.label}</span>
                        </div>
                      )}

                      {/* Level */}
                      {typeof displayLevel === 'number' && (
                        <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold border border-blue-200 shadow-sm">
                          <span>⭐</span>
                          <span>{language === 'ar' ? 'مستوى' : 'Level'} {displayLevel}</span>
                        </div>
                      )}

                      {/* VIP badge */}
                      {vipInfo.isVip && vipStyle.badgeClassName && (
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${vipStyle.badgeClassName} border-0 shadow-sm`}>
                          <span className="mr-1">{vipInfo.label}</span>
                          <span>👑</span>
                        </span>
                      )}
                    </div>
                    
                    {/* ID chip - clickable to copy */}
                    {profile?.profile_id && (
                        <div className="mb-6">
                            <button
                                onClick={handleCopyId}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors active:scale-95"
                                title="Click to copy ID"
                            >
                                <span className="font-mono">ID: {profile.profile_id}</span>
                                <Copy size={10} className="opacity-70" />
                            </button>
                        </div>
                    )}

                    {!isOwnProfile && currentUser && (
                        <div className="flex justify-center gap-4 mt-2 mb-6">

                            {/* Message Button */}
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={handleMessageClick}
                                disabled={creatingThread}
                                className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition active:scale-95 disabled:opacity-60"
                                title="Message"
                              >
                                {creatingThread
                                  ? <Loader2 className="w-6 h-6 animate-spin" />
                                  : <MessageCircle className="w-6 h-6" />
                                }
                              </button>
                              <span className="text-xs font-medium text-gray-500">
                                {language === 'ar' ? 'مراسلة' : 'Message'}
                              </span>
                            </div>

                            {/* Send Gift Button */}
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => setShowGiftPanel(true)}
                                disabled={isSendingGift}
                                className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg flex items-center justify-center transition active:scale-95 disabled:opacity-60"
                                title="Send Gift"
                              >
                                {isSendingGift
                                  ? <Loader2 className="w-6 h-6 animate-spin" />
                                  : <Gift className="w-6 h-6" />
                                }
                              </button>
                              <span className="text-xs font-medium text-gray-500">
                                {language === 'ar' ? 'هدية' : 'Gift'}
                              </span>
                            </div>

                            {/* Block/Unblock Button */}
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={isBlocked ? handleUnblock : handleBlock}
                                disabled={blocking}
                                className={`w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition active:scale-95 disabled:opacity-60 ${
                                  isBlocked
                                    ? 'bg-emerald-500 hover:bg-emerald-600'
                                    : 'bg-slate-400 hover:bg-slate-500'
                                }`}
                                title={isBlocked ? 'Unblock' : 'Block'}
                              >
                                {blocking
                                  ? <Loader2 className="w-6 h-6 animate-spin" />
                                  : isBlocked
                                    ? <ShieldCheck className="w-6 h-6" />
                                    : <Shield className="w-6 h-6" />
                                }
                              </button>
                              <span className="text-xs font-medium text-gray-500">
                                {isBlocked
                                  ? (language === 'ar' ? 'إلغاء الحظر' : 'Unblock')
                                  : (language === 'ar' ? 'حظر' : 'Block')
                                }
                              </span>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => setShowReport(true)}
                                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition active:scale-95"
                                title="Report"
                              >
                                🚩
                              </button>
                              <span className="text-xs font-medium text-gray-500">Report</span>
                            </div>

                        </div>
                    )}
                    {!currentUser && (
                      <div className="text-sm text-gray-500 mb-4">Log in to message or send gifts!</div>
                    )}

                    <div className="flex flex-wrap justify-center gap-4 mb-6">
                        {(profile.living_in_code || profile.country) && (
                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                                <span className="text-sm text-gray-500">{language === 'ar' ? 'يعيش في' : 'Lives in'}</span>
                                <CountryDisplay code={profile.living_in_code || profile.country} />
                            </div>
                        )}
                        {(profile.from_code || profile.from_country) && (
                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                                <span className="text-sm text-gray-500">{language === 'ar' ? 'من' : 'From'}</span>
                                <CountryDisplay code={profile.from_code || profile.from_country} />
                            </div>
                        )}
                    </div>

                    {profile.bio && (
                        <div className="text-left border-t border-gray-100 pt-6 mt-2">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
                                {language === 'ar' ? 'نبذة عني' : 'About Me'}
                            </h3>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                        </div>
                    )}

                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{language === 'ar' ? 'التفاصيل' : 'Details'}</h3>
                <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{language === 'ar' ? 'المهنة' : 'Occupation'}</p>
                        <p className="font-medium text-gray-900">{profile.occupation || '—'}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{language === 'ar' ? 'الحالة الاجتماعية' : 'Marital Status'}</p>
                        <p className="font-medium text-gray-900 capitalize">{profile.marital_status || '—'}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{language === 'ar' ? 'يبحث عن' : 'Looking For'}</p>
                        <p className="font-medium text-gray-900 capitalize">{profile.lookingfor || '—'}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{language === 'ar' ? 'الجنس' : 'Gender'}</p>
                        <p className="font-medium text-gray-900 capitalize">{profile.gender || '—'}</p>
                     </div>
                </div>
            </div>
            
            {interests.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">{language === 'ar' ? 'الاهتمامات' : 'Interests'}</h3>
                    <div className="flex flex-wrap gap-2">
                        {(typeof profile.interests === 'string' ? profile.interests.split(',') : interests).map((interest, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                {interest.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {photos.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">{language === 'ar' ? 'الصور' : 'Photos'}</h3>
                    <PhotoGallery
                        userId={profile.id}
                        photos={photos}
                        readOnly={true}
                    />
                </div>
            )}
        </div>

        {/* Floating wallet pill - ONLY show if this is the logged-in user's own profile */}
        {currentUser && isOwnProfile && (
            <div className="fixed bottom-20 right-4 z-40 bg-white/90 backdrop-blur shadow-lg rounded-full p-2 border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletDisplay userId={currentUser.id} refreshTrigger={walletRefresh} />
            </div>
        )}

        {showGiftPanel && (
            <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
                <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                    onClick={() => setShowGiftPanel(false)}
                />
                <div className="relative w-full md:w-[450px] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                    <GiftPanel 
                        receiverId={profile.id}
                        onClose={() => setShowGiftPanel(false)}
                        onGiftSent={handleSendGift}
                    />
                </div>
            </div>
        )}

        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          reportType="user"
          targetId={profile.id}
          targetName={profile.name}
        />
      </div>
    </Layout>
  );
}