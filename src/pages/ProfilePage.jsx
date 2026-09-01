import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { getLevelFromXp } from '@/lib/xpLevelUtils';
import { getLevelStats, formatXp } from '@/utils/levels';
import { getVipInfo, getVipStyle } from '@/utils/vip';
import AgencySection from '@/components/AgencySection';
import AgentDashboard from '@/components/AgentDashboard';
import AgencyMembersSection from '@/components/AgencyMembersSection';
import LevelBadge from '@/components/LevelBadge';
import UserWall from '@/components/UserWall';
import { useToast } from '@/components/ui/use-toast';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, History, Zap, MessageSquare, Bookmark, Heart } from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user: authUser, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const { isAdmin: isStaffMember, staffRole, loading: permLoading } = useAdminPermissions();
  console.log('[STAFF_CHECK]', { isStaffMember, staffRole, permLoading });

  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [settingProfilePhoto, setSettingProfilePhoto] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const [isRechargeAgent, setIsRechargeAgent] = useState(false);

  // ✅ Agent flag from profile (tolerant)
  const isAgent = useMemo(() => {
    return (
      profile?.is_agent === true ||
      profile?.agent === true ||
      profile?.role === 'agent' ||
      profile?.account_type === 'agent' ||
      false
    );
  }, [profile]);

  // ✅ Joined family/agency (tolerant mapping)
  const joinedFamilyId = useMemo(() => {
    return profile?.family_id ?? profile?.agency_id ?? null;
  }, [profile]);

  const joinedFamilyName = useMemo(() => {
    return profile?.family_name ?? profile?.agency_name ?? null;
  }, [profile]);

  const joinedFamilyCode = useMemo(() => {
    return profile?.family_code ?? profile?.agency_code ?? null;
  }, [profile]);

  const isInFamily = useMemo(() => {
    return !!joinedFamilyId || !!joinedFamilyName;
  }, [joinedFamilyId, joinedFamilyName]);

  // Conversion States
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [conversionAmount, setConversionAmount] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // ============================================
  // EFFECT: Fetch current user's profile + attach v_user_agency
  // ============================================
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!authUser?.id) {
          console.warn('No authenticated user found');
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        // 1) Base profile
        const { data: profileData, error: profileError } = await supabase
          .from('v_user_profile_with_wallet')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError || !profileData) {
          console.error('Failed to load profile:', profileError?.message || 'No data returned');
          setError('Could not load profile');
          setLoading(false);
          return;
        }

        // 2) Attach membership from v_user_agency (source of truth)
        let merged = { ...profileData };

        try {
          const { data: ua, error: uaErr } = await supabase
            .from('v_user_agency')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();

          if (uaErr) {
            console.warn('[ProfilePage] v_user_agency error:', uaErr.message);
          } else if (ua) {
            merged = {
              ...merged,
              agency_id: ua.agency_id ?? merged.agency_id ?? null,
              agency_name: ua.agency_name ?? merged.agency_name ?? null,

              // mirror as family_*
              family_id: ua.agency_id ?? merged.family_id ?? merged.agency_id ?? null,
              family_name: ua.agency_name ?? merged.family_name ?? merged.agency_name ?? null,
            };
          }
        } catch (e) {
          console.warn('[ProfilePage] v_user_agency fetch failed:', e?.message || e);
        }

        setProfile(merged);

        // 3) Check if recharge agent
        const { data: raData } = await supabase
          .from('recharge_agents')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('is_active', true)
          .maybeSingle();

        setIsRechargeAgent(!!raData);

        setLoading(false);
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setError('Error loading profile');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authUser?.id]);

  // ============================================
  // EFFECT: Fetch gallery photos
  // ============================================
  useEffect(() => {
    const fetchGalleryPhotos = async () => {
      try {
        if (!authUser?.id) {
          setGalleryPhotos([]);
          return;
        }
        const { data: photos, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (photosError) throw photosError;
        setGalleryPhotos(photos || []);
      } catch (err) {
        setGalleryPhotos([]);
      }
    };
    fetchGalleryPhotos();
  }, [authUser?.id]);

  // ============================================
  // HELPERS & HANDLERS
  // ============================================
  const handleCopyProfileId = async () => {
    try {
      if (!profile?.profile_id) return;
      await navigator.clipboard.writeText(String(profile.profile_id));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) { }
  };

  const handleAddPhotosClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingPhotos(true);
      setUploadError(null);

      const uploadedPhotosData = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${authUser.id}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `photos/${authUser.id}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('profile-photos')
          .upload(filePath, file);

        if (uploadErr) continue;

        const { data: publicUrlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          uploadedPhotosData.push({ url: publicUrlData.publicUrl, file_path: filePath });
        }
      }

      if (uploadedPhotosData.length === 0) {
        setUploadError('No photos were uploaded');
        setUploadingPhotos(false);
        return;
      }

      const { data: insertedPhotos, error: insertError } = await supabase
        .from('photos')
        .insert(
          uploadedPhotosData.map((photo) => ({
            user_id: authUser.id,
            url: photo.url,
            is_public: true,
            is_primary: false,
          }))
        )
        .select('*');

      if (insertError) throw insertError;

      setGalleryPhotos((prev) => [...(insertedPhotos || []), ...prev]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingPhotos(false);
    } catch (err) {
      setUploadError('An error occurred while uploading photos');
      setUploadingPhotos(false);
    }
  };

  const handleSetProfilePhoto = async (photoUrl) => {
    try {
      setSettingProfilePhoto(photoUrl);
      await supabase.from('profiles').update({ avatar_url: photoUrl }).eq('id', authUser.id);
      setProfile((prev) => (prev ? { ...prev, avatar_url: photoUrl } : prev));
      setSettingProfilePhoto(null);
    } catch (err) {
      setSettingProfilePhoto(null);
    }
  };

  const handleDeletePhoto = async (photoId, photoUrl) => {
    try {
      if (!window.confirm('Are you sure you want to delete this photo?')) return;
      await supabase.from('photos').delete().eq('id', photoId);
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photoId));

      if (profile?.avatar_url === photoUrl) {
        setProfile((prev) => ({ ...prev, avatar_url: null }));
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', authUser.id);
      }
    } catch (err) { }
  };

  const handleProfileUpdate = (updates) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    refreshUserProfile();
  };

  const handleConversionClick = () => {
    if ((profile?.gems || 0) < 1000) return;
    setConversionAmount('1000');
    setIsConvertModalOpen(true);
  };

  const handleConvertConfirm = async () => {
    const gemsToConvert = parseInt(conversionAmount, 10);
    if (isNaN(gemsToConvert) || gemsToConvert < 1000 || gemsToConvert % 10 !== 0) return;

    try {
      setIsConverting(true);
      const { data, error } = await supabase.rpc('convert_gems_to_coins', {
        p_gems_to_convert: gemsToConvert,
      });
      if (error) throw error;

      if (data && data.success) {
        toast({
          title: 'Conversion Successful! 🎉',
          description: `Converted ${data.gems_spent} gems into ${data.coins_added} coins.`,
        });

        setProfile((prev) => ({
          ...prev,
          gems: (prev.gems || 0) - data.gems_spent,
          coins: (prev.coins || 0) + data.coins_added,
        }));

        await refreshUserProfile(authUser.id);
        setIsConvertModalOpen(false);
      }
    } catch (err) {
      toast({
        title: 'Conversion Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );

  if (error || !profile)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-600 font-semibold">{error || 'Profile not found'}</p>
      </div>
    );

  const computedLevel = getLevelFromXp(profile?.xp || 0)?.currentLevel || 1;
  console.log('[PROFILE_LEVEL_DEBUG]', { xp: profile?.xp, computedLevel });
  const vipInfo = getVipInfo(profile);
  const vipStyle = getVipStyle(profile?.vip_number);
  const canManagePhotos = Boolean(authUser?.id && profile?.id && authUser.id === profile.id);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const levelStats = profile?.xp !== undefined ? getLevelStats(profile.xp) : null;

  /**
   * ✅ Rules
   * - If joined family/agency: show Family card + Members list (and Leave/Remove handled inside AgencyMembersSection)
   * - If NOT joined: show AgencySection to browse/join
   *
   * IMPORTANT:
   * - We should NOT hide AgencySection just because user isAgent.
   *   A lot of agent tools (invites/requests dashboard) will live there.
   */
  const showJoinBrowse = !isInFamily;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="h-48 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400" />

      <div className="max-w-4xl mx-auto px-4 -mt-24 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* HEADER */}
          <div className="flex items-end gap-6 mb-6">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className={`w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg ${vipStyle.avatarRingClassName}`}
                />
              ) : (
                <div
                  className={`w-32 h-32 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center ${vipStyle.avatarRingClassName}`}
                >
                  <span className="text-4xl">👤</span>
                </div>
              )}

              <button
                onClick={() => navigate('/profile/edit')}
                className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-colors cursor-pointer"
                title="Change Avatar"
              >
                <span className="text-lg">✏️</span>
              </button>
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3 flex-wrap">
                {profile.name} {profile.age && `, ${profile.age}`}
              </h1>

              {profile.profile_id && (
                <div className="mb-4">
                  <button
                    onClick={handleCopyProfileId}
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    ID: {profile.profile_id} {copiedId && <span className="ml-2">✓</span>}
                  </button>
                </div>
              )}

              {profile.location && <p className="text-lg text-gray-600 mb-4">📍 {profile.location}</p>}

              <div className="flex flex-wrap items-start gap-2">
                {(profile.xp || profile.level) && (
                  <LevelBadge
                    level={profile.xp ? getLevelFromXp(profile.xp)?.currentLevel : profile.level}
                    size="md"
                    showName={true}
                  />
                )}

                {staffRole && (
                  <div className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm',
                    staffRole === 'manager' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    staffRole === 'admin' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-blue-100 text-blue-800 border-blue-200'
                  )}>
                    {staffRole === 'manager' ? '🛡️ Manager' :
                     staffRole === 'admin' ? '🛡️ Admin' :
                     '🛡️ Moderator'}
                  </div>
                )}

                {vipInfo.isVip && vipStyle.badgeClassName && (
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${vipStyle.badgeClassName}`}
                    >
                      <span className="mr-1">{vipInfo.label}</span>
                      <span>👑</span>
                    </span>
                    {vipInfo.expiresLabel && (
                      <span className="text-xs text-slate-500 px-1">{vipInfo.expiresLabel}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {profile.bio && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-gray-700 text-lg">{profile.bio}</p>
            </div>
          )}

          {interests.length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, idx) => (
                  <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* REWARDS */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rewards & Level</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <button
                onClick={() => navigate('/plans?tab=coins')}
                className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 text-center w-full transition-all hover:shadow-md active:scale-95"
              >
                <p className="text-2xl font-bold text-amber-600">🪙</p>
                <p className="text-sm text-gray-600 mt-2">Coins</p>
                <p className="text-xl font-semibold text-gray-900">{profile.coins || 0}</p>
              </button>

              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">💎</p>
                <p className="text-sm text-gray-600 mt-2">Gems</p>
                <p className="text-xl font-semibold text-gray-900">{profile.gems || 0}</p>
                <button
                  onClick={handleConversionClick}
                  disabled={(profile.gems || 0) < 1000}
                  className="text-xs bg-white text-indigo-600 border border-indigo-200 px-2 py-1 rounded-full font-medium hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  Convert to Coins
                </button>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 md:col-span-2">
                <p className="text-2xl font-bold text-green-600">⚡</p>
                <p className="text-sm text-gray-600 mt-2">XP Progress</p>

                {levelStats && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 mb-2">
                      Level {levelStats.level} → {levelStats.level + 1}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all duration-300"
                        style={{ width: `${levelStats.progress * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 font-medium">
                      {formatXp(levelStats.xpInLevel)} / {formatXp(levelStats.xpToNext)} XP
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end mb-4 gap-2">
              {isRechargeAgent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/recharge-agent')}
                  className="text-indigo-600 hover:text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Recharge Agent
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/wallet-activity')}
                className="text-gray-600 hover:text-gray-900 border-gray-200"
              >
                <History className="w-4 h-4 mr-2" />
                Wallet Activity
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">Total XP Earned</p>
              <p className="text-2xl font-bold text-gray-900">{formatXp(profile.xp || 0)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/saved?tab=saved')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition"
            >
              <Bookmark className="w-4 h-4" />
              Saved
            </button>
            <button
              onClick={() => navigate('/saved?tab=liked')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition"
            >
              <Heart className="w-4 h-4" />
              Liked
            </button>
            <button
              onClick={() => navigate('/profile/edit')}
              className="flex-1 min-w-[140px] bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Edit Profile
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex-1 min-w-[140px] bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg transition-colors"
            >
              Settings
            </button>
          </div>
        </div>

        {/* ✅ Agent Dashboard داخل البروفايل (لو هو Agent فعلاً) */}
        {isAgent && (
          <div className="mb-8">
            <AgentDashboard profile={profile} embedded={true} />
          </div>
        )}

        {/* ✅ لو المستخدم منضم لعائلة/وكالة: نظهر Family + Members */}
        {isInFamily && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Family</h2>
                  <p className="text-sm text-gray-600 mt-1">You are already in a family.</p>

                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-1">Your Family</p>
                    <p className="text-lg font-semibold text-gray-900">{joinedFamilyName || '—'}</p>

                    {joinedFamilyCode ? (
                      <p className="text-sm text-gray-600 mt-1">
                        Code: <span className="font-mono">{joinedFamilyCode}</span>
                      </p>
                    ) : null}

                    {/* ✅ Agency Chat Button */}
                    <div className="mt-4">
                      <Button onClick={() => navigate('/agency/chat')} className="w-full sm:w-auto">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Agency Chat
                      </Button>
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Joined
                </span>
              </div>
            </div>

            <div className="mb-8">
              <AgencyMembersSection profile={profile} agencyId={joinedFamilyId} />
            </div>
          </>
        )}

        {/* Add Photos - hidden for staff/admin */}
        {canManagePhotos && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Photos</h2>

            <button
              onClick={handleAddPhotosClick}
              disabled={uploadingPhotos}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-4xl mb-2">{uploadingPhotos ? '⏳' : '📸'}</p>
              <p className="text-gray-600">{uploadingPhotos ? 'Uploading...' : 'Click to upload photos'}</p>
              <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
            </button>

            {uploadError && <p className="text-red-600 text-sm mt-2">{uploadError}</p>}
          </div>
        )}

        {galleryPhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Photos</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-200 relative group">
                  <img
                    src={photo.url}
                    alt="Gallery photo"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {canManagePhotos && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleSetProfilePhoto(photo.url)}
                        disabled={settingProfilePhoto === photo.url}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-full p-2 transition-colors"
                        title="Set as profile photo"
                      >
                        {settingProfilePhoto === photo.url ? '⏳' : '✓'}
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id, photo.url)}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
                        title="Delete photo"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wall */}
        <div className="mt-6">
          <UserWall
            profileId={profile.profile_id}
            isOwner={true}
          />
        </div>

        {/* ✅ Browse/Join يظهر فقط لو مش منضم (حتى لو Agent) */}
        {showJoinBrowse && <AgencySection profile={profile} onProfileUpdate={handleProfileUpdate} />}
      </div>

      {/* Convert modal */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert Gems to Coins</DialogTitle>
            <DialogDescription>
              Enter the amount of gems you want to convert.
              <br />
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                Rate: 10 Gems = 1 Coin (Min 1000 Gems)
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available Gems:</span>
                <span className="font-semibold">{profile?.gems || 0}</span>
              </div>

              <Input
                id="gems-amount"
                type="number"
                placeholder="Enter amount (e.g. 1000)"
                value={conversionAmount}
                onChange={(e) => setConversionAmount(e.target.value)}
                className="col-span-3"
                min={1000}
                step={10}
              />

              <div className="text-xs text-muted-foreground text-right">
                Will receive:{' '}
                <span className="font-medium text-foreground">
                  {parseInt(conversionAmount) >= 1000 ? Math.floor(parseInt(conversionAmount) / 10) : 0} Coins
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertConfirm} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert Now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}