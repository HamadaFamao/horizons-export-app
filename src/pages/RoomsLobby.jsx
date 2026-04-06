import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Lock, Unlock, Plus, Sparkles, Crown } from 'lucide-react';
import CreateRoomModal from '@/components/CreateRoomModal';

export default function RoomsLobby() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [recentRoomIds, setRecentRoomIds] = useState([]);
  const [pinnedRoomId, setPinnedRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  const fetchRooms = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_rooms')
        .select('id,title,avatar_url,is_locked,max_mics,is_active,created_at,owner_user_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRooms(Array.isArray(data) ? data : []);
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
    if (!banners.length) return undefined;
    const interval = window.setInterval(() => {
      setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('recent_rooms');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setRecentRoomIds(ids.filter((id) => id));
        }
      }
    } catch (error) {
      console.warn('[RoomsLobby] unable to read recent_rooms', error);
    }

    try {
      const savedPinned = window.localStorage.getItem('pinned_room');
      if (savedPinned) {
        setPinnedRoomId(savedPinned);
      }
    } catch (error) {
      console.warn('[RoomsLobby] unable to read pinned_room', error);
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
      setBanners(Array.isArray(data) ? data.filter((banner) => banner?.image_url) : []);
    } catch (fetchError) {
      console.warn('[RoomsLobby] fetch banners failed', fetchError);
      setBanners([]);
    }
  };

  const saveRecentRoomIds = (ids) => {
    try {
      window.localStorage.setItem('recent_rooms', JSON.stringify(ids));
    } catch (error) {
      console.warn('[RoomsLobby] unable to save recent_rooms', error);
    }
  };

  const savePinnedRoomId = (id) => {
    try {
      if (id) {
        window.localStorage.setItem('pinned_room', String(id));
      } else {
        window.localStorage.removeItem('pinned_room');
      }
    } catch (error) {
      console.warn('[RoomsLobby] unable to save pinned_room', error);
    }
  };

  const addRecentRoom = (roomId) => {
    const normalized = String(roomId);
    const next = [normalized, ...recentRoomIds.filter((id) => String(id) !== normalized)].slice(0, 5);
    setRecentRoomIds(next);
    saveRecentRoomIds(next);
  };

  const togglePinnedRoom = (roomId) => {
    if (String(roomId) === String(pinnedRoomId)) {
      setPinnedRoomId(null);
      savePinnedRoomId(null);
      return;
    }
    setPinnedRoomId(String(roomId));
    savePinnedRoomId(roomId);
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

  const renderRoomCard = (room, actionLabel = 'Join', actionVariant = 'outline') => {
    const isPinned = String(room.id) === String(pinnedRoomId);
    return (
      <div
        key={room.id}
        className="min-w-[220px] sm:min-w-[240px] flex-none bg-white border rounded-3xl overflow-hidden hover:shadow-xl transition cursor-pointer flex flex-col"
        onClick={() => handleOpenRoom(room.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleOpenRoom(room.id);
        }}
      >
        <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
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
        </div>

        <div className="p-3 flex flex-col flex-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 line-clamp-2 text-sm">{room.title}</h3>
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

          <div className="text-xs text-slate-500 mb-3">{room.max_mics || 6} mics</div>

          <div className="mt-auto flex items-center justify-between gap-2">
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
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePinnedRoom(room.id);
                }}
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </Button>
              <span className="text-[11px] text-slate-500 font-mono">#{String(room.id).slice(0, 8)}</span>
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

  const pinnedRoom = useMemo(
    () => (pinnedRoomId ? rooms.find((room) => String(room.id) === String(pinnedRoomId)) : null),
    [rooms, pinnedRoomId]
  );

  const recentRooms = useMemo(() => {
    if (!recentRoomIds.length) return [];
    return recentRoomIds
      .map((id) => rooms.find((room) => String(room.id) === String(id)))
      .filter(Boolean)
      .filter((room) => !myRoom || String(room.id) !== String(myRoom.id))
      .filter((room) => !pinnedRoom || String(room.id) !== String(pinnedRoom.id));
  }, [recentRoomIds, rooms, myRoom, pinnedRoom]);

  const excludedRoomIds = useMemo(
    () => new Set([
      String(myRoom?.id || ''),
      String(pinnedRoom?.id || ''),
      ...recentRooms.map((room) => String(room.id))
    ]),
    [myRoom, pinnedRoom, recentRooms]
  );

  const otherRooms = useMemo(
    () => rooms.filter((room) => !excludedRoomIds.has(String(room.id))),
    [rooms, excludedRoomIds]
  );

  const hasRooms = useMemo(() => Array.isArray(rooms) && rooms.length > 0, [rooms]);

  const activeBanner = banners.length ? banners[currentBannerIndex % banners.length] : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* ✅ Debug marker: لو مش شايف السطر ده يبقى بتعدل ملف غلط */}
      <div className="text-[10px] text-slate-400 mb-2">RoomsLobby v2</div>

      {activeBanner ? (
        <div className="mb-6">
          <div className="relative overflow-hidden rounded-3xl bg-slate-100 aspect-video">
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
            {activeBanner.title ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                {activeBanner.title}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setCurrentBannerIndex(index)}
                className={`h-2 w-2 rounded-full transition ${index === currentBannerIndex ? 'bg-slate-900' : 'bg-slate-300'}`}
                aria-label={`Go to banner ${index + 1}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rooms Lobby</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">
            Discover active voice chat rooms or create your own room.
          </p>
        </div>

        {/* Desktop buttons */}
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="outline" onClick={fetchRooms} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>

          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Room
          </Button>
        </div>
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
          {/* Mobile refresh row */}
          <div className="sm:hidden flex items-center justify-between mb-3">
            <Button variant="outline" onClick={fetchRooms} disabled={loading} className="w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                'Refresh rooms'
              )}
            </Button>
          </div>

          {myRoom ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span>Your Room</span>
                </div>
                <Button size="sm" onClick={() => handleOpenRoom(myRoom.id)}>
                  Manage
                </Button>
              </div>
              <div className="overflow-x-auto pb-3">
                <div className="flex gap-4 min-w-max">
                  {renderRoomCard(myRoom, 'Manage', 'secondary')}
                </div>
              </div>
            </div>
          ) : null}

          {pinnedRoom && (!myRoom || String(pinnedRoom.id) !== String(myRoom.id)) ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  <span>Pinned Room</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => togglePinnedRoom(pinnedRoom.id)}>
                  Unpin
                </Button>
              </div>
              <div className="overflow-x-auto pb-3">
                <div className="flex gap-4 min-w-max">
                  {renderRoomCard(pinnedRoom, 'Join', 'outline')}
                </div>
              </div>
            </div>
          ) : null}

          {recentRooms.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Recent</h2>
                <span className="text-sm text-slate-500">Last visited</span>
              </div>
              <div className="overflow-x-auto pb-3">
                <div className="flex gap-4 min-w-max">
                  {recentRooms.map((room) => renderRoomCard(room))}
                </div>
              </div>
            </div>
          ) : null}

          {otherRooms.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">All Rooms</h2>
                <span className="text-sm text-slate-500">Browse active rooms</span>
              </div>
              <div className="overflow-x-auto pb-3">
                <div className="flex gap-4 min-w-max">
                  {otherRooms.map((room) => renderRoomCard(room))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ✅ Floating Create button for mobile (guaranteed visible) */}
      <button
        type="button"
        onClick={() => setOpenCreate(true)}
        className="sm:hidden fixed bottom-[80px] right-5 z-50 min-w-[180px] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-2xl shadow-fuchsia-500/30 hover:shadow-[0_0_30px_rgba(236,72,153,0.45)] animate-pulse"
        aria-label="Create Room"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-semibold">Create Room</span>
      </button>

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