import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Lock, Unlock, Plus, Sparkles, Crown, RefreshCw, Heart, Users } from 'lucide-react';
import CreateRoomModal from '@/components/CreateRoomModal';

export default function RoomsLobby() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [recentRoomIds, setRecentRoomIds] = useState([]);
  const [favoriteRoomIds, setFavoriteRoomIds] = useState([]);
  const [activeTab, setActiveTab] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  const fetchRooms = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_rooms')
        .select('id,title,avatar_url,is_locked,max_mics,is_active,created_at,owner_user_id,public_room_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const baseRooms = Array.isArray(data) ? data : [];
      if (baseRooms.length === 0) {
        setRooms([]);
        return;
      }

      const roomIds = baseRooms.map((r) => r.id).filter(Boolean);

      const { data: participantCounts } = await supabase
        .from('live_room_participants')
        .select('room_id, user_id')
        .in('room_id', roomIds)
        .is('left_at', null);

      const countsByRoomId = (participantCounts || []).reduce((acc, row) => {
        const roomId = String(row.room_id);
        acc[roomId] = (acc[roomId] || 0) + 1;
        return acc;
      }, {});

      const mergedRooms = baseRooms.map((room) => ({
        ...room,
        participant_count: countsByRoomId[String(room.id)] || 0,
      }));

      setRooms(mergedRooms);
    } catch (e) {
      console.error(e);
      setErr(e?.message || 'Failed to load rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.history.replaceState(null, '', '/rooms');
    fetchRooms();
    fetchBanners();
  }, []);

  useEffect(() => {
  const channel = supabase
    .channel('rooms_lobby_lock_rt')
    .on('broadcast', { event: 'room_locked' }, ({ payload }) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === payload?.room_id
            ? { ...room, is_locked: true }
            : room
        )
      );
    })
    .on('broadcast', { event: 'room_unlocked' }, ({ payload }) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === payload?.room_id
            ? { ...room, is_locked: false }
            : room
        )
      );
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  useEffect(() => {
    if (!banners.length) return undefined;
    const interval = window.setInterval(() => {
      setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('recent_room_ids');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setRecentRoomIds(ids.filter((id) => id));
        }
      }
    } catch (error) {
      console.warn('[RoomsLobby] unable to read recent_room_ids', error);
    }

    try {
      const savedFavorites = window.localStorage.getItem('favorite_room_ids');
      if (savedFavorites) {
        const ids = JSON.parse(savedFavorites);
        if (Array.isArray(ids)) {
          setFavoriteRoomIds(ids.filter((id) => id));
        }
      }
    } catch (error) {
      console.warn('[RoomsLobby] unable to read favorite_room_ids', error);
    }

  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('room_lobby_banners')
        .select('id,image_url,link_url,title')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      const validBanners = Array.isArray(data) ? data.filter((banner) => banner?.image_url) : [];
      
      // Use demo banners if DB is empty
      if (validBanners.length === 0) {
        const demoBanners = [
          {
            id: 'demo-1',
            title: '🏆 Weekly Tournament',
            subtitle: 'Join now and win prizes!',
            gradient: 'from-purple-600 to-pink-600',
            isDemo: true
          },
          {
            id: 'demo-2',
            title: '🎤 Voice Rooms',
            subtitle: 'Discover amazing rooms',
            gradient: 'from-blue-600 to-cyan-600',
            isDemo: true
          }
        ];
        setBanners(demoBanners);
      } else {
        setBanners(validBanners);
      }
    } catch (fetchError) {
      console.warn('[RoomsLobby] fetch banners failed', fetchError);
      
      // Fall back to demo banners on error
      const demoBanners = [
        {
          id: 'demo-1',
          title: '🏆 Weekly Tournament',
          subtitle: 'Join now and win prizes!',
          gradient: 'from-purple-600 to-pink-600',
          isDemo: true
        },
        {
          id: 'demo-2',
          title: '🎤 Voice Rooms',
          subtitle: 'Discover amazing rooms',
          gradient: 'from-blue-600 to-cyan-600',
          isDemo: true
        }
      ];
      setBanners(demoBanners);
    }
  };

  const saveRecentRoomIds = (ids) => {
    try {
      window.localStorage.setItem('recent_room_ids', JSON.stringify(ids));
    } catch (error) {
      console.warn('[RoomsLobby] unable to save recent_room_ids', error);
    }
  };

  const saveFavoriteRoomIds = (ids) => {
    try {
      window.localStorage.setItem('favorite_room_ids', JSON.stringify(ids));
    } catch (error) {
      console.warn('[RoomsLobby] unable to save favorite_room_ids', error);
    }
  };

  const addRecentRoom = (roomId) => {
    const normalized = String(roomId);
    const next = [normalized, ...recentRoomIds.filter((id) => String(id) !== normalized)].slice(0, 5);
    setRecentRoomIds(next);
    saveRecentRoomIds(next);
  };

  const toggleFavoriteRoom = (roomId) => {
    const normalized = String(roomId);
    const next = favoriteRoomIds.includes(normalized)
      ? favoriteRoomIds.filter((id) => String(id) !== normalized)
      : [normalized, ...favoriteRoomIds];
    setFavoriteRoomIds(next);
    saveFavoriteRoomIds(next);
  };

  const openBannerLink = (linkUrl) => {
    if (!linkUrl) return;
    if (linkUrl.startsWith('/')) {
      navigate(linkUrl);
      return;
    }
    if (/^https?:\/\//.test(linkUrl)) {
      window.location.href = linkUrl;
      return;
    }
    navigate(linkUrl);
  };

  const handleOpenRoom = (roomId) => {
    addRecentRoom(roomId);
    navigate(`/rooms/${roomId}`);
  };

  const renderRoomCard = (
    room,
    actionLabel = 'Join',
    actionVariant = 'outline',
    showPinToggle = true,
    gridMode = false
  ) => {
    const isFavorite = favoriteRoomIds.includes(String(room.id));
    return (
      <div
        key={room.id}
        className={`bg-white border rounded-3xl overflow-hidden hover:shadow-xl transition cursor-pointer flex flex-col ${gridMode ? 'w-full' : 'min-w-[220px] sm:min-w-[240px] flex-none'}`}
        onClick={() => handleOpenRoom(room.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleOpenRoom(room.id);
        }}
      >
        <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
          {room.avatar_url ? (
            <img
              src={room.avatar_url}
              alt={room.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.innerHTML = '<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>';
              }}
            />
          ) : (
            <Mic className="w-8 h-8 text-slate-400" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteRoom(room.id);
            }}
            className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'text-rose-500' : 'text-slate-400'}`} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="p-2 flex flex-col flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 line-clamp-2 text-xs">{room.title}</h3>
            {room.is_locked ? (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Unlock className="w-3 h-3" />
                Open
              </span>
            )}
          </div>

          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {room.participant_count || 0}
          </div>

          <div className="mt-auto pt-1 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant={actionVariant}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRoom(room.id);
              }}
            >
              {actionLabel}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">{room.public_room_id ? `#${room.public_room_id}` : `#${String(room.id).slice(0, 8)}`}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const myRoom = useMemo(
    () => rooms.find((room) => user?.id && String(room.owner_user_id) === String(user.id)),
    [rooms, user?.id]
  );

  const popularRooms = useMemo(
    () => [...rooms].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      return bTime - aTime;
    }),
    [rooms]
  );

  const recentRooms = useMemo(() => {
    if (!recentRoomIds.length) return [];
    return recentRoomIds
      .map((id) => rooms.find((room) => String(room.id) === String(id)))
      .filter(Boolean);
  }, [recentRoomIds, rooms]);

  const favoriteRooms = useMemo(() => {
    if (!favoriteRoomIds.length) return [];
    return favoriteRoomIds
      .map((id) => rooms.find((room) => String(room.id) === String(id)))
      .filter(Boolean);
  }, [favoriteRoomIds, rooms]);

  const activeTabRooms = useMemo(() => {
    if (activeTab === 'favorites') return favoriteRooms;
    if (activeTab === 'recent') return recentRooms;
    return popularRooms;
  }, [activeTab, favoriteRooms, recentRooms, popularRooms]);

  const hasRooms = useMemo(() => Array.isArray(rooms) && rooms.length > 0, [rooms]);

  const hasOwnActiveRoom = useMemo(
    () => Array.isArray(rooms) && rooms.some((room) => String(room.owner_user_id) === String(user?.id)),
    [rooms, user?.id]
  );

  const activeBanner = banners.length ? banners[currentBannerIndex % banners.length] : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* ✅ Debug marker: لو مش شايف السطر ده يبقى بتعدل ملف غلط */}
      <div className="text-[10px] text-slate-400 mb-2">RoomsLobby v2</div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rooms Lobby</h1>
          <button
            type="button"
            onClick={fetchRooms}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh rooms"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {myRoom ? (
            <button
              type="button"
              onClick={() => navigate(`/rooms/${myRoom.id}`)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              <span>🏠</span>
              <span>My Room</span>
            </button>
          ) : null}
          {!hasOwnActiveRoom ? (
            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Room
            </Button>
          ) : null}
        </div>
      </div>

      {activeBanner ? (
        <div className="mb-6">
          {activeBanner.isDemo ? (
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${activeBanner.gradient} shadow-xl flex items-center justify-center min-h-[140px] px-6 py-8`}>
              <div className="text-center text-white">
                <h2 className="text-3xl sm:text-4xl font-bold mb-2">{activeBanner.title}</h2>
                <p className="text-sm sm:text-base opacity-90 font-medium">{activeBanner.subtitle}</p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl aspect-[2/1] shadow-[0_20px_60px_rgba(99,102,241,0.18)] bg-slate-900">
              <button
                type="button"
                onClick={() => openBannerLink(activeBanner.link_url)}
                className="absolute inset-0"
                aria-label={activeBanner.title || 'Banner'}
              >
                <img
                  src={activeBanner.image_url}
                  alt={activeBanner.title || 'Banner image'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-700/30 via-fuchsia-500/10 to-pink-700/30" />
              {activeBanner.title ? (
                <div className="absolute bottom-4 left-4 right-4 rounded-3xl border border-white/20 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
                  {activeBanner.title}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-2">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setCurrentBannerIndex(index)}
                className={`h-2.5 w-2.5 rounded-full transition ${index === currentBannerIndex ? 'bg-white' : 'bg-slate-300'}`}
                aria-label={`Go to banner ${index + 1}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2 border border-slate-200 rounded-full bg-white p-1 shadow-sm">
        {[
          { id: 'popular', label: 'Popular' },
          { id: 'favorites', label: 'Favorites' },
          { id: 'recent', label: 'Recent' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {err ? (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {err}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="bg-white border rounded-xl p-10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-slate-600">Loading rooms...</span>
        </div>
      ) : !hasRooms ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
            <Mic className="w-6 h-6 text-slate-700" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">No active rooms yet</h2>
          <p className="text-slate-600 mt-1 text-sm">Be the first to start a room!</p>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button variant="outline" onClick={fetchRooms} disabled={loading}>
              Refresh
            </Button>

            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Room
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{activeTab === 'popular' ? 'Popular Rooms' : activeTab === 'favorites' ? 'Favorite Rooms' : 'Recent Rooms'}</h2>
                <p className="text-sm text-slate-500">
                  {activeTab === 'popular'
                    ? 'All active rooms sorted by newest first.'
                    : activeTab === 'favorites'
                    ? 'Rooms you saved as favorites.'
                    : 'Rooms you recently visited.'}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {activeTabRooms.length} rooms
              </span>
            </div>

            {activeTabRooms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {activeTabRooms.map((room) => renderRoomCard(room, 'Join', 'outline', true, true))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600">
                <p className="text-sm font-semibold text-slate-900 mb-2">No rooms found here yet.</p>
                <p className="text-sm">Try switching tabs, or refresh to see the latest active rooms.</p>
              </div>
            )}
          </div>
        </>
      )}

      {!hasOwnActiveRoom ? (
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="sm:hidden fixed bottom-[80px] right-5 z-50 min-w-[180px] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-2xl shadow-fuchsia-500/30 hover:shadow-[0_0_30px_rgba(236,72,153,0.45)] animate-pulse"
          aria-label="Create Room"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">Create Room</span>
        </button>
      ) : null}

      {/* Modal */}
      <CreateRoomModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={(room) => {
          setOpenCreate(false);
          fetchRooms();
          const roomId = room?.id || room; // يدعم لو رجعت id فقط أو object
          if (roomId) navigate(`/rooms/${roomId}`);
        }}
      />
    </div>
  );
}