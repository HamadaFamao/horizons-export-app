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

// Last logical outer-track index before entering home lane.
const HOME_ENTRY_LOGICAL_INDEX = 50;
const HOME_LANE_START_LOGICAL_INDEX = HOME_ENTRY_LOGICAL_INDEX + 1; // 51
const HOME_LANE_END_LOGICAL_INDEX = 56;

// Arrow cells where each color enters its home lane.
const HOME_ENTRY_ARROW_CELLS = [
  [14, 7],
  [7, 14],
  [0, 7],
  [7, 0],
];

// Home-lane cells per player (6 cells, logical positions 51-56)
const HOME_COLUMNS = [
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]], // 0: Red (Bottom)
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]], // 1: Blue (Right)
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],     // 2: Yellow (Top)
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],     // 3: Green (Left)
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
  const [teamMode, setTeamMode] = useState(false);
  const [entryCost, setEntryCost] = useState(100);
  // {userId: seatNumber} — stores planned seat swaps before game start.
  // Seat is the single source of truth: seat 1/3 = Team A, seat 2/4 = Team B.
  const [seatOverrides, setSeatOverrides] = useState({});
  const [selectedTeamPlayerId, setSelectedTeamPlayerId] = useState(null);
  const [teamsDirty, setTeamsDirty] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
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
  const [resignedTeammateName, setResignedTeammateName] = useState(null);
  const [autoHeaderGlow, setAutoHeaderGlow] = useState(false);
  const [turnPulseUserId, setTurnPulseUserId] = useState(null);
  const [diceResultPulseKey, setDiceResultPulseKey] = useState('');
  const [diceSixGlowKey, setDiceSixGlowKey] = useState('');
  const [finishToast, setFinishToast] = useState('');
  const [recentFinishedUserId, setRecentFinishedUserId] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const canvasRef = useRef(null);
  const channelRef = useRef(null);
  const resultFiredRef = useRef(false);
  const lastSeenRollRef = useRef(null);
  const avatarImagesRef = useRef({});
  const pieceMoveAnimRef = useRef({});
  const lastPieceCanvasPosRef = useRef({});
  const boardAnimFrameRef = useRef(null);
  const finishFxTimerRef = useRef(null);
  const turnTimerRef = useRef(null);
  const autoActionStateRef = useRef({});
  const teamEliminationHandledRef = useRef(false);
  const previousPlayersRef = useRef([]);
  const previousResignedTeammateRef = useRef(null);
  const movingPieceRef = useRef(false);
  const homeEntryDebugSnapshotRef = useRef('');
  const previousTurnUserIdRef = useRef(null);
  const previousDiceResultKeyRef = useRef('');
  const leftTurnActionRef = useRef({ inFlight: false, key: '' });
  // Prevents the realtime room_ludo_players subscription from reloading players
  // while saveTeams is mid-flight (temp seats 100+ would crash color lookups).
  const savingTeamsRef = useRef(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState(12);

  useEffect(() => {
    return () => {
      if (finishFxTimerRef.current) clearTimeout(finishFxTimerRef.current);
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      if (boardAnimFrameRef.current) cancelAnimationFrame(boardAnimFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (maxPlayers !== 4 && teamMode) {
      setTeamMode(false);
    }
  }, [maxPlayers, teamMode]);

  useEffect(() => {
    if (currentSession?.status === 'playing') {
      teamEliminationHandledRef.current = false;
    }
  }, [currentSession?.id, currentSession?.status]);

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  // Clear pre-game seat overrides once the game starts or session resets.
  useEffect(() => {
    if (currentSession?.status === 'playing' || !currentSession?.id) {
      setSeatOverrides({});
      setSelectedTeamPlayerId(null);
      setTeamsDirty(false);
    }
  }, [currentSession?.id, currentSession?.status]);

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

      if (count >= 9) {
        clearInterval(interval);
        setRemoteDiceDisplay(roll);
        setRemoteDiceAnimating(false);
      }
    }, 70);

    return () => clearInterval(interval);
  }, [
    currentSession?.id,
    currentSession?.display_roll,
    currentSession?.current_turn_user_id,
    currentSession?.last_roll,
    user?.id,
  ]);

  useEffect(() => {
    if (currentSession?.status !== 'playing') {
      previousDiceResultKeyRef.current = '';
      setDiceResultPulseKey('');
      setDiceSixGlowKey('');
      return;
    }

    const rollVal = Number(currentSession?.display_roll || 0);
    const rollUserId = String(currentSession?.display_roll_user_id || '');
    const sessionRoll = Number(currentSession?.last_roll || 0);
    if (rollVal < 1 || rollVal > 6 || !rollUserId) return;

    const rollKey = `${rollUserId}-${rollVal}-${sessionRoll}`;
    if (previousDiceResultKeyRef.current === rollKey) return;
    previousDiceResultKeyRef.current = rollKey;

    setDiceResultPulseKey(rollKey);

    if (rollVal === 6) {
      setDiceSixGlowKey(rollKey);
      const sixTimer = setTimeout(() => {
        setDiceSixGlowKey(prev => (prev === rollKey ? '' : prev));
      }, 500);
      return () => clearTimeout(sixTimer);
    }
  }, [
    currentSession?.status,
    currentSession?.display_roll,
    currentSession?.display_roll_user_id,
    currentSession?.last_roll,
  ]);

  // ─── Turn countdown timer ────────────────────
  useEffect(() => {
    const myPlayer = players.find(
      p => String(p.user_id) === String(user?.id)
    );
    const isMine =
      String(currentSession?.current_turn_user_id) === String(user?.id) &&
      !!myPlayer &&
      !myPlayer.left_at &&
      !myPlayer.is_left;

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

  const isPlayerLeft = (player) => Boolean(player?.left_at || player?.is_left);
  const getActivePlayersList = (playersList = players) =>
    (playersList || []).filter(p => !p.refunded_at && !isPlayerLeft(p));
  const getVisiblePlayersList = (playersList = players, sessionArg = currentSession) => {
    const isTeamSession =
      Number(sessionArg?.max_players || 0) === 4 &&
      sessionArg?.team_mode === true;
    if (isTeamSession) return (playersList || []).filter(p => !p.refunded_at);
    return getActivePlayersList(playersList);
  };

  // Emit local resign notifications with mode-specific messaging.
  useEffect(() => {
    if (!currentSession?.id) {
      previousPlayersRef.current = players;
      return;
    }

    const prevMap = new Map(
      (previousPlayersRef.current || []).map(p => [String(p.user_id), p])
    );
    const me = players.find(p => String(p.user_id) === String(user?.id));

    players.forEach((p) => {
      const prev = prevMap.get(String(p.user_id));
      const justResigned =
        !!prev &&
        !prev.left_at &&
        !prev.is_left &&
        (p.left_at || p.is_left);

      if (!justResigned) return;

      if (isTeamMode()) {
        if (!me || isPlayerLeft(me)) return;
        const sameTeam = getEffectiveTeam(me) === getEffectiveTeam(p);
        const isSelf = String(me.user_id) === String(p.user_id);
        if (!sameTeam || isSelf) return;

        setMessage(`Your teammate ${p.name || 'A player'} resigned. Their turns will be auto-played.`);
        setTimeout(() => setMessage(''), 2600);
        setResignedTeammateName(p.name || 'Your teammate');
      } else {
        setMessage(`${p.name || 'A player'} resigned from Ludo.`);
        setTimeout(() => setMessage(''), 2200);
      }
    });

    previousPlayersRef.current = players;
  }, [players, currentSession?.id, currentSession?.team_mode, currentSession?.max_players, user?.id]);

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
          loadPlayers(s.id).then(async ps => {
            let winningTeamPlayers = s.winner_team
              ? ps.filter(p => getEffectiveTeam(p) === s.winner_team)
              : [];

            if (s.winner_team && winningTeamPlayers.length === 0) {
              const reloadedPlayers = await loadPlayers(s.id);
              winningTeamPlayers = (reloadedPlayers || []).filter(
                p => getEffectiveTeam(p) === s.winner_team
              );
            }
            const perPlayerPrize = Number(s.winner_coins || s.per_player_prize || 0);
            const totalTeamPrize = perPlayerPrize * winningTeamPlayers.length;

            if (s.winner_team) {
              const sortedWinners = [...winningTeamPlayers].sort((a, b) => a.seat_number - b.seat_number);
              const announcerId = sortedWinners[0]?.user_id;

              setWinner(null);
              setWinnerCoins(perPlayerPrize);
              setShowResult(true);
              setResignedTeammateName(null);
              setMessage(`Team ${s.winner_team} wins`);
              setTimeout(() => setMessage(''), 3000);

              if (String(announcerId) === String(user?.id) && sortedWinners.length > 0) {
                onLudoResult?.({
                  teamMode: true,
                  winnerTeam: s.winner_team,
                  winningTeamPlayers: sortedWinners.map(p => ({
                    user_id: p.user_id,
                    name: p.name,
                    avatar_url: p.avatar_url,
                    seat_number: p.seat_number,
                  })),
                  perPlayerPrize,
                  totalTeamPrize,
                  winnerCoins: perPlayerPrize,
                  totalPlayers: ps.length,
                });
              }
            } else {
              const w = ps.find(p =>
                String(p.user_id) === String(s.winner_id)
              );
              if (!w) {
                resultFiredRef.current = false;
                return;
              }

              // Defensive guard: classic mode should only end when winner has all 4 pieces.
              if (Number(w.pieces_finished || 0) < 4) {
                resultFiredRef.current = false;
                setCurrentSession(prev => (
                  prev
                    ? {
                        ...s,
                        status: 'playing',
                        winner_id: null,
                        winner_coins: 0,
                      }
                    : prev
                ));
                return;
              }

              setWinner(w);
              setWinnerCoins(s.winner_coins || 0);
              setShowResult(true);
              setResignedTeammateName(null);
              if (String(s.winner_id) === String(user?.id)) {
                onLudoResult?.({
                  winnerName: w.name,
                  winnerAvatar: w.avatar_url,
                  winnerId: w.user_id,
                  winnerCoins: s.winner_coins || 0,
                  totalPlayers: ps.length,
                });
              }
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
          });
        } else {
          setCurrentSession(s);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_ludo_players',
      }, async () => {
        // Skip reload while saveTeams is writing temp seats to avoid crash.
        if (currentSession?.id && !savingTeamsRef.current) {
          const refreshedPlayers = await loadPlayers(currentSession.id);
          await maybeEndGameForEliminatedTeam(refreshedPlayers, currentSession);
        }
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

  const endGame = async (winningTeam, sessionArg = currentSession) => {
    if (!sessionArg?.id || !winningTeam) return;
    if (sessionArg.status === 'finished') return;
    if (teamEliminationHandledRef.current) return;

    teamEliminationHandledRef.current = true;

    const { data, error } = await supabase.rpc('finish_ludo_team_game', {
      p_session_id: sessionArg.id,
      p_winning_team: winningTeam,
    });

    if (error || !data?.success) {
      teamEliminationHandledRef.current = false;
      console.error('Failed to end team game:', error || data?.error);
      return;
    }

    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }

    onCoinsUpdated?.();
    setMessage(`Team ${winningTeam} wins`);
    setTimeout(() => setMessage(''), 3000);
    setCurrentSession(prev => (
      prev
        ? {
            ...prev,
            status: 'finished',
            winner_team: winningTeam,
            winner_id: data?.winner_id || prev.winner_id || null,
            winner_coins: data?.winner_coins || prev.winner_coins || 0,
            current_turn_user_id: null,
          }
        : prev
    ));
  };

  const maybeEndGameForEliminatedTeam = async (playersList = players, sessionArg = currentSession) => {
    if (!sessionArg?.id || sessionArg?.status !== 'playing') return;
    if (!(Number(sessionArg?.max_players || 0) === 4 && sessionArg?.team_mode === true)) return;

    const activePlayers = (playersList || []).filter(p => !p.refunded_at && !p.left_at && !p.is_left);
    const teamAPlayers = activePlayers.filter(p => getEffectiveTeam(p) === 'A');
    const teamBPlayers = activePlayers.filter(p => getEffectiveTeam(p) === 'B');

    if (teamAPlayers.length === 0 && teamBPlayers.length > 0) {
      await endGame('B', sessionArg);
      return;
    }

    if (teamBPlayers.length === 0 && teamAPlayers.length > 0) {
      await endGame('A', sessionArg);
    }
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

  // Clamps any seat/visual index to 0-3, handling temporary seats (100+) safely.
  const normalizeColorIndex = (idx) => {
    const n = Number(idx);
    if (!Number.isFinite(n)) return 0;
    return ((n % 4) + 4) % 4;
  };

  const getPlayerColorIndex = (player, playersList = players) => {
    let seat = Number(player?.seat_number || 1);
    // During saveTeams phase 1, DB may briefly hold temporary seats like 101-104.
    if (seat > 100) seat = seat - 100;
    const totalPlayers = Number(currentSession?.max_players || playersList.length || 4);
    const layout = VISUAL_SEAT_LAYOUTS[totalPlayers] || [0, 1, 2, 3];
    const seatIdx = Math.max(0, seat - 1);
    return normalizeColorIndex(layout[seatIdx] ?? seatIdx);
  };

  const getTeamKey = (player) => {
    if (!player) return null;
    if (Number(currentSession?.max_players || 0) === 4 && currentSession?.team_mode === true) {
      return getEffectiveTeam(player);
    }
    return String(player.user_id || '');
  };

  const getTrackCell = (player, piecePos, playersList = players) => {
    if (typeof piecePos !== 'number') return null;
    if (piecePos < 0 || piecePos > HOME_ENTRY_LOGICAL_INDEX) return null;

    const colorIdx = getPlayerColorIndex(player, playersList);
    return (piecePos + START_POSITIONS[colorIdx]) % 52;
  };

  const isSafeCell = (trackCell) => {
    return Number.isInteger(trackCell) && SAFE_SQUARES.includes(trackCell);
  };

  const getPiecesOnCell = (trackCell, playersList = players) => {
    if (!Number.isInteger(trackCell)) return [];

    const piecesOnCell = [];
    (playersList || []).forEach((player) => {
      const piecePositions = [player.piece1, player.piece2, player.piece3, player.piece4];
      piecePositions.forEach((piecePos, pieceIndex) => {
        if (getTrackCell(player, piecePos, playersList) !== trackCell) return;
        piecesOnCell.push({
          userId: String(player.user_id || ''),
          teamKey: getTeamKey(player),
          pieceNumber: pieceIndex + 1,
          piecePos,
        });
      });
    });

    return piecesOnCell;
  };

  const getPieceBoardPlacement = (player, pieceIndex, playersList = players) => {
    const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
    const pos = pieces[pieceIndex];
    if (typeof pos !== 'number') return null;

    const colorIdx = getRelativeVisualSeat(player, playersList);
    const finishedTriangleSlots = [
      // Red (bottom triangle)
      [[8.35, 7.2], [8.35, 7.8], [8.7, 7.35], [8.7, 7.65]],
      // Blue (right triangle)
      [[7.2, 8.35], [7.8, 8.35], [7.35, 8.7], [7.65, 8.7]],
      // Yellow (top triangle)
      [[6.65, 7.2], [6.65, 7.8], [6.3, 7.35], [6.3, 7.65]],
      // Green (left triangle)
      [[7.2, 6.65], [7.8, 6.65], [7.35, 6.3], [7.65, 6.3]],
    ];

    if (pos === 57) {
      const finishedPieceIndices = pieces
        .map((piecePos, idx) => ({ piecePos, idx }))
        .filter(item => item.piecePos === 57)
        .map(item => item.idx);
      const slotIndex = Math.max(0, finishedPieceIndices.indexOf(pieceIndex));
      const slots = finishedTriangleSlots[colorIdx] || [[7.5, 7.5]];
      const [row, col] = slots[Math.min(slotIndex, slots.length - 1)] || [7.5, 7.5];
      return {
        row,
        col,
        colorIdx,
        isFinished: true,
        zone: 'finished',
        seatNumber: Number(player?.seat_number || 0),
        logicalPos: pos,
        trackIndex: null,
      };
    }

    if (pos === -1) {
      const homeBase = HOME_BASES[colorIdx];
      if (!homeBase || !homeBase[pieceIndex]) return null;
      const [baseRow, baseCol] = homeBase[pieceIndex];
      return {
        row: baseRow,
        col: baseCol,
        colorIdx,
        isFinished: false,
        zone: 'base',
        seatNumber: Number(player?.seat_number || 0),
        logicalPos: pos,
        trackIndex: null,
      };
    }

    if (pos >= 0 && pos <= HOME_ENTRY_LOGICAL_INDEX) {
      const adjustedPos = getTrackCell(player, pos, playersList);
      const trackCell = TRACK_CELLS[adjustedPos];

      if (!trackCell) return null;
      const [row, col] = trackCell;
      const piecesOnTrackCell = getPiecesOnCell(adjustedPos, playersList);
      return {
        row,
        col,
        colorIdx,
        isFinished: false,
        zone: 'outer-track',
        seatNumber: Number(player?.seat_number || 0),
        logicalPos: pos,
        trackIndex: adjustedPos,
        isSafeTrackCell: isSafeCell(adjustedPos),
        trackStackSize: piecesOnTrackCell.length,
      };
    }

    if (pos >= HOME_LANE_START_LOGICAL_INDEX && pos <= HOME_LANE_END_LOGICAL_INDEX) {
      const homeColIdx = pos - HOME_LANE_START_LOGICAL_INDEX;
      const homeCol = HOME_COLUMNS[colorIdx];
      if (!homeCol || !homeCol[homeColIdx]) return null;
      const [row, col] = homeCol[homeColIdx];
      return {
        row,
        col,
        colorIdx,
        isFinished: false,
        zone: 'home-lane',
        seatNumber: Number(player?.seat_number || 0),
        logicalPos: pos,
        trackIndex: null,
      };
    }

    return null;
  };

  const getPieceCanvasPosition = (player, pieceIndex, cellSize, playersList = players) => {
    const placement = getPieceBoardPlacement(player, pieceIndex, playersList);
    if (!placement) return null;

    const isCenteredCell = placement.zone === 'outer-track' || placement.zone === 'home-lane';

    return {
      ...placement,
      x: placement.col * cellSize + (isCenteredCell ? cellSize / 2 : 0),
      y: placement.row * cellSize + (isCenteredCell ? cellSize / 2 : 0),
    };
  };

  useEffect(() => {
    const cellSize = canvasRef.current ? canvasRef.current.width / 15 : 0;
    const debugRows = [];

    players.forEach((player) => {
      [player.piece1, player.piece2, player.piece3, player.piece4].forEach((pos, pieceIdx) => {
        if (typeof pos !== 'number' || pos < 49 || pos > 53) return;
        const placement = getPieceBoardPlacement(player, pieceIdx, players);
        const canvasPos = cellSize > 0 ? getPieceCanvasPosition(player, pieceIdx, cellSize, players) : null;
        if (!placement) return;
        debugRows.push({
          seat_number: Number(player?.seat_number || 0),
          piece_number: pieceIdx + 1,
          piece_position: pos,
          rendered_cell: [placement.row, placement.col],
          rendered_xy: canvasPos ? [Number(canvasPos.x.toFixed(1)), Number(canvasPos.y.toFixed(1))] : null,
          zone: placement.zone,
          track_index: placement.trackIndex,
          safe_cell: placement.isSafeTrackCell || false,
          track_stack_size: placement.trackStackSize || 0,
        });
      });
    });

    const snapshot = JSON.stringify(debugRows);
    if (!debugRows.length || snapshot === homeEntryDebugSnapshotRef.current) return;
    homeEntryDebugSnapshotRef.current = snapshot;
    console.debug('Ludo home-entry mapping', debugRows);
  }, [players, currentSession?.id]);

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const CELLS = 15;
    const cellSize = W / CELLS;
    const boardPlayers = getVisiblePlayersList(players, currentSession);

    // Helper to map visual index to real player color
    const getVisualColorIndex = (visualIdx) => {
      const playerAtVisual = boardPlayers.find(p =>
        getRelativeVisualSeat(p, boardPlayers) === visualIdx
      );
      return normalizeColorIndex(
        playerAtVisual ? getPlayerColorIndex(playerAtVisual, boardPlayers) : visualIdx
      );
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
    boardPlayers.forEach((player) => {
      const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
      pieces.forEach((pos, pieceIdx) => {
        const piecePos = getPieceCanvasPosition(player, pieceIdx, cellSize, boardPlayers);
        if (!piecePos) return;
        drawablePieces.push({ player, pieceIdx, piecePos });
      });
    });

    const stackedByCell = new Map();
    drawablePieces.forEach((item) => {
      const key = `${Math.round(item.piecePos.x)}_${Math.round(item.piecePos.y)}`;
      if (!stackedByCell.has(key)) stackedByCell.set(key, []);
      stackedByCell.get(key).push(item);
    });

    const nowTs = performance.now();
    let needsMoveAnimationFrame = false;
    const seenPieceKeys = new Set();

    stackedByCell.forEach((cellPieces) => {
      cellPieces.forEach((item, stackIndex) => {
        const { player, pieceIdx, piecePos } = item;
        const { x, y, colorIdx: rawColorIdx } = piecePos;
        const colorIdx = normalizeColorIndex(rawColorIdx);
        const [offX, offY] = getPieceStackOffset(stackIndex);
        const px = x + offX;
        const py = y + offY;
        const pieceKey = `${player.user_id}-${pieceIdx}`;
        seenPieceKeys.add(pieceKey);

        const prevPos = lastPieceCanvasPosRef.current[pieceKey];
        const existingAnim = pieceMoveAnimRef.current[pieceKey];
        const moveDistance = prevPos
          ? Math.hypot(px - prevPos.x, py - prevPos.y)
          : 0;

        if (prevPos && moveDistance > 1) {
          const targetChanged =
            !existingAnim ||
            existingAnim.toX !== px ||
            existingAnim.toY !== py;

          if (targetChanged) {
            // Snappy per-step: 90–110ms per tile. 3ms stagger keeps steps distinct.
            const STEP_DELAY_MS = 3;
            const stepDelay = existingAnim ? STEP_DELAY_MS : 0;
            const duration = Math.max(90, Math.min(110, moveDistance * 2.5));
            pieceMoveAnimRef.current[pieceKey] = {
              fromX: existingAnim ? existingAnim.fromX + (existingAnim.toX - existingAnim.fromX) * Math.max(0, Math.min(1, (nowTs - existingAnim.start) / existingAnim.duration)) : prevPos.x,
              fromY: existingAnim ? existingAnim.fromY + (existingAnim.toY - existingAnim.fromY) * Math.max(0, Math.min(1, (nowTs - existingAnim.start) / existingAnim.duration)) : prevPos.y,
              toX: px,
              toY: py,
              start: nowTs + stepDelay,
              duration,
            };
          }
        }

        let drawX = px;
        let drawY = py;
        const activeAnim = pieceMoveAnimRef.current[pieceKey];
        if (activeAnim) {
          const t = Math.max(0, Math.min(1, (nowTs - activeAnim.start) / activeAnim.duration));
          // cubic-bezier(0.2, 0.8, 0.2, 1) approximation via power 1.8 ease-out
          const eased = t < 0 ? 0 : 1 - Math.pow(1 - t, 1.8);
          drawX = activeAnim.fromX + (activeAnim.toX - activeAnim.fromX) * eased;
          drawY = activeAnim.fromY + (activeAnim.toY - activeAnim.fromY) * eased;

          if (t < 1) {
            needsMoveAnimationFrame = true;
          } else {
            delete pieceMoveAnimRef.current[pieceKey];
          }
        }

        lastPieceCanvasPosRef.current[pieceKey] = { x: px, y: py };

        // Slightly bigger radius while keeping board proportions intact
        const r = cellSize * 0.45;
        const isMyPiece = String(player.user_id) === String(user?.id);
        const isMovable = isMyPiece && movablePieces.includes(pieceIdx + 1);
        const isSelected = isMyPiece && selectedPiece === pieceIdx + 1;

        ctx.save();

        // Glow for movable pieces
        if (isMovable || isSelected) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, r + 6, 0, Math.PI * 2);
          ctx.shadowColor = isSelected ? '#ffffff' : PLAYER_COLORS[colorIdx];
          ctx.shadowBlur = isSelected ? 15 : 8;
          ctx.fillStyle = isSelected
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(255,255,255,0.18)';
          ctx.fill();
          ctx.shadowBlur = 0; // reset

          // Soft ring for available moves to improve move readability.
          if (isMovable) {
            ctx.beginPath();
            ctx.arc(drawX, drawY, r + 8, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.30)';
            ctx.stroke();
          }
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
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
          ctx.closePath();
          
          // Fill background just in case image has transparency
          ctx.fillStyle = PLAYER_COLORS[colorIdx];
          ctx.fill();

          ctx.save();
          ctx.clip();
          ctx.drawImage(img, drawX - r, drawY - r, r * 2, r * 2);
          ctx.restore();
        } else {
          // Fallback piece
          const pieceGrad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
          pieceGrad.addColorStop(0, homeColors[colorIdx].grad1);
          pieceGrad.addColorStop(1, homeColors[colorIdx].grad2);
          
          ctx.beginPath();
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
          ctx.fillStyle = pieceGrad;
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.font = `bold ${r}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2;
          ctx.fillText(pieceIdx + 1, drawX, drawY + 1);
        }

        // Reset shadow for borders and gloss
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Professional border
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, r - 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PLAYER_COLORS[colorIdx];
        ctx.stroke();

        // Glossy reflection overlay
        ctx.beginPath();
        ctx.arc(drawX, drawY - r * 0.3, r * 0.6, 0, Math.PI * 2);
        const glossGrad = ctx.createLinearGradient(drawX, drawY - r, drawX, drawY);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.fill();

        ctx.restore();
      });
    });

    // Clean stale cached piece positions/animations for pieces no longer drawn.
    Object.keys(lastPieceCanvasPosRef.current).forEach((key) => {
      if (!seenPieceKeys.has(key)) delete lastPieceCanvasPosRef.current[key];
    });
    Object.keys(pieceMoveAnimRef.current).forEach((key) => {
      if (!seenPieceKeys.has(key)) delete pieceMoveAnimRef.current[key];
    });

    if (needsMoveAnimationFrame && !boardAnimFrameRef.current) {
      boardAnimFrameRef.current = requestAnimationFrame(() => {
        boardAnimFrameRef.current = null;
        drawBoard();
      });
    }
  };

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const DICE_REVEAL_DELAY = 1400;
  const TRIPLE_SIX_REVEAL_DELAY = 320;

  const getLogicalNextPos = (pos, roll) => {
    // Finished pieces cannot move
    if (pos === 57) return null;

    // Home base: can only start with a 6
    if (pos === -1) {
      return roll === 6 ? 0 : null;
    }

    // Outer track (positions 0-50)
    if (pos >= 0 && pos <= HOME_ENTRY_LOGICAL_INDEX) {
      const target = pos + roll;
      
      // Stay on outer track
      if (target <= HOME_ENTRY_LOGICAL_INDEX) return target;
      
      // Enter home lane (positions 51-56)
      if (target >= HOME_LANE_START_LOGICAL_INDEX && target <= HOME_LANE_END_LOGICAL_INDEX) return target;
      
      // Exact finish only: target must be exactly 57
      if (target === 57) return 57;
      
      // Overshoot: not allowed
      return null;
    }

    // Home lane (positions 51-56)
    if (pos >= HOME_LANE_START_LOGICAL_INDEX && pos <= HOME_LANE_END_LOGICAL_INDEX) {
      const target = pos + roll;
      
      // Stay in home lane
      if (target <= HOME_LANE_END_LOGICAL_INDEX) return target;
      
      // Exact finish only: target must be exactly 57
      if (target === 57) return 57;
      
      // Overshoot: not allowed
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

    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6) + 1);
    }, 70);

    try {
      const { data, error } = await supabase.rpc('get_ludo_roll', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to roll');

      const finalRoll = Number(data.roll || 0);

      clearInterval(interval);
      setDiceAnimating(false);
      setDiceDisplay(finalRoll);
      setLastRoll(finalRoll);

      if (typeof data.consecutive_sixes === 'number') {
        setConsecutiveSixes(data.consecutive_sixes);
      }

      if (data.triple_six === true) {
        // Third consecutive 6: keep visible 6, block any movement, lose turn.
        setDiceDisplay(6);
        setLastRoll(6);
        setMovablePieces([]);
        setSelectedPiece(null);
        setMessage('🚫 Three 6s! Turn lost.');
        setTimeout(() => setMessage(''), 2000);
        await wait(TRIPLE_SIX_REVEAL_DELAY);
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

      const myPlayerNow = players.find(
        p => String(p.user_id) === String(user.id)
      );

      if (!myPlayerNow) {
        await refreshSession();
        return;
      }

      const movable = getMovablePieces(myPlayerNow, finalRoll);
      setMovablePieces(movable);

      if (movable.length === 0) {
        setMessage('❌ No valid move. Turn passed.');
        setTimeout(() => setMessage(''), 1700);
        
        // Reset the roll on backend and pass turn to next player
        await supabase
          .from('room_ludo_sessions')
          .update({ last_roll: 0 })
          .eq('id', currentSession.id)
          .eq('status', 'playing');
        
        await wait(400);
        await passTurnToNextPlayer();
        return;
      }

      if (movable.length === 1) {
        await wait(300);
        await movePiece(movable[0]);
        return;
      }

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
    await maybeEndGameForEliminatedTeam(refreshedPlayers, sd || currentSession);
    return { players: refreshedPlayers || [], session: sd || null };
  };

  const forceAdvanceTurnFromLeft = async (leftUserId, sessionArg = currentSession, playersList = players) => {
    if (!sessionArg?.id || !leftUserId) return false;

    const sorted = [...(playersList || [])].sort((a, b) => a.seat_number - b.seat_number);
    const currentPlayer = sorted.find(p => String(p.user_id) === String(leftUserId));
    if (!currentPlayer) return false;

    const candidates = isTeamMode()
      ? sorted.filter(p => String(p.user_id) !== String(leftUserId))
      : sorted.filter(p => !isPlayerLeft(p));
    if (candidates.length === 0) return false;

    const nextPlayer =
      candidates.find(p => p.seat_number > currentPlayer.seat_number) ||
      candidates[0];
    if (!nextPlayer?.user_id) return false;

    const { error } = await supabase
      .from('room_ludo_sessions')
      .update({
        current_turn_user_id: nextPlayer.user_id,
        last_roll: 0,
        display_roll: null,
        display_roll_user_id: null,
      })
      .eq('id', sessionArg.id)
      .eq('status', 'playing')
      .eq('current_turn_user_id', leftUserId);

    return !error;
  };

  const autoPlayLeftTurn = async (leftPlayer, sessionArg = currentSession) => {
    if (!leftPlayer?.user_id || !sessionArg?.id) return;

    const { data: rollData, error: rollError } = await supabase.rpc('get_ludo_roll', {
      p_session_id: sessionArg.id,
      p_user_id: leftPlayer.user_id,
    });

    if (rollError || !rollData?.success) {
      await forceAdvanceTurnFromLeft(leftPlayer.user_id, sessionArg, players);
      return;
    }

    if (rollData.triple_six === true || rollData.turn_passed) {
      await refreshSession();
      return;
    }

    const refreshed = await refreshSession();
    const latestPlayers = refreshed?.players || players;
    const latestSession = refreshed?.session || sessionArg;
    const latestLeft = latestPlayers.find(
      p => String(p.user_id) === String(leftPlayer.user_id)
    );
    if (!latestLeft) return;

    const rollVal = Number(latestSession?.last_roll ?? rollData.roll ?? 0);
    const movable = getMovablePieces(latestLeft, rollVal);
    if (movable.length > 0) {
      await supabase.rpc('move_ludo_piece', {
        p_session_id: sessionArg.id,
        p_user_id: leftPlayer.user_id,
        p_piece_number: movable[0],
      });
    }

    await refreshSession();
  };

  // Handle turns for resigned players:
  // - Classic mode: skip forever.
  // - Team mode: auto-play resigned teammate turns.
  useEffect(() => {
    if (!open || currentSession?.status !== 'playing' || !currentSession?.id) return;

    const turnUserId = String(currentSession?.current_turn_user_id || '');
    if (!turnUserId) return;

    const me = players.find(p => String(p.user_id) === String(user?.id));
    if (!me || isPlayerLeft(me)) return;

    const turnPlayer = players.find(p => String(p.user_id) === turnUserId);
    if (!turnPlayer || !isPlayerLeft(turnPlayer)) return;

    const key = `${currentSession.id}:${turnUserId}:${currentSession.last_roll || 0}:${currentSession.display_roll || 0}`;
    if (leftTurnActionRef.current.inFlight || leftTurnActionRef.current.key === key) return;

    leftTurnActionRef.current.inFlight = true;
    leftTurnActionRef.current.key = key;

    (async () => {
      try {
        if (isTeamMode()) {
          await autoPlayLeftTurn(turnPlayer, currentSession);
        } else {
          await forceAdvanceTurnFromLeft(turnUserId, currentSession, players);
          await refreshSession();
        }
      } catch (err) {
        console.error('Failed to process resigned turn:', err);
      } finally {
        leftTurnActionRef.current.inFlight = false;
      }
    })();
  }, [
    open,
    currentSession?.id,
    currentSession?.status,
    currentSession?.current_turn_user_id,
    currentSession?.last_roll,
    currentSession?.display_roll,
    players,
    user?.id,
  ]);

  const passTurnToNextPlayer = async () => {
    if (!currentSession?.id) {
      await refreshSession();
      return;
    }

    const sorted = isTeamMode()
      ? [...players].sort((a, b) => a.seat_number - b.seat_number)
      : [...players].filter(p => !isPlayerLeft(p)).sort((a, b) => a.seat_number - b.seat_number);
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

    let nextPlayer = null;
    if (isTeamMode()) {
      // Alternate teams: after a Team A player, pick a Team B player (and vice versa).
      // Within each team, cycle by seat order so both teammates get turns.
      const currentPlayer = sorted[baseIdx];
      const currentTeam = getEffectiveTeam(currentPlayer);
      const targetTeam = currentTeam === 'A' ? 'B' : 'A';

      // Collect players from the target team sorted by seat.
      const targetTeamPlayers = sorted.filter(p => getEffectiveTeam(p) === targetTeam);

      if (targetTeamPlayers.length > 0) {
        // Cycle through target team players so both teammates get equal turns.
        const teamCycleIdx = Math.floor(baseIdx / 2) % targetTeamPlayers.length;
        nextPlayer = targetTeamPlayers[teamCycleIdx] || targetTeamPlayers[0];
      }
    } else {
      nextPlayer = sorted[(baseIdx + 1) % sorted.length];
    }

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

    // Disable piece selection immediately so there are no double-taps
    setMovablePieces([]);
    setSelectedPiece(null);

    try {
      const { data, error } = await supabase.rpc('move_ludo_piece', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
        p_piece_number: pieceNumber,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to move');

      // Apply the server-confirmed position so canvas animation starts immediately
      // after RPC returns — no overshoot, no rubber-band.
      if (typeof data.new_pos === 'number' && data.piece_number) {
        const pieceKey = `piece${data.piece_number}`;
        setPlayers(prev =>
          prev.map(p =>
            String(p.user_id) === String(user.id)
              ? { ...p, [pieceKey]: data.new_pos }
              : p
          )
        );
      }

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

      // Give the canvas animation (~110ms) time to finish before refreshSession
      // overwrites the players state with the authoritative snapshot.
      await new Promise(resolve => setTimeout(resolve, 180));

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
    if (movingPieceRef.current) return;
    movingPieceRef.current = true;
    setSelectedPiece(pieceNumber);
    try {
      await movePiece(pieceNumber);
    } finally {
      movingPieceRef.current = false;
    }
  };

  const handleCanvasClick = (e) => {
    if (!isMyTurn || rolling) return;
    if (!movablePieces.length) return;
    if (movingPieceRef.current) return;

    const boardPlayers = getVisiblePlayersList(players, currentSession);

    const myPlayerLocal = boardPlayers.find(
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
    boardPlayers.forEach((player) => {
      const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
      pieces.forEach((pos, pieceIdx) => {
        const piecePos = getPieceCanvasPosition(player, pieceIdx, cellSize, boardPlayers);
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
      const piecePos = getPieceCanvasPosition(myPlayerLocal, pieceNum - 1, cellSize, boardPlayers);
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
      const refreshedPlayers = await loadPlayers(currentSession.id);
      await maybeEndGameForEliminatedTeam(refreshedPlayers, currentSession);
    } catch (err) {
      alert(err.message || 'Failed to leave');
    } finally {
      setLeaving(false);
    }
  };

  const startGame = async () => {
    if (!currentSession?.id || !canModerate) return;

    // Validate team mode requirements
    if (isTeamMode()) {
      if (players.length !== 4) {
        alert('Team mode requires exactly 4 players');
        return;
      }
      if (!areTeamsComplete()) {
        alert('Please complete teams: 2 players in Team A and 2 players in Team B');
        return;
      }
      if (teamsDirty) {
        alert('Please save teams before starting.');
        return;
      }
      // Teams already persisted via Save Teams — just start the game.
      const sortedFresh = [...players].sort((a, b) => a.seat_number - b.seat_number);
      const firstPlayerForTeam = sortedFresh[0];
      if (!firstPlayerForTeam?.user_id) return;

      await supabase
        .from('room_ludo_sessions')
        .update({
          status: 'playing',
          started_at: new Date().toISOString(),
          current_turn_user_id: firstPlayerForTeam.user_id,
        })
        .eq('id', currentSession.id);
      return; // done — skip the non-team-mode update below
    } else {
      if (getActivePlayersList(players).length < 2) {
        alert('Need at least 2 players');
        return;
      }
    }

    const firstPlayer = getActivePlayersList(players)[0];
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

  const resignSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    try {
      const { data, error } = await supabase.rpc('resign_ludo_game', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to resign');
      onCoinsUpdated?.();

      // If the SQL already finished the game (team eliminated), just reload and bail out.
      // The realtime room_ludo_sessions subscription will fire the finished handler.
      if (data.game_ended) {
        setShowSettingsMenu(false);
        await refreshSession();
        return;
      }

      // Game still ongoing — reload players and run the client-side team check as
      // a safety net (covers edge cases where realtime fires before SQL commits).
      const refreshedPlayers = await loadPlayers(currentSession.id);
      const { data: sd } = await supabase
        .from('room_ludo_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
      if (sd) setCurrentSession(sd);
      await maybeEndGameForEliminatedTeam(refreshedPlayers, sd || currentSession);
      setShowSettingsMenu(false);
    } catch (err) {
      alert(err.message || 'Failed to resign');
    }
  };

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    setCreating(true);
    try {
      const payload = {
        room_id: roomId,
        created_by: user.id,
        max_players: maxPlayers,
        entry_cost: entryCost,
        status: 'waiting',
        team_mode: maxPlayers === 4 && teamMode,
      };

      const { data, error } = await supabase
        .from('room_ludo_sessions')
        .insert(payload)
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

  const visiblePlayers = getVisiblePlayersList(players, currentSession);
  const activePlayers = getActivePlayersList(players);
  const isJoined = activePlayers.some(p => String(p.user_id) === String(user?.id));
  const isFull = activePlayers.length >= (currentSession?.max_players || 0);
  const isMyTurn =
    String(currentSession?.current_turn_user_id) === String(user?.id) &&
    isJoined;
  const netPrize = Math.floor((currentSession?.entry_cost || 0) * players.length * 0.9);

  // Returns the planned seat number for a player.
  // If a swap was staged via seatOverrides, that takes priority over the DB value.
  const getEffectiveSeat = (player) => {
    if (!player) return 0;
    const override = seatOverrides[String(player.user_id)];
    return override !== undefined ? Number(override) : Number(player.seat_number || 0);
  };

  // Team is always derived from the effective seat: seat 1/3 = A, seat 2/4 = B.
  // This is the single source of truth — never read team_key or a separate A/B override.
  const getEffectiveTeam = (player) => {
    if (!player) return null;
    const seat = getEffectiveSeat(player);
    return seat === 1 || seat === 3 ? 'A' : 'B';
  };

  // Alias for backward compat.
  const getLudoTeam = getEffectiveTeam;

  function isTeamMode() {
    if (Number(currentSession?.max_players || 0) !== 4) return false;
    return currentSession?.team_mode === true;
  }

  const meInTeamMode = isTeamMode()
    ? players.find(p => String(p.user_id) === String(user?.id))
    : null;
  const teammatePlayer = meInTeamMode
    ? players.find(
      p => String(p.user_id) !== String(user?.id) && getEffectiveTeam(p) === getEffectiveTeam(meInTeamMode)
    )
    : null;
  const teammatePillBaseClass =
    'h-[26px] min-w-[170px] max-w-[170px] px-3 rounded-full text-xs font-bold leading-[26px] flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-200';
  const teamHeaderStatusText = resignedTeammateName
    ? `Auto: ${resignedTeammateName}`
    : (teammatePlayer?.name ? `Your teammate: ${teammatePlayer.name}` : null);

  useEffect(() => {
    const wasAuto = !!previousResignedTeammateRef.current;
    const isAuto = !!resignedTeammateName;
    previousResignedTeammateRef.current = resignedTeammateName;

    if (!isAuto || wasAuto) return;

    setAutoHeaderGlow(true);
    const glowTimer = setTimeout(() => setAutoHeaderGlow(false), 800);
    return () => clearTimeout(glowTimer);
  }, [resignedTeammateName]);

  useEffect(() => {
    if (currentSession?.status !== 'playing') {
      previousTurnUserIdRef.current = null;
      setTurnPulseUserId(null);
      return;
    }

    const turnUserId = String(currentSession?.current_turn_user_id || '');
    if (!turnUserId) return;

    if (previousTurnUserIdRef.current === turnUserId) return;
    previousTurnUserIdRef.current = turnUserId;

    setTurnPulseUserId(turnUserId);
    const pulseTimer = setTimeout(() => setTurnPulseUserId(null), 360);
    return () => clearTimeout(pulseTimer);
  }, [currentSession?.status, currentSession?.current_turn_user_id]);

  const getTeamPlayers = (teamLetter) => {
    return players.filter(p => getEffectiveTeam(p) === teamLetter);
  };

  const winningTeamPlayers = currentSession?.winner_team
    ? players.filter(p => getEffectiveTeam(p) === currentSession.winner_team)
    : [];
  const perPlayerPrize = Number(currentSession?.winner_coins || currentSession?.per_player_prize || 0);
  const totalTeamPrize = perPlayerPrize * winningTeamPlayers.length;

  useEffect(() => {
    if (!showResult || !currentSession?.winner_team || !currentSession?.id) return;
    if (winningTeamPlayers.length > 0) return;
    loadPlayers(currentSession.id);
  }, [showResult, currentSession?.winner_team, currentSession?.id, winningTeamPlayers.length]);

  // Handle card click in Assign Teams.
  // First click selects a player. Second click on the OPPOSITE team swaps their seats.
  // Second click on the SAME team changes selection.
  // Clicking the already-selected player deselects.
  const togglePlayerTeam = (userId) => {
    const userIdStr = String(userId);
    const player = players.find(p => String(p.user_id) === userIdStr);
    if (!player) return;

    // First click or deselect.
    if (!selectedTeamPlayerId) {
      setSelectedTeamPlayerId(userIdStr);
      return;
    }

    const selectedIdStr = String(selectedTeamPlayerId);
    if (selectedIdStr === userIdStr) {
      setSelectedTeamPlayerId(null);
      return;
    }

    const selectedPlayer = players.find(p => String(p.user_id) === selectedIdStr);
    if (!selectedPlayer) {
      setSelectedTeamPlayerId(userIdStr);
      return;
    }

    const currentTeam = getEffectiveTeam(player);
    const selectedTeam = getEffectiveTeam(selectedPlayer);

    // Same team — just change selection.
    if (selectedTeam === currentTeam) {
      setSelectedTeamPlayerId(userIdStr);
      return;
    }

    // Opposite team — swap their effective seat numbers.
    const seatA = getEffectiveSeat(selectedPlayer);
    const seatB = getEffectiveSeat(player);
    setSeatOverrides(prev => ({
      ...prev,
      [selectedIdStr]: seatB,
      [userIdStr]: seatA,
    }));
    setTeamsDirty(true);
    setSelectedTeamPlayerId(null);
  };

  // Randomly reshuffle seats 1-4 across all 4 players.
  // Seats 1/3 will be Team A, seats 2/4 will be Team B.
  const assignRandomTeams = () => {
    if (players.length !== 4) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const overrides = {};
    shuffled.forEach((p, i) => {
      overrides[String(p.user_id)] = i + 1; // seats 1, 2, 3, 4
    });
    setSeatOverrides(overrides);
    setTeamsDirty(true);
    setSelectedTeamPlayerId(null);
  };

  // Persist planned seat assignments to DB using two-phase update to avoid
  // unique constraint conflicts on seat_number.
  const saveTeams = async () => {
    if (!currentSession?.id || !teamsDirty || savingTeams) return;
    setSavingTeams(true);
    savingTeamsRef.current = true;
    try {
      // Phase 1: move every player to a temporary seat (100+intended) so no two
      // rows ever share the same intended seat_number during the transition.
      for (const player of players) {
        const intendedSeat = getEffectiveSeat(player);
        const { error } = await supabase
          .from('room_ludo_players')
          .update({ seat_number: 100 + intendedSeat })
          .eq('id', player.id);
        if (error) throw error;
      }
      // Phase 2: write the final seat_number and derive team_key from it.
      for (const player of players) {
        const intendedSeat = getEffectiveSeat(player);
        const intendedTeam = intendedSeat === 1 || intendedSeat === 3 ? 'A' : 'B';
        const { error } = await supabase
          .from('room_ludo_players')
          .update({ seat_number: intendedSeat, team_key: intendedTeam })
          .eq('id', player.id);
        if (error) throw error;
      }
      // Reload so board redraws with the persisted seat numbers.
      await loadPlayers(currentSession.id);
      setSeatOverrides({});
      setTeamsDirty(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save teams');
    } finally {
      savingTeamsRef.current = false;
      setSavingTeams(false);
    }
  };

  // With 4 players and seat-based teams, teams are always 2-2 by construction.
  const areTeamsComplete = () => {
    if (!isTeamMode() || players.length !== 4) return false;
    return getTeamPlayers('A').length === 2 && getTeamPlayers('B').length === 2;
  };

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

    if (isLocalCurrentTurn && diceDisplay >= 1 && diceDisplay <= 6) {
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
    const shouldShowDice = isDisplayRollOwner || isCurrentTurnPlayer;

    if (!shouldShowDice) {
      return <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 invisible" aria-hidden="true" />;
    }

    const colorIdx = getPlayerColorIndex(player);
    const sessionRoll = Number(currentSession?.last_roll || 0);

    const isTurnMine = pid === String(user?.id) && isMyTurn;
    const canRoll = isTurnMine && !rolling && sessionRoll === 0 && movablePieces.length === 0;

    const faceValue = getVisibleDiceValueForPlayer(player);
    const hasValue = faceValue >= 1 && faceValue <= 6;

    const isLocalDice = pid === String(user?.id) && isCurrentTurnPlayer;
    const isRollingNow = isCurrentTurnPlayer && (isLocalDice ? diceAnimating : remoteDiceAnimating);
    const isTurnPulseDice = isCurrentTurnPlayer && String(turnPulseUserId || '') === pid && !isRollingNow;
    const showSettledValue = !isRollingNow && hasValue;
    const resultRollKey = `${displayRollUserId}-${displayRoll}-${sessionRoll}`;
    const isResultPulse = showSettledValue && displayRollUserId === pid && diceResultPulseKey === resultRollKey;
    const isSixGlow = !isRollingNow && displayRollUserId === pid && displayRoll === 6 && diceSixGlowKey === resultRollKey;

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
        className={`relative z-[80] w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center select-none ${
          canRoll ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          pointerEvents: 'auto',
        }}
      >
        <div
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 flex items-center justify-center shadow-lg"
          style={{
            borderColor: PLAYER_COLORS[colorIdx],
            background: `linear-gradient(135deg, ${PLAYER_COLORS[colorIdx]}22, ${PLAYER_COLORS[colorIdx]}55)`,
            boxShadow: `0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 12px ${PLAYER_COLORS[colorIdx]}55${isSixGlow ? ', 0 0 14px rgba(250,204,21,0.55)' : ''}`,
            transformOrigin: 'center center',
            animation: isRollingNow
              ? 'ludoDiceSingleSpin 620ms linear 1 both'
              : (isTurnPulseDice ? 'ludoTurnDiceNudge 360ms ease-out 1' : 'none'),
          }}
        >
          {showSettledValue ? (
            <span
              className="text-2xl sm:text-3xl font-black leading-none"
              style={{
                color: PLAYER_COLORS[colorIdx],
                animation: isResultPulse ? 'ludoDiceResultPop 360ms ease-out 1' : 'none',
                transformOrigin: 'center center',
              }}
            >
              {faceValue}
            </span>
          ) : (
            <span className="text-xl sm:text-2xl opacity-80">🎲</span>
          )}
        </div>

        {canRoll && (
          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
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
          0%   { transform: rotate(0deg)   scale(1);    }
          50%  { transform: rotate(180deg) scale(1.03); }
          100% { transform: rotate(360deg) scale(1);    }
        }
        @keyframes ludoTurnCardGlow {
          0% {
            box-shadow: 0 0 0 rgba(255,255,255,0);
          }
          50% {
            box-shadow: 0 0 14px rgba(255,255,255,0.24);
          }
          100% {
            box-shadow: 0 0 0 rgba(255,255,255,0);
          }
        }
        @keyframes ludoTurnDiceNudge {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes ludoDiceResultPop {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
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
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="font-bold text-white text-lg">Ludo</span>
          </div>
          <div className="flex items-center gap-3">
            {isTeamMode() && currentSession?.status === 'playing' && isJoined && teamHeaderStatusText && (
              <div
                className={`${teammatePillBaseClass} border border-white/20 text-white ${
                  resignedTeammateName ? 'bg-red-800/95' : 'bg-green-600/95'
                }`}
                style={{
                  boxShadow: resignedTeammateName && autoHeaderGlow
                    ? '0 0 12px rgba(239,68,68,0.55)'
                    : 'none',
                  transition: 'box-shadow 200ms ease, background-color 200ms ease',
                }}
              >
                {teamHeaderStatusText}
              </div>
            )}
            {/* Settings button — visible only for waiting moderators or playing participants */}
            {currentSession && (
              ((canModerate && currentSession.status === 'waiting') ||
                (isJoined && currentSession.status === 'playing'))
            ) && (
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
                    {currentSession.status === 'waiting' && canModerate && (
                      <button
                        onClick={() => { setShowSettingsMenu(false); cancelSession(); }}
                        className="w-full text-left px-4 py-2.5 text-rose-400 font-bold text-sm
                          hover:bg-rose-500/10 transition"
                      >
                        🚫 Cancel Game
                      </button>
                    )}
                    {currentSession.status === 'playing' && isJoined && (
                      <button
                        onClick={resignSession}
                        className="w-full text-left px-4 py-2.5 text-amber-300 font-bold text-sm
                          hover:bg-amber-500/10 transition"
                      >
                        🚪 Resign Game
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`flex-1 px-3 ${currentSession?.status === 'playing'
          ? `${isTeamMode() ? 'pt-2 pb-2' : 'pt-1 pb-2'} overflow-hidden flex flex-col`
          : 'pt-1 pb-8 overflow-y-auto'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
          ) : showResult && currentSession?.winner_team ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl animate-bounce">🏆</div>
              <div className="text-white font-black text-3xl">Team {currentSession.winner_team} Wins!</div>
              {winningTeamPlayers.length > 0 ? (
                <>
                  <div className="w-full max-w-sm bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <div className="text-amber-200 text-sm font-bold text-center mb-3">
                      Team prize: {totalTeamPrize.toLocaleString()} coins
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {winningTeamPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={player.avatar_url || FALLBACK_AVATAR}
                              alt={player.name}
                              className="w-12 h-12 rounded-full border-2 border-amber-400 object-cover"
                              onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                            />
                            <div className="min-w-0">
                              <div className="text-white font-bold truncate">{player.name}</div>
                              <div className="text-amber-300 text-sm font-black">+{perPlayerPrize.toLocaleString()} coins</div>
                            </div>
                          </div>
                          <div className={`text-[10px] font-black leading-tight px-2 py-1 rounded-full shrink-0 ${
                            currentSession.winner_team === 'A'
                              ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/40'
                              : 'bg-violet-400/20 text-violet-200 border border-violet-300/40'
                          }`}>
                            Team {currentSession.winner_team}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              )}
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
            <div className={`relative flex flex-col flex-1 ${currentSession?.status === 'playing' ? 'gap-1 mt-0' : 'gap-2'}`}>
              {/* Info bar */}
              <div className="flex items-center justify-between
                bg-slate-800 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Entry</div>
                  <div className="text-amber-400 font-black text-xs">
                    🪙 {currentSession.entry_cost.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Players</div>
                  <div className="text-white font-black text-xs">
                    {visiblePlayers.length}/{currentSession.max_players}
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
                const diceSideByVisualIdx = ['right', 'left', 'left', 'right'];

                const playersWithVisuals = visiblePlayers.map((p) => {
                  const visualIdx = getRelativeVisualSeat(p, visiblePlayers);
                  const colorIdx = getPlayerColorIndex(p, visiblePlayers);
                  return { player: p, visualIdx, colorIdx };
                });

                const renderPlayerWithDice = (entry) => {
                  if (!entry) return null;
                  const { player: p, visualIdx, colorIdx } = entry;
                  const team = getEffectiveTeam(p);
                  const isCurrentTurn = String(currentSession.current_turn_user_id) === String(p.user_id);
                  const isTurnPulseCard = isCurrentTurn && String(turnPulseUserId || '') === String(p.user_id);
                  const piecesFinished = p.pieces_finished || 0;
                  const isFinishFx = String(recentFinishedUserId) === String(p.user_id);
                  const diceSide = diceSideByVisualIdx[visualIdx] || 'right';
                  const isAutoForViewer = isTeamMode() && (p.left_at || p.is_left) && (() => {
                    const me = players.find(pl => String(pl.user_id) === String(user?.id));
                    return me && String(me.user_id) !== String(p.user_id) && getEffectiveTeam(me) === getEffectiveTeam(p);
                  })();

                  const playerCard = (
                    <div
                      className="flex flex-col items-center gap-0.5 rounded-xl p-1 backdrop-blur-sm transition"
                      style={{
                        background: isCurrentTurn ? `${PLAYER_COLORS[colorIdx]}44` : 'rgba(0,0,0,0.55)',
                        outline: isCurrentTurn ? `2px solid ${PLAYER_COLORS[colorIdx]}` : 'none',
                        boxShadow: isFinishFx ? `0 0 0 2px ${PLAYER_COLORS[colorIdx]}, 0 0 18px ${PLAYER_COLORS[colorIdx]}cc` : undefined,
                        animation: isTurnPulseCard ? 'ludoTurnCardGlow 360ms ease-out 1' : 'none',
                        maxWidth: '60px',
                      }}
                    >
                      <img
                        src={p.avatar_url || FALLBACK_AVATAR}
                        alt={p.name}
                        className="w-7 h-7 rounded-full object-cover"
                        style={{
                          border: `2px solid ${PLAYER_COLORS[colorIdx]}`,
                          opacity: isAutoForViewer ? 0.75 : 1,
                        }}
                        onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                      />
                      <div className="text-white text-[9px] font-bold max-w-[56px] truncate text-center leading-tight">
                        {p.name}
                      </div>
                      {isTeamMode() && team && (
                        <div className="relative">
                          <div className={`text-[9px] font-black leading-tight px-1.5 py-[1px] rounded-full ${
                            team === 'A'
                              ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/40'
                              : 'bg-violet-400/20 text-violet-200 border border-violet-300/40'
                          }`}>
                            {team}
                          </div>
                          {isAutoForViewer && (
                            <span className="pointer-events-none absolute -top-[2px] -right-[2px] text-[9px] leading-none font-semibold px-[5px] py-[1px] rounded-full bg-amber-900/95 text-amber-100 border border-amber-400/40 opacity-[0.85]">
                              Auto
                            </span>
                          )}
                        </div>
                      )}
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
                    <div key={p.id} className={`flex items-center gap-1 sm:gap-2 min-h-[64px] sm:min-h-[80px] ${isFinishFx ? 'animate-bounce' : ''}`}>
                      {diceSide === 'left' && renderDiceSlot(p)}
                      {playerCard}
                      {diceSide === 'right' && renderDiceSlot(p)}
                    </div>
                  );
                };

                const topLeft = playersWithVisuals.find(x => x.visualIdx === 3);
                const topRight = playersWithVisuals.find(x => x.visualIdx === 2);
                const bottomLeft = playersWithVisuals.find(x => x.visualIdx === 0);
                const bottomRight = playersWithVisuals.find(x => x.visualIdx === 1);

                return (
                  <>
                    {/* Top players: fixed by real home slot */}
                    <div className="mt-1 shrink-0 min-h-[64px] sm:min-h-[80px]">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex-1 flex justify-start">{renderPlayerWithDice(topLeft)}</div>
                        <div className="flex-1 flex justify-end">{renderPlayerWithDice(topRight)}</div>
                      </div>
                    </div>

                    {/* Board */}
                    <div className="mt-1 flex-1 flex flex-col justify-center items-center min-h-0 w-full relative">
                      {finishToast && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none rounded-full bg-amber-400/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg animate-bounce">
                          {finishToast}
                        </div>
                      )}
                      <div
                        className={`relative bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-300 flex items-center justify-center shrink min-h-0 ${
                          recentFinishedUserId ? 'animate-pulse' : ''
                        }`}
                        style={{
                          boxShadow: recentFinishedUserId
                            ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 24px rgba(251,191,36,0.35)'
                            : undefined,
                          maxHeight: '100%',
                          maxWidth: '100%',
                          aspectRatio: '1 / 1'
                        }}
                      >
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={600}
                          onClick={handleCanvasClick}
                          className="w-full h-full rounded-lg object-contain"
                        />
                        {/* Team A/B corner badges */}
                        {isTeamMode() && playersWithVisuals.map(({ player: bp, visualIdx: vi }) => {
                          const bTeam = getEffectiveTeam(bp);
                          const cornerClass = [
                            'bottom-2 left-2 sm:bottom-3 sm:left-3',
                            'bottom-2 right-2 sm:bottom-3 sm:right-3',
                            'top-2 right-2 sm:top-3 sm:right-3',
                            'top-2 left-2 sm:top-3 sm:left-3',
                          ][vi];
                          return (
                            <div
                              key={bp.id}
                              className={`pointer-events-none absolute ${cornerClass} z-10 w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] flex items-center justify-center rounded-full text-[8px] sm:text-[9px] font-black border shadow-md ${
                                bTeam === 'A'
                                  ? 'bg-cyan-500/85 text-white border-cyan-300/70'
                                  : 'bg-violet-500/85 text-white border-violet-300/70'
                              }`}
                            >
                              {bTeam}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom players: fixed by real home slot */}
                    <div className="mt-1 shrink-0 min-h-[64px] sm:min-h-[80px]">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex-1 flex justify-start">{renderPlayerWithDice(bottomLeft)}</div>
                        <div className="flex-1 flex justify-end">{renderPlayerWithDice(bottomRight)}</div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Board (non-playing) */}
              {currentSession.status !== 'playing' && (
                <div
                  className={`relative bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-300 mx-auto w-full max-w-[500px] ${
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

              {/* Waiting: players list or team selection */}
              {currentSession.status === 'waiting' && isTeamMode() && players.length === 4 ? (
                <div className="flex flex-col gap-3">
                  <div className="text-center text-white/70 text-xs font-bold uppercase tracking-wider">
                    🎯 Assign Teams
                  </div>
                  
                  {/* Team Selection Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Team A */}
                    <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl p-3">
                      <div className="text-cyan-300 font-bold text-sm text-center mb-2">
                        Team A
                      </div>
                      <div className="flex flex-col gap-2">
                        {getTeamPlayers('A').map(p => {
                          const colorIdx = getPlayerColorIndex(p);
                          const isSelected = String(selectedTeamPlayerId) === String(p.user_id);
                          const effSeat = getEffectiveSeat(p);
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePlayerTeam(p.user_id)}
                              className={`flex items-center gap-2 bg-cyan-400/10 hover:bg-cyan-400/20
                                border border-cyan-400/30 rounded-lg px-2 py-2 transition cursor-pointer
                                active:scale-95 ${isSelected ? 'ring-2 ring-white scale-[1.02]' : ''}`}
                            >
                              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: PLAYER_COLORS[effSeat - 1] || PLAYER_COLORS[colorIdx] }} />
                              <img
                                src={p.avatar_url || FALLBACK_AVATAR}
                                alt={p.name}
                                className="w-6 h-6 rounded-full object-cover"
                                onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                              />
                              <span className="text-white text-xs font-bold truncate flex-1">
                                {p.name}
                              </span>
                              {String(p.user_id) === String(user?.id) && (
                                <span className="text-amber-300 text-[8px] shrink-0">You</span>
                              )}
                              {(p.left_at || p.is_left) && (
                                <span className="text-amber-200 text-[8px] shrink-0 px-1 py-[1px] rounded-full bg-white/10 border border-amber-300/40">
                                  Auto
                                </span>
                              )}
                              <span className="text-white/30 text-[7px] shrink-0 font-mono">
                                s:{effSeat}
                              </span>
                            </button>
                          );
                        })}
                        {getTeamPlayers('A').length < 2 && (
                          <div className="flex items-center justify-center py-3 text-white/40 text-xs">
                            {2 - getTeamPlayers('A').length} slot{2 - getTeamPlayers('A').length !== 1 ? 's' : ''} available
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team B */}
                    <div className="bg-violet-500/10 border-2 border-violet-500/30 rounded-xl p-3">
                      <div className="text-violet-300 font-bold text-sm text-center mb-2">
                        Team B
                      </div>
                      <div className="flex flex-col gap-2">
                        {getTeamPlayers('B').map(p => {
                          const colorIdx = getPlayerColorIndex(p);
                          const isSelected = String(selectedTeamPlayerId) === String(p.user_id);
                          const effSeat = getEffectiveSeat(p);
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePlayerTeam(p.user_id)}
                              className={`flex items-center gap-2 bg-violet-400/10 hover:bg-violet-400/20
                                border border-violet-400/30 rounded-lg px-2 py-2 transition cursor-pointer
                                active:scale-95 ${isSelected ? 'ring-2 ring-white scale-[1.02]' : ''}`}
                            >
                              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: PLAYER_COLORS[effSeat - 1] || PLAYER_COLORS[colorIdx] }} />
                              <img
                                src={p.avatar_url || FALLBACK_AVATAR}
                                alt={p.name}
                                className="w-6 h-6 rounded-full object-cover"
                                onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                              />
                              <span className="text-white text-xs font-bold truncate flex-1">
                                {p.name}
                              </span>
                              {String(p.user_id) === String(user?.id) && (
                                <span className="text-amber-300 text-[8px] shrink-0">You</span>
                              )}
                              {(p.left_at || p.is_left) && (
                                <span className="text-amber-200 text-[8px] shrink-0 px-1 py-[1px] rounded-full bg-white/10 border border-amber-300/40">
                                  Auto
                                </span>
                              )}
                              <span className="text-white/30 text-[7px] shrink-0 font-mono">
                                s:{effSeat}
                              </span>
                            </button>
                          );
                        })}
                        {getTeamPlayers('B').length < 2 && (
                          <div className="flex items-center justify-center py-3 text-white/40 text-xs">
                            {2 - getTeamPlayers('B').length} slot{2 - getTeamPlayers('B').length !== 1 ? 's' : ''} available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Random Teams Button */}
                  <button
                    onClick={assignRandomTeams}
                    className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20
                      border border-white/20 text-white font-bold text-xs
                      active:scale-95 transition"
                  >
                    🔀 Random Teams
                  </button>

                  {/* Save Teams Button */}
                  <button
                    onClick={saveTeams}
                    disabled={!teamsDirty || savingTeams}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500
                      border border-cyan-400/40 text-white font-bold text-xs
                      active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingTeams
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : '💾 Save Teams'
                    }
                  </button>

                  {/* Status Message */}
                  <div className="text-center text-white/50 text-[10px]">
                    {areTeamsComplete() ? (
                      <span className="text-green-400">✓ Teams ready</span>
                    ) : (
                      <span>Assign {4 - players.length === 0 ? (2 - getTeamPlayers('A').length) + (2 - getTeamPlayers('B').length) : 0} more player{((2 - getTeamPlayers('A').length) + (2 - getTeamPlayers('B').length)) !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              ) : currentSession.status !== 'playing' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {visiblePlayers.map(p => {
                    const colorIdx = getPlayerColorIndex(p);
                    const isResignedTeammate = isTeamMode() && (p.left_at || p.is_left) && (() => {
                      const me = players.find(pl => String(pl.user_id) === String(user?.id));
                      return me && String(me.user_id) !== String(p.user_id) && getEffectiveTeam(me) === getEffectiveTeam(p);
                    })();
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
                        {isResignedTeammate && (
                          <span className="text-amber-200 text-[9px] shrink-0 px-1.5 py-[1px] rounded-full bg-white/10 border border-amber-300/40 ml-auto">
                            Auto
                          </span>
                        )}
                        {String(p.user_id) === String(user?.id) && (
                          <span className="text-amber-300 text-[9px] shrink-0">You</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

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
                  <button onClick={startGame} disabled={isTeamMode() ? !areTeamsComplete() : activePlayers.length < 2}
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
                    🤝 Mode
                  </div>
                  <button
                    onClick={() => {
                      if (maxPlayers !== 4) return;
                      setTeamMode(v => !v);
                    }}
                    disabled={maxPlayers !== 4}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs active:scale-95 transition ${
                      maxPlayers === 4
                        ? (teamMode
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-white/80 hover:bg-white/20')
                        : 'bg-white/5 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    Team 2v2 {teamMode ? 'ON' : 'OFF'}
                  </button>
                  {maxPlayers !== 4 && (
                    <div className="text-[10px] text-white/45 mt-1">
                      Team mode is available only with 4 players.
                    </div>
                  )}
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