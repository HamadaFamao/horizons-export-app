import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8];
const ENTRY_COST_OPTIONS = [100, 200, 500, 1000, 5000, 10000];
const TRACK_LENGTH = 100;

const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
};

const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
};

const PLAYER_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
];

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
  const [leaving, setLeaving] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [diceDisplay, setDiceDisplay] = useState(null);
  const [specialEvent, setSpecialEvent] = useState(null);
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

  const getCellCenter = (cellNum, cols, rows, cellW, cellH) => {
    const idx = cellNum - 1;
    const row = Math.floor(idx / cols);
    const col = row % 2 === 0
      ? idx % cols
      : cols - 1 - (idx % cols);
    const displayRow = rows - 1 - row;
    return {
      x: col * cellW + cellW / 2,
      y: displayRow * cellH + cellH / 2,
    };
  };

  const drawTrack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    // Clear and draw outer border
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const cols = 10;
    const rows = 10;
    const cellW = W / cols;
    const cellH = H / rows;

    // Draw cells
    for (let i = 1; i <= 100; i++) {
      const idx = i - 1;
      const row = Math.floor(idx / cols);
      const col = row % 2 === 0
        ? idx % cols
        : cols - 1 - (idx % cols);

      // Flip row from bottom
      const displayRow = rows - 1 - row;
      const x = col * cellW;
      const y = displayRow * cellH;

      // Cell colors
      let bgColor = (row + col) % 2 === 0
        ? '#1e293b' // slate-800
        : '#334155'; // slate-700

      if (i === 100) bgColor = '#b45309'; // amber-700
      if (i === 1) bgColor = '#4338ca'; // indigo-700

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, cellW, cellH);

      // Inner highlight for 3D effect
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + cellH);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cellW, y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.moveTo(x + cellW, y);
      ctx.lineTo(x + cellW, y + cellH);
      ctx.lineTo(x, y + cellH);
      ctx.stroke();

      // Cell number
      ctx.fillStyle = i === 100
        ? '#fde68a'
        : i === 1
          ? '#a5b4fc'
          : 'rgba(255,255,255,0.4)';
      ctx.font = `bold ${cellW * 0.25}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(i, x + 3, y + 3);

      // Icons
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (i === 100) {
        ctx.font = `${cellW * 0.4}px sans-serif`;
        ctx.fillText('🏆', x + cellW / 2, y + cellH / 2 + 4);
      } else if (i === 1) {
        ctx.font = `${cellW * 0.4}px sans-serif`;
        ctx.fillText('🚀', x + cellW / 2, y + cellH / 2 + 4);
      }
    }

    // Draw ladders
    Object.entries(LADDERS).forEach(([from, to]) => {
      const fromPos = getCellCenter(Number(from), cols, rows, cellW, cellH);
      const toPos = getCellCenter(Number(to), cols, rows, cellW, cellH);
      
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const angle = Math.atan2(dy, dx);
      const length = Math.sqrt(dx * dx + dy * dy);
      
      ctx.save();
      ctx.translate(fromPos.x, fromPos.y);
      ctx.rotate(angle);
      
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      // Ladder styles
      ctx.strokeStyle = '#fbbf24'; // amber-400
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      
      const width = cellW * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, -width/2);
      ctx.lineTo(length, -width/2);
      ctx.moveTo(0, width/2);
      ctx.lineTo(length, width/2);
      ctx.stroke();
      
      // Rungs
      const rungSpacing = 12;
      const rungs = Math.floor(length / rungSpacing);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for(let j=1; j<=rungs; j++) {
        const rx = j * (length / (rungs + 1));
        ctx.moveTo(rx, -width/2);
        ctx.lineTo(rx, width/2);
      }
      ctx.stroke();
      
      ctx.restore();
    });

    // Draw snakes
    Object.entries(SNAKES).forEach(([from, to]) => {
      const fromPos = getCellCenter(Number(from), cols, rows, cellW, cellH);
      const toPos = getCellCenter(Number(to), cols, rows, cellW, cellH);
      
      ctx.save();
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      
      const midX = (fromPos.x + toPos.x) / 2;
      const midY = (fromPos.y + toPos.y) / 2;
      
      const cp1x = midX + (toPos.y - fromPos.y) * 0.25;
      const cp1y = midY - (toPos.x - fromPos.x) * 0.25;
      
      ctx.quadraticCurveTo(cp1x, cp1y, toPos.x, toPos.y);
      
      // Snake body
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Snake pattern
      ctx.strokeStyle = '#047857'; // emerald-700
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Snake head
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.ellipse(fromPos.x, fromPos.y, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fromPos.x - 2.5, fromPos.y - 2, 2, 0, Math.PI * 2);
      ctx.arc(fromPos.x + 2.5, fromPos.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(fromPos.x - 2.5, fromPos.y - 2, 1, 0, Math.PI * 2);
      ctx.arc(fromPos.x + 2.5, fromPos.y - 2, 1, 0, Math.PI * 2);
      ctx.fill();

      // Tongue
      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y + 5);
      ctx.lineTo(fromPos.x, fromPos.y + 12);
      ctx.moveTo(fromPos.x, fromPos.y + 12);
      ctx.lineTo(fromPos.x - 3, fromPos.y + 15);
      ctx.moveTo(fromPos.x, fromPos.y + 12);
      ctx.lineTo(fromPos.x + 3, fromPos.y + 15);
      ctx.stroke();

      ctx.restore();
    });

    // Draw players
    players.forEach((p) => {
      if (p.position === 0) return;
      const center = getCellCenter(p.position, cols, rows, cellW, cellH);
      const playersOnSameCell = players.filter(
        op => op.position === p.position
      );
      const pidx = playersOnSameCell.findIndex(
        op => op.user_id === p.user_id
      );
      
      // Arrange players in a circle if multiple
      let offsetX = 0;
      let offsetY = 0;
      if (playersOnSameCell.length > 1) {
        const angle = (pidx / playersOnSameCell.length) * Math.PI * 2 - Math.PI / 2;
        const radius = cellW * 0.22;
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }

      ctx.save();
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.arc(
        center.x + offsetX,
        center.y + offsetY,
        cellW * 0.22,
        0, Math.PI * 2
      );
      ctx.fillStyle = p.color || '#ffffff';
      ctx.fill();
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Initial
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${cellW * 0.25}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        (p.name || 'U')[0].toUpperCase(),
        center.x + offsetX,
        center.y + offsetY + 1
      );
      
      ctx.restore();
    });
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

  const leaveSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { data, error } = await supabase.rpc('leave_race_session', {
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
      if (data.special_event) {
        setSpecialEvent(data.special_event);
        setTimeout(() => setSpecialEvent(null), 2500);
      }
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

  const renderPlayer = (p) => {
    const progressPct = (p.position / TRACK_LENGTH) * 100;
    const isCurrentTurn = String(currentSession?.current_turn_user_id) === String(p.user_id) && currentSession?.status === 'playing';
    
    return (
      <div key={p.id}
        className={`relative overflow-hidden flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
          isCurrentTurn ? 'bg-white/10 border border-white/20 shadow-md' : 'bg-white/5 border border-transparent'
        }`}>
        {/* Progress background */}
        <div 
          className="absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500"
          style={{ width: `${progressPct}%`, backgroundColor: p.color }}
        />
        
        <div className="relative shrink-0">
          <img
            src={p.avatar_url || FALLBACK_AVATAR}
            alt={p.name}
            className="w-7 h-7 rounded-full object-cover border border-white/20"
            onError={e => e.currentTarget.src = FALLBACK_AVATAR}
          />
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900"
            style={{ backgroundColor: p.color }}
          />
        </div>
        
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-1">
            <span className="text-white text-[11px] font-bold truncate">
              {p.name}
            </span>
            {String(p.user_id) === String(user?.id) && (
              <span className="text-amber-300 text-[9px] shrink-0">(You)</span>
            )}
          </div>
          <div className="text-white/60 text-[9px] font-bold leading-tight">
            {p.position}/{TRACK_LENGTH}
          </div>
        </div>
        
        {isCurrentTurn && (
          <span className="text-sm animate-bounce shrink-0 drop-shadow-md z-10">
            🎲
          </span>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl
          shadow-2xl flex flex-col overflow-hidden max-h-[95vh] sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle (Visible only on mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
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
              className="text-white/50 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
          ) : showResult && winner ? (
            /* Winner */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl animate-bounce drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">🏆</div>
              <div className="text-white font-black text-3xl tracking-wide">WINNER!</div>
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20"></div>
                <img
                  src={winner.avatar_url || FALLBACK_AVATAR}
                  alt={winner.name}
                  className="relative w-24 h-24 rounded-full border-4 border-amber-400
                    shadow-[0_0_40px_rgba(251,191,36,0.8)] object-cover"
                  onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                />
              </div>
              <div className="text-amber-300 font-black text-2xl drop-shadow-lg text-center">
                {winner.name}
              </div>
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40
                rounded-2xl px-6 py-3 text-center shadow-xl backdrop-blur-sm">
                <div className="text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">Prize Won</div>
                <div className="text-amber-400 text-3xl font-black drop-shadow-md">
                  🪙 {winnerCoins.toLocaleString()}
                </div>
              </div>
            </div>
          ) : currentSession ? (
            <div className="flex flex-col gap-2">
              {/* Session Info */}
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-800/50 border border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Entry</div>
                  <div className="text-amber-400 font-black text-xs">
                    🪙 {currentSession.entry_cost.toLocaleString()}
                  </div>
                </div>
                <div className="w-px h-5 bg-white/10"></div>
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Players</div>
                  <div className="text-white font-black text-xs">
                    {players.length}/{currentSession.max_players}
                  </div>
                </div>
                <div className="w-px h-5 bg-white/10"></div>
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Prize</div>
                  <div className="text-emerald-400 font-black text-xs">
                    🪙 {netPrize.toLocaleString()}
                  </div>
                </div>
                <div className="w-px h-5 bg-white/10"></div>
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">My Coins</div>
                  <div className={`font-black text-xs ${
                    userCoins >= currentSession.entry_cost
                      ? 'text-white' : 'text-rose-400'
                  }`}>
                    🪙 {(userCoins || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Status */}
              {currentSession.status === 'playing' && (
                <div className={`text-center py-1.5 rounded-xl text-xs font-black shadow-sm transition-all ${
                  isMyTurn
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white animate-pulse border border-emerald-400'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}>
                  {isMyTurn ? '🎲 YOUR TURN! ROLL THE DICE!' : (() => {
                    const currentPlayer = players.find(
                      p => String(p.user_id) ===
                           String(currentSession.current_turn_user_id)
                    );
                    return `⏳ Waiting for ${currentPlayer?.name || 'Player'}...`;
                  })()}
                </div>
              )}

              {/* Track Canvas */}
              <div className="bg-slate-900 rounded-xl p-1.5 overflow-hidden shadow-inner border border-white/5 flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={340}
                  className="w-full max-w-[340px] aspect-square rounded-lg shadow-sm"
                />
              </div>

              {/* Special Event */}
              {specialEvent && (
                <div className={`text-center py-1.5 px-3 rounded-xl font-black
                  text-xs animate-bounce shadow-sm my-1 ${
                  specialEvent.includes('ladder')
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white border border-emerald-400'
                    : specialEvent.includes('snake')
                      ? 'bg-gradient-to-r from-rose-500 to-red-400 text-white border border-rose-400'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-400 text-white border border-purple-400'
                }`}>
                  {specialEvent.includes('ladder') && '🪜 Ladder! Jump forward!'}
                  {specialEvent.includes('snake') && '🐍 Snake! Slide back!'}
                  {specialEvent.includes('bump') && !specialEvent.includes('ladder')
                    && !specialEvent.includes('snake')
                    && '💥 Bumped a player back to start!'}
                </div>
              )}

              {/* Players & Dice */}
              {currentSession.status === 'playing' ? (
                <div className="flex items-stretch justify-between gap-2 my-1">
                  {/* Left Players */}
                  <div className="flex-1 flex flex-col gap-1.5 justify-center">
                    {players.filter((_, i) => i % 2 === 0).map(renderPlayer)}
                  </div>

                  {/* Dice */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-20">
                    {(lastRoll || diceAnimating) ? (
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`relative w-14 h-14 rounded-2xl flex items-center
                            justify-center shadow-xl border-b-4 border-r-4 border-white/20
                            ${diceAnimating ? 'animate-spin' : 'animate-bounce'}`}
                          style={{
                            background: 'linear-gradient(135deg, #ffffff, #e2e8f0)',
                            boxShadow: diceAnimating
                              ? '0 0 20px rgba(251,191,36,0.8)'
                              : '0 5px 15px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,1)',
                            animationDuration: diceAnimating ? '0.3s' : '1s',
                          }}
                        >
                          {/* Dice dots */}
                          {(() => {
                            const num = diceAnimating
                              ? (diceDisplay ?? 1) + 1
                              : lastRoll > 6 ? 6 : lastRoll;
                            const dotPositions = {
                              1: [[50, 50]],
                              2: [[25, 25], [75, 75]],
                              3: [[25, 25], [50, 50], [75, 75]],
                              4: [[25, 25], [75, 25], [25, 75], [75, 75]],
                              5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
                              6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
                            };
                            const dots = dotPositions[Math.min(num, 6)] || dotPositions[1];
                            return dots.map(([dx, dy], di) => (
                              <div
                                key={di}
                                className="absolute w-2.5 h-2.5 rounded-full bg-slate-800"
                                style={{
                                  left: `${dx}%`,
                                  top: `${dy}%`,
                                  transform: 'translate(-50%, -50%)',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.8)',
                                }}
                              />
                            ));
                          })()}
                        </div>
                        {!diceAnimating && lastRoll && (
                          <div className="text-white/70 text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Rolled: <span className="text-amber-400 font-black text-xs">{lastRoll}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center opacity-30">
                        <span className="text-2xl">🎲</span>
                      </div>
                    )}
                  </div>

                  {/* Right Players */}
                  <div className="flex-1 flex flex-col gap-1.5 justify-center">
                    {players.filter((_, i) => i % 2 !== 0).map(renderPlayer)}
                  </div>
                </div>
              ) : (
                /* Waiting state: just show players in a grid */
                <div className="grid grid-cols-2 gap-2 my-1">
                  {players.map(renderPlayer)}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-1">
                {/* Join */}
                {!isJoined && !isFull &&
                  currentSession.status === 'waiting' && (
                  <button
                    onClick={joinSession}
                    disabled={joining || userCoins < currentSession.entry_cost}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400
                      text-white font-black text-xs disabled:opacity-50 shadow-md
                      hover:shadow-lg transition active:scale-95 border border-amber-400"
                  >
                    {joining
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`
                    }
                  </button>
                )}

                {/* Leave */}
                {isJoined && currentSession.status === 'waiting' && (
                  <button
                    onClick={leaveSession}
                    disabled={leaving}
                    className="flex-1 py-2.5 rounded-xl border border-white/20
                      text-white/70 font-bold text-xs bg-white/5
                      hover:bg-white/10 transition active:scale-95"
                  >
                    {leaving
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : 'Leave & Refund'
                    }
                  </button>
                )}

                {/* Roll */}
                {isJoined && currentSession.status === 'playing' &&
                  isMyTurn && (
                  <button
                    onClick={rollDice}
                    disabled={rolling}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400
                      text-white font-black text-sm disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.4)]
                      hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] transition active:scale-95
                      animate-pulse border border-emerald-400"
                  >
                    {rolling
                      ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      : '🎲 ROLL DICE!'
                    }
                  </button>
                )}

                {/* Start */}
                {canModerate && currentSession.status === 'waiting' && (
                  <button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500
                      text-white font-black text-xs disabled:opacity-50 shadow-md
                      hover:shadow-lg transition active:scale-95 border border-blue-400"
                  >
                    🚀 Start Race
                  </button>
                )}

                {canModerate && (
                  currentSession.status === 'waiting' ||
                  currentSession.status === 'playing'
                ) && (
                  <button
                    onClick={cancelSession}
                    className="px-3 py-2.5 rounded-xl border
                      border-rose-500/40 text-rose-400 font-bold text-xs bg-rose-500/5
                      hover:bg-rose-500/10 transition active:scale-95"
                  >
                    Cancel
                  </button>
                )}

                {/* Waiting message */}
                {isJoined && currentSession.status === 'playing' &&
                  !isMyTurn && (
                  <div className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10
                    text-white/50 font-bold text-xs text-center shadow-inner">
                    ⏳ Waiting for your turn...
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Create */
            canModerate ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="text-center text-white/50 text-sm">
                  No active race game. Create one!
                </div>

                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">
                    👥 Number of Players
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxPlayers(n)}
                        className={`py-2.5 rounded-xl font-black text-sm
                          transition-all active:scale-95 shadow-sm ${
                          maxPlayers === n
                            ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border border-amber-400'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">
                    🪙 Entry Cost
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ENTRY_COST_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEntryCost(c)}
                        className={`py-2.5 rounded-xl font-bold text-xs
                          transition-all active:scale-95 shadow-sm ${
                          entryCost === c
                            ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border border-amber-400'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {c >= 1000 ? (c/1000)+'k' : c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 text-center shadow-inner">
                  <div className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Winner gets (after 10% fee)
                  </div>
                  <div className="text-amber-400 font-black text-2xl drop-shadow-md">
                    🪙 {Math.floor(entryCost * maxPlayers * 0.9).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={createSession}
                  disabled={creating}
                  className="w-full py-3 rounded-xl bg-gradient-to-r
                    from-blue-500 to-indigo-500 text-white font-black text-sm
                    shadow-[0_0_15px_rgba(59,130,246,0.4)]
                    hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]
                    transition active:scale-95 disabled:opacity-50 border border-blue-400"
                >
                  {creating
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    : '🎲 Create Race Game'
                  }
                </button>
              </div>
            ) : (
              <div className="text-center text-white/40 py-12">
                <div className="text-5xl mb-3 opacity-50">🎲</div>
                <div className="text-base font-bold text-white/60">No active race game</div>
                <div className="text-xs mt-2">
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