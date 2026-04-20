import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8, 10];
const ENTRY_COST_OPTIONS = [100, 200, 500, 1000, 5000, 10000];

const SEAT_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
  '#6366f1', '#84cc16',
];

export default function SpinGame({
  open,
  onClose,
  roomId,
  user,
  canModerate,
  activeParticipants,
  userCoins,
  onCoinsUpdated,
  onSpinResult,
}) {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [entryCost, setEntryCost] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const canvasRef = useRef(null);
  const spinAudioRef = useRef(null);

  // Load active session for this room
  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!open || !roomId) return;

    const channel = supabase
      .channel(`spin_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_spin_sessions',
        filter: `room_id=eq.${roomId}`,
      }, () => loadSession())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_spin_players',
      }, () => loadPlayers(currentSession?.id))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [open, roomId, currentSession?.id]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_spin_sessions')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['waiting', 'spinning'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(data || null);
      if (data?.id) {
        await loadPlayers(data.id);
      } else {
        setPlayers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (sessionId) => {
    if (!sessionId) return;
    const { data: playersData } = await supabase
      .from('room_spin_players')
      .select('*')
      .eq('session_id', sessionId)
      .is('refunded_at', null)
      .order('seat_number', { ascending: true });

    if (!playersData?.length) {
      setPlayers([]);
      return;
    }

    const userIds = playersData.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    const merged = playersData.map(p => ({
      ...p,
      name: profilesMap.get(p.user_id)?.name || 'User',
      avatar_url: profilesMap.get(p.user_id)?.avatar_url || null,
    }));

    setPlayers(merged);
  };

  // Draw wheel on canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    drawWheel();
  }, [players, currentSession, rotation]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;

    ctx.clearRect(0, 0, size, size);

    const slots = currentSession?.max_players || maxPlayers;
    const anglePerSlice = (2 * Math.PI) / slots;

    for (let i = 0; i < slots; i++) {
      const startAngle = rotation + i * anglePerSlice;
      const endAngle = startAngle + anglePerSlice;
      const player = players[i];

      // Slice
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEAT_COLORS[i % SEAT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text/Avatar label
      const midAngle = startAngle + anglePerSlice / 2;
      const textX = center + (radius * 0.65) * Math.cos(midAngle);
      const textY = center + (radius * 0.65) * Math.sin(midAngle);

      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(midAngle + Math.PI / 2);

      if (player) {
        // Draw avatar circle
        const avatarSize = 24;
        if (player.avatar_url) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.beginPath();
            ctx.arc(0, -8, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, -avatarSize / 2, -8 - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();

            // Name
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 3;
            const shortName = (player.name || 'User').slice(0, 8);
            ctx.fillText(shortName, 0, 22);
            ctx.restore();
          };
          img.src = player.avatar_url;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          const shortName = (player.name || 'User').slice(0, 8);
          ctx.fillText(shortName, 0, 4);
        }
      } else {
        // Empty seat
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${i + 1}`, 0, 4);
      }

      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center icon
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎰', center, center + 5);
  };

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('room_spin_sessions')
        .insert({
          room_id: roomId,
          created_by: user.id,
          max_players: maxPlayers,
          entry_cost: entryCost,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentSession(data);
      setPlayers([]);
    } catch (err) {
      alert(err.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const joinSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (userCoins < currentSession.entry_cost) {
      alert(`Not enough coins. Need ${currentSession.entry_cost} coins.`);
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_spin_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to join');
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);
    } catch (err) {
      alert(err.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const leaveSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { data, error } = await supabase.rpc('leave_spin_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to leave');
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);
    } catch (err) {
      alert(err.message || 'Failed to leave');
    } finally {
      setLeaving(false);
    }
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    const confirmed = window.confirm('Cancel game? All players will be refunded.');
    if (!confirmed) return;
    try {
      const { data, error } = await supabase.rpc('cancel_spin_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to cancel');
      onCoinsUpdated?.();
      setCurrentSession(null);
      setPlayers([]);
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const startSpin = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (players.length < 2) {
      alert('Need at least 2 players to spin');
      return;
    }

    setSpinning(true);
    setShowResult(false);
    setWinner(null);

    // Update status to spinning
    await supabase
      .from('room_spin_sessions')
      .update({ status: 'spinning', started_at: new Date().toISOString() })
      .eq('id', currentSession.id);

    // Pick random winner
    const winnerIdx = Math.floor(Math.random() * players.length);
    const winnerPlayer = players[winnerIdx];
    const slots = currentSession.max_players;
    const anglePerSlice = (2 * Math.PI) / slots;

    // Use actual seat_number - 1 for angle calculation
    // since wheel slots are 0-indexed but seat_numbers are 1-indexed
    const winnerSeatIdx = winnerPlayer.seat_number - 1;
    const winnerAngle = winnerSeatIdx * anglePerSlice;
    const extraSpins = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const targetRotation = extraSpins + (2 * Math.PI - winnerAngle - anglePerSlice / 2);

    // Animate spin
    const duration = 5000;
    const startTime = Date.now();
    const startRotation = rotation;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentRotation = startRotation + targetRotation * eased;
      setRotation(currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Done spinning
        setTimeout(async () => {
          // Finish session
          const { data } = await supabase.rpc('finish_spin_session', {
            p_session_id: currentSession.id,
            p_winner_seat: winnerPlayer.seat_number,
          });

          const actualWinnerId = data?.winner_id;
          const actualWinner = players.find(
            p => String(p.user_id) === String(actualWinnerId)
          ) || winnerPlayer;

          setWinner(actualWinner);
          setWinnerCoins(data?.winner_coins || 0);
          setShowResult(true);
          setSpinning(false);
          onCoinsUpdated?.();
          onSpinResult?.({
            winnerName: actualWinner?.name || 'User',
            winnerAvatar: actualWinner?.avatar_url || null,
            winnerId: actualWinner?.user_id,
            winnerCoins: data?.winner_coins || 0,
            totalPlayers: players.length,
            entryCost: currentSession?.entry_cost || 0,
          });

          setTimeout(() => {
            setCurrentSession(null);
            setPlayers([]);
            setShowResult(false);
            setWinner(null);
            setRotation(0);
          }, 5000);
        }, 500);
      }
    };

    requestAnimationFrame(animate);
  };

  const isJoined = players.some(p => String(p.user_id) === String(user?.id));
  const isFull = players.length >= (currentSession?.max_players || 0);
  const totalPrize = (currentSession?.entry_cost || 0) * players.length;
  const netPrize = Math.floor(totalPrize * 0.9);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute inset-x-0 bottom-0 bg-slate-900 rounded-t-3xl 
          shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-4 py-3 flex items-center justify-between 
          border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎡</span>
            <span className="font-bold text-white text-lg">Spin Wheel</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-amber-500/20 
              border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-amber-300 font-black text-sm">
                {(userCoins || 0).toLocaleString()}
              </span>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
          ) : showResult && winner ? (
            /* Winner Result */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-6xl animate-bounce">🏆</div>
              <div className="text-white font-black text-2xl text-center">
                Winner!
              </div>
              <img
                src={winner.avatar_url || FALLBACK_AVATAR}
                alt={winner.name}
                className="w-20 h-20 rounded-full border-4 border-amber-400 
                  shadow-[0_0_30px_rgba(251,191,36,0.6)]"
                onError={e => e.currentTarget.src = FALLBACK_AVATAR}
              />
              <div className="text-amber-300 font-black text-xl">
                {winner.name}
              </div>
              <div className="bg-amber-500/20 border border-amber-500/40 
                rounded-2xl px-6 py-3 text-center">
                <div className="text-amber-300 text-sm font-bold">Won</div>
                <div className="text-amber-200 text-3xl font-black">
                  🪙 {winnerCoins.toLocaleString()}
                </div>
              </div>
            </div>
          ) : currentSession ? (
            /* Active Session */
            <div className="flex flex-col gap-4">
              {/* Session Info */}
              <div className="flex items-center justify-between 
                bg-white/5 rounded-2xl px-4 py-3 gap-2">
                <div>
                  <div className="text-white/50 text-xs">Entry</div>
                  <div className="text-amber-300 font-black">
                    🪙 {currentSession.entry_cost.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/50 text-xs">Players</div>
                    <div className="text-white/50 text-xs">Prize</div>
                    <div className="text-emerald-300 font-black">
                      🪙 {netPrize.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/50 text-xs">My Coins</div>
                    <div className={`font-black text-sm ${
                      userCoins >= currentSession.entry_cost
                        ? 'text-white'
                        : 'text-rose-400'
                    }`}>
                      🪙 {(userCoins || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Wheel */}
                <div className="relative flex items-center justify-center">
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 
                    z-10 w-0 h-0"
                    style={{
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: '20px solid #fbbf24',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={280}
                    className="rounded-full shadow-2xl"
                  />
                </div>

                {/* Players List */}
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: currentSession.max_players }, (_, i) => {
                    const player = players.find(p => p.seat_number === i + 1);
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${
                          player
                            ? 'border-white/10 bg-white/5'
                            : 'border-white/5 bg-white/[0.03]'
                        }`}
                      >
                        {player ? (
                          <>
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: SEAT_COLORS[i % SEAT_COLORS.length] }}
                            />
                            <img
                              src={player.avatar_url || FALLBACK_AVATAR}
                              alt={player.name}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                              onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                            />
                            <span className="text-white text-xs font-bold truncate">
                              {player.name}
                            </span>
                            {String(player.user_id) === String(user?.id) && (
                              <span className="text-[9px] text-amber-300 
                                font-bold ml-auto shrink-0">You</span>
                            )}
                          </>
                        ) : (
                          <span className="text-white/30 text-xs">
                            Seat #{i + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              {/* Actions */}
              <div className="flex gap-2">
                {!isJoined && !isFull && 
                  currentSession.status === 'waiting' && (
                  <button
                    onClick={joinSession}
                    disabled={joining || userCoins < currentSession.entry_cost}
                    className="flex-1 py-3 rounded-2xl bg-amber-500 
                      text-white font-black text-sm disabled:opacity-50
                      hover:bg-amber-400 transition active:scale-95"
                  >
                    {joining ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`
                    )}
                  </button>
                )}

                {isJoined && currentSession.status === 'waiting' && (
                  <button
                    onClick={leaveSession}
                    disabled={leaving}
                    className="flex-1 py-3 rounded-2xl border border-white/20 
                      text-white/70 font-bold text-sm
                      hover:bg-white/10 transition active:scale-95"
                  >
                    {leaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : 'Leave & Refund'}
                  </button>
                )}

                {canModerate && currentSession.status === 'waiting' && (
                  <>
                    <button
                      onClick={startSpin}
                      disabled={spinning || players.length < 2}
                      className="flex-1 py-3 rounded-2xl bg-emerald-500 
                        text-white font-black text-sm disabled:opacity-50
                        hover:bg-emerald-400 transition active:scale-95"
                    >
                      {spinning ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : '🎰 Spin!'}
                    </button>
                    <button
                      onClick={cancelSession}
                      className="px-4 py-3 rounded-2xl border border-rose-500/40 
                        text-rose-400 font-bold text-sm
                        hover:bg-rose-500/10 transition active:scale-95"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Create Session */
            canModerate ? (
              <div className="flex flex-col gap-5">
                <div className="text-center text-white/50 text-sm">
                  No active spin game. Create one!
                </div>

                {/* Max Players */}
                <div>
                  <div className="text-white/70 text-sm font-bold mb-2">
                    👥 Number of Players
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxPlayers(n)}
                        className={`py-3 rounded-xl font-black text-lg transition
                          active:scale-95 ${
                          maxPlayers === n
                            ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entry Cost */}
                <div>
                  <div className="text-white/70 text-sm font-bold mb-2">
                    🪙 Entry Cost
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ENTRY_COST_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEntryCost(c)}
                        className={`py-2.5 rounded-xl font-bold text-sm transition
                          active:scale-95 ${
                          entryCost === c
                            ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {c.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prize Preview */}
                <div className="bg-white/5 rounded-2xl p-4 text-center">
                  <div className="text-white/50 text-xs mb-1">
                    Winner gets (after 10% fee)
                  </div>
                  <div className="text-amber-300 font-black text-2xl">
                    🪙 {Math.floor(entryCost * maxPlayers * 0.9).toLocaleString()}
                  </div>
                  <div className="text-white/30 text-xs mt-1">
                    {entryCost.toLocaleString()} × {maxPlayers} players
                  </div>
                </div>

                <button
                  onClick={createSession}
                  disabled={creating}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r 
                    from-amber-500 to-yellow-400 text-white font-black 
                    text-lg shadow-[0_0_20px_rgba(245,158,11,0.4)]
                    hover:shadow-[0_0_30px_rgba(245,158,11,0.6)]
                    transition active:scale-95 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : '🎰 Create Spin Game'}
                </button>
              </div>
            ) : (
              <div className="text-center text-white/40 py-12">
                <div className="text-4xl mb-3">🎰</div>
                <div className="text-sm">No active spin game</div>
                <div className="text-xs mt-1">
                  Wait for the host to start one
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}