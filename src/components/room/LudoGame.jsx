import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#f1f5f9"/><circle cx="64" cy="52" r="22" fill="#cbd5e1"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#cbd5e1"/></svg>`);

const MAX_PLAYERS_OPTIONS = [2, 3, 4];
const ENTRY_COST_OPTIONS = [100, 200, 500, 1000, 5000, 10000];

// Player colors: Red, Blue, Green, Yellow
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const PLAYER_LIGHT_COLORS = ['#fca5a5', '#93c5fd', '#86efac', '#fcd34d'];
const PLAYER_DARK_COLORS = ['#991b1b', '#1e40af', '#15803d', '#b45309'];

// Safe squares on the main track (0-51)
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

// Each player's starting position on main track
const START_POSITIONS = [0, 13, 26, 39];

// Home column positions (52-56) per player
// After position 51, pieces enter their home column
const HOME_ENTRY = [51, 12, 25, 38];

// Ludo board: 15x15 grid
// Track cells (row, col) for positions 0-51
const TRACK_CELLS = [
  // Bottom row going right (Red start area) - positions 0-5
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  // Right column going up - positions 6-11  
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  // Top row going right - positions 12-17
  [7,0],[6,0],[6,1],[6,2],[6,3],[6,4],
  // Going right and up - positions 18-23
  [6,5],[5,5],[4,5],[3,5],[2,5],[1,5],
  // Top middle - positions 24-29
  [0,5],[0,6],[0,7],[0,8],[0,9],[1,9],
  // Right side going down - positions 30-35
  [2,9],[3,9],[4,9],[5,9],[6,9],[6,10],
  // positions 36-41
  [6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  // positions 42-47
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,9],
  // positions 48-51
  [10,9],[11,9],[12,9],[13,9],
];

// Home column cells per player
const HOME_COLUMNS = [
  [[13,7],[12,7],[11,7],[10,7],[9,7]], // Red
  [[7,1],[7,2],[7,3],[7,4],[7,5]],     // Blue  
  [[1,7],[2,7],[3,7],[4,7],[5,7]],     // Green
  [[7,13],[7,12],[7,11],[7,10],[7,9]], // Yellow
];

// Home base positions (4 pieces in home)
const HOME_BASES = [
  [[12,2],[12,3],[13,2],[13,3]],   // Red
  [[1,2],[1,3],[2,2],[2,3]],       // Blue (adjusted)
  [[1,11],[1,12],[2,11],[2,12]],   // Green
  [[12,11],[12,12],[13,11],[13,12]], // Yellow
];

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
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [movablePieces, setMovablePieces] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [extraTurn, setExtraTurn] = useState(false);
  const [message, setMessage] = useState('');
  const canvasRef = useRef(null);
  const channelRef = useRef(null);
  const resultFiredRef = useRef(false);
  const avatarImagesRef = useRef({});

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

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

  const getCellPixel = (row, col, cellSize) => ({
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  });

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const CELLS = 15;
    const cellSize = W / CELLS;

    ctx.clearRect(0, 0, W, W);

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, W);

    // Draw home bases (corners)
    const homeColors = [
      { bg: '#fca5a5', border: '#ef4444' }, // Red - bottom left
      { bg: '#93c5fd', border: '#3b82f6' }, // Blue - top left
      { bg: '#86efac', border: '#22c55e' }, // Green - top right
      { bg: '#fcd34d', border: '#f59e0b' }, // Yellow - bottom right
    ];

    const homeRects = [
      { r: 9, c: 0, w: 6, h: 6 },   // Red
      { r: 0, c: 0, w: 6, h: 6 },   // Blue
      { r: 0, c: 9, w: 6, h: 6 },   // Green
      { r: 9, c: 9, w: 6, h: 6 },   // Yellow
    ];

    homeRects.forEach((rect, i) => {
      // Outer border
      ctx.fillStyle = homeColors[i].border;
      ctx.fillRect(
        rect.c * cellSize, rect.r * cellSize,
        rect.w * cellSize, rect.h * cellSize
      );
      // Inner area
      ctx.fillStyle = homeColors[i].bg;
      ctx.fillRect(
        (rect.c + 0.5) * cellSize, (rect.r + 0.5) * cellSize,
        (rect.w - 1) * cellSize, (rect.h - 1) * cellSize
      );

      // Inner home circle
      ctx.beginPath();
      ctx.arc(
        (rect.c + rect.w / 2) * cellSize,
        (rect.r + rect.h / 2) * cellSize,
        cellSize * 2,
        0, Math.PI * 2
      );
      ctx.fillStyle = homeColors[i].border + '40';
      ctx.fill();
      ctx.strokeStyle = homeColors[i].border;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw track cells
    for (let i = 0; i < TRACK_CELLS.length; i++) {
      const [row, col] = TRACK_CELLS[i];
      const x = col * cellSize;
      const y = row * cellSize;

      // Safe squares colored
      let cellColor = '#334155';
      
      // Color start squares
      if (i === 0) cellColor = '#fca5a5';      // Red start
      if (i === 13) cellColor = '#93c5fd';     // Blue start
      if (i === 26) cellColor = '#86efac';     // Green start
      if (i === 39) cellColor = '#fcd34d';     // Yellow start
      
      // Safe squares
      if (SAFE_SQUARES.includes(i) && i !== 0 && i !== 13 && i !== 26 && i !== 39) {
        cellColor = '#475569';
      }

      ctx.fillStyle = cellColor;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Star on safe squares
      if (SAFE_SQUARES.includes(i) && i !== 0 && i !== 13 && i !== 26 && i !== 39) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `${cellSize * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', x + cellSize / 2, y + cellSize / 2);
      }
    }

    // Draw home columns
    HOME_COLUMNS.forEach((col, playerIdx) => {
      col.forEach(([row, c]) => {
        const x = c * cellSize;
        const y = row * cellSize;
        ctx.fillStyle = PLAYER_LIGHT_COLORS[playerIdx] + '60';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.strokeStyle = PLAYER_COLORS[playerIdx] + '80';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      });
    });

    // Center finishing square
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6 * cellSize, 6 * cellSize, 3 * cellSize, 3 * cellSize);
    
    // Draw triangle in center for each color
    const centerX = 7.5 * cellSize;
    const centerY = 7.5 * cellSize;
    const triColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    const triPoints = [
      [[6,6],[9,6],[7.5,7.5]],   // top - blue
      [[9,6],[9,9],[7.5,7.5]],   // right - green
      [[9,9],[6,9],[7.5,7.5]],   // bottom - yellow
      [[6,9],[6,6],[7.5,7.5]],   // left - red
    ];
    triPoints.forEach((pts, i) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][1] * cellSize, pts[0][0] * cellSize);
      ctx.lineTo(pts[1][1] * cellSize, pts[1][0] * cellSize);
      ctx.lineTo(pts[2][1] * cellSize, pts[2][0] * cellSize);
      ctx.closePath();
      ctx.fillStyle = triColors[i] + 'cc';
      ctx.fill();
    });

    // Draw pieces on board
    players.forEach((player, playerIdx) => {
      const colorIdx = player.seat_number - 1;
      const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
      
      pieces.forEach((pos, pieceIdx) => {
        if (pos === 57) return; // Finished - draw in center

        let px, py;

        if (pos === -1) {
          // In home base
          const homeBase = HOME_BASES[colorIdx];
          if (!homeBase || !homeBase[pieceIdx]) return;
          const [baseRow, baseCol] = homeBase[pieceIdx];
          px = baseCol * cellSize + cellSize / 2;
          py = baseRow * cellSize + cellSize / 2;
        } else {
          // On track or home column
          if (pos < 52) {
            // On main track
            // Adjust position based on player's starting offset
            const adjustedPos = (pos + START_POSITIONS[colorIdx]) % 52;
            if (!TRACK_CELLS[adjustedPos]) return;
            const [row, col] = TRACK_CELLS[adjustedPos];
            px = col * cellSize + cellSize / 2;
            py = row * cellSize + cellSize / 2;
          } else {
            // In home column (52-56)
            const homeColIdx = pos - 52;
            const homeCol = HOME_COLUMNS[colorIdx];
            if (!homeCol || !homeCol[homeColIdx]) return;
            const [row, col] = homeCol[homeColIdx];
            px = col * cellSize + cellSize / 2;
            py = row * cellSize + cellSize / 2;
          }
        }

        const r = cellSize * 0.32;
        const isMyPiece = String(player.user_id) === String(user?.id);
        const isMovable = isMyPiece && movablePieces.includes(pieceIdx + 1);
        const isSelected = isMyPiece && selectedPiece === pieceIdx + 1;

        // Glow for movable pieces
        if (isMovable || isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, r + 4, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? 'rgba(255,255,255,0.6)'
            : 'rgba(255,255,255,0.3)';
          ctx.fill();
        }

        // Piece circle
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = PLAYER_COLORS[colorIdx];
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Avatar or number
        const img = avatarImagesRef.current[player.user_id];
        if (img?.complete && img?.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, r - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, px - r + 2, py - r + 2, (r - 2) * 2, (r - 2) * 2);
          ctx.restore();
        } else {
          ctx.fillStyle = 'white';
          ctx.font = `bold ${r * 0.9}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pieceIdx + 1, px, py + 1);
        }
      });
    });
  };

  const getMovablePieces = (player, roll) => {
    const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
    const movable = [];
    pieces.forEach((pos, idx) => {
      if (pos === 57) return; // Already finished
      if (pos === -1 && roll === 6) movable.push(idx + 1); // Can exit home
      if (pos >= 0 && pos < 57) {
        // Can move if won't overshoot (pieces need exact number to finish)
        if (pos + roll <= 57) movable.push(idx + 1);
      }
    });
    return movable;
  };

  const rollDice = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (String(currentSession.current_turn_user_id) !== String(user.id)) return;
    if (rolling) return;

    setRolling(true);
    setDiceAnimating(true);
    setMovablePieces([]);
    setSelectedPiece(null);

    let count = 0;
    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 8) {
        clearInterval(interval);
        setDiceAnimating(false);
      }
    }, 80);

    try {
      // First roll dice to get result, then let player choose piece
      const roll = Math.floor(Math.random() * 6) + 1;
      setLastRoll(roll);
      setDiceDisplay(roll);

      // Find current player
      const myPlayer = players.find(
        p => String(p.user_id) === String(user.id)
      );

      if (!myPlayer) return;

      const movable = getMovablePieces(myPlayer, roll);
      setMovablePieces(movable);

      if (movable.length === 0) {
        // No movable pieces - skip turn
        setMessage("No pieces can move! Turn skipped.");
        setTimeout(() => setMessage(''), 2000);

        // Auto-skip via RPC with piece 0
        const { data } = await supabase.rpc('roll_ludo_dice', {
          p_session_id: currentSession.id,
          p_user_id: user.id,
          p_piece_number: 1, // Will be ignored since can't move
        });
        if (data?.next_turn_user_id) {
          const { data: sessionData } = await supabase
            .from('room_ludo_sessions')
            .select('*')
            .eq('id', currentSession.id)
            .single();
          if (sessionData) setCurrentSession(sessionData);
        }
        await loadPlayers(currentSession.id);
      } else if (movable.length === 1) {
        // Auto-move the only movable piece
        await movePiece(movable[0], roll);
      } else {
        // Let player choose which piece to move
        setMessage("Choose a piece to move!");
      }

    } catch (err) {
      alert(err.message || 'Failed to roll');
    } finally {
      setRolling(false);
    }
  };

  const movePiece = async (pieceNumber, roll) => {
    try {
      const { data, error } = await supabase.rpc('roll_ludo_dice', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
        p_piece_number: pieceNumber,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');

      setMovablePieces([]);
      setSelectedPiece(null);
      setMessage('');

      if (data.extra_turn) {
        setExtraTurn(true);
        setMessage('🎲 You rolled a 6! Roll again!');
        setTimeout(() => {
          setExtraTurn(false);
          setMessage('');
        }, 2000);
      }

      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);

      const { data: sessionData } = await supabase
        .from('room_ludo_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
      if (sessionData) setCurrentSession(sessionData);

    } catch (err) {
      alert(err.message || 'Failed to move piece');
    }
  };

  const handlePieceSelect = async (pieceNumber) => {
    if (!movablePieces.includes(pieceNumber)) return;
    setSelectedPiece(pieceNumber);
    await movePiece(pieceNumber, lastRoll);
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

  // Dice dots positions
  const DOT_POSITIONS = {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
  };

  const myPlayer = players.find(p => String(p.user_id) === String(user?.id));
  const myColorIdx = myPlayer ? myPlayer.seat_number - 1 : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl
          shadow-2xl flex flex-col overflow-hidden max-h-[95vh]"
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
            <button onClick={onClose} className="text-white/50 hover:text-white">
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
            <div className="flex flex-col gap-2">
              {/* Info bar */}
              <div className="flex items-center justify-between
                bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
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

              {/* Status */}
              {currentSession.status === 'playing' && (
                <div className={`text-center py-1.5 rounded-xl text-xs font-black ${
                  isMyTurn
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}>
                  {isMyTurn
                    ? message || '🎯 YOUR TURN!'
                    : `⏳ ${players.find(p =>
                        String(p.user_id) === String(currentSession.current_turn_user_id)
                      )?.name || 'Player'}'s turn`
                  }
                </div>
              )}

              {/* Board */}
              <div className="bg-slate-800 rounded-xl p-1.5 border border-white/5">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={600}
                  className="w-full aspect-square rounded-lg"
                />
              </div>

              {/* Dice + Players */}
              {currentSession.status === 'playing' && (
                <div className="flex items-center gap-2">
                  {/* Dice */}
                  <div className="shrink-0">
                    {lastRoll || diceAnimating ? (
                      <div
                        onClick={isMyTurn && !rolling && !movablePieces.length ? rollDice : undefined}
                        className={`relative w-14 h-14 rounded-2xl border-b-4 border-r-2
                          flex items-center justify-center
                          ${isMyTurn && !rolling && !movablePieces.length
                            ? 'cursor-pointer active:scale-90 animate-bounce'
                            : 'cursor-default'
                          }
                          ${diceAnimating ? 'animate-spin' : ''}
                        `}
                        style={{
                          background: 'linear-gradient(135deg, #fff, #e2e8f0)',
                          borderColor: PLAYER_COLORS[myColorIdx],
                          boxShadow: isMyTurn
                            ? `0 4px 12px rgba(0,0,0,0.4), 0 0 15px ${PLAYER_COLORS[myColorIdx]}66`
                            : '0 4px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        {(DOT_POSITIONS[diceDisplay || lastRoll] || DOT_POSITIONS[1]).map(
                          ([dx, dy], di) => (
                            <div
                              key={di}
                              className="absolute w-2 h-2 rounded-full"
                              style={{
                                left: `${dx}%`,
                                top: `${dy}%`,
                                transform: 'translate(-50%,-50%)',
                                backgroundColor: PLAYER_COLORS[myColorIdx],
                              }}
                            />
                          )
                        )}
                        {isMyTurn && !rolling && !movablePieces.length && (
                          <div className="absolute -top-1 -right-1 w-3 h-3
                            rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={isMyTurn && !rolling ? rollDice : undefined}
                        className={`w-14 h-14 rounded-2xl border-2 flex items-center
                          justify-center text-2xl
                          ${isMyTurn ? 'cursor-pointer animate-bounce border-emerald-400' : 'border-white/10 opacity-30'}`}
                      >
                        🎲
                      </div>
                    )}
                  </div>

                  {/* Players */}
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    {players.map((p) => {
                      const colorIdx = p.seat_number - 1;
                      const isCurrentTurn = String(currentSession.current_turn_user_id) === String(p.user_id);
                      const piecesFinished = p.pieces_finished || 0;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5
                            border transition ${
                            isCurrentTurn
                              ? 'border-white/20 bg-white/10'
                              : 'border-transparent bg-white/5'
                          }`}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: PLAYER_COLORS[colorIdx] }}
                          />
                          <img
                            src={p.avatar_url || FALLBACK_AVATAR}
                            alt={p.name}
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                            onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-[10px] font-bold truncate">
                              {p.name}
                              {String(p.user_id) === String(user?.id) && (
                                <span className="text-amber-300 ml-1 text-[8px]">(You)</span>
                              )}
                            </div>
                            <div className="flex gap-0.5 mt-0.5">
                              {[0,1,2,3].map(i => (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-full border"
                                  style={{
                                    backgroundColor: i < piecesFinished
                                      ? PLAYER_COLORS[colorIdx]
                                      : 'transparent',
                                    borderColor: PLAYER_COLORS[colorIdx],
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          {isCurrentTurn && (
                            <span className="text-xs animate-bounce shrink-0">🎲</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Piece selection for current player */}
              {isMyTurn && movablePieces.length > 1 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30
                  rounded-xl p-2">
                  <div className="text-emerald-300 text-xs font-bold text-center mb-2">
                    Choose which piece to move:
                  </div>
                  <div className="flex gap-2 justify-center">
                    {movablePieces.map(pieceNum => (
                      <button
                        key={pieceNum}
                        onClick={() => handlePieceSelect(pieceNum)}
                        className="w-10 h-10 rounded-xl font-black text-white
                          active:scale-95 transition border-2"
                        style={{
                          backgroundColor: PLAYER_COLORS[myColorIdx],
                          borderColor: 'white',
                        }}
                      >
                        {pieceNum}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting: players list */}
              {currentSession.status === 'waiting' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {players.map(p => {
                    const colorIdx = p.seat_number - 1;
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

                {canModerate && ['waiting','playing'].includes(currentSession.status) && (
                  <button onClick={cancelSession}
                    className="px-3 py-2.5 rounded-xl border border-rose-500/40
                      text-rose-400 font-bold text-xs bg-rose-500/5
                      active:scale-95 transition">
                    Cancel
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