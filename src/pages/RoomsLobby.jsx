import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Lock, Unlock, Plus } from 'lucide-react';
import CreateRoomModal from '@/components/CreateRoomModal';

export default function RoomsLobby() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
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
    fetchRooms();
  }, []);

  const hasRooms = useMemo(() => Array.isArray(rooms) && rooms.length > 0, [rooms]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* ✅ Debug marker: لو مش شايف السطر ده يبقى بتعدل ملف غلط */}
      <div className="text-[10px] text-slate-400 mb-2">RoomsLobby v2</div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="bg-white border rounded-xl p-4 hover:shadow-sm transition cursor-pointer"
                onClick={() => navigate(`/rooms/${r.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/rooms/${r.id}`);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                    {r.avatar_url ? (
                      <img
                        src={r.avatar_url}
                        alt={r.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Mic className="w-6 h-6 text-slate-700" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">{r.title}</h3>
                      {r.is_locked ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Unlock className="w-3 h-3" /> Open
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="font-mono truncate">#{String(r.id).slice(0, 8)}</span>
                      <span>•</span>
                      <span>{r.max_mics || 6} mics</span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-700">Join →</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ✅ Floating Create button for mobile (guaranteed visible) */}
      <button
        type="button"
        onClick={() => setOpenCreate(true)}
        className="sm:hidden fixed bottom-5 right-5 z-40 shadow-lg rounded-full bg-slate-900 text-white w-14 h-14 flex items-center justify-center"
        aria-label="Create Room"
      >
        <Plus className="w-6 h-6" />
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