import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8];
const ENTRY_COST_OPTIONS = [100, 200, 500, 1000, 5000, 10000];
const TRACK_LENGTH = 20;

const PLAYER_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
];

const GOAL_EMOJI = '🏆';
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function RaceGame({
  open,
  onClose,
  roomId,
  user,
  canModerate,
  userCoins,
  onCoinsUpdated,
  onRaceResult,
}) {
  const [currentSession, setCurrentSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [entryCost, setEntryCost] = useState(100);
  const [joining, setJoining] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [diceDisplay, setDiceDisplay] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  // Realtime
  useEffect(() => {
    if (!open || !roomId) return;

    const channel = supabase
      .channel(`race_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_race_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const s = payload.new;
        if (s?.status === 'finished') {
          setCurrentSession(s);
          loadPlayers(s.id).then(ps => {
            const w = ps.find(p =>
              String(p.user_id) === String(s.winner_id)
            );
            if (w) {
              setWinner(w);
              setWinnerCoins(s.winner_coins || 0);
              setShowResult(true);
              onRaceResult?.({
                winnerName: w.name,
                winnerAvatar: w.avatar_url,
                winnerId: w.user_id,
                winnerCoins: s.winner_coins || 0,
                totalPlayers: ps.length,
              });
              setTimeout(() => {
                setCurrentSession(null);
                setPlayers([]);
                setShowResult(false);
                setWinner(null);
                setLastRoll(null);
              }, 5000);
            }
          });
        } else {
          setCurrentSession(s);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_race_players',
      }, () => {
        if (currentSession?.id) loadPlayers(currentSession.id);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [open, roomId, currentSession?.id]);

  // Draw track on canvas
  useEffect(() => {
    if (!canvasRef.current || !currentSession) return;
    drawTrack();
  }, [players, currentSession]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_race_sessions')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(data || null);
      if (data?.id) await loadPlayers(data.id);
      else setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (sessionId) => {
    if (!sessionId) return [];
    const { data: playersData } = await supabase
      .from('room_race_players')
      .select('*')
      .eq('session_id', sessionId)
      .is('refunded_at', null)
      .order('seat_number', { ascending: true });

    if (!playersData?.length) {
      setPlayers([]);
      return [];
    }

    const userIds = playersData.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );
    const merged = playersData.map(p => ({
      ...p,
      name: profilesMap.get(p.user_id)?.name || 'User',
      avatar_url: profilesMap.get(p.user_id)?.avatar_url || null,
    }));

    setPlayers(merged);
    return merged;
  };

  const drawTrack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const cols = 5;
    const rows = Math.ceil((TRACK_LENGTH + 1) / cols);
    const cellW = W / cols;
    const cellH = (H - 40) / rows;

    // Draw track cells
    for (let i = 0; i <= TRACK_LENGTH; i++) {
      const row = Math.floor(i / cols);
      const col = row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
      const x = col * cellW;
      const y = row * cellH + 20;

      // Cell background
      const isGoal = i === TRACK_LENGTH;
      const isStart = i === 0;

      ctx.fillStyle = isGoal
        ? 'rgba(251,191,36,0.3)'
        : isStart
          ? 'rgba(34,197,94,0.2)'
          : i % 2 === 0
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.1)';

      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
      ctx.fill();

      ctx.strokeStyle = isGoal
        ? 'rgba(251,191,36,0.6)'
        : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cell number
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isGoal ? GOAL_EMOJI : isStart ? '🚀' : i,
        x + cellW / 2,
        y + 14
      );

      // Draw players on this cell
      const playersHere = players.filter(p => p.position === i);
      playersHere.forEach((p, idx) => {
        const px = x + cellW / 2 + (idx - playersHere.length / 2) * 10;
        const py = y + cellH / 2 + 6;

        // Player dot
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = p.color || '#fff';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Player initial
        ctx.fillStyle = 'white';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          (p.name || 'U')[0].toUpperCase(),
          px, py + 3
        );
      });
    }
  };

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('room_race_sessions')
        .insert({
          room_id: roomId,
          created_by: user.id,
          max_players: maxPlayers,
          entry_cost: entryCost,
          track_length: TRACK_LENGTH,
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
      alert(`Need ${currentSession.entry_cost} coins to join`);
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_race_session', {
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

  const startGame = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (players.length < 2) {
      alert('Need at least 2 players');
      return;
    }

    const firstPlayer = players[0];
    const { error } = await supabase
      .from('room_race_sessions')
      .update({
        status: 'playing',
        started_at: new Date().toISOString(),
        current_turn_user_id: firstPlayer.user_id,
      })
      .eq('id', currentSession.id);

    if (error) alert(error.message);
  };

  const rollDice = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (String(currentSession.current_turn_user_id) !== String(user.id)) {
      alert("It's not your turn!");
      return;
    }
    if (rolling) return;

    setRolling(true);
    setDiceAnimating(true);

    // Animate dice
    let count = 0;
    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6));
      count++;
      if (count > 8) {
        clearInterval(interval);
        setDiceAnimating(false);
      }
    }, 80);

    try {
      const { data, error } = await supabase.rpc('roll_race_dice', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to roll');

      setLastRoll(data.roll);
      setDiceDisplay(null);
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);

      // Refresh session for next turn
      const { data: sessionData } = await supabase
        .from('room_race_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
      if (sessionData) setCurrentSession(sessionData);

    } catch (err) {
      alert(err.message || 'Failed to roll');
    } finally {
      setRolling(false);
    }
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    const confirmed = window.confirm('Cancel game? All players will be refunded.');
    if (!confirmed) return;
    try {
      const { data, error } = await supabase.rpc('cancel_race_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      onCoinsUpdated?.();
      setCurrentSession(null);
      setPlayers([]);
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const isJoined = players.some(
    p => String(p.user_id) === String(user?.id)
  );
  const isFull = players.length >= (currentSession?.max_players || 0);
  const isMyTurn = String(currentSession?.current_turn_user_id) === String(user?.id);
  const totalPrize = (currentSession?.entry_cost || 0) * players.length;
  const netPrize = Math.floor(totalPrize * 0.9);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute inset-x-0 bottom-0 bg-slate-900 rounded-t-3xl
          shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between
          border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎲</span>
            <span className="font-bold text-white text-lg">Race Game</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-amber-500/20
              border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-amber-300 font-black text-sm">
                {(userCoins || 0).toLocaleString()}
              </span>
            </div>
            <button onClick={onClose}
              className="text-white/50 hover:text-white">
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
            /* Winner */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-6xl animate-bounce">🏆</div>
              <div className="text-white font-black text-2xl">Winner!</div>
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
            <div className="flex flex-col gap-4">
              {/* Session Info */}
              <div className="flex items-center justify-between
                bg-white/5 rounded-2xl px-4 py-3">
                <div>
                  <div className="text-white/50 text-xs">Entry</div>
                  <div className="text-amber-300 font-black">
                    🪙 {currentSession.entry_cost.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/50 text-xs">Players</div>
                  <div className="text-white font-black text-lg">
                    {players.length}/{currentSession.max_players}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/50 text-xs">Prize</div>
                  <div className="text-emerald-300 font-black">
                    🪙 {netPrize.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-white/50 text-xs">My Coins</div>
                  <div className={`font-black text-sm ${
                    userCoins >= currentSession.entry_cost
                      ? 'text-white' : 'text-rose-400'
                  }`}>
                    🪙 {(userCoins || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Status */}
              {currentSession.status === 'playing' && (
                <div className={`text-center py-2 rounded-xl text-sm font-bold ${
                  isMyTurn
                    ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                    : 'bg-white/5 text-white/50'
                }`}>
                  {isMyTurn ? '🎲 Your turn! Roll the dice!' : (() => {
                    const currentPlayer = players.find(
                      p => String(p.user_id) ===
                           String(currentSession.current_turn_user_id)
                    );
                    return `⏳ ${currentPlayer?.name || 'Player'}'s turn`;
                  })()}
                </div>
              )}

              {/* Track Canvas */}
              <div className="bg-white/5 rounded-2xl p-2 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={280}
                  className="w-full rounded-xl"
                />
              </div>

              {/* Last Roll */}
              {lastRoll && (
                <div className="text-center">
                  <span className="text-4xl">
                    {DICE_FACES[Math.floor(lastRoll / 2) - 1] || '🎲'}
                    {DICE_FACES[(lastRoll % 6) - 1] || '🎲'}
                  </span>
                  <div className="text-white/50 text-xs mt-1">
                    Rolled: {lastRoll}
                  </div>
                </div>
              )}

              {/* Dice animation */}
              {diceAnimating && diceDisplay !== null && (
                <div className="text-center text-5xl animate-bounce">
                  {DICE_FACES[diceDisplay]}
                </div>
              )}

              {/* Players list */}
              <div className="space-y-2">
                {players.map((p, idx) => {
                  const progressPct = (p.position / TRACK_LENGTH) * 100;
                  return (
                    <div key={p.id}
                      className="flex items-center gap-3 bg-white/5
                        rounded-xl px-3 py-2">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ background: p.color }}
                      />
                      <img
                        src={p.avatar_url || FALLBACK_AVATAR}
                        alt={p.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                        onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-xs font-bold truncate">
                            {p.name}
                            {String(p.user_id) === String(user?.id) && (
                              <span className="text-amber-300 ml-1">
                                (You)
                              </span>
                            )}
                          </span>
                          <span className="text-white/40 text-xs">
                            {p.position}/{TRACK_LENGTH}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPct}%`,
                              background: p.color,
                            }}
                          />
                        </div>
                      </div>
                      {String(currentSession.current_turn_user_id) ===
                       String(p.user_id) &&
                       currentSession.status === 'playing' && (
                        <span className="text-lg animate-bounce shrink-0">
                          🎲
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {/* Join */}
                {!isJoined && !isFull &&
                  currentSession.status === 'waiting' && (
                  <button
                    onClick={joinSession}
                    disabled={joining || userCoins < currentSession.entry_cost}
                    className="flex-1 py-3 rounded-2xl bg-amber-500
                      text-white font-black text-sm disabled:opacity-50
                      hover:bg-amber-400 transition active:scale-95"
                  >
                    {joining
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`
                    }
                  </button>
                )}

                {/* Roll */}
                {isJoined && currentSession.status === 'playing' &&
                  isMyTurn && (
                  <button
                    onClick={rollDice}
                    disabled={rolling}
                    className="flex-1 py-3 rounded-2xl bg-emerald-500
                      text-white font-black text-sm disabled:opacity-50
                      hover:bg-emerald-400 transition active:scale-95
                      animate-pulse"
                  >
                    {rolling
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : '🎲 Roll Dice!'
                    }
                  </button>
                )}

                {/* Start */}
                {canModerate && currentSession.status === 'waiting' && (
                  <>
                    <button
                      onClick={startGame}
                      disabled={players.length < 2}
                      className="flex-1 py-3 rounded-2xl bg-blue-500
                        text-white font-black text-sm disabled:opacity-50
                        hover:bg-blue-400 transition active:scale-95"
                    >
                      🚀 Start Race
                    </button>
                    <button
                      onClick={cancelSession}
                      className="px-4 py-3 rounded-2xl border
                        border-rose-500/40 text-rose-400 font-bold text-sm
                        hover:bg-rose-500/10 transition active:scale-95"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* Waiting message */}
                {isJoined && currentSession.status === 'playing' &&
                  !isMyTurn && (
                  <div className="flex-1 py-3 rounded-2xl bg-white/5
                    text-white/40 font-bold text-sm text-center">
                    ⏳ Waiting for your turn...
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Create */
            canModerate ? (
              <div className="flex flex-col gap-5">
                <div className="text-center text-white/50 text-sm">
                  No active race game. Create one!
                </div>

                <div>
                  <div className="text-white/70 text-sm font-bold mb-2">
                    👥 Number of Players
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxPlayers(n)}
                        className={`py-3 rounded-xl font-black text-lg
                          transition active:scale-95 ${
                          maxPlayers === n
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-white/70 text-sm font-bold mb-2">
                    🪙 Entry Cost
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ENTRY_COST_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEntryCost(c)}
                        className={`py-2.5 rounded-xl font-bold text-sm
                          transition active:scale-95 ${
                          entryCost === c
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {c.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

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
                    from-blue-500 to-cyan-400 text-white font-black text-lg
                    shadow-[0_0_20px_rgba(59,130,246,0.4)]
                    hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]
                    transition active:scale-95 disabled:opacity-50"
                >
                  {creating
                    ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    : '🎲 Create Race Game'
                  }
                </button>
              </div>
            ) : (
              <div className="text-center text-white/40 py-12">
                <div className="text-4xl mb-3">🎲</div>
                <div className="text-sm">No active race game</div>
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