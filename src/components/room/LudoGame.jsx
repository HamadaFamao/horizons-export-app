import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Settings } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const MAX_PLAYERS_OPTIONS = [2, 3, 4];
const ENTRY_COST_OPTIONS = [100, 200, 500, 1000, 5000, 10000];

// Player colors: Red (Bottom), Blue (Right), Yellow (Top), Green (Left)
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const PLAYER_LIGHT_COLORS = ['#fca5a5', '#93c5fd', '#fcd34d', '#86efac'];
const PLAYER_DARK_COLORS = ['#991b1b', '#1e40af', '#b45309', '#15803d'];

// Standard Ludo path: 52 cells (indices 0-51), [row, col]
const TRACK_CELLS = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];

// Safe squares: starred positions on track (includes start positions 0,13,26,39)
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

// Start position on track per color: Red=39, Blue=26, Yellow=13, Green=0
const START_POSITIONS = [39, 26, 13, 0];

// Home column cells per player (5 cells, positions 52-56 relative)
const HOME_COLUMNS = [
  [[13,7],[12,7],[11,7],[10,7],[9,7]], // 0: Red (Bottom)
  [[7,13],[7,12],[7,11],[7,10],[7,9]], // 1: Blue (Right)
  [[1,7],[2,7],[3,7],[4,7],[5,7]],     // 2: Yellow (Top)
  [[7,1],[7,2],[7,3],[7,4],[7,5]],     // 3: Green (Left)
];

// Home base positions (4 pieces per player in home corner) — decimal grid units
const HOME_BASES = [
  [[10.6,1.9],[10.6,4.1],[12.8,1.9],[12.8,4.1]],   // 0: Red (Bottom-Left)
  [[10.6,10.9],[10.6,13.1],[12.8,10.9],[12.8,13.1]], // 1: Blue (Bottom-Right)
  [[1.9,10.9],[1.9,13.1],[4.1,10.9],[4.1,13.1]],     // 2: Yellow (Top-Right)
  [[1.9,1.9],[1.9,4.1],[4.1,1.9],[4.1,4.1]],         // 3: Green (Top-Left)
];

const PIECE_STACK_OFFSETS = [
  [0, 0],
  [-8, -8],
  [8, -8],
  [-8, 8],
  [8, 8],
];

function getPieceStackOffset(index) {
  if (PIECE_STACK_OFFSETS[index]) return PIECE_STACK_OFFSETS[index];
  const overflowIndex = index - PIECE_STACK_OFFSETS.length;
  const angle = (overflowIndex / 6) * Math.PI * 2;
  const radius = 11 + Math.floor(overflowIndex / 6) * 4;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

// Visual seat layouts: maps seat order → color index for 2/3/4 players
const VISUAL_SEAT_LAYOUTS = {
  2: [0, 2],      // Red + Yellow (diagonal)
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
};

function getVisualSeatIndex(player, playersList) {
  const layout = VISUAL_SEAT_LAYOUTS[playersList.length] || [0, 1, 2, 3];
  const seatIdx = (player.seat_number || 1) - 1;
  return layout[Math.min(seatIdx, layout.length - 1)] ?? seatIdx;
}

export default function LudoGame({
  open,
  onClose,
  roomId,
  user,
  canModerate,
  userCoins,
  onCoinsUpdated,
  onLudoResult,
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
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [diceDisplay, setDiceDisplay] = useState(null);
  const [remoteDiceAnimating, setRemoteDiceAnimating] = useState(false);
  const [remoteDiceDisplay, setRemoteDiceDisplay] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [movablePieces, setMovablePieces] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [message, setMessage] = useState('');
  const [finishToast, setFinishToast] = useState('');
  const [recentFinishedUserId, setRecentFinishedUserId] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const canvasRef = useRef(null);
  const channelRef = useRef(null);
  const resultFiredRef = useRef(false);
  const lastSeenRollRef = useRef(null);
  const avatarImagesRef = useRef({});
  const finishFxTimerRef = useRef(null);
  const turnTimerRef = useRef(null);
  const autoActionStateRef = useRef({});
  const [turnTimeLeft, setTurnTimeLeft] = useState(12);

  useEffect(() => {
    return () => {
      if (finishFxTimerRef.current) clearTimeout(finishFxTimerRef.current);
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  useEffect(() => {
    if (!currentSession?.id) return;

    const roll = Number(currentSession.display_roll || 0);
    const turnUserId = String(currentSession.current_turn_user_id || '');
    const displayRollUserId = String(currentSession.display_roll_user_id || '');

    if (roll < 1 || roll > 6 || !turnUserId || !displayRollUserId) {
      setRemoteDiceAnimating(false);
      return;
    }

    // Do not animate for the next player before they press roll.
    if (turnUserId !== displayRollUserId) {
      setRemoteDiceAnimating(false);
      return;
    }

    const key = `${displayRollUserId}-${roll}-${currentSession.last_roll || 0}`;

    if (lastSeenRollRef.current === key) return;
    lastSeenRollRef.current = key;

    const isLocalTurn =
      displayRollUserId === String(user?.id);

    if (isLocalTurn) return;

    setRemoteDiceAnimating(true);

    let count = 0;
    const interval = setInterval(() => {
      setRemoteDiceDisplay(Math.floor(Math.random() * 6) + 1);
      count++;

      if (count >= 16) {
        clearInterval(interval);
        setRemoteDiceDisplay(roll);
        setRemoteDiceAnimating(false);
      }
    }, 90);

    return () => clearInterval(interval);
  }, [
    currentSession?.id,
    currentSession?.display_roll,
    currentSession?.current_turn_user_id,
    currentSession?.last_roll,
    user?.id,
  ]);

  // ─── Turn countdown timer ────────────────────
  useEffect(() => {
    const isMine =
      String(currentSession?.current_turn_user_id) === String(user?.id);

    if (!isMine || currentSession?.status !== 'playing' || !open) {
      setTurnTimeLeft(12);
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      return;
    }

    // Reset timer for this new turn/roll state
    setTurnTimeLeft(12);
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);

    let remaining = 12;
    // Local flag per effect instance — resets automatically when deps change
    let actionFired = false;

    turnTimerRef.current = setInterval(() => {
      remaining -= 1;
      setTurnTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
        if (actionFired) return;
        actionFired = true;

        const {
          sessionLastRoll: slr,
          movablePieces: mp,
          rolling: r,
          rollDice: rd,
          handlePieceSelect: hps,
        } = autoActionStateRef.current;

        if (!slr && !r) {
          rd();
        } else if (slr > 0 && mp && mp.length > 0) {
          hps(mp[0]);
        }
      }
    }, 1000);

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  }, [currentSession?.id, currentSession?.current_turn_user_id, currentSession?.last_roll, currentSession?.status, open]);

  // Realtime
  useEffect(() => {
    if (!open || !roomId) return;

    const channel = supabase
      .channel(`ludo_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_ludo_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const s = payload.new;
        if (s?.status === 'finished') {
          if (resultFiredRef.current) return;
          resultFiredRef.current = true;
          setCurrentSession(s);
          loadPlayers(s.id).then(ps => {
            const w = ps.find(p =>
              String(p.user_id) === String(s.winner_id)
            );
            if (w) {
              setWinner(w);
              setWinnerCoins(s.winner_coins || 0);
              setShowResult(true);
              if (String(s.winner_id) === String(user?.id)) {
                onLudoResult?.({
                  winnerName: w.name,
                  winnerAvatar: w.avatar_url,
                  winnerId: w.user_id,
                  winnerCoins: s.winner_coins || 0,
                  totalPlayers: ps.length,
                });
              }
              setTimeout(() => {
                resultFiredRef.current = false;
                setCurrentSession(null);
                setPlayers([]);
                setShowResult(false);
                setWinner(null);
                setLastRoll(null);
                setMovablePieces([]);
              }, 6000);
            }
          });
        } else {
          setCurrentSession(s);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_ludo_players',
      }, () => {
        if (currentSession?.id) loadPlayers(currentSession.id);
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [open, roomId, currentSession?.id]);

  // Draw board
  useEffect(() => {
    if (!canvasRef.current || !currentSession) return;
    drawBoard();
  }, [players, currentSession]);

  // Preload avatars
  useEffect(() => {
    players.forEach(p => {
      if (p.avatar_url && !avatarImagesRef.current[p.user_id]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          avatarImagesRef.current[p.user_id] = img;
          drawBoard();
        };
        img.src = p.avatar_url;
        avatarImagesRef.current[p.user_id] = img;
      }
    });
  }, [players]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_ludo_sessions')
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
      .from('room_ludo_players')
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

  const getRelativeVisualSeat = (player, playersList = players) => {
    const totalPlayers = playersList.length;
    if (!totalPlayers) return 0;

    const layout = VISUAL_SEAT_LAYOUTS[totalPlayers] || [0, 1, 2, 3];
    const sortedBySeat = [...playersList].sort((a, b) => a.seat_number - b.seat_number);
    const myPlayerInGame = sortedBySeat.find(
      p => String(p.user_id) === String(user?.id)
    );

    const myBaseIndex = myPlayerInGame
      ? sortedBySeat.findIndex(p => String(p.user_id) === String(myPlayerInGame.user_id))
      : 0;
    const playerIndex = sortedBySeat.findIndex(p => String(p.user_id) === String(player.user_id));
    const relativeIndex = ((playerIndex - myBaseIndex) % totalPlayers + totalPlayers) % totalPlayers;

    return layout[relativeIndex] ?? 0;
  };

  const getPlayerColorIndex = (player, playersList = players) => {
    const totalPlayers = Number(currentSession?.max_players || playersList.length || 4);
    const layout = VISUAL_SEAT_LAYOUTS[totalPlayers] || [0, 1, 2, 3];
    const seatIdx = Math.max(0, Number(player?.seat_number || 1) - 1);
    return layout[seatIdx] ?? seatIdx;
  };

  const getPieceCanvasPosition = (player, pieceIndex, cellSize, playersList = players) => {
    const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
    const pos = pieces[pieceIndex];
    if (typeof pos !== 'number') return null;

    const colorIdx = getRelativeVisualSeat(player, playersList);
    const finishedOffsets = [
      [8.2, 7.5],
      [7.5, 8.2],
      [6.8, 7.5],
      [7.5, 6.8],
    ];

    if (pos === 57) {
      const [row, col] = finishedOffsets[colorIdx] || [7.5, 7.5];
      return {
        x: col * cellSize,
        y: row * cellSize,
        colorIdx,
        isFinished: true,
      };
    }

    if (pos === -1) {
      const homeBase = HOME_BASES[colorIdx];
      if (!homeBase || !homeBase[pieceIndex]) return null;
      const [baseRow, baseCol] = homeBase[pieceIndex];
      // Coordinates are already decimal-centered — multiply directly by cellSize
      return {
        x: baseCol * cellSize,
        y: baseRow * cellSize,
        colorIdx,
        isFinished: false,
      };
    }

    if (pos >= 0 && pos <= 51) {
      const adjustedPos = (pos + START_POSITIONS[colorIdx]) % 52;
      if (!TRACK_CELLS[adjustedPos]) return null;
      const [row, col] = TRACK_CELLS[adjustedPos];
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2,
        colorIdx,
        isFinished: false,
      };
    }

    if (pos >= 52 && pos <= 56) {
      const homeColIdx = pos - 52;
      const homeCol = HOME_COLUMNS[colorIdx];
      if (!homeCol || !homeCol[homeColIdx]) return null;
      const [row, col] = homeCol[homeColIdx];
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2,
        colorIdx,
        isFinished: false,
      };
    }

    return null;
  };

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const CELLS = 15;
    const cellSize = W / CELLS;

    // Helper to map visual index to real player color
    const getVisualColorIndex = (visualIdx) => {
      const playerAtVisual = players.find(p =>
        getRelativeVisualSeat(p, players) === visualIdx
      );
      return playerAtVisual ? getPlayerColorIndex(playerAtVisual, players) : visualIdx;
    };

    ctx.clearRect(0, 0, W, W);

    // Background with radial gradient
    const bgGrad = ctx.createRadialGradient(W/2, W/2, 0, W/2, W/2, W);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, W);

    // Draw home bases (corners)
    const homeColors = [
      { bg: '#fca5a5', border: '#ef4444', grad1: '#f87171', grad2: '#dc2626' }, // 0: Red
      { bg: '#93c5fd', border: '#3b82f6', grad1: '#60a5fa', grad2: '#2563eb' }, // 1: Blue
      { bg: '#fcd34d', border: '#f59e0b', grad1: '#fbbf24', grad2: '#d97706' }, // 2: Yellow
      { bg: '#86efac', border: '#22c55e', grad1: '#4ade80', grad2: '#16a34a' }, // 3: Green
    ];

    const homeRects = [
      { r: 9, c: 0, w: 6, h: 6 },   // 0: Red (Bottom-Left)
      { r: 9, c: 9, w: 6, h: 6 },   // 1: Blue (Bottom-Right)
      { r: 0, c: 9, w: 6, h: 6 },   // 2: Yellow (Top-Right)
      { r: 0, c: 0, w: 6, h: 6 },   // 3: Green (Top-Left)
    ];

    homeRects.forEach((rect, i) => {
      const realColorIdx = getVisualColorIndex(i);
      const x = rect.c * cellSize;
      const y = rect.r * cellSize;
      const w = rect.w * cellSize;
      const h = rect.h * cellSize;

      // Outer border with shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = homeColors[realColorIdx].border;
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      // Inner area with gradient
      const innerGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      innerGrad.addColorStop(0, homeColors[realColorIdx].grad1);
      innerGrad.addColorStop(1, homeColors[realColorIdx].grad2);
      
      ctx.fillStyle = innerGrad;
      ctx.fillRect(
        x + cellSize * 0.5, y + cellSize * 0.5,
        w - cellSize, h - cellSize
      );

      // Inner home circle with glow
      const cx = x + w / 2;
      const cy = y + h / 2;
      
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      
      // Add a subtle inner shadow/glow to the circle
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw track cells
    for (let i = 0; i < TRACK_CELLS.length; i++) {
      const [row, col] = TRACK_CELLS[i];
      const x = col * cellSize;
      const y = row * cellSize;

      let cellColor = '#f8fafc';
      let isStart = false;
      const startIndices = [39, 26, 13, 0]; // Red, Blue, Yellow, Green
      const startIdx = startIndices.indexOf(i);
      
      if (startIdx !== -1) {
        const realColorIdx = getVisualColorIndex(startIdx);
        cellColor = homeColors[realColorIdx].grad1;
        isStart = true;
      } else if (SAFE_SQUARES.includes(i)) {
        cellColor = '#e2e8f0';
      }

      // Cell background
      ctx.fillStyle = cellColor;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      
      // Subtle 3D bevel effect for cells
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 1, y + 1, cellSize - 2, 2); // top highlight
      ctx.fillRect(x + 1, y + 1, 2, cellSize - 2); // left highlight
      
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + 1, y + cellSize - 3, cellSize - 2, 2); // bottom shadow
      ctx.fillRect(x + cellSize - 3, y + 1, 2, cellSize - 2); // right shadow

      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Star on non-start safe squares
      if (SAFE_SQUARES.includes(i) && !isStart) {
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#fbbf24';
        ctx.font = `${cellSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', x + cellSize / 2, y + cellSize / 2 + 1);
        ctx.restore();
      }
    }

    // Draw home columns
    HOME_COLUMNS.forEach((col, playerIdx) => {
      const realColorIdx = getVisualColorIndex(playerIdx);
      col.forEach(([row, c]) => {
        const x = c * cellSize;
        const y = row * cellSize;
        
        const grad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        grad.addColorStop(0, homeColors[realColorIdx].grad1 + '80');
        grad.addColorStop(1, homeColors[realColorIdx].grad2 + '80');
        
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        
        ctx.strokeStyle = homeColors[realColorIdx].border + '60';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      });
    });

    // Draw arrows
    const arrows = [
      { r: 14, c: 7, colorIdx: 0, dir: 'up' },
      { r: 7, c: 14, colorIdx: 1, dir: 'left' },
      { r: 0, c: 7, colorIdx: 2, dir: 'down' },
      { r: 7, c: 0, colorIdx: 3, dir: 'right' },
    ];
    arrows.forEach(({ r, c, colorIdx, dir }) => {
      const realColorIdx = getVisualColorIndex(colorIdx);
      const color = PLAYER_COLORS[realColorIdx];
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      const s = cellSize * 0.15;
      const l = cellSize * 0.35;
      if (dir === 'up') {
        ctx.moveTo(cx, cy - l);
        ctx.lineTo(cx - s*2, cy);
        ctx.lineTo(cx - s, cy);
        ctx.lineTo(cx - s, cy + l);
        ctx.lineTo(cx + s, cy + l);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx + s*2, cy);
      } else if (dir === 'down') {
        ctx.moveTo(cx, cy + l);
        ctx.lineTo(cx - s*2, cy);
        ctx.lineTo(cx - s, cy);
        ctx.lineTo(cx - s, cy - l);
        ctx.lineTo(cx + s, cy - l);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx + s*2, cy);
      } else if (dir === 'left') {
        ctx.moveTo(cx - l, cy);
        ctx.lineTo(cx, cy - s*2);
        ctx.lineTo(cx, cy - s);
        ctx.lineTo(cx + l, cy - s);
        ctx.lineTo(cx + l, cy + s);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx, cy + s*2);
      } else if (dir === 'right') {
        ctx.moveTo(cx + l, cy);
        ctx.lineTo(cx, cy - s*2);
        ctx.lineTo(cx, cy - s);
        ctx.lineTo(cx - l, cy - s);
        ctx.lineTo(cx - l, cy + s);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx, cy + s*2);
      }
      ctx.fill();
      ctx.restore();
    });

    // Center finishing square
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6 * cellSize, 6 * cellSize, 3 * cellSize, 3 * cellSize);
    
    // Draw triangle in center for each color
    const triPoints = [
      [[9,6],[9,9],[7.5,7.5]],   // 0: bottom
      [[6,9],[9,9],[7.5,7.5]],   // 1: right
      [[6,6],[6,9],[7.5,7.5]],   // 2: top
      [[6,6],[9,6],[7.5,7.5]],   // 3: left
    ];
    triPoints.forEach((pts, i) => {
      const realColorIdx = getVisualColorIndex(i);
      ctx.beginPath();
      ctx.moveTo(pts[0][1] * cellSize, pts[0][0] * cellSize);
      ctx.lineTo(pts[1][1] * cellSize, pts[1][0] * cellSize);
      ctx.lineTo(pts[2][1] * cellSize, pts[2][0] * cellSize);
      ctx.closePath();
      
      const triColor = PLAYER_COLORS[realColorIdx];
      const grad = ctx.createLinearGradient(
        pts[0][1] * cellSize, pts[0][0] * cellSize,
        pts[2][1] * cellSize, pts[2][0] * cellSize
      );
      grad.addColorStop(0, triColor + 'ee');
      grad.addColorStop(1, triColor + '66');
      
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw pieces on board
    const drawablePieces = [];
    players.forEach((player) => {
      const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
      pieces.forEach((pos, pieceIdx) => {
        const piecePos = getPieceCanvasPosition(player, pieceIdx, cellSize, players);
        if (!piecePos || piecePos.isFinished) return;
        drawablePieces.push({ player, pieceIdx, piecePos });
      });
    });

    const stackedByCell = new Map();
    drawablePieces.forEach((item) => {
      const key = `${Math.round(item.piecePos.x)}_${Math.round(item.piecePos.y)}`;
      if (!stackedByCell.has(key)) stackedByCell.set(key, []);
      stackedByCell.get(key).push(item);
    });

    stackedByCell.forEach((cellPieces) => {
      cellPieces.forEach((item, stackIndex) => {
        const { player, pieceIdx, piecePos } = item;
        const { x, y, colorIdx } = piecePos;
        const [offX, offY] = getPieceStackOffset(stackIndex);
        const px = x + offX;
        const py = y + offY;

        // Slightly bigger radius while keeping board proportions intact
        const r = cellSize * 0.45;
        const isMyPiece = String(player.user_id) === String(user?.id);
        const isMovable = isMyPiece && movablePieces.includes(pieceIdx + 1);
        const isSelected = isMyPiece && selectedPiece === pieceIdx + 1;

        ctx.save();

        // Glow for movable pieces
        if (isMovable || isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, r + 6, 0, Math.PI * 2);
          ctx.shadowColor = isSelected ? '#ffffff' : PLAYER_COLORS[colorIdx];
          ctx.shadowBlur = 15;
          ctx.fillStyle = isSelected
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(255,255,255,0.4)';
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }

        // Piece shadow
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;

        // Avatar or colored circle
        const img = avatarImagesRef.current[player.user_id];
        if (img?.complete && img?.naturalWidth > 0) {
          // Draw avatar
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.closePath();
          
          // Fill background just in case image has transparency
          ctx.fillStyle = PLAYER_COLORS[colorIdx];
          ctx.fill();

          ctx.save();
          ctx.clip();
          ctx.drawImage(img, px - r, py - r, r * 2, r * 2);
          ctx.restore();
        } else {
          // Fallback piece
          const pieceGrad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
          pieceGrad.addColorStop(0, homeColors[colorIdx].grad1);
          pieceGrad.addColorStop(1, homeColors[colorIdx].grad2);
          
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = pieceGrad;
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.font = `bold ${r}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2;
          ctx.fillText(pieceIdx + 1, px, py + 1);
        }

        // Reset shadow for borders and gloss
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Professional border
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(px, py, r - 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PLAYER_COLORS[colorIdx];
        ctx.stroke();

        // Glossy reflection overlay
        ctx.beginPath();
        ctx.arc(px, py - r * 0.3, r * 0.6, 0, Math.PI * 2);
        const glossGrad = ctx.createLinearGradient(px, py - r, px, py);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.fill();

        ctx.restore();
      });
    });
  };

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const DICE_REVEAL_DELAY = 1400;

  const getLogicalNextPos = (pos, roll) => {
    if (pos === 57) return null;

    if (pos === -1) {
      return roll === 6 ? 0 : null;
    }

    if (pos >= 0 && pos <= 51) {
      const target = pos + roll;
      if (target <= 51) return target;
      if (target <= 57) return 52 + (target - 52);
      return null;
    }

    if (pos >= 52 && pos <= 56) {
      const target = pos + roll;
      if (target <= 56) return target;
      if (target === 57) return 57;
      return null;
    }

    return null;
  };

  const getMovablePieces = (player, roll) => {
    const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
    const movable = [];

    pieces.forEach((pos, idx) => {
      if (pos === 57) return;
      const nextPos = getLogicalNextPos(pos, roll);
      if (nextPos !== null && nextPos <= 57) movable.push(idx + 1);
    });

    return movable;
  };

  // ─── DICE ROLL ───────────────────────────────
  const rollDice = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (!isMyTurn || rolling) return;

    setRolling(true);
    setDiceAnimating(true);
    setMovablePieces([]);
    setSelectedPiece(null);
    setMessage('');

    let tick = 0;
    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6) + 1);
      tick++;
    }, 80);

    try {
      await new Promise((resolve) => setTimeout(resolve, 850));
      clearInterval(interval);

      const { data, error } = await supabase.rpc('get_ludo_roll', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to roll');

      const roll = Number(data.roll || 0);

      setDiceAnimating(false);
      setDiceDisplay(roll);
      setLastRoll(roll);

      if (typeof data.consecutive_sixes === 'number') {
        setConsecutiveSixes(data.consecutive_sixes);
      }

      if (data.triple_six) {
        setMessage('🚫 Three 6s! Turn lost.');
        setTimeout(() => setMessage(''), 2000);
        await wait(DICE_REVEAL_DELAY);
        await refreshSession();
        return;
      }

      if (data.turn_passed) {
        setMessage(data.all_in_home ? '🎲 Need 6 to start. Turn passed.' : 'Turn passed.');
        setTimeout(() => setMessage(''), 2000);
        await wait(DICE_REVEAL_DELAY);
        await refreshSession();
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 700));

      const refreshed = await refreshSession();
      const refreshedRoll = Number(refreshed?.session?.last_roll ?? roll ?? 0);
      const myPlayerNow = (refreshed?.players || []).find(
        p => String(p.user_id) === String(user.id)
      );

      if (!myPlayerNow) return;

      const movable = getMovablePieces(myPlayerNow, refreshedRoll);

      if (movable.length === 0) {
        setMessage('No valid move. Turn passed.');
        setTimeout(() => setMessage(''), 1700);
        await wait(DICE_REVEAL_DELAY);
        return;
      }

      if (movable.length === 1) {
        await wait(DICE_REVEAL_DELAY);
        await movePiece(movable[0]);
        return;
      }

      setMovablePieces(movable);
      setMessage('Tap a highlighted piece to move.');
    } catch (err) {
      clearInterval(interval);
      setDiceAnimating(false);
      alert(err.message || 'Failed to roll');
    } finally {
      clearInterval(interval);
      setRolling(false);
    }
  };

  const refreshSession = async () => {
    const refreshedPlayers = await loadPlayers(currentSession.id);
    const { data: sd } = await supabase
      .from('room_ludo_sessions')
      .select('*')
      .eq('id', currentSession.id)
      .single();
    if (sd) setCurrentSession(sd);
    return { players: refreshedPlayers || [], session: sd || null };
  };

  const passTurnToNextPlayer = async () => {
    if (!currentSession?.id) {
      await refreshSession();
      return;
    }

    const sorted = [...players].sort((a, b) => a.seat_number - b.seat_number);
    if (sorted.length < 2) {
      await refreshSession();
      return;
    }

    const currentTurnUserId = currentSession.current_turn_user_id || user?.id;
    const currentIdx = sorted.findIndex(
      p => String(p.user_id) === String(currentTurnUserId)
    );
    const baseIdx = currentIdx >= 0 ? currentIdx : sorted.findIndex(
      p => String(p.user_id) === String(user?.id)
    );

    if (baseIdx < 0) {
      await refreshSession();
      return;
    }

    const nextPlayer = sorted[(baseIdx + 1) % sorted.length];
    if (!nextPlayer?.user_id) {
      await refreshSession();
      return;
    }

    if (String(nextPlayer.user_id) === String(currentTurnUserId)) {
      await refreshSession();
      return;
    }

    const { error } = await supabase
      .from('room_ludo_sessions')
      .update({
        current_turn_user_id: nextPlayer.user_id,
      })
      .eq('id', currentSession.id)
      .eq('status', 'playing')
      .eq('current_turn_user_id', currentTurnUserId);

    if (error) {
      await refreshSession();
      return;
    }

    setCurrentSession(prev => (
      prev
        ? { ...prev, current_turn_user_id: nextPlayer.user_id }
        : prev
    ));
    await refreshSession();
  };

  // ─── MOVE PIECE ──────────────────────────────
  const movePiece = async (pieceNumber) => {
    if (!currentSession?.id || !user?.id) return;

    const myPlayerBefore = players.find(
      p => String(p.user_id) === String(user.id)
    );
    const beforeFinished = Number(myPlayerBefore?.pieces_finished || 0);

    try {
      const { data, error } = await supabase.rpc('move_ludo_piece', {
  p_session_id: currentSession.id,
  p_user_id: user.id,
  p_piece_number: pieceNumber,
});

if (error) throw error;
if (!data?.success) throw new Error(data?.error || 'Failed to move');

      setMovablePieces([]);
      setSelectedPiece(null);

  // UI-only feedback from server result; no local capture/home mutation here.
      if (data.bumped) {
        setMessage('💥 You sent an opponent home!');
        setTimeout(() => setMessage(''), 1800);
      } else if (data.extra_turn) {
        setMessage('🎲 Rolled 6! Play again!');
        setTimeout(() => setMessage(''), 1800);
      } else {
        setMessage('');
      }

      onCoinsUpdated?.();
      const refreshed = await refreshSession();
      const myPlayerAfter = (refreshed.players || []).find(
        p => String(p.user_id) === String(user.id)
      );
      const afterFinished = Number(
        myPlayerAfter?.pieces_finished ?? data?.pieces_finished ?? beforeFinished
      );

      if (afterFinished > beforeFinished) {
        setFinishToast('🎉 Piece finished!');
        setMessage('🎉 Piece finished!');
        setRecentFinishedUserId(String(user.id));

        if (finishFxTimerRef.current) clearTimeout(finishFxTimerRef.current);
        finishFxTimerRef.current = setTimeout(() => {
          setFinishToast('');
          setRecentFinishedUserId(null);
          setMessage('');
        }, 1800);
      }
    } catch (err) {
      alert(err.message || 'Failed to move piece');
    }
  };
  const handlePieceSelect = async (pieceNumber) => {
    if (!movablePieces.includes(pieceNumber)) return;
    setSelectedPiece(pieceNumber);
    await movePiece(pieceNumber);
  };

  const handleCanvasClick = (e) => {
    if (!isMyTurn || rolling) return;
    if (!movablePieces.length) return;

    const myPlayerLocal = players.find(
      p => String(p.user_id) === String(user?.id)
    );
    if (!myPlayerLocal) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cellSize = canvas.width / 15;
    const hitRadius = cellSize * 0.62;

    const stackedByCell = new Map();
    players.forEach((player) => {
      const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
      pieces.forEach((pos, pieceIdx) => {
        const piecePos = getPieceCanvasPosition(player, pieceIdx, cellSize, players);
        if (!piecePos || piecePos.isFinished) return;
        const key = `${Math.round(piecePos.x)}_${Math.round(piecePos.y)}`;
        if (!stackedByCell.has(key)) stackedByCell.set(key, []);
        stackedByCell.get(key).push({ player, pieceIdx, piecePos });
      });
    });

    const movablePieceOffsetMap = new Map();
    stackedByCell.forEach((cellPieces) => {
      cellPieces.forEach((item, stackIndex) => {
        if (String(item.player.user_id) !== String(user?.id)) return;
        if (!movablePieces.includes(item.pieceIdx + 1)) return;
        movablePieceOffsetMap.set(item.pieceIdx + 1, getPieceStackOffset(stackIndex));
      });
    });

    for (const pieceNum of movablePieces) {
      const piecePos = getPieceCanvasPosition(myPlayerLocal, pieceNum - 1, cellSize, players);
      if (!piecePos || piecePos.isFinished) continue;

      const [offX, offY] = movablePieceOffsetMap.get(pieceNum) || [0, 0];
      const px = piecePos.x + offX;
      const py = piecePos.y + offY;

      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        handlePieceSelect(pieceNum);
        return;
      }
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
      const { data, error } = await supabase.rpc('join_ludo_session', {
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
      const { data, error } = await supabase.rpc('leave_ludo_session', {
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
    await supabase
      .from('room_ludo_sessions')
      .update({
        status: 'playing',
        started_at: new Date().toISOString(),
        current_turn_user_id: firstPlayer.user_id,
      })
      .eq('id', currentSession.id);
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    const confirmed = window.confirm('Cancel game? All players will be refunded.');
    if (!confirmed) return;
    try {
      const { data, error } = await supabase.rpc('cancel_ludo_session', {
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

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('room_ludo_sessions')
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
      alert(err.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const isJoined = players.some(p => String(p.user_id) === String(user?.id));
  const isFull = players.length >= (currentSession?.max_players || 0);
  const isMyTurn = String(currentSession?.current_turn_user_id) === String(user?.id);
  const netPrize = Math.floor((currentSession?.entry_cost || 0) * players.length * 0.9);

  // Keep autoAction ref in sync with latest closures every render
  autoActionStateRef.current = {
    lastRoll,
    sessionLastRoll: currentSession?.last_roll ?? 0,
    movablePieces,
    rolling,
    rollDice,
    handlePieceSelect,
  };

  const isDiceOwnerPlayer = (player) => {
    // Show dice slot for the player who owns the last roll OR the current turn player
    const displayRollUserId = currentSession?.display_roll_user_id;
    const currentTurnUserId = currentSession?.current_turn_user_id;
    const displayRoll = Number(currentSession?.display_roll || 0);
    const pid = String(player?.user_id);
    if (displayRoll > 0 && displayRollUserId && String(displayRollUserId) === pid) return true;
    if (String(currentTurnUserId) === pid) return true;
    return false;
  };

  const getVisibleDiceValueForPlayer = (player) => {
    const pid = String(player?.user_id || '');
    const myId = String(user?.id || '');
    const currentTurnUserId = String(currentSession?.current_turn_user_id || '');
    const displayRollUserId = String(currentSession?.display_roll_user_id || '');
    const displayRoll = Number(currentSession?.display_roll || 0);

    const isLocalCurrentTurn = pid === myId && currentTurnUserId === myId;

    if (isLocalCurrentTurn && diceAnimating && diceDisplay >= 1 && diceDisplay <= 6) {
      return diceDisplay;
    }

    if (
      currentTurnUserId === pid &&
      displayRollUserId === pid &&
      remoteDiceAnimating &&
      remoteDiceDisplay >= 1 &&
      remoteDiceDisplay <= 6
    ) {
      return remoteDiceDisplay;
    }

    if (displayRollUserId === pid && displayRoll >= 1 && displayRoll <= 6) {
      return displayRoll;
    }

    return 0;
  };

  const renderDiceSlot = (player) => {
    if (!player || currentSession?.status !== 'playing') return null;

    const pid = String(player.user_id);
    const displayRollUserId = String(currentSession?.display_roll_user_id || '');
    const currentTurnUserId = String(currentSession?.current_turn_user_id || '');
    const displayRoll = Number(currentSession?.display_roll || 0);

    const isDisplayRollOwner = displayRoll > 0 && displayRollUserId === pid;
    const isCurrentTurnPlayer = currentTurnUserId === pid;

    if (!isDisplayRollOwner && !isCurrentTurnPlayer) return null;

    const colorIdx = getPlayerColorIndex(player);
    const sessionRoll = Number(currentSession?.last_roll || 0);

    const isTurnMine = pid === String(user?.id) && isMyTurn;
    const canRoll = isTurnMine && !rolling && sessionRoll === 0 && movablePieces.length === 0;

    const faceValue = getVisibleDiceValueForPlayer(player);
    const hasValue = faceValue >= 1 && faceValue <= 6;

    const isLocalDice = pid === String(user?.id) && isCurrentTurnPlayer;
    const isRollingNow = isCurrentTurnPlayer && (isLocalDice ? diceAnimating : remoteDiceAnimating);
    const showSettledValue = !isRollingNow && hasValue;

    return (
      <button
        type="button"
        disabled={!canRoll}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (canRoll) rollDice();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={`relative z-[80] w-20 h-20 flex items-center justify-center select-none ${
          canRoll ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          pointerEvents: 'auto',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center shadow-lg"
          style={{
            borderColor: PLAYER_COLORS[colorIdx],
            background: `linear-gradient(135deg, ${PLAYER_COLORS[colorIdx]}22, ${PLAYER_COLORS[colorIdx]}55)`,
            boxShadow: `0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 12px ${PLAYER_COLORS[colorIdx]}55`,
            transformOrigin: 'center center',
            animation: isRollingNow ? 'ludoDiceSingleSpin 850ms cubic-bezier(0.22, 1, 0.36, 1) 1 both' : 'none',
          }}
        >
          {showSettledValue ? (
            <span
              className="text-3xl font-black leading-none"
              style={{ color: PLAYER_COLORS[colorIdx] }}
            >
              {faceValue}
            </span>
          ) : (
            <span className="text-2xl opacity-80">🎲</span>
          )}
        </div>

        {canRoll && (
          <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
        )}
      </button>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center"
      onClick={() => { setShowSettingsMenu(false); onClose(); }}>
      <style>{`
        @keyframes ludoDiceSingleSpin {
          0% {
            transform: rotate(0deg) scale(1);
          }
          70% {
            transform: rotate(300deg) scale(1.04);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl
          shadow-2xl flex flex-col overflow-hidden h-[95dvh] max-h-[95dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="font-bold text-white text-lg">Ludo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-amber-500/20
              border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="text-amber-300 font-black text-sm">
                {(userCoins || 0).toLocaleString()}
              </span>
            </div>
            {/* Settings button — visible when a session exists */}
            {currentSession && canModerate && ['waiting','playing'].includes(currentSession.status) && (
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(v => !v)}
                  className="text-white/50 hover:text-white p-0.5"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {showSettingsMenu && (
                  <div
                    className="absolute right-0 top-7 z-50 bg-slate-800 border border-white/10
                      rounded-xl shadow-xl min-w-[140px] overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setShowSettingsMenu(false); cancelSession(); }}
                      className="w-full text-left px-4 py-2.5 text-rose-400 font-bold text-sm
                        hover:bg-rose-500/10 transition"
                    >
                      🚫 Cancel Game
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`flex-1 p-3 ${currentSession?.status === 'playing' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
          ) : showResult && winner ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl animate-bounce">🏆</div>
              <div className="text-white font-black text-3xl">WINNER!</div>
              <img
                src={winner.avatar_url || FALLBACK_AVATAR}
                alt={winner.name}
                className="w-24 h-24 rounded-full border-4 border-amber-400
                  shadow-[0_0_40px_rgba(251,191,36,0.8)] object-cover"
                onError={e => e.currentTarget.src = FALLBACK_AVATAR}
              />
              <div className="text-amber-300 font-black text-2xl">{winner.name}</div>
              <div className="bg-amber-500/20 border border-amber-500/40
                rounded-2xl px-6 py-3 text-center">
                <div className="text-amber-300 text-sm font-bold">Won</div>
                <div className="text-amber-200 text-3xl font-black">
                  🪙 {winnerCoins.toLocaleString()}
                </div>
              </div>
            </div>
          ) : currentSession ? (
            <div className={`flex flex-col ${currentSession?.status === 'playing' ? 'gap-1.5 mt-2' : 'gap-2'}`}>
              {/* Info bar */}
              <div className="flex items-center justify-between
                bg-slate-800 border border-white/10 rounded-xl px-3 py-1.5">
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Entry</div>
                  <div className="text-amber-400 font-black text-xs">
                    🪙 {currentSession.entry_cost.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Players</div>
                  <div className="text-white font-black text-xs">
                    {players.length}/{currentSession.max_players}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Prize</div>
                  <div className="text-emerald-400 font-black text-xs">
                    🪙 {netPrize.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">My Coins</div>
                  <div className={`font-black text-xs ${
                    userCoins >= currentSession.entry_cost ? 'text-white' : 'text-rose-400'
                  }`}>
                    🪙 {(userCoins || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Playing layout: top row + board + bottom row */}
              {currentSession.status === 'playing' && (() => {
                const renderPlayerRow = (visualIndices) => {
                  const rowPlayers = players
                    .filter(p => visualIndices.includes(getRelativeVisualSeat(p, players)))
                    .sort((a, b) => getRelativeVisualSeat(a, players) - getRelativeVisualSeat(b, players));
                  if (rowPlayers.length === 0) return null;
                  return (
                    <div className="flex items-center justify-between px-1">
                      {rowPlayers.map(p => {
                        const colorIdx = getPlayerColorIndex(p);
                        const isCurrentTurn = String(currentSession.current_turn_user_id) === String(p.user_id);
                        const piecesFinished = p.pieces_finished || 0;
                        const isFinishFx = String(recentFinishedUserId) === String(p.user_id);

                        const playerCard = (
                          <div
                            className="flex flex-col items-center gap-0.5 rounded-xl p-1 backdrop-blur-sm transition"
                            style={{
                              background: isCurrentTurn ? `${PLAYER_COLORS[colorIdx]}44` : 'rgba(0,0,0,0.55)',
                              outline: isCurrentTurn ? `2px solid ${PLAYER_COLORS[colorIdx]}` : 'none',
                              boxShadow: isFinishFx ? `0 0 0 2px ${PLAYER_COLORS[colorIdx]}, 0 0 18px ${PLAYER_COLORS[colorIdx]}cc` : undefined,
                              maxWidth: '60px',
                            }}
                          >
                            <img
                              src={p.avatar_url || FALLBACK_AVATAR}
                              alt={p.name}
                              className="w-7 h-7 rounded-full object-cover"
                              style={{ border: `2px solid ${PLAYER_COLORS[colorIdx]}` }}
                              onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                            />
                            <div className="text-white text-[9px] font-bold max-w-[56px] truncate text-center leading-tight">
                              {p.name}
                            </div>
                            <div className="flex gap-0.5">
                              {[0,1,2,3].map(i => (
                                <div
                                  key={i}
                                  className="w-[9px] h-[9px] rounded-full border-2 shadow"
                                  style={{
                                    backgroundColor: i < piecesFinished ? PLAYER_COLORS[colorIdx] : 'transparent',
                                    borderColor: PLAYER_COLORS[colorIdx],
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        );

                        return (
                          <div key={p.id} className={`flex items-center gap-2 ${isFinishFx ? 'animate-bounce' : ''}`}>
                            {playerCard}
                            {renderDiceSlot(p, 'right')}
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Top players: visualIdx 2 & 3 */}
                    <div className="mt-2">
                      {renderPlayerRow([2, 3])}
                    </div>

                    {/* Board */}
                    <div className="mt-3">
                      {finishToast && (
                        <div className="mb-2 flex justify-center">
                          <div className="pointer-events-none rounded-full bg-amber-400/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg animate-bounce">
                            {finishToast}
                          </div>
                        </div>
                      )}
                      <div
                        className={`bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-300 ${
                          recentFinishedUserId ? 'animate-pulse' : ''
                        }`}
                        style={{
                          boxShadow: recentFinishedUserId
                            ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 24px rgba(251,191,36,0.35)'
                            : undefined,
                        }}
                      >
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={600}
                          onClick={handleCanvasClick}
                          className="w-full max-h-[49dvh] aspect-square rounded-lg object-contain"
                        />
                      </div>
                    </div>

                    {/* Bottom players: visualIdx 0 & 1 */}
                    <div className="mt-2">
                      {renderPlayerRow([0, 1])}
                    </div>
                  </>
                );
              })()}

              {/* Board (non-playing) */}
              {currentSession.status !== 'playing' && (
                <div
                  className={`relative bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-300 ${
                    recentFinishedUserId ? 'animate-pulse' : ''
                  }`}
                  style={{
                    boxShadow: recentFinishedUserId
                      ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 24px rgba(251,191,36,0.35)'
                      : undefined,
                  }}
                >
                  {finishToast && (
                    <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-amber-400/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg animate-bounce">
                      {finishToast}
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={600}
                    onClick={handleCanvasClick}
                    className="w-full aspect-square rounded-lg"
                  />
                </div>
              )}

              {/* Waiting: players list */}
              {currentSession.status === 'waiting' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {players.map(p => {
                    const colorIdx = getPlayerColorIndex(p);
                    return (
                      <div key={p.id}
                        className="flex items-center gap-2 bg-white/5
                          border border-white/10 rounded-xl px-3 py-2">
                        <div className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PLAYER_COLORS[colorIdx] }} />
                        <img
                          src={p.avatar_url || FALLBACK_AVATAR}
                          alt={p.name}
                          className="w-7 h-7 rounded-full object-cover"
                          onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                        />
                        <span className="text-white text-xs font-bold truncate">
                          {p.name}
                        </span>
                        {String(p.user_id) === String(user?.id) && (
                          <span className="text-amber-300 text-[9px] ml-auto shrink-0">You</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-1">
                {!isJoined && !isFull && currentSession.status === 'waiting' && (
                  <button onClick={joinSession} disabled={joining}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500
                      text-white font-black text-xs disabled:opacity-50
                      active:scale-95 transition">
                    {joining
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`
                    }
                  </button>
                )}

                {isJoined && currentSession.status === 'waiting' && (
                  <button onClick={leaveSession} disabled={leaving}
                    className="flex-1 py-2.5 rounded-xl border border-white/20
                      text-white/70 font-bold text-xs bg-white/5
                      active:scale-95 transition">
                    {leaving
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : 'Leave & Refund'
                    }
                  </button>
                )}

                {canModerate && currentSession.status === 'waiting' && (
                  <button onClick={startGame} disabled={players.length < 2}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500
                      text-white font-black text-xs disabled:opacity-50
                      active:scale-95 transition">
                    🎯 Start Ludo
                  </button>
                )}
              </div>
            </div>
          ) : (
            canModerate ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="text-center text-white/50 text-sm">
                  No active Ludo game. Create one!
                </div>

                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">
                    👥 Number of Players
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button key={n} onClick={() => setMaxPlayers(n)}
                        className={`py-3 rounded-xl font-black text-lg
                          active:scale-95 transition ${
                          maxPlayers === n
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}>
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
                      <button key={c} onClick={() => setEntryCost(c)}
                        className={`py-2.5 rounded-xl font-bold text-xs
                          active:scale-95 transition ${
                          entryCost === c
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}>
                        {c >= 1000 ? (c/1000)+'k' : c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20
                  rounded-xl p-3 text-center">
                  <div className="text-amber-200/70 text-[10px] font-bold uppercase mb-1">
                    Winner gets (after 10% fee)
                  </div>
                  <div className="text-amber-400 font-black text-2xl">
                    🪙 {Math.floor(entryCost * maxPlayers * 0.9).toLocaleString()}
                  </div>
                </div>

                <button onClick={createSession} disabled={creating}
                  className="w-full py-3 rounded-xl bg-gradient-to-r
                    from-red-500 via-blue-500 to-green-500
                    text-white font-black text-sm active:scale-95
                    transition disabled:opacity-50">
                  {creating
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    : '🎯 Create Ludo Game'
                  }
                </button>
              </div>
            ) : (
              <div className="text-center text-white/40 py-12">
                <div className="text-5xl mb-3">🎯</div>
                <div className="text-base font-bold text-white/60">No active Ludo game</div>
                <div className="text-xs mt-2">Wait for the host to start one</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}