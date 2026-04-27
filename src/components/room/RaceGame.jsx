import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Settings } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

// ── 1. Free tier added (0) ────────────────────────────────────────────────────
const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8];
const ENTRY_COST_OPTIONS = [0, 100, 200, 500, 1000, 5000, 10000];
const TRACK_LENGTH = 100;

const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67 };
const SNAKES  = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73 };

const PLAYER_COLORS = [
  '#f43f5e','#f97316','#eab308','#22c55e',
  '#06b6d4','#8b5cf6','#ec4899','#14b8a6',
];

export default function RaceGame({
  open, onClose, roomId, user,
  canModerate, userCoins, onCoinsUpdated, onRaceResult,
}) {
  const [currentSession, setCurrentSession]   = useState(null);
  const [players, setPlayers]                 = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [creating, setCreating]               = useState(false);
  const [maxPlayers, setMaxPlayers]           = useState(4);
  const [entryCost, setEntryCost]             = useState(100);
  const [teamMode, setTeamMode]               = useState(false);
  const [joining, setJoining]                 = useState(false);
  const [leaving, setLeaving]                 = useState(false);
  const [rolling, setRolling]                 = useState(false);
  const [resigning, setResigning]             = useState(false);
  const [lastRoll, setLastRoll]               = useState(null);
  const [winner, setWinner]                   = useState(null);
  const [winnerCoins, setWinnerCoins]         = useState(0);
  const [showResult, setShowResult]           = useState(false);
  const [diceAnimating, setDiceAnimating]     = useState(false);
  const [diceDisplay, setDiceDisplay]         = useState(null);
  const [specialEvent, setSpecialEvent]       = useState(null);
  const [playersLastRoll, setPlayersLastRoll] = useState({});
  const [allDiceRolls, setAllDiceRolls]       = useState({});
  const [allDiceAnimating, setAllDiceAnimating] = useState({});
  const [anyoneMoving, setAnyoneMoving]       = useState(false);
  const [animatingPlayer, setAnimatingPlayer] = useState(null);
  const [soundMuted, setSoundMuted]           = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const canvasRef        = useRef(null);
  const avatarImagesRef  = useRef({});
  const animationRef     = useRef(null);
  const channelRef       = useRef(null);
  const resultFiredRef   = useRef(false);
  const soundMutedRef    = useRef(false);

  useEffect(() => { soundMutedRef.current = soundMuted; }, [soundMuted]);

  // ── Sound utility ─────────────────────────────────────────────────────────
  const playSound = (type) => {
    if (soundMutedRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);

      if (type === 'roll') {
        o.type = 'square';
        o.frequency.setValueAtTime(220, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        o.start(); o.stop(ctx.currentTime + 0.12);

      } else if (type === 'move') {
        o.type = 'sine';
        o.frequency.setValueAtTime(660, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        o.start(); o.stop(ctx.currentTime + 0.09);

      } else if (type === 'ladder') {
        // Ascending happy tones
        [0, 0.1, 0.2].forEach((delay, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime([523, 659, 784][i], ctx.currentTime + delay);
          g2.gain.setValueAtTime(0.2, ctx.currentTime + delay);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
          o2.start(ctx.currentTime + delay);
          o2.stop(ctx.currentTime + delay + 0.16);
        });
        return;

      } else if (type === 'snake') {
        // Descending sad tones
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(400, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.4);
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        o.start(); o.stop(ctx.currentTime + 0.45);

      } else if (type === 'victory') {
        // Energetic victory fanfare
        const notes = [
          { f: 523, t: 0,    dur: 0.35 },
          { f: 659, t: 0.08, dur: 0.35 },
          { f: 784, t: 0.16, dur: 0.35 },
          { f: 1047,t: 0.28, dur: 0.5  },
          { f: 880, t: 0.36, dur: 0.4  },
          { f: 1047,t: 0.48, dur: 0.55 },
          { f: 1319,t: 0.6,  dur: 0.7  },
        ];
        notes.forEach(({ f, t, dur }) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(f, ctx.currentTime + t);
          g2.gain.setValueAtTime(0, ctx.currentTime + t);
          g2.gain.linearRampToValueAtTime(0.22, ctx.currentTime + t + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
          o2.start(ctx.currentTime + t);
          o2.stop(ctx.currentTime + t + dur + 0.05);
        });
        // Bass punch
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.connect(bassGain); bassGain.connect(ctx.destination);
        bass.type = 'sine';
        bass.frequency.setValueAtTime(130, ctx.currentTime);
        bass.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.3);
        bassGain.gain.setValueAtTime(0.3, ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        bass.start(ctx.currentTime); bass.stop(ctx.currentTime + 0.36);
        // Sparkle
        [0.3, 0.5, 0.65, 0.8].forEach((t, i) => {
          const os = ctx.createOscillator();
          const gs = ctx.createGain();
          os.connect(gs); gs.connect(ctx.destination);
          os.type = 'sine';
          os.frequency.setValueAtTime([1568,1760,1976,2093][i], ctx.currentTime + t);
          gs.gain.setValueAtTime(0.1, ctx.currentTime + t);
          gs.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
          os.start(ctx.currentTime + t); os.stop(ctx.currentTime + t + 0.16);
        });
        return;
      }
    } catch (_) {}
  };

  // ── 3. Play victory sound when result screen appears ─────────────────────
  useEffect(() => {
    if (showResult) playSound('victory');
  }, [showResult]);

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  // Realtime
  useEffect(() => {
    if (!open || !roomId) return;
    const channel = supabase
      .channel(`race_${roomId}`)
      .on('broadcast', { event: 'player_move' }, ({ payload }) => {
        if (!payload) return;
        const { userId, position, isDone } = payload;
        if (String(userId) === String(user?.id)) return;
        setAnyoneMoving(true);
        setPlayers(prev => prev.map(p =>
          String(p.user_id) === String(userId) ? { ...p, position } : p
        ));
        if (isDone) setAnyoneMoving(false);
      })
      .on('broadcast', { event: 'dice_roll' }, ({ payload }) => {
        if (!payload) return;
        const { userId, roll, color } = payload;
        setAllDiceAnimating(prev => ({ ...prev, [userId]: true }));
        setAllDiceRolls(prev => ({ ...prev, [userId]: { roll: null, color } }));
        let count = 0;
        const interval = setInterval(() => {
          setAllDiceRolls(prev => ({
            ...prev,
            [userId]: { roll: Math.floor(Math.random() * 6) + 1, color, animating: true }
          }));
          count++;
          if (count > 8) {
            clearInterval(interval);
            setAllDiceRolls(prev => ({ ...prev, [userId]: { roll, color, animating: false } }));
            setAllDiceAnimating(prev => ({ ...prev, [userId]: false }));
          }
        }, 80);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_race_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const s = payload.new;
        if (s?.status === 'finished') {
          if (resultFiredRef.current) return;
          resultFiredRef.current = true;
          setCurrentSession(s);
          loadPlayers(s.id).then(ps => {
            const w = ps.find(p => String(p.user_id) === String(s.winner_id));
            if (w) {
              setWinner(w);
              setWinnerCoins(s.winner_coins || 0);
              setShowResult(true);
              if (String(s.winner_id) === String(user?.id)) {
                onRaceResult?.({
                  winnerName: w.name, winnerAvatar: w.avatar_url,
                  winnerId: w.user_id, winnerCoins: s.winner_coins || 0,
                  totalPlayers: ps.length,
                });
              }
              setTimeout(() => {
                resultFiredRef.current = false;
                setCurrentSession(null); setPlayers([]);
                setShowResult(false); setWinner(null); setLastRoll(null);
              }, 6000);
            }
          });
        } else {
          setCurrentSession(s);
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_race_players',
      }, () => {
        if (currentSession?.id) loadPlayers(currentSession.id);
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [open, roomId, currentSession?.id]);

  useEffect(() => {
    if (!canvasRef.current || !currentSession) return;
    drawTrack();
  }, [players, currentSession, animatingPlayer]);

  useEffect(() => {
    players.forEach(p => {
      if (p.avatar_url && !avatarImagesRef.current[p.user_id]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { avatarImagesRef.current[p.user_id] = img; drawTrack(); };
        img.src = p.avatar_url;
        avatarImagesRef.current[p.user_id] = img;
      }
    });
  }, [players]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_race_sessions').select('*')
        .eq('room_id', roomId).in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setCurrentSession(data || null);
      if (data?.id) await loadPlayers(data.id);
      else setPlayers([]);
    } finally { setLoading(false); }
  };

  const loadPlayers = async (sessionId) => {
    if (!sessionId) return [];
    const { data: playersData } = await supabase
      .from('room_race_players').select('*')
      .eq('session_id', sessionId).is('refunded_at', null)
      .order('seat_number', { ascending: true });
    if (!playersData?.length) { setPlayers([]); setPlayersLastRoll({}); return []; }
    const userIds = playersData.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, name, avatar_url').in('id', userIds);
    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    const merged = playersData.map(p => ({
      ...p,
      name: profilesMap.get(p.user_id)?.name || 'User',
      avatar_url: profilesMap.get(p.user_id)?.avatar_url || null,
    }));
    setPlayers(merged);
    const rollsMap = {};
    merged.forEach(p => { if (p.last_roll) rollsMap[p.user_id] = p.last_roll; });
    setPlayersLastRoll(rollsMap);
    return merged;
  };

  const getCellCenter = (cellNum, cols, rows, cellW, cellH) => {
    const idx = cellNum - 1;
    const row = Math.floor(idx / cols);
    const col = row % 2 === 0 ? idx % cols : cols - 1 - (idx % cols);
    const displayRow = rows - 1 - row;
    return { x: col * cellW + cellW / 2, y: displayRow * cellH + cellH / 2 };
  };

  const drawTrack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    const cols = 10, rows = 10;
    const cellW = W / cols, cellH = H / rows;

    for (let i = 1; i <= 100; i++) {
      const idx = i - 1;
      const row = Math.floor(idx / cols);
      const col = row % 2 === 0 ? idx % cols : cols - 1 - (idx % cols);
      const displayRow = rows - 1 - row;
      const x = col * cellW, y = displayRow * cellH;
      const vibrantColors = ['#FF4B4B','#4B7BFF','#00D084','#FFB020'];
      let bgColor = vibrantColors[(row + col) % vibrantColors.length];
      if (i === 100) bgColor = '#FFD700';
      if (i === 1)   bgColor = '#00E676';
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = cellW * 0.04;
      ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x, y); ctx.lineTo(x + cellW, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW, y + cellH); ctx.lineTo(x, y + cellH); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = cellW * 0.1; ctx.shadowOffsetY = cellW * 0.02;
      ctx.font = `bold ${cellW * 0.28}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(i, x + cellW * 0.08, y + cellH * 0.08);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (i === 100) { ctx.font = `${cellW * 0.45}px sans-serif`; ctx.fillText('🏆', x + cellW / 2, y + cellH / 2 + cellH * 0.1); }
      else if (i === 1) { ctx.font = `${cellW * 0.45}px sans-serif`; ctx.fillText('🚀', x + cellW / 2, y + cellH / 2 + cellH * 0.1); }
    }

    Object.entries(LADDERS).forEach(([from, to]) => {
      const fromPos = getCellCenter(Number(from), cols, rows, cellW, cellH);
      const toPos   = getCellCenter(Number(to),   cols, rows, cellW, cellH);
      const dx = toPos.x - fromPos.x, dy = toPos.y - fromPos.y;
      const angle = Math.atan2(dy, dx), length = Math.sqrt(dx*dx + dy*dy);
      ctx.save();
      ctx.translate(fromPos.x, fromPos.y); ctx.rotate(angle);
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = cellW * 0.15; ctx.shadowOffsetY = cellW * 0.05;
      ctx.strokeStyle = '#FDE047'; ctx.lineWidth = cellW * 0.12; ctx.lineCap = 'round';
      const width = cellW * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, -width/2); ctx.lineTo(length, -width/2);
      ctx.moveTo(0, width/2);  ctx.lineTo(length, width/2); ctx.stroke();
      const rungSpacing = cellW * 0.35, rungs = Math.floor(length / rungSpacing);
      ctx.lineWidth = cellW * 0.09; ctx.beginPath();
      for (let j = 1; j <= rungs; j++) {
        const rx = j * (length / (rungs + 1));
        ctx.moveTo(rx, -width/2); ctx.lineTo(rx, width/2);
      }
      ctx.stroke(); ctx.restore();
    });

    Object.entries(SNAKES).forEach(([from, to]) => {
      const fromPos = getCellCenter(Number(from), cols, rows, cellW, cellH);
      const toPos   = getCellCenter(Number(to),   cols, rows, cellW, cellH);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = cellW * 0.15; ctx.shadowOffsetY = cellW * 0.05;
      ctx.beginPath(); ctx.moveTo(fromPos.x, fromPos.y);
      const midX = (fromPos.x + toPos.x) / 2, midY = (fromPos.y + toPos.y) / 2;
      const cp1x = midX + (toPos.y - fromPos.y) * 0.25, cp1y = midY - (toPos.x - fromPos.x) * 0.25;
      ctx.quadraticCurveTo(cp1x, cp1y, toPos.x, toPos.y);
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = cellW * 0.2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = '#047857'; ctx.setLineDash([cellW * 0.12, cellW * 0.18]);
      ctx.lineWidth = cellW * 0.14; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#10b981'; ctx.beginPath();
      ctx.ellipse(fromPos.x, fromPos.y, cellW * 0.2, cellW * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath();
      ctx.arc(fromPos.x - cellW * 0.07, fromPos.y - cellW * 0.06, cellW * 0.06, 0, Math.PI * 2);
      ctx.arc(fromPos.x + cellW * 0.07, fromPos.y - cellW * 0.06, cellW * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.beginPath();
      ctx.arc(fromPos.x - cellW * 0.07, fromPos.y - cellW * 0.06, cellW * 0.03, 0, Math.PI * 2);
      ctx.arc(fromPos.x + cellW * 0.07, fromPos.y - cellW * 0.06, cellW * 0.03, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = cellW * 0.04; ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y + cellW * 0.15); ctx.lineTo(fromPos.x, fromPos.y + cellW * 0.35);
      ctx.moveTo(fromPos.x, fromPos.y + cellW * 0.35); ctx.lineTo(fromPos.x - cellW * 0.09, fromPos.y + cellW * 0.44);
      ctx.moveTo(fromPos.x, fromPos.y + cellW * 0.35); ctx.lineTo(fromPos.x + cellW * 0.09, fromPos.y + cellW * 0.44);
      ctx.stroke(); ctx.restore();
    });

    players.forEach((p) => {
      if (p.position === 0) return;
      const center = getCellCenter(p.position, cols, rows, cellW, cellH);
      const playersOnSameCell = players.filter(op => op.position === p.position);
      const pidx = playersOnSameCell.findIndex(op => op.user_id === p.user_id);
      let offsetX = 0, offsetY = 0;
      if (playersOnSameCell.length > 1) {
        const angle = (pidx / playersOnSameCell.length) * Math.PI * 2 - Math.PI / 2;
        const radius = cellW * 0.22;
        offsetX = Math.cos(angle) * radius; offsetY = Math.sin(angle) * radius;
      }
      const cx = center.x + offsetX, cy = center.y + offsetY, r = cellW * 0.22;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = cellW * 0.1; ctx.shadowOffsetY = cellW * 0.05;
      ctx.beginPath(); ctx.arc(cx, cy, r + cellW * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#ffffff'; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      const img = avatarImagesRef.current[p.user_id];
      if (img?.complete && img?.naturalWidth > 0) {
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = p.color || '#334155'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#ffffff'; ctx.font = `bold ${r * 0.9}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((p.name || 'U')[0].toUpperCase(), cx, cy + cellW * 0.03);
      }
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
          room_id: roomId, created_by: user.id, max_players: maxPlayers,
          entry_cost: entryCost, track_length: TRACK_LENGTH, status: 'waiting',
          team_mode: maxPlayers === 4 && teamMode,
        })
        .select().single();
      if (error) throw error;
      setCurrentSession(data); setPlayers([]);
    } catch (err) { alert(err.message || 'Failed to create game'); }
    finally { setCreating(false); }
  };

  const resignSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setResigning(true);
    try {
      const { data, error } = await supabase.rpc('resign_race_game', {
        p_session_id: currentSession.id, p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to resign');
      onCoinsUpdated?.();
      setShowSettingsMenu(false);
      if (data.game_ended && !data.winner_id) {
        setCurrentSession(null); setPlayers([]);
      }
    } catch (err) { alert(err.message || 'Failed to resign'); }
    finally { setResigning(false); }
  };

  const joinSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (userCoins < currentSession.entry_cost) { alert(`Need ${currentSession.entry_cost} coins to join`); return; }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_race_session', { p_session_id: currentSession.id, p_user_id: user.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to join');
      onCoinsUpdated?.(); await loadPlayers(currentSession.id);
    } catch (err) { alert(err.message || 'Failed to join'); }
    finally { setJoining(false); }
  };

  const leaveSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { data, error } = await supabase.rpc('leave_race_session', { p_session_id: currentSession.id, p_user_id: user.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to leave');
      onCoinsUpdated?.(); await loadPlayers(currentSession.id);
    } catch (err) { alert(err.message || 'Failed to leave'); }
    finally { setLeaving(false); }
  };

  const startGame = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (players.length < 2) { alert('Need at least 2 players'); return; }
    const { error } = await supabase.from('room_race_sessions')
      .update({ status: 'playing', started_at: new Date().toISOString(), current_turn_user_id: players[0].user_id })
      .eq('id', currentSession.id);
    if (error) alert(error.message);
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (!window.confirm('Cancel game? All players will be refunded.')) return;
    try {
      const { data, error } = await supabase.rpc('cancel_race_session', { p_session_id: currentSession.id, p_user_id: user.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      onCoinsUpdated?.(); setCurrentSession(null); setPlayers([]);
    } catch (err) { alert(err.message || 'Failed to cancel'); }
  };

  const animateSteps = (playerId, fromPos, toPos, finalPos, specialEventType, callback) => {
    if (animationRef.current) clearTimeout(animationRef.current);
    setAnimatingPlayer(playerId);
    let currentPos = fromPos;
    const step = () => {
      if (currentPos >= toPos) {
        if (finalPos !== toPos) {
          setTimeout(() => {
            setPlayers(prev => prev.map(p =>
              String(p.user_id) === String(playerId) ? { ...p, position: finalPos } : p
            ));
            channelRef.current?.send({ type: 'broadcast', event: 'player_move', payload: { userId: playerId, position: finalPos, isJump: true, isDone: false } });
            setAnimatingPlayer(null);
            // Play ladder or snake sound
            if (specialEventType === 'ladder') playSound('ladder');
            else if (specialEventType === 'snake') playSound('snake');
            setTimeout(() => {
              channelRef.current?.send({ type: 'broadcast', event: 'player_move', payload: { userId: playerId, position: finalPos, isJump: false, isDone: true } });
              callback?.();
            }, 400);
          }, 400);
        } else {
          setAnimatingPlayer(null);
          channelRef.current?.send({ type: 'broadcast', event: 'player_move', payload: { userId: playerId, position: finalPos, isJump: false, isDone: true } });
          callback?.();
        }
        return;
      }
      currentPos += 1;
      setPlayers(prev => prev.map(p =>
        String(p.user_id) === String(playerId) ? { ...p, position: currentPos } : p
      ));
      channelRef.current?.send({ type: 'broadcast', event: 'player_move', payload: { userId: playerId, position: currentPos, isJump: false, isDone: false } });
      playSound('move');
      animationRef.current = setTimeout(step, 500);
    };
    step();
  };

  const rollDice = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (String(currentSession.current_turn_user_id) !== String(user.id)) { alert("It's not your turn!"); return; }
    if (rolling) return;
    setRolling(true); setAnyoneMoving(true); setDiceAnimating(true);
    const myPlayer = players.find(p => String(p.user_id) === String(user.id));
    const myColor = myPlayer?.color || '#ffffff';
    channelRef.current?.send({ type: 'broadcast', event: 'dice_roll', payload: { userId: user.id, roll: 0, color: myColor } });
    let count = 0;
    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6));
      count++;
      if (count > 8) { clearInterval(interval); setDiceAnimating(false); }
    }, 80);
    playSound('roll');
    try {
      const { data, error } = await supabase.rpc('roll_race_dice', { p_session_id: currentSession.id, p_user_id: user.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to roll');
      channelRef.current?.send({ type: 'broadcast', event: 'dice_roll', payload: { userId: user.id, roll: data.roll, color: myColor } });
      const fromPos = myPlayer?.position || 0;
      setLastRoll(data.roll);
      setAllDiceRolls(prev => ({ ...prev, [user.id]: { roll: data.roll, color: myColor, animating: false } }));

      // Detect special event type for sound
      const specialType = data.special_event?.includes('ladder') ? 'ladder'
        : data.special_event?.includes('snake') ? 'snake' : null;

      setTimeout(() => {
        setDiceDisplay(null);
        animateSteps(user.id, fromPos, data.new_position, data.final_position, specialType, async () => {
          setAnyoneMoving(false);
          if (data.special_event) { setSpecialEvent(data.special_event); setTimeout(() => setSpecialEvent(null), 2500); }
          onCoinsUpdated?.();
          await loadPlayers(currentSession.id);
          const { data: sessionData } = await supabase.from('room_race_sessions').select('*').eq('id', currentSession.id).single();
          if (sessionData) setCurrentSession(sessionData);
        });
      }, 800);
    } catch (err) { alert(err.message || 'Failed to roll'); }
    finally { setRolling(false); }
  };

  const isJoined  = players.some(p => String(p.user_id) === String(user?.id));
  const isFull    = players.length >= (currentSession?.max_players || 0);
  const isMyTurn  = String(currentSession?.current_turn_user_id) === String(user?.id);
  const netPrize  = Math.floor((currentSession?.entry_cost || 0) * players.length * 0.9);

  const renderPlayer = (p) => {
    const progressPct = (p.position / TRACK_LENGTH) * 100;
    const isCurrentTurn = String(currentSession?.current_turn_user_id) === String(p.user_id) && currentSession?.status === 'playing';
    const playerLastRoll = playersLastRoll[p.user_id];
    return (
      <div key={p.id} className={`relative overflow-hidden flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${isCurrentTurn ? 'bg-white/10 border border-white/20 shadow-md' : 'bg-white/5 border border-transparent'}`}>
        <div className="absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: p.color }} />
        <div className="relative shrink-0">
          <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name} className="w-7 h-7 rounded-full object-cover border border-white/20" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900" style={{ backgroundColor: p.color }} />
        </div>
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-1">
            <span className="text-white text-[10px] font-bold truncate">{p.name}</span>
            {String(p.user_id) === String(user?.id) && <span className="text-amber-300 text-[8px] shrink-0">(You)</span>}
            {p.team_key && (
              <span className={`text-[8px] font-black px-1 py-[1px] rounded-full shrink-0 ${p.team_key === 'A' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-violet-500/30 text-violet-200'}`}>
                {p.team_key}
              </span>
            )}
          </div>
          <div className="text-white/60 text-[9px] font-bold leading-tight">{p.position}/{TRACK_LENGTH}</div>
        </div>
        {(() => {
          const uid = p.user_id;
          const diceData = allDiceRolls[uid];
          const isAnimating = allDiceAnimating[uid] || false;
          const isMe = String(uid) === String(user?.id);
          const canRoll = isMyTurn && isMe && currentSession?.status === 'playing' && !rolling && !anyoneMoving;
          if (!diceData && !isCurrentTurn) return null;
          const num = Math.min(diceData?.roll || 1, 6);
          const dotPositions = {
            1:[[50,50]], 2:[[25,25],[75,75]], 3:[[25,25],[50,50],[75,75]],
            4:[[25,25],[75,25],[25,75],[75,75]], 5:[[25,25],[75,25],[50,50],[25,75],[75,75]],
            6:[[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
          };
          const dots = dotPositions[num] || dotPositions[1];
          return (
            <div onClick={canRoll ? rollDice : undefined}
              className={`relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-b-4 border-r-2 z-10 ${canRoll ? 'cursor-pointer active:scale-90 active:border-b-2 active:translate-y-0.5' : 'cursor-default opacity-80'} ${isAnimating ? 'animate-spin' : canRoll ? 'animate-bounce' : ''}`}
              style={{ background: 'linear-gradient(135deg, #ffffff, #e2e8f0)', borderColor: p.color || '#ffffff', boxShadow: canRoll ? `0 4px 12px rgba(0,0,0,0.4), 0 0 15px ${p.color || '#fff'}66` : '0 4px 8px rgba(0,0,0,0.3)' }}>
              {diceData ? dots.map(([dx, dy], di) => (
                <div key={di} className="absolute w-1.5 h-1.5 rounded-full"
                  style={{ left: `${dx}%`, top: `${dy}%`, transform: 'translate(-50%,-50%)', backgroundColor: p.color || '#1e293b' }} />
              )) : <span className="text-base">🎲</span>}
              {canRoll && !isAnimating && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />}
            </div>
          );
        })()}
        {playerLastRoll && currentSession?.status === 'playing' && (
          <span className="text-[9px] text-white/50 font-bold shrink-0">🎲{playerLastRoll}</span>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center" onClick={() => { setShowSettingsMenu(false); onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-12 h-1.5 rounded-full bg-white/20" /></div>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎲</span>
            <span className="font-bold text-white text-lg">Race Game</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-amber-300 font-black text-sm">{(userCoins || 0).toLocaleString()}</span>
            </div>
            {/* ── Settings with mute button ──────────────────────────────── */}
            {currentSession && (
              <div className="relative">
                <button onClick={() => setShowSettingsMenu(v => !v)} className="text-white/50 hover:text-white p-0.5">
                  <Settings className="w-5 h-5" />
                </button>
                {showSettingsMenu && (
                  <div className="absolute right-0 top-7 z-50 bg-slate-800 border border-white/10 rounded-xl shadow-xl min-w-[160px] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSoundMuted(v => !v)} className="w-full text-left px-4 py-2.5 text-white font-bold text-sm hover:bg-white/10 transition flex items-center gap-2">
                      {soundMuted ? '🔇' : '🔊'} {soundMuted ? 'Unmute' : 'Mute'} Sound
                    </button>
                    {currentSession?.status === 'playing' && isJoined && (
                      <button onClick={resignSession} disabled={resigning} className="w-full text-left px-4 py-2.5 text-amber-300 font-bold text-sm hover:bg-amber-500/10 transition">
                        {resigning ? '...' : '🚪 Resign Game'}
                      </button>
                    )}
                    {canModerate && (currentSession?.status === 'waiting' || currentSession?.status === 'playing') && (
                      <button onClick={() => { setShowSettingsMenu(false); cancelSession(); }} className="w-full text-left px-4 py-2.5 text-rose-400 font-bold text-sm hover:bg-rose-500/10 transition">
                        🚫 Cancel Game
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
          ) : showResult && winner ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl animate-bounce drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">🏆</div>
              <div className="text-white font-black text-3xl tracking-wide">WINNER!</div>
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20" />
                <img src={winner.avatar_url || FALLBACK_AVATAR} alt={winner.name} className="relative w-24 h-24 rounded-full border-4 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.8)] object-cover" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
              </div>
              <div className="text-amber-300 font-black text-2xl drop-shadow-lg text-center">{winner.name}</div>
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl px-6 py-3 text-center shadow-xl backdrop-blur-sm">
                <div className="text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">Prize Won</div>
                <div className="text-amber-400 text-3xl font-black drop-shadow-md">🪙 {winnerCoins.toLocaleString()}</div>
              </div>
            </div>
          ) : currentSession ? (
            <div className="flex flex-col gap-2">
              {/* Info bar */}
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-800/50 border border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Entry</div>
                  <div className="text-amber-400 font-black text-xs">
                    {currentSession.entry_cost === 0 ? '🆓 Free' : `🪙 ${currentSession.entry_cost.toLocaleString()}`}
                  </div>
                </div>
                <div className="w-px h-5 bg-white/10" />
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Players</div>
                  <div className="text-white font-black text-xs">{players.length}/{currentSession.max_players}</div>
                </div>
                <div className="w-px h-5 bg-white/10" />
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">Prize</div>
                  <div className="text-emerald-400 font-black text-xs">
                    {currentSession.entry_cost === 0 ? '🆓' : `🪙 ${netPrize.toLocaleString()}`}
                  </div>
                </div>
                <div className="w-px h-5 bg-white/10" />
                <div className="text-center">
                  <div className="text-white/50 text-[9px] uppercase tracking-wider font-bold">My Coins</div>
                  <div className={`font-black text-xs ${userCoins >= currentSession.entry_cost ? 'text-white' : 'text-rose-400'}`}>🪙 {(userCoins || 0).toLocaleString()}</div>
                </div>
              </div>

              {currentSession.status === 'playing' && (
                <div className={`text-center py-1.5 rounded-xl text-xs font-black shadow-sm transition-all ${isMyTurn ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white animate-pulse border border-emerald-400' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                  {isMyTurn ? '🎲 YOUR TURN! ROLL THE DICE!' : `⏳ Waiting for ${players.find(p => String(p.user_id) === String(currentSession.current_turn_user_id))?.name || 'Player'}...`}
                </div>
              )}

              <div className="bg-slate-900 rounded-xl p-2 overflow-hidden shadow-inner border border-white/5 flex justify-center">
                <canvas ref={canvasRef} width={800} height={800} className="w-full max-w-[400px] aspect-square rounded-lg shadow-md" />
              </div>

              {specialEvent && (
                <div className={`text-center py-1.5 px-3 rounded-xl font-black text-xs animate-bounce shadow-sm my-1 ${
                  specialEvent.includes('ladder') ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white border border-emerald-400'
                  : specialEvent.includes('snake') ? 'bg-gradient-to-r from-rose-500 to-red-400 text-white border border-rose-400'
                  : specialEvent.includes('overshoot') ? 'bg-gradient-to-r from-slate-600 to-slate-500 text-white border border-slate-400'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-400 text-white border border-purple-400'}`}>
                  {specialEvent.includes('ladder') && '🪜 Ladder! Jump forward!'}
                  {specialEvent.includes('snake') && '🐍 Snake! Slide back!'}
                  {specialEvent.includes('overshoot') && '🎲 Too high! Need exact number!'}
                  {specialEvent.includes('bump') && !specialEvent.includes('ladder') && !specialEvent.includes('snake') && !specialEvent.includes('overshoot') && '💥 Bumped opponent to start!'}
                </div>
              )}

              <div className={`grid gap-1.5 my-1 ${currentSession.status === 'playing' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {players.map(renderPlayer)}
              </div>

              <div className="flex flex-wrap gap-2 mt-1">
                {!isJoined && !isFull && currentSession.status === 'waiting' && (
                  <button onClick={joinSession} disabled={joining || userCoins < currentSession.entry_cost}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 text-white font-black text-xs disabled:opacity-50 shadow-md hover:shadow-lg transition active:scale-95 border border-amber-400">
                    {joining ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : currentSession.entry_cost === 0 ? 'Join Free 🆓' : `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`}
                  </button>
                )}
                {isJoined && currentSession.status === 'waiting' && (
                  <button onClick={leaveSession} disabled={leaving}
                    className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 font-bold text-xs bg-white/5 hover:bg-white/10 transition active:scale-95">
                    {leaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Leave & Refund'}
                  </button>
                )}
                {canModerate && currentSession.status === 'waiting' && (
                  <button onClick={startGame} disabled={players.length < 2}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-xs disabled:opacity-50 shadow-md hover:shadow-lg transition active:scale-95 border border-blue-400">
                    🚀 Start Race
                  </button>
                )}
              </div>
            </div>
          ) : canModerate ? (
            <div className="flex flex-col gap-4 py-2">
              <div className="text-center text-white/50 text-sm">No active race game. Create one!</div>
              <div>
                <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">👥 Number of Players</div>
                <div className="grid grid-cols-4 gap-2">
                  {MAX_PLAYERS_OPTIONS.map(n => (
                    <button key={n} onClick={() => { setMaxPlayers(n); if (n !== 4) setTeamMode(false); }}
                      className={`py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-sm ${maxPlayers === n ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border border-amber-400' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">🤝 Mode</div>
                <button
                  onClick={() => { if (maxPlayers !== 4) return; setTeamMode(v => !v); }}
                  disabled={maxPlayers !== 4}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs active:scale-95 transition ${
                    maxPlayers === 4
                      ? teamMode ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                  }`}>
                  Team 2v2 {teamMode ? 'ON' : 'OFF'}
                </button>
                {maxPlayers !== 4 && <div className="text-[10px] text-white/45 mt-1">Team mode available with 4 players only.</div>}
              </div>
              <div>
                <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">🪙 Entry Cost</div>
                <div className="grid grid-cols-4 gap-2">
                  {ENTRY_COST_OPTIONS.map(c => (
                    <button key={c} onClick={() => setEntryCost(c)}
                      className={`py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm ${entryCost === c ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border border-amber-400' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'}`}>
                      {c === 0 ? '🆓' : c >= 1000 ? (c/1000)+'k' : c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 text-center shadow-inner">
                <div className="text-amber-200/70 text-[10px] font-bold uppercase tracking-wider mb-1">
                  {entryCost === 0 ? 'Free to play' : 'Winner gets (after 10% fee)'}
                </div>
                <div className="text-amber-400 font-black text-2xl drop-shadow-md">
                  {entryCost === 0 ? '🆓 No entry cost' : `🪙 ${Math.floor(entryCost * maxPlayers * 0.9).toLocaleString()}`}
                </div>
              </div>
              <button onClick={createSession} disabled={creating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-sm shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition active:scale-95 disabled:opacity-50 border border-blue-400">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🎲 Create Race Game'}
              </button>
            </div>
          ) : (
            <div className="text-center text-white/40 py-12">
              <div className="text-5xl mb-3 opacity-50">🎲</div>
              <div className="text-base font-bold text-white/60">No active race game</div>
              <div className="text-xs mt-2">Wait for the host to start one</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}