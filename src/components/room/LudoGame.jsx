import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Settings } from 'lucide-react';
import { ROOM_EMOJIS } from "@/lib/roomEmojis";
import { RoomEmojiAsset } from "@/components/room/RoomChat";

import {
  FALLBACK_AVATAR,
  MAX_PLAYERS_OPTIONS,
  ENTRY_COST_OPTIONS,
  PLAYER_COLORS,
  PLAYER_LIGHT_COLORS,
  PLAYER_DARK_COLORS,
  TRACK_CELLS,
  SAFE_SQUARES,
  START_POSITIONS,
  HOME_ENTRY_LOGICAL_INDEX,
  HOME_ENTRY_ARROW_CELLS,
  HOME_COLUMNS,
  HOME_BASES,
  PIECE_STACK_OFFSETS,
  getPieceStackOffset,
  VISUAL_SEAT_LAYOUTS
} from './ludoUtils';

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
  const [turnTimeLeft, setTurnTimeLeft] = useState(12);
  const [soundMuted, setSoundMuted] = useState(false);
  const [bumpFlash, setBumpFlash] = useState(null); // {x, y, colorIdx}
  const [sixFlash, setSixFlash] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [ludoEmojiEffects, setLudoEmojiEffects] = useState([]);
  const LUDO_EMOJI_IDS = [
  "fist",
  "Bottle",
  "kissing",
  "kiss",
  "Alarm-clockjson",
  "Clinking",
  "clap",
  "dancer",
  "donkey",
  "laughing",
  "Running",
  "Clinking",
  "Money-face",
];

const LUDO_EMOJIS = LUDO_EMOJI_IDS
  .map(id => ROOM_EMOJIS.find(e => e.id === id))
  .filter(Boolean);
  

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
  const savingTeamsRef = useRef(false);
  const teamTurnCycleRef = useRef(0);
  const soundMutedRef = useRef(false);
  const bumpFlashTimerRef = useRef(null);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [turnGlowTick, setTurnGlowTick] = useState(0);
  const inactivePlayersRef = useRef(new Set());
  const autoPlayVersionRef = useRef(0);
  const disconnectedResignRef = useRef(new Set());

  // ─── Sound utility ────────────────────────────
  const playSound = (type) => {
    if (soundMutedRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);

      if (type === 'roll') {
        o.type = 'square'; o.frequency.setValueAtTime(220, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        o.start(); o.stop(ctx.currentTime + 0.12);
      } else if (type === 'six') {
        // Fanfare for 6
        [0, 0.07, 0.14].forEach((delay, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime([523, 659, 784][i], ctx.currentTime + delay);
          g2.gain.setValueAtTime(0.22, ctx.currentTime + delay);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
          o2.start(ctx.currentTime + delay);
          o2.stop(ctx.currentTime + delay + 0.13);
        });
        return;
      } else if (type === 'move') {
        o.type = 'sine'; o.frequency.setValueAtTime(660, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        o.start(); o.stop(ctx.currentTime + 0.09);
      } else if (type === 'exit') {
        // Exit base — ascending pop
        o.type = 'sine'; o.frequency.setValueAtTime(330, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o.start(); o.stop(ctx.currentTime + 0.15);
      } else if (type === 'finish') {
        // Goal reached — victory chime
        [0, 0.1, 0.2, 0.32].forEach((delay, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'sine';
          o2.frequency.setValueAtTime([523, 659, 784, 1047][i], ctx.currentTime + delay);
          g2.gain.setValueAtTime(0.2, ctx.currentTime + delay);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
          o2.start(ctx.currentTime + delay);
          o2.stop(ctx.currentTime + delay + 0.19);
        });
        return;
      } else if (type === 'bump') {
        o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        o.start(); o.stop(ctx.currentTime + 0.2);
      } else if (type === 'applause') {
        // Energetic victory fanfare — ascending chords + sparkle
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
        // Bass punch at start
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.connect(bassGain); bassGain.connect(ctx.destination);
        bass.type = 'sine';
        bass.frequency.setValueAtTime(130, ctx.currentTime);
        bass.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.3);
        bassGain.gain.setValueAtTime(0.3, ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        bass.start(ctx.currentTime);
        bass.stop(ctx.currentTime + 0.36);
        // Sparkle high notes
        [0.3, 0.5, 0.65, 0.8].forEach((t, i) => {
          const os = ctx.createOscillator();
          const gs = ctx.createGain();
          os.connect(gs); gs.connect(ctx.destination);
          os.type = 'sine';
          os.frequency.setValueAtTime([1568, 1760, 1976, 2093][i], ctx.currentTime + t);
          gs.gain.setValueAtTime(0.1, ctx.currentTime + t);
          gs.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
          os.start(ctx.currentTime + t);
          os.stop(ctx.currentTime + t + 0.16);
        });
        return;
      }
    } catch (_) {}
  };

  // ─── Helpers ─────────────────────────────────
  const isPlayerLeft = (player) => Boolean(player?.left_at);

  const getActivePlayersList = useCallback((playersList = players) =>
    (playersList || []).filter(p => !p.refunded_at && !isPlayerLeft(p)),
  [players]);

  // FIX #2: In classic mode, left players are always excluded from waiting list display
  const getVisiblePlayersList = useCallback((playersList = players, sessionArg = currentSession) => {
    const isTeamSession =
      Number(sessionArg?.max_players || 0) === 4 &&
      sessionArg?.team_mode === true;
    if (isTeamSession) return (playersList || []).filter(p => !p.refunded_at);
    // Classic mode: always exclude left players from all views
    return (playersList || []).filter(p => !p.refunded_at && !isPlayerLeft(p));
  }, [players, currentSession]);

  function isTeamMode(sessionArg) {
    const s = sessionArg || currentSession;
    if (Number(s?.max_players || 0) !== 4) return false;
    return s?.team_mode === true;
  }

  const getEffectiveSeat = (player) => {
    if (!player) return 0;
    const override = seatOverrides[String(player.user_id)];
    return override !== undefined ? Number(override) : Number(player.seat_number || 0);
  };

  const getEffectiveTeam = (player) => {
    if (!player) return null;
    const seat = getEffectiveSeat(player);
    return seat === 1 || seat === 3 ? 'A' : 'B';
  };

  const getLudoTeam = getEffectiveTeam;

  const normalizeColorIndex = (idx) => {
    const n = Number(idx);
    if (!Number.isFinite(n)) return 0;
    return ((n % 4) + 4) % 4;
  };

  // Color index is always derived from absolute seat_number.
  // seat 1=Red(0), seat 2=Blue(1), seat 3=Yellow(2), seat 4=Green(3)
  // For 2-player: seats 1,2 map to colors 0,2 (Red,Yellow — opposite corners)
  // For 3-player: seats 1,2,3 map to colors 0,1,2
  const getPlayerColorIndex = (player, playersList = players) => {
    let seat = Number(player?.seat_number || 1);
    if (seat > 100) seat = seat - 100;
    const totalPlayers = Number(currentSession?.max_players || playersList.length || 4);
    const layout = VISUAL_SEAT_LAYOUTS[totalPlayers] || [0, 1, 2, 3];
    const seatIdx = Math.max(0, seat - 1);
    return normalizeColorIndex(layout[seatIdx] ?? seatIdx);
  };

  const getRelativeVisualSeat = (player, playersList = players) => {
    const totalPlayers = playersList.length;
    if (!totalPlayers) return 0;

    const layout = VISUAL_SEAT_LAYOUTS[totalPlayers] || [0, 1, 2, 3];
    const sortedBySeat = [...playersList].sort((a, b) => a.seat_number - b.seat_number);

    // FIX #6: Graceful fallback when user is not in the game (observer mode)
    const myPlayerInGame = sortedBySeat.find(
      p => String(p.user_id) === String(user?.id)
    );
    const myBaseIndex = myPlayerInGame
      ? sortedBySeat.findIndex(p => String(p.user_id) === String(myPlayerInGame.user_id))
      : 0;

    const playerIndex = sortedBySeat.findIndex(p => String(p.user_id) === String(player.user_id));
    if (playerIndex === -1) return 0;

    const relativeIndex = ((playerIndex - myBaseIndex) % totalPlayers + totalPlayers) % totalPlayers;
    return layout[relativeIndex] ?? 0;
  };

  // ─── Cleanup ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (finishFxTimerRef.current) clearTimeout(finishFxTimerRef.current);
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      if (boardAnimFrameRef.current) cancelAnimationFrame(boardAnimFrameRef.current);
      if (bumpFlashTimerRef.current) clearTimeout(bumpFlashTimerRef.current);
      pieceMoveAnimRef.current = {};
      lastPieceCanvasPosRef.current = {};
    };
  }, []);

  // Drive the turn-owner glow pulse via state tick — triggers fresh drawBoard with current players
  useEffect(() => {
    if (currentSession?.status !== 'playing' || !currentSession?.current_turn_user_id) return;
    const interval = setInterval(() => setTurnGlowTick(t => (t + 1) % 1000), 80);
    return () => clearInterval(interval);
  }, [currentSession?.status, currentSession?.current_turn_user_id]);

  useEffect(() => { soundMutedRef.current = soundMuted; }, [soundMuted]);

  useEffect(() => {
    if (maxPlayers !== 4 && teamMode) setTeamMode(false);
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

  useEffect(() => {
    if (currentSession?.status === 'playing' || !currentSession?.id) {
      setSeatOverrides({});
      setSelectedTeamPlayerId(null);
      setTeamsDirty(false);
    }
    // Reset inactive tracking on new session
    if (!currentSession?.id) {
      inactivePlayersRef.current = new Set();
      setIsAutoPlay(false);
    }
  }, [currentSession?.id, currentSession?.status]);

  // FIX #2 (cont): Clear resignedTeammateName when session resets
  useEffect(() => {
    if (!currentSession?.id) {
      setResignedTeammateName(null);
    }
  }, [currentSession?.id]);

  // ─── Remote dice animation ────────────────────
  useEffect(() => {
    if (!currentSession?.id) return;

    const roll = Number(currentSession.display_roll || 0);
    const turnUserId = String(currentSession.current_turn_user_id || '');
    const displayRollUserId = String(currentSession.display_roll_user_id || '');

    if (roll < 1 || roll > 6 || !turnUserId || !displayRollUserId) {
      setRemoteDiceAnimating(false);
      return;
    }

    if (turnUserId !== displayRollUserId) {
      setRemoteDiceAnimating(false);
      return;
    }

    const key = `${displayRollUserId}-${roll}-${currentSession.last_roll || 0}`;
    if (lastSeenRollRef.current === key) return;
    lastSeenRollRef.current = key;

    if (displayRollUserId === String(user?.id)) return;

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

  // ─── Dice result pulse ────────────────────────
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

  // ─── Auto-play when board is closed ──────────
  // When the player closes the board mid-game, immediately mark them inactive
  // so the turn timer fires auto-play instead of freezing the game.
  useEffect(() => {
    if (open) return;
    if (currentSession?.status !== 'playing' || !currentSession?.id) return;
    const myPlayer = players.find(p => String(p.user_id) === String(user?.id));
    if (!myPlayer || myPlayer.left_at || myPlayer.refunded_at) return;
    inactivePlayersRef.current.add(String(user?.id));
    setIsAutoPlay(v => !v);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Turn countdown timer ─────────────────────
  useEffect(() => {
    const myPlayer = players.find(p => String(p.user_id) === String(user?.id));
    const isMine =
      String(currentSession?.current_turn_user_id) === String(user?.id) &&
      !!myPlayer && !myPlayer.left_at;

    if (!isMine || currentSession?.status !== 'playing') {
      setTurnTimeLeft(12);
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
      return;
    }

    if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }

    const autoMode = inactivePlayersRef.current.has(String(user?.id));
    const sessionId = currentSession.id;
    const userId = user?.id;
    const lastRollNow = Number(currentSession?.last_roll || 0);

    // Direct DB auto-action — bypasses stale React closures entirely
    const fireAutoAction = async () => {
      try {
        // Check it's still our turn from DB
        const { data: sess } = await supabase
          .from('room_ludo_sessions')
          .select('current_turn_user_id, last_roll, status')
          .eq('id', sessionId)
          .single();

        if (!sess || sess.status !== 'playing') return;
        if (String(sess.current_turn_user_id) !== String(userId)) return;

        if (!sess.last_roll || sess.last_roll === 0) {
          // Need to roll
          await supabase.rpc('get_ludo_roll', { p_session_id: sessionId, p_user_id: userId });
          await refreshSession();
          // After roll, the last_roll dep will change and trigger this effect again
        } else {
          // Need to move — get fresh player data
          const { data: playerData } = await supabase
            .from('room_ludo_players')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .maybeSingle();

          if (!playerData) return;
          const movable = getMovablePieces(playerData, sess.last_roll);
          if (movable.length > 0) {
            await supabase.rpc('move_ludo_piece', {
              p_session_id: sessionId,
              p_user_id: userId,
              p_piece_number: movable[0],
            });
          }
          await refreshSession();
        }
      } catch (e) {
        console.error('Auto-play error:', e);
      }
    };

    if (autoMode) {
      setTurnTimeLeft(0);
      const WAIT = lastRollNow > 0 ? 500 : 1200;
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        fireAutoAction();
      }, WAIT);
      return () => { done = true; clearTimeout(t); };
    }

    // Active: 12s countdown
    setTurnTimeLeft(12);
    let remaining = 12;
    let done = false;

    turnTimerRef.current = setInterval(() => {
      if (done) return;
      remaining -= 1;
      setTurnTimeLeft(remaining);
      if (remaining > 0) return;

      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
      done = true;

      inactivePlayersRef.current.add(String(userId));
      setIsAutoPlay(v => !v); // trigger re-render so next turn uses autoMode
      fireAutoAction();
    }, 1000);

    return () => {
      done = true;
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
    };
  }, [currentSession?.id, currentSession?.current_turn_user_id, currentSession?.last_roll, currentSession?.status, open, isAutoPlay]);

  // ─── Resign notifications ─────────────────────
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
        !!prev && !prev.left_at && !!p.left_at;
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

  // ─── Realtime ─────────────────────────────────
  // Subscription stays active even when the board is closed so turn changes
  // reach the auto-play logic and the game never freezes.
  useEffect(() => {
    if (!roomId) return;

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
              const w = ps.find(p => String(p.user_id) === String(s.winner_id));
              if (!w) { resultFiredRef.current = false; return; }

              // Only block if this looks like a false positive (no pieces finished AND
              // other players are still active — i.e. not a resignation win)
              const otherActivePlayers = ps.filter(
                p => String(p.user_id) !== String(s.winner_id) && !p.left_at && !p.refunded_at
              );
              const isResignationWin = otherActivePlayers.length === 0;
              const isNormalWin = Number(w.pieces_finished || 0) >= 4;

              if (!isNormalWin && !isResignationWin) {
                // False positive — game not actually over
                resultFiredRef.current = false;
                setCurrentSession(prev => prev
                  ? { ...s, status: 'playing', winner_id: null, winner_coins: 0 }
                  : prev
                );
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
        if (currentSession?.id && !savingTeamsRef.current) {
          const refreshedPlayers = await loadPlayers(currentSession.id);
          await maybeEndGameForEliminatedTeam(refreshedPlayers, currentSession);
        }
      })

      .on('broadcast', { event: 'ludo_emoji' }, ({ payload }) => {
  if (!payload?.emoji || !payload?.target_user_id) return;

  const id = `${payload.sender_user_id || payload.sender_id}_${payload.target_user_id}_${payload.ts || Date.now()}`;

  setLudoEmojiEffects(prev => [
  ...prev,
  {
    id,
    emoji: payload.emoji,
    senderUserId: String(payload.sender_user_id || payload.sender_id || ''),
    targetUserId: String(payload.target_user_id),
  }
]);

  setTimeout(() => {
    setLudoEmojiEffects(prev => prev.filter(x => x.id !== id));
  }, 1800);
})

      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [roomId, currentSession?.id]);

  // FIX #5: drawBoard depends on movablePieces, selectedPiece, user too
  useEffect(() => {
    if (!canvasRef.current || !currentSession) return;
    drawBoard();
  }, [players, currentSession, movablePieces, selectedPiece, user?.id, sixFlash, bumpFlash, turnGlowTick]);

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

  // ─── DB ──────────────────────────────────────
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

    if (!playersData?.length) { setPlayers([]); return []; }

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

    if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
    onCoinsUpdated?.();
    setMessage(`Team ${winningTeam} wins`);
    setTimeout(() => setMessage(''), 3000);
    setCurrentSession(prev => prev
      ? { ...prev, status: 'finished', winner_team: winningTeam, winner_id: data?.winner_id || prev.winner_id || null, winner_coins: data?.winner_coins || prev.winner_coins || 0, current_turn_user_id: null }
      : prev
    );
  };

  const maybeEndGameForEliminatedTeam = async (playersList = players, sessionArg = currentSession) => {
    if (!sessionArg?.id || sessionArg?.status !== 'playing') return;
    if (!isTeamMode(sessionArg)) return;

    const activePlayers = (playersList || []).filter(p => !p.refunded_at && !p.left_at);
    const teamAPlayers = activePlayers.filter(p => getEffectiveTeam(p) === 'A');
    const teamBPlayers = activePlayers.filter(p => getEffectiveTeam(p) === 'B');

    if (teamAPlayers.length === 0 && teamBPlayers.length > 0) { await endGame('B', sessionArg); return; }
    if (teamBPlayers.length === 0 && teamAPlayers.length > 0) { await endGame('A', sessionArg); }
  };

  // ─── Board geometry ───────────────────────────
  const getPieceBoardPlacement = (player, pieceIndex, playersList = players) => {
    const pieces = [player.piece1, player.piece2, player.piece3, player.piece4];
    const pos = pieces[pieceIndex];
    if (typeof pos !== 'number') return null;

    // geometryIdx: which corner/lane/base to use — always relative to current viewer
    // so each player sees themselves at bottom-left and others around the board.
    const geometryIdx = normalizeColorIndex(getRelativeVisualSeat(player, playersList));

    // colorIdx: the player's absolute color (derived from seat_number) — never changes.
    // Used only for ring color and piece color, NOT for board geometry.
    const colorIdx = normalizeColorIndex(getPlayerColorIndex(player, playersList));
    const finishedTriangleSlots = [
      [[8.35, 7.2], [8.35, 7.8], [8.7, 7.35], [8.7, 7.65]],
      [[7.2, 8.35], [7.8, 8.35], [7.35, 8.7], [7.65, 8.7]],
      [[6.65, 7.2], [6.65, 7.8], [6.3, 7.35], [6.3, 7.65]],
      [[7.2, 6.65], [7.8, 6.65], [7.35, 6.3], [7.65, 6.3]],
    ];

    if (pos === 57) {
      const finishedPieceIndices = pieces
        .map((piecePos, idx) => ({ piecePos, idx }))
        .filter(item => item.piecePos === 57)
        .map(item => item.idx);
      const slotIndex = Math.max(0, finishedPieceIndices.indexOf(pieceIndex));
      const slots = finishedTriangleSlots[geometryIdx] || [[7.5, 7.5]];
      const [row, col] = slots[Math.min(slotIndex, slots.length - 1)] || [7.5, 7.5];
      return { row, col, colorIdx, isFinished: true, zone: 'finished', seatNumber: Number(player?.seat_number || 0), logicalPos: pos, trackIndex: null };
    }

    if (pos === -1) {
      const homeBase = HOME_BASES[geometryIdx];
      if (!homeBase || !homeBase[pieceIndex]) return null;
      const [baseRow, baseCol] = homeBase[pieceIndex];
      return { row: baseRow, col: baseCol, colorIdx, isFinished: false, zone: 'base', seatNumber: Number(player?.seat_number || 0), logicalPos: pos, trackIndex: null };
    }

    if (pos >= 0 && pos <= 51) {
      const adjustedPos = (pos + START_POSITIONS[geometryIdx]) % 52;
      const [entryRow, entryCol] = HOME_ENTRY_ARROW_CELLS[geometryIdx] || [];
      const entryTrackIndex = TRACK_CELLS.findIndex(([row, col]) => row === entryRow && col === entryCol);
      const trackCell = TRACK_CELLS[adjustedPos];
      const isInvalidOuterAfterEntry =
        entryTrackIndex !== -1 &&
        adjustedPos === (entryTrackIndex + 1) % TRACK_CELLS.length;

      if (isInvalidOuterAfterEntry) {
        const homeCol = HOME_COLUMNS[geometryIdx];
        if (!homeCol || !homeCol[0]) return null;
        const [row, col] = homeCol[0];
        return { row: row + 0.0001, col, colorIdx, isFinished: false, zone: 'home-lane', seatNumber: Number(player?.seat_number || 0), logicalPos: pos, trackIndex: adjustedPos, derivedFromOuterTrack: true };
      }

      if (!trackCell) return null;
      const [row, col] = trackCell;
      return { row, col, colorIdx, isFinished: false, zone: 'outer-track', seatNumber: Number(player?.seat_number || 0), logicalPos: pos, trackIndex: adjustedPos };
    }

    if (pos >= 52 && pos <= 56) {
      const homeColIdx = pos - 52;
      const homeCol = HOME_COLUMNS[geometryIdx];
      if (!homeCol || !homeCol[homeColIdx]) return null;
      const [row, col] = homeCol[homeColIdx];
      return { row, col, colorIdx, isFinished: false, zone: 'home-lane', seatNumber: Number(player?.seat_number || 0), logicalPos: pos, trackIndex: null };
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

  // ─── Debug home-entry mapping ─────────────────
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
        });
      });
    });

    const snapshot = JSON.stringify(debugRows);
    if (!debugRows.length || snapshot === homeEntryDebugSnapshotRef.current) return;
    homeEntryDebugSnapshotRef.current = snapshot;
    console.debug('Ludo home-entry mapping', debugRows);
  }, [players, currentSession?.id]);

  // ─── Draw board ───────────────────────────────
  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const CELLS = 15;
    const cellSize = W / CELLS;
    const boardPlayers = getVisiblePlayersList(players, currentSession);

    const getVisualColorIndex = (visualIdx) => {
      const playerAtVisual = boardPlayers.find(p => getRelativeVisualSeat(p, boardPlayers) === visualIdx);
      return normalizeColorIndex(playerAtVisual ? getPlayerColorIndex(playerAtVisual, boardPlayers) : visualIdx);
    };

    // Pulsing glow phase (0→1→0) on a ~1.2 s cycle — drives home + piece glow
    const glowPhase = (currentSession?.status === 'playing' && currentSession?.current_turn_user_id)
      ? (Math.sin(performance.now() / 600 * Math.PI) + 1) / 2
      : 0;

    ctx.clearRect(0, 0, W, W);

    // Six flash glow border
    if (sixFlash) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 40;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, W - 6);
      ctx.restore();
    }

    const bgGrad = ctx.createRadialGradient(W/2, W/2, 0, W/2, W/2, W);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, W);

    const homeColors = [
      { bg: '#fca5a5', border: '#ef4444', grad1: '#f87171', grad2: '#dc2626' },
      { bg: '#93c5fd', border: '#3b82f6', grad1: '#60a5fa', grad2: '#2563eb' },
      { bg: '#fcd34d', border: '#f59e0b', grad1: '#fbbf24', grad2: '#d97706' },
      { bg: '#86efac', border: '#22c55e', grad1: '#4ade80', grad2: '#16a34a' },
    ];

    const homeRects = [
      { r: 9, c: 0, w: 6, h: 6 },
      { r: 9, c: 9, w: 6, h: 6 },
      { r: 0, c: 9, w: 6, h: 6 },
      { r: 0, c: 0, w: 6, h: 6 },
    ];

    // currentTurnPlayer and currentTurnVisualIdx from component scope
    const currentTurnVisualIdx = currentTurnPlayer
      ? getRelativeVisualSeat(currentTurnPlayer, boardPlayers)
      : -1;

    homeRects.forEach((rect, i) => {
      const realColorIdx = getVisualColorIndex(i);
      const x = rect.c * cellSize;
      const y = rect.r * cellSize;
      const w = rect.w * cellSize;
      const h = rect.h * cellSize;
      const isTurnHome = i === currentTurnVisualIdx;

      // Border — pulsing glow for active turn home
      ctx.save();
      if (isTurnHome) {
        ctx.shadowColor = PLAYER_COLORS[realColorIdx];
        ctx.shadowBlur = 16 + glowPhase * 26;
      }
      ctx.fillStyle = homeColors[realColorIdx].border;
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      // Inner gradient — slightly dimmer for inactive homes
      const innerGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      if (isTurnHome) {
        innerGrad.addColorStop(0, homeColors[realColorIdx].grad1);
        innerGrad.addColorStop(1, homeColors[realColorIdx].grad2);
      } else {
        // Darker/less saturated for inactive
        innerGrad.addColorStop(0, homeColors[realColorIdx].grad1 + 'bb');
        innerGrad.addColorStop(1, homeColors[realColorIdx].grad2 + 'bb');
      }
      ctx.fillStyle = innerGrad;
      ctx.fillRect(x + cellSize * 0.5, y + cellSize * 0.5, w - cellSize, h - cellSize);

      // Active turn: pulsing white border ring
      if (isTurnHome) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${(0.55 + glowPhase * 0.4).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = PLAYER_COLORS[realColorIdx];
        ctx.shadowBlur = 10 + glowPhase * 20;
        ctx.strokeRect(x + cellSize * 0.6, y + cellSize * 0.6, w - cellSize * 1.2, h - cellSize * 1.2);
        ctx.restore();
      }

      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    for (let i = 0; i < TRACK_CELLS.length; i++) {
      const [row, col] = TRACK_CELLS[i];
      const x = col * cellSize;
      const y = row * cellSize;

      let cellColor = '#f8fafc';
      let isStart = false;
      const startIndices = [39, 26, 13, 0];
      const startIdx = startIndices.indexOf(i);

      if (startIdx !== -1) {
        const realColorIdx = getVisualColorIndex(startIdx);
        cellColor = homeColors[realColorIdx].grad1;
        isStart = true;
      } else if (SAFE_SQUARES.includes(i)) {
        cellColor = '#e2e8f0';
      }

      ctx.fillStyle = cellColor;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 1, y + 1, cellSize - 2, 2);
      ctx.fillRect(x + 1, y + 1, 2, cellSize - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + 1, y + cellSize - 3, cellSize - 2, 2);
      ctx.fillRect(x + cellSize - 3, y + 1, 2, cellSize - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

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

    // Arrow cell coordinates — these are on the outer track and must NOT be colored as home lane
    const arrowCellSet = new Set(
      HOME_ENTRY_ARROW_CELLS.map(([r, c]) => `${r}_${c}`)
    );

    HOME_COLUMNS.forEach((col, playerIdx) => {
      const realColorIdx = getVisualColorIndex(playerIdx);
      col.forEach(([row, c]) => {
        // Skip the arrow/entry cell — it belongs to the outer track, not the home lane
        if (arrowCellSet.has(`${row}_${c}`)) return;
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
        ctx.moveTo(cx, cy - l); ctx.lineTo(cx - s*2, cy); ctx.lineTo(cx - s, cy);
        ctx.lineTo(cx - s, cy + l); ctx.lineTo(cx + s, cy + l); ctx.lineTo(cx + s, cy); ctx.lineTo(cx + s*2, cy);
      } else if (dir === 'down') {
        ctx.moveTo(cx, cy + l); ctx.lineTo(cx - s*2, cy); ctx.lineTo(cx - s, cy);
        ctx.lineTo(cx - s, cy - l); ctx.lineTo(cx + s, cy - l); ctx.lineTo(cx + s, cy); ctx.lineTo(cx + s*2, cy);
      } else if (dir === 'left') {
        ctx.moveTo(cx - l, cy); ctx.lineTo(cx, cy - s*2); ctx.lineTo(cx, cy - s);
        ctx.lineTo(cx + l, cy - s); ctx.lineTo(cx + l, cy + s); ctx.lineTo(cx, cy + s); ctx.lineTo(cx, cy + s*2);
      } else if (dir === 'right') {
        ctx.moveTo(cx + l, cy); ctx.lineTo(cx, cy - s*2); ctx.lineTo(cx, cy - s);
        ctx.lineTo(cx - l, cy - s); ctx.lineTo(cx - l, cy + s); ctx.lineTo(cx, cy + s); ctx.lineTo(cx, cy + s*2);
      }
      ctx.fill();
      ctx.restore();
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6 * cellSize, 6 * cellSize, 3 * cellSize, 3 * cellSize);

    const triPoints = [
      [[9,6],[9,9],[7.5,7.5]],
      [[6,9],[9,9],[7.5,7.5]],
      [[6,6],[6,9],[7.5,7.5]],
      [[6,6],[9,6],[7.5,7.5]],
    ];
    triPoints.forEach((pts, i) => {
      const realColorIdx = getVisualColorIndex(i);
      ctx.beginPath();
      ctx.moveTo(pts[0][1] * cellSize, pts[0][0] * cellSize);
      ctx.lineTo(pts[1][1] * cellSize, pts[1][0] * cellSize);
      ctx.lineTo(pts[2][1] * cellSize, pts[2][0] * cellSize);
      ctx.closePath();
      const triColor = PLAYER_COLORS[realColorIdx];
      const grad = ctx.createLinearGradient(pts[0][1]*cellSize, pts[0][0]*cellSize, pts[2][1]*cellSize, pts[2][0]*cellSize);
      grad.addColorStop(0, triColor + 'ee');
      grad.addColorStop(1, triColor + '66');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw pieces
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

        // Always record current position — no animation to avoid false movement bugs
        lastPieceCanvasPosRef.current[pieceKey] = { x: px, y: py };

        // Only animate if an animation is already in progress (from movePiece RPC)
        const activeAnim = pieceMoveAnimRef.current[pieceKey];

        let drawX = px;
        let drawY = py;
        let hopY = 0;

        if (activeAnim) {
          const elapsed = nowTs - activeAnim.start;
          const t = Math.max(0, Math.min(1, elapsed / activeAnim.duration));
          const eased = 1 - Math.pow(1 - t, 2.2);
          drawX = activeAnim.fromX + (activeAnim.toX - activeAnim.fromX) * eased;
          drawY = activeAnim.fromY + (activeAnim.toY - activeAnim.fromY) * eased;
          // Hop arc — small bounce per step
          hopY = Math.sin(t * Math.PI) * cellSize * 0.38;

          if (t >= 1) {
            // Step done — check queue
            if (activeAnim.queue && activeAnim.queue.length > 0) {
              const next = activeAnim.queue[0];
              pieceMoveAnimRef.current[pieceKey] = {
                fromX: activeAnim.toX, fromY: activeAnim.toY,
                toX: next.toX, toY: next.toY,
                start: nowTs,
                duration: 160,
                queue: activeAnim.queue.slice(1),
              };
              needsMoveAnimationFrame = true;
            } else {
              delete pieceMoveAnimRef.current[pieceKey];
            }
          } else {
            needsMoveAnimationFrame = true;
          }
        }

        const r = cellSize * 0.42;
        const isMyPiece = String(player.user_id) === String(user?.id);
        const isMovable = isMyPiece && movablePieces.includes(pieceIdx + 1);
        const isSelected = isMyPiece && selectedPiece === pieceIdx + 1;
        const drawYFinal = drawY - hopY;

        ctx.save();

        // Subtle shadow when hopping
        if (hopY > 3) {
          ctx.beginPath();
          const sc = Math.max(0.5, 1 - hopY / (cellSize * 0.5));
          ctx.ellipse(drawX, drawY + r * 0.2, r * sc, r * 0.13 * sc, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,0,0,${0.22 * sc})`;
          ctx.fill();
        }

        // Movable / selected glow ring
        if (isMovable || isSelected) {
          ctx.beginPath();
          ctx.arc(drawX, drawYFinal, r + 7, 0, Math.PI * 2);
          ctx.shadowColor = isSelected ? '#ffffff' : PLAYER_COLORS[colorIdx];
          ctx.shadowBlur = isSelected ? 20 : 14;
          ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.88)' : `${PLAYER_COLORS[colorIdx]}50`;
          ctx.fill();
          ctx.shadowBlur = 0;
          if (isMovable) {
            ctx.beginPath();
            ctx.arc(drawX, drawYFinal, r + 11, 0, Math.PI * 2);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = `${PLAYER_COLORS[colorIdx]}99`;
            ctx.stroke();
          }
        }

        // Turn-owner pulsing ring on ALL pieces of the active player
        const isTurnOwnerPiece = String(player.user_id) === String(currentSession?.current_turn_user_id);
        if (isTurnOwnerPiece && !isMovable && !isSelected && glowPhase > 0) {
          const ringAlpha = Math.round((0.28 + glowPhase * 0.45) * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(drawX, drawYFinal, r + 5 + glowPhase * 5, 0, Math.PI * 2);
          ctx.shadowColor = PLAYER_COLORS[colorIdx];
          ctx.shadowBlur = 8 + glowPhase * 14;
          ctx.strokeStyle = `${PLAYER_COLORS[colorIdx]}${ringAlpha}`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;

        const img = avatarImagesRef.current[player.user_id];
        if (img?.complete && img?.naturalWidth > 0) {
          ctx.beginPath();
          ctx.arc(drawX, drawYFinal, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStyle = PLAYER_COLORS[colorIdx];
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.drawImage(img, drawX - r, drawYFinal - r, r * 2, r * 2);
          ctx.restore();
        } else {
          const pieceGrad = ctx.createRadialGradient(drawX - r*0.3, drawYFinal - r*0.3, r*0.1, drawX, drawYFinal, r);
          pieceGrad.addColorStop(0, homeColors[colorIdx].grad1);
          pieceGrad.addColorStop(1, homeColors[colorIdx].grad2);
          ctx.beginPath();
          ctx.arc(drawX, drawYFinal, r, 0, Math.PI * 2);
          ctx.fillStyle = pieceGrad;
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.font = `bold ${Math.round(r)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2;
          ctx.fillText(pieceIdx + 1, drawX, drawYFinal + 1);
        }

        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Outer colored ring (thick, clearly shows player color)
        ctx.beginPath();
        ctx.arc(drawX, drawYFinal, r + 2.5, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = PLAYER_COLORS[colorIdx];
        ctx.stroke();
        // Inner white ring
        ctx.beginPath();
        ctx.arc(drawX, drawYFinal, r, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.stroke();

        // Gloss
        ctx.beginPath();
        ctx.arc(drawX, drawYFinal - r * 0.28, r * 0.52, 0, Math.PI * 2);
        const glossGrad = ctx.createLinearGradient(drawX, drawYFinal - r, drawX, drawYFinal);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.52)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.fill();

        ctx.restore();
      });
    });

    // ── Bump flash overlay ────────────────────────
    if (bumpFlash) {
      const flashAge = nowTs - bumpFlash.startTs;
      const flashDur = 450;
      if (flashAge < flashDur) {
        needsMoveAnimationFrame = true;
        const alpha = (1 - flashAge / flashDur) * 0.8;
        const flashR = (flashAge / flashDur) * cellSize * 1.5;
        ctx.save();
        const radGrad = ctx.createRadialGradient(bumpFlash.x, bumpFlash.y, 0, bumpFlash.x, bumpFlash.y, flashR);
        radGrad.addColorStop(0, `rgba(255,100,0,${alpha})`);
        radGrad.addColorStop(0.45, `rgba(255,220,0,${alpha * 0.55})`);
        radGrad.addColorStop(1, 'rgba(255,180,0,0)');
        ctx.beginPath();
        ctx.arc(bumpFlash.x, bumpFlash.y, flashR, 0, Math.PI * 2);
        ctx.fillStyle = radGrad;
        ctx.fill();
        // 💥 emoji
        if (flashAge < 280) {
          ctx.font = `${Math.round(cellSize * 0.9)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = alpha;
          ctx.fillText('💥', bumpFlash.x, bumpFlash.y - flashR * 0.3);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }

    // Cleanup stale refs
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

  // ─── Game logic ───────────────────────────────
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const DICE_REVEAL_DELAY = 1400;
  const TRIPLE_SIX_REVEAL_DELAY = 320;

  const getLogicalNextPos = (pos, roll) => {
    if (pos === 57) return null;
    if (pos === -1) return roll === 6 ? 0 : null;

    const ARROW = 50; // arrow cell = valid resting position on outer track

    if (pos >= 0 && pos <= ARROW) {
      const target = pos + roll;
      if (target <= ARROW) return target;          // stays on outer track (incl. arrow)
      // Past the arrow → into home lane
      // target 51 = 1 step past arrow = lane pos 1
      const stepsInLane = target - ARROW;          // 1=lane1(52), 2=lane2(53)...
      const dest = 51 + stepsInLane;               // 52, 53, 54, 55, 56, 57
      if (dest <= 57) return dest;
      return null;                                  // overshoot
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

  // ─── Roll dice ────────────────────────────────
  const rollDice = async () => {
    inactivePlayersRef.current.add(String(user?.id));
    if (!currentSession?.id || !user?.id) return;
    if (!isMyTurn || rolling) return;

    // Player is actively rolling — remove from inactive set so auto-play stops
    inactivePlayersRef.current.delete(String(user.id));
    setIsAutoPlay(false);autoPlayVersionRef.current += 1;

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

      if (finalRoll === 6) {
        playSound('six');
        setSixFlash(true);
        setTimeout(() => setSixFlash(false), 600);
      } else {
        playSound('roll');
      }

      if (typeof data.consecutive_sixes === 'number') {
        setConsecutiveSixes(data.consecutive_sixes);
      }

      if (data.triple_six === true) {
        setDiceDisplay(6);
        setLastRoll(6);
        setMovablePieces([]);
        setSelectedPiece(null);
        setMessage('🚫 Three 6s! Turn lost.');
        setTimeout(() => setMessage(''), 2000);
        await wait(TRIPLE_SIX_REVEAL_DELAY);
        setLastRoll(null);
        setDiceDisplay(null);
        await refreshSession();
        return;
      }

      if (data.turn_passed) {
        setMessage(data.all_in_home ? '🎲 Need 6 to start. Turn passed.' : 'Turn passed.');
        setTimeout(() => setMessage(''), 2000);
        await wait(DICE_REVEAL_DELAY);
        // Reset dice state BEFORE refreshSession so canRoll reflects the new turn correctly
        setLastRoll(null);
        setDiceDisplay(null);
        setMovablePieces([]);
        setSelectedPiece(null);
        await refreshSession();
        return;
      }

      // FIX #3: Load fresh player data from server after RPC instead of using stale state
      const { data: freshPlayerData } = await supabase
        .from('room_ludo_players')
        .select('*')
        .eq('session_id', currentSession.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!freshPlayerData) {
        setLastRoll(null);
        setDiceDisplay(null);
        await refreshSession();
        return;
      }

      const movable = getMovablePieces(freshPlayerData, finalRoll);
      setMovablePieces(movable);

      if (movable.length === 0) {
        setMessage('No valid move. Turn passed.');
        setTimeout(() => setMessage(''), 1700);
        // Reset dice so the next player's turn starts clean
        setLastRoll(null);
        setDiceDisplay(null);
        setMovablePieces([]);
        setSelectedPiece(null);
        await refreshSession();
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

  const sendLudoEmoji = async (targetUserId, emoji) => {
  if (!channelRef.current || !currentSession?.id || !user?.id) return;

  const payload = {
  session_id: currentSession.id,
  room_id: roomId,
  sender_id: user.id,
  sender_user_id: user.id, //
  target_user_id: targetUserId,
  emoji: emoji?.id || emoji,
  ts: Date.now(),
};

  await channelRef.current.send({
    type: "broadcast",
    event: "ludo_emoji",
    payload,
  });

  const localId = `${user.id}_${targetUserId}_${payload.ts}_local`;

setLudoEmojiEffects(prev => [
  ...prev,
  {
    id: localId,
    emoji: payload.emoji,
    senderUserId: String(user.id),
    targetUserId: String(targetUserId),
  }
]);

setTimeout(() => {
  setLudoEmojiEffects(prev => prev.filter(x => x.id !== localId));
}, 1800);

  setEmojiPickerFor(null);
};

  const forceAdvanceTurnFromLeft = async (leftUserId, sessionArg = currentSession, playersList = players) => {
    if (!sessionArg?.id || !leftUserId) return false;

    const sorted = [...(playersList || [])].sort((a, b) => a.seat_number - b.seat_number);
    const currentPlayer = sorted.find(p => String(p.user_id) === String(leftUserId));
    if (!currentPlayer) return false;

    const candidates = isTeamMode(sessionArg)
      ? sorted.filter(p => String(p.user_id) !== String(leftUserId))
      : sorted.filter(p => !isPlayerLeft(p));
    if (candidates.length === 0) return false;

    const nextPlayer =
      candidates.find(p => p.seat_number > currentPlayer.seat_number) || candidates[0];
    if (!nextPlayer?.user_id) return false;

    const { error } = await supabase
      .from('room_ludo_sessions')
      .update({ current_turn_user_id: nextPlayer.user_id, last_roll: 0, display_roll: null, display_roll_user_id: null })
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
    const latestLeft = latestPlayers.find(p => String(p.user_id) === String(leftPlayer.user_id));
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

  // Handle resigned player turns
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
    if (!currentSession?.id) { await refreshSession(); return; }

    const totalPlayers = Number(currentSession?.max_players || 4);

    // Clockwise seat order per player count
    const clockwiseSeats =
      totalPlayers === 4 ? [1, 4, 3, 2] :
      totalPlayers === 3 ? [1, 3, 2] :
                           [1, 3];

    const activeSorted = isTeamMode()
      ? [...players].filter(p => !p.refunded_at)
      : [...players].filter(p => !p.refunded_at && !isPlayerLeft(p));

    if (activeSorted.length < 2) { await refreshSession(); return; }

    const currentTurnUserId = currentSession.current_turn_user_id || user?.id;
    const currentPlayer = activeSorted.find(p => String(p.user_id) === String(currentTurnUserId));
    const currentSeat = currentPlayer?.seat_number || 1;

    // Find current seat's index in clockwise order
    const currentIdx = clockwiseSeats.indexOf(currentSeat);
    const startIdx = currentIdx >= 0 ? currentIdx : 0;

    // Walk clockwise to find the next active player
    let nextPlayer = null;
    for (let i = 1; i <= clockwiseSeats.length; i++) {
      const nextSeat = clockwiseSeats[(startIdx + i) % clockwiseSeats.length];
      nextPlayer = activeSorted.find(p => p.seat_number === nextSeat);
      if (nextPlayer) break;
    }

    if (!nextPlayer?.user_id) { await refreshSession(); return; }
    if (String(nextPlayer.user_id) === String(currentTurnUserId)) { await refreshSession(); return; }

    const { error } = await supabase
      .from('room_ludo_sessions')
      .update({ current_turn_user_id: nextPlayer.user_id })
      .eq('id', currentSession.id)
      .eq('status', 'playing')
      .eq('current_turn_user_id', currentTurnUserId);

    if (error) { await refreshSession(); return; }

    setCurrentSession(prev => prev ? { ...prev, current_turn_user_id: nextPlayer.user_id } : prev);
    await refreshSession();
  };

  // ─── Move piece ───────────────────────────────
  const movePiece = async (pieceNumber) => {
    if (!currentSession?.id || !user?.id) return;

    const myPlayerBefore = players.find(p => String(p.user_id) === String(user.id));
    const beforeFinished = Number(myPlayerBefore?.pieces_finished || 0);

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

      if (typeof data.new_pos === 'number' && data.piece_number) {
        const pieceKey = `piece${data.piece_number}`;
        const pieceRefKey = `${user.id}-${data.piece_number - 1}`;
        const myPlayerNow = players.find(p => String(p.user_id) === String(user.id));
        const wasInBase = (myPlayerNow?.[pieceKey] ?? -1) === -1;

        // Build step-by-step path for hop animation
        const canvas = canvasRef.current;
        if (canvas && myPlayerNow) {
          const cellSize = canvas.width / 15;
          const boardPlayers = getVisiblePlayersList(players, currentSession);
          const oldPos = myPlayerNow[pieceKey] ?? -1;
          const newPos = data.new_pos;

          // Build list of intermediate logical positions
          const steps = [];
          if (oldPos === -1 && newPos === 0) {
            steps.push(0);
          } else if (oldPos >= 0 && newPos > oldPos && newPos <= 57) {
            // Walk each logical step
            for (let p = oldPos + 1; p <= newPos; p++) steps.push(p);
          } else {
            steps.push(newPos);
          }

          // Convert logical steps to canvas positions
          const canvasSteps = steps.map(logPos => {
            const fakePlayer = { ...myPlayerNow, [pieceKey]: logPos };
            return getPieceCanvasPosition(fakePlayer, data.piece_number - 1, cellSize, boardPlayers);
          }).filter(Boolean);

          if (canvasSteps.length >= 1) {
            const HOP_MS = 160; // ms per step
            const startNow = performance.now();

            if (canvasSteps.length === 1) {
              // Single step — simple move
              const from = getPieceCanvasPosition(myPlayerNow, data.piece_number - 1, cellSize, boardPlayers);
              if (from) {
                pieceMoveAnimRef.current[pieceRefKey] = {
                  fromX: from.x, fromY: from.y,
                  toX: canvasSteps[0].x, toY: canvasSteps[0].y,
                  start: startNow, duration: HOP_MS * 1.5,
                };
              }
            } else {
              // Multi-step: chain animations with per-step delay
              pieceMoveAnimRef.current[pieceRefKey] = {
                fromX: canvasSteps[0].x, fromY: canvasSteps[0].y,
                toX: canvasSteps[1]?.x ?? canvasSteps[0].x,
                toY: canvasSteps[1]?.y ?? canvasSteps[0].y,
                start: startNow, duration: HOP_MS,
                // Queue: remaining steps to animate after this one
                queue: canvasSteps.slice(2).map((pos, i) => ({
                  toX: pos.x, toY: pos.y,
                  delay: HOP_MS * (i + 1),
                })),
              };
            }
          }
        }

        setPlayers(prev =>
          prev.map(p =>
            String(p.user_id) === String(user.id) ? { ...p, [pieceKey]: data.new_pos } : p
          )
        );
        if (wasInBase && data.new_pos === 0) playSound('exit');
        else playSound('move');
      }

      onCoinsUpdated?.();
      await new Promise(resolve => setTimeout(resolve, 180));

      if (data.bumped) {
        // Trigger bump flash on canvas at bumped piece last position
        const canvas = canvasRef.current;
        if (canvas) {
          const cellSize = canvas.width / 15;
          // Flash at destination cell of moving piece
          const myPlayer = players.find(p => String(p.user_id) === String(user.id));
          if (myPlayer && typeof data.new_pos === 'number') {
            const placement = getPieceBoardPlacement(
              { ...myPlayer, [`piece${data.piece_number}`]: data.new_pos },
              (data.piece_number || 1) - 1,
              players
            );
            if (placement) {
              const fx = placement.col * cellSize + cellSize / 2;
              const fy = placement.row * cellSize + cellSize / 2;
              setBumpFlash({ x: fx, y: fy, startTs: performance.now() });
              if (bumpFlashTimerRef.current) clearTimeout(bumpFlashTimerRef.current);
              bumpFlashTimerRef.current = setTimeout(() => setBumpFlash(null), 500);
            }
          }
        }
        playSound('bump');
      }

      const refreshed = await refreshSession();
      const myPlayerAfter = (refreshed.players || []).find(p => String(p.user_id) === String(user.id));
      const afterFinished = Number(myPlayerAfter?.pieces_finished ?? data?.pieces_finished ?? beforeFinished);
      const pieceReachedGoal = data.new_pos === 57;

      // Reset dice state so the player can roll again
      // Covers: rolled 6 (extra_turn), piece reached goal (also extra_turn in DB)
      if (data.extra_turn && !data.winner) {
        setLastRoll(null);
        setDiceDisplay(null);
        setMovablePieces([]);
        setSelectedPiece(null);
      }

      if (pieceReachedGoal && afterFinished > beforeFinished) {
        playSound('finish');
        setFinishToast('🎉 Piece finished!');
        setMessage('🎉 Piece finished! Roll again 🎲');
        setRecentFinishedUserId(String(user.id));
        if (finishFxTimerRef.current) clearTimeout(finishFxTimerRef.current);
        finishFxTimerRef.current = setTimeout(() => {
          setFinishToast('');
          setRecentFinishedUserId(null);
          setMessage('');
        }, 2200);
      } else if (data.bumped) {
        setMessage('💥 You sent an opponent home!');
        setTimeout(() => setMessage(''), 1800);
      } else if (data.extra_turn && !data.winner) {
        setMessage('🎲 Rolled 6! Play again!');
        setTimeout(() => setMessage(''), 1800);
      } else {
        setMessage('');
      }
    } catch (err) {
      alert(err.message || 'Failed to move piece');
    }
  };

  const handlePieceSelect = async (pieceNumber) => {
    if (!movablePieces.includes(pieceNumber)) return;
    if (movingPieceRef.current) return;
    movingPieceRef.current = true;
    // Player is actively selecting — remove from inactive set
    inactivePlayersRef.current.delete(String(user?.id));
    setIsAutoPlay(false);autoPlayVersionRef.current += 1;
    setSelectedPiece(pieceNumber);
    try {
      await movePiece(pieceNumber);
    } finally {
      movingPieceRef.current = false;
    }
  };

  const handleCanvasClick = (e) => {
  if (!isMyTurn || rolling) return;

  inactivePlayersRef.current.delete(String(user?.id));
  setIsAutoPlay(false);
  autoPlayVersionRef.current += 1;

  if (!movablePieces.length) return;
  if (movingPieceRef.current) return;

    const boardPlayers = getVisiblePlayersList(players, currentSession);
    const myPlayerLocal = boardPlayers.find(p => String(p.user_id) === String(user?.id));
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

  // ─── Session management ───────────────────────
  const joinSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    if (userCoins < currentSession.entry_cost) { alert(`Need ${currentSession.entry_cost} coins to join`); return; }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_ludo_session', { p_session_id: currentSession.id, p_user_id: user.id });
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
      const { data, error } = await supabase.rpc('leave_ludo_session', { p_session_id: currentSession.id, p_user_id: user.id });
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

    if (isTeamMode()) {
      if (players.length !== 4) { alert('Team mode requires exactly 4 players'); return; }
      if (!areTeamsComplete()) { alert('Please complete teams: 2 players in Team A and 2 players in Team B'); return; }
      if (teamsDirty) { alert('Please save teams before starting.'); return; }
      const sortedFresh = [...players].sort((a, b) => a.seat_number - b.seat_number);
      const firstPlayerForTeam = sortedFresh[0];
      if (!firstPlayerForTeam?.user_id) return;
      // Reset cycle counter at game start
      teamTurnCycleRef.current = 0;
      await supabase
        .from('room_ludo_sessions')
        .update({ status: 'playing', started_at: new Date().toISOString(), current_turn_user_id: firstPlayerForTeam.user_id })
        .eq('id', currentSession.id);
      return;
    } else {
      if (getActivePlayersList(players).length < 2) { alert('Need at least 2 players'); return; }
    }

    const firstPlayer = getActivePlayersList(players)[0];
    await supabase
      .from('room_ludo_sessions')
      .update({ status: 'playing', started_at: new Date().toISOString(), current_turn_user_id: firstPlayer.user_id })
      .eq('id', currentSession.id);
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    const confirmed = window.confirm('Cancel game? All players will be refunded.');
    if (!confirmed) return;
    try {
      const { data, error } = await supabase.rpc('cancel_ludo_session', { p_session_id: currentSession.id, p_user_id: user.id });
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
      const { data, error } = await supabase.rpc('resign_ludo_game', { p_session_id: currentSession.id, p_user_id: user.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to resign');
      onCoinsUpdated?.();
      setShowSettingsMenu(false);

      if (data.game_ended) {
        if (!data.winner_id) {
          // No winner — all resigned, just close
          setCurrentSession(null);
          setPlayers([]);
          setShowResult(false);
          setWinner(null);
        } else {
          // Winner exists — reload session so realtime + result screen fires correctly
          const { data: sd } = await supabase
            .from('room_ludo_sessions')
            .select('*')
            .eq('id', currentSession.id)
            .single();
          if (sd) setCurrentSession(sd);
          await loadPlayers(currentSession.id);
        }
        return;
      }

      // Game continues — reload players and pass turn if needed
      const refreshedPlayers = await loadPlayers(currentSession.id);
      const { data: sd } = await supabase
        .from('room_ludo_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
      if (sd) setCurrentSession(sd);
      await maybeEndGameForEliminatedTeam(refreshedPlayers, sd || currentSession);
    } catch (err) {
      alert(err.message || 'Failed to resign');
    }
  };

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    setCreating(true);
    try {
      const payload = { room_id: roomId, created_by: user.id, max_players: maxPlayers, entry_cost: entryCost, status: 'waiting', team_mode: maxPlayers === 4 && teamMode };
      const { data, error } = await supabase.from('room_ludo_sessions').insert(payload).select().single();
      if (error) throw error;
      setCurrentSession(data);
      setPlayers([]);
    } catch (err) {
      alert(err.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  // Auto-resign Ludo players who left the live room/browser
useEffect(() => {
  if (!roomId || !currentSession?.id || currentSession?.status !== 'playing') return;

  let cancelled = false;

  const checkDisconnectedPlayers = async () => {
    try {
      const { data: activeRows } = await supabase
        .from('live_room_participants')
        .select('user_id')
        .eq('room_id', roomId)
        .is('left_at', null);

      const activeRoomUserIds = new Set(
        (activeRows || []).map(r => String(r.user_id))
      );

      const { data: ludoRows } = await supabase
        .from('room_ludo_players')
        .select('user_id,left_at,refunded_at')
        .eq('session_id', currentSession.id)
        .is('refunded_at', null);

      if (cancelled) return;

      for (const p of ludoRows || []) {
        const uid = String(p.user_id);
        if (!uid || p.left_at) continue;
        if (activeRoomUserIds.has(uid)) continue;

        const key = `${currentSession.id}:${uid}`;
        if (disconnectedResignRef.current.has(key)) continue;
        disconnectedResignRef.current.add(key);

        const { data, error } = await supabase.rpc('resign_ludo_game', {
          p_session_id: currentSession.id,
          p_user_id: uid,
        });

        if (error || data?.success === false) {
          console.warn('[LUDO_AUTO_RESIGN_FAILED]', uid, error || data?.error);
          disconnectedResignRef.current.delete(key);
          continue;
        }

        await refreshSession();
      }
    } catch (e) {
      console.warn('[LUDO_DISCONNECT_WATCHDOG_ERROR]', e);
    }
  };

  checkDisconnectedPlayers();
  const interval = setInterval(checkDisconnectedPlayers, 4000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [roomId, currentSession?.id, currentSession?.status]);

useEffect(() => {
  if (!roomId || !currentSession?.id || currentSession?.status !== 'playing') return;

  let stopped = false;

  const tick = async () => {
    try {
      const turnUserId = currentSession.current_turn_user_id;
      if (!turnUserId) return;

      const turnPlayer = players.find(
        p => String(p.user_id) === String(turnUserId)
      );

      if (!turnPlayer || turnPlayer.left_at || turnPlayer.refunded_at) return;

      const { data: participant } = await supabase
        .from('live_room_participants')
        .select('user_id,left_at,last_seen_at')
        .eq('room_id', roomId)
        .eq('user_id', turnUserId)
        .maybeSingle();

      if (stopped) return;

      const lastSeen = participant?.last_seen_at
        ? new Date(participant.last_seen_at).getTime()
        : 0;

      const offlineMs = Date.now() - lastSeen;

      // heartbeat عندك كل 20 ثانية، لذلك 45 ثانية آمنة
      const isDisconnected =
        !participant ||
        participant.left_at ||
        !lastSeen ||
        offlineMs > 45000;

      if (!isDisconnected) return;

      const key = `${currentSession.id}:${turnUserId}`;
      if (disconnectedResignRef.current.has(key)) return;
      disconnectedResignRef.current.add(key);

      const { data, error } = await supabase.rpc('resign_ludo_game', {
        p_session_id: currentSession.id,
        p_user_id: turnUserId,
      });

      if (error || data?.success === false) {
        console.warn('[LUDO_AUTO_RESIGN_FAILED]', error || data?.error);
        disconnectedResignRef.current.delete(key);
        return;
      }

      await refreshSession();
    } catch (e) {
      console.warn('[LUDO_AUTO_RESIGN_WATCHDOG_ERROR]', e);
    }
  };

  tick();
  const interval = setInterval(tick, 5000);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}, [
  roomId,
  currentSession?.id,
  currentSession?.status,
  currentSession?.current_turn_user_id,
  players,
]);

  // ─── Derived state ────────────────────────────
  const visiblePlayers = getVisiblePlayersList(players, currentSession);
  const activePlayers = getActivePlayersList(players);
  const isJoined = activePlayers.some(p => String(p.user_id) === String(user?.id));
  const isFull = activePlayers.length >= (currentSession?.max_players || 0);
  const isMyTurn =
    String(currentSession?.current_turn_user_id) === String(user?.id) && isJoined;
  const netPrize = Math.floor((currentSession?.entry_cost || 0) * players.length * 0.9);

  // Current turn player — used in both JSX and drawBoard
  const currentTurnPlayer = visiblePlayers.find(
    p => String(p.user_id) === String(currentSession?.current_turn_user_id)
  ) || null;
  const currentTurnColorIdx = currentTurnPlayer
    ? normalizeColorIndex(getPlayerColorIndex(currentTurnPlayer, visiblePlayers))
    : -1;

  const getTeamPlayers = (teamLetter) => players.filter(p => getEffectiveTeam(p) === teamLetter);

  const areTeamsComplete = () => {
    if (!isTeamMode() || players.length !== 4) return false;
    return getTeamPlayers('A').length === 2 && getTeamPlayers('B').length === 2;
  };

  const winningTeamPlayers = currentSession?.winner_team
    ? players.filter(p => getEffectiveTeam(p) === currentSession.winner_team)
    : [];
  const perPlayerPrize = Number(currentSession?.winner_coins || currentSession?.per_player_prize || 0);
  const totalTeamPrize = perPlayerPrize * winningTeamPlayers.length;

  const meInTeamMode = isTeamMode()
    ? players.find(p => String(p.user_id) === String(user?.id))
    : null;
  const teammatePlayer = meInTeamMode
    ? players.find(p => String(p.user_id) !== String(user?.id) && getEffectiveTeam(p) === getEffectiveTeam(meInTeamMode))
    : null;
  const teammatePillBaseClass = 'h-[26px] min-w-[170px] max-w-[170px] px-3 rounded-full text-xs font-bold leading-[26px] flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-200';
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
    if (!turnUserId || previousTurnUserIdRef.current === turnUserId) return;
    previousTurnUserIdRef.current = turnUserId;
    setTurnPulseUserId(turnUserId);
    const pulseTimer = setTimeout(() => setTurnPulseUserId(null), 360);
    return () => clearTimeout(pulseTimer);
  }, [currentSession?.status, currentSession?.current_turn_user_id]);

  useEffect(() => {
    if (!showResult || !currentSession?.id) return;
    loadPlayers(currentSession.id);
  }, [showResult, currentSession?.winner_team, currentSession?.id, winningTeamPlayers.length]);

  // Play victory sound for ALL viewers when result screen appears
  useEffect(() => {
    if (!showResult) return;
    playSound('applause');
  }, [showResult]);

  // Keep autoAction ref in sync
  autoActionStateRef.current = {
    sessionId: currentSession?.id,
    turnUserId: currentSession?.current_turn_user_id,
    lastRoll,
    sessionLastRoll: currentSession?.last_roll ?? 0,
    movablePieces,
    rolling,
    rollDice,
    handlePieceSelect,
  };

  // ─── Team assignment UI ───────────────────────
  const togglePlayerTeam = (userId) => {
    const userIdStr = String(userId);
    const player = players.find(p => String(p.user_id) === userIdStr);
    if (!player) return;

    if (!selectedTeamPlayerId) { setSelectedTeamPlayerId(userIdStr); return; }

    const selectedIdStr = String(selectedTeamPlayerId);
    if (selectedIdStr === userIdStr) { setSelectedTeamPlayerId(null); return; }

    const selectedPlayer = players.find(p => String(p.user_id) === selectedIdStr);
    if (!selectedPlayer) { setSelectedTeamPlayerId(userIdStr); return; }

    const currentTeam = getEffectiveTeam(player);
    const selectedTeam = getEffectiveTeam(selectedPlayer);

    if (selectedTeam === currentTeam) { setSelectedTeamPlayerId(userIdStr); return; }

    const seatA = getEffectiveSeat(selectedPlayer);
    const seatB = getEffectiveSeat(player);
    setSeatOverrides(prev => ({ ...prev, [selectedIdStr]: seatB, [userIdStr]: seatA }));
    setTeamsDirty(true);
    setSelectedTeamPlayerId(null);
  };

  const assignRandomTeams = () => {
    if (players.length !== 4) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const overrides = {};
    shuffled.forEach((p, i) => { overrides[String(p.user_id)] = i + 1; });
    setSeatOverrides(overrides);
    setTeamsDirty(true);
    setSelectedTeamPlayerId(null);
  };

  const saveTeams = async () => {
    if (!currentSession?.id || !teamsDirty || savingTeams) return;
    setSavingTeams(true);
    savingTeamsRef.current = true;
    try {
      for (const player of players) {
        const intendedSeat = getEffectiveSeat(player);
        const { error } = await supabase.from('room_ludo_players').update({ seat_number: 100 + intendedSeat }).eq('id', player.id);
        if (error) throw error;
      }
      for (const player of players) {
        const intendedSeat = getEffectiveSeat(player);
        const intendedTeam = intendedSeat === 1 || intendedSeat === 3 ? 'A' : 'B';
        const { error } = await supabase.from('room_ludo_players').update({ seat_number: intendedSeat, team_key: intendedTeam }).eq('id', player.id);
        if (error) throw error;
      }
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

  // ─── Dice rendering ───────────────────────────
  const isDiceOwnerPlayer = (player) => {
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

    if (isLocalCurrentTurn && diceDisplay >= 1 && diceDisplay <= 6) return diceDisplay;
    if (currentTurnUserId === pid && displayRollUserId === pid && remoteDiceAnimating && remoteDiceDisplay >= 1 && remoteDiceDisplay <= 6) return remoteDiceDisplay;
    if (displayRollUserId === pid && displayRoll >= 1 && displayRoll <= 6) return displayRoll;
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

    if (!shouldShowDice) return <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 invisible" aria-hidden="true" />;

    const colorIdx = getPlayerColorIndex(player);
    const sessionRoll = Number(currentSession?.last_roll || 0);
    const isTurnMine = pid === String(user?.id) && isMyTurn;

    // FIX (renderDiceSlot): Use !sessionRoll instead of sessionRoll === 0 to handle null
    const canRoll = isTurnMine && !rolling && !sessionRoll && movablePieces.length === 0;

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
        onPointerDown={(e) => { e.stopPropagation(); if (canRoll) rollDice(); }}
        onClick={(e) => { e.stopPropagation(); }}
        className={`relative z-[80] w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center select-none ${canRoll ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}
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
              : (isTurnPulseDice
                ? 'ludoTurnDiceNudge 360ms ease-out 1'
                : (isCurrentTurnPlayer ? 'ludoActiveTurnDicePulse 1.2s ease-in-out infinite' : 'none')),
          }}
        >
          {showSettledValue ? (
            <span
              className="text-2xl sm:text-3xl font-black leading-none"
              style={{ color: PLAYER_COLORS[colorIdx], animation: isResultPulse ? 'ludoDiceResultPop 360ms ease-out 1' : 'none', transformOrigin: 'center center' }}
            >
              {faceValue}
            </span>
          ) : (
            <span className="text-xl sm:text-2xl opacity-80">🎲</span>
          )}
        </div>
        {canRoll && <span className="absolute top-2 right-2 sm:top-3 sm:right-3 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />}
      </button>
    );
  };

  // ─── Render ───────────────────────────────────
  if (!open) return null;

  // homeColors needed inside drawBoard but also in JSX (piece fallback gradient)
  const homeColors = [
    { bg: '#fca5a5', border: '#ef4444', grad1: '#f87171', grad2: '#dc2626' },
    { bg: '#93c5fd', border: '#3b82f6', grad1: '#60a5fa', grad2: '#2563eb' },
    { bg: '#fcd34d', border: '#f59e0b', grad1: '#fbbf24', grad2: '#d97706' },
    { bg: '#86efac', border: '#22c55e', grad1: '#4ade80', grad2: '#16a34a' },
  ];

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center"
      onClick={() => { setShowSettingsMenu(false); onClose(); }}>
      <style>{`
      @keyframes ludoEmojiFly {
  0% {
    opacity: 0;
    transform: translate(-50%, 0) scale(0.5);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -12px) scale(1.15);
  }
  75% {
    opacity: 1;
    transform: translate(calc(-50% + var(--emoji-dx)), var(--emoji-dy)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--emoji-dx)), calc(var(--emoji-dy) - 35px)) scale(0.9);
  }
}
        @keyframes ludoDiceSingleSpin {
          0%   { transform: rotate(0deg)   scale(1);    }
          50%  { transform: rotate(180deg) scale(1.03); }
          100% { transform: rotate(360deg) scale(1);    }
        }
          @keyframes ludoEmojiFloat {
  0%   { opacity: 0; transform: translate(-50%, 8px) scale(0.65); }
  18%  { opacity: 1; transform: translate(-50%, 0) scale(1.25); }
  70%  { opacity: 1; transform: translate(-50%, -20px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -38px) scale(0.9); }
}
        @keyframes ludoTurnCardGlow {
          0%   { box-shadow: 0 0 0 rgba(255,255,255,0); }
          50%  { box-shadow: 0 0 14px rgba(255,255,255,0.24); }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes ludoTurnDiceNudge {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes ludoDiceResultPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes ludoHomePulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
        @keyframes ludoActiveTurnDicePulse {
          0%,100% { transform: scale(1);    filter: brightness(1);   }
          50%     { transform: scale(1.07); filter: brightness(1.18); }
        }
        @keyframes ludoActiveTurnCardGlow {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.045); }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[95dvh] max-h-[95dvh]"
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
                className={`${teammatePillBaseClass} border border-white/20 text-white ${resignedTeammateName ? 'bg-red-800/95' : 'bg-green-600/95'}`}
                style={{ boxShadow: resignedTeammateName && autoHeaderGlow ? '0 0 12px rgba(239,68,68,0.55)' : 'none', transition: 'box-shadow 200ms ease, background-color 200ms ease' }}
              >
                {teamHeaderStatusText}
              </div>
            )}
            {currentSession && (
              ((canModerate && currentSession.status === 'waiting') || (isJoined && currentSession.status === 'playing'))
            ) && (
              <div className="relative">
                <button onClick={() => setShowSettingsMenu(v => !v)} className="text-white/50 hover:text-white p-0.5">
                  <Settings className="w-5 h-5" />
                </button>
                {showSettingsMenu && (
                  <div className="absolute right-0 top-7 z-50 bg-slate-800 border border-white/10 rounded-xl shadow-xl min-w-[160px] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSoundMuted(v => !v)}
                      className="w-full text-left px-4 py-2.5 text-white font-bold text-sm hover:bg-white/10 transition flex items-center gap-2"
                    >
                      {soundMuted ? '🔇' : '🔊'} {soundMuted ? 'Unmute' : 'Mute'} Sound
                    </button>
                    {currentSession.status === 'waiting' && canModerate && (
                      <button onClick={() => { setShowSettingsMenu(false); cancelSession(); }} className="w-full text-left px-4 py-2.5 text-rose-400 font-bold text-sm hover:bg-rose-500/10 transition">
                        🚫 Cancel Game
                      </button>
                    )}
                    {currentSession.status === 'playing' && isJoined && (
                      <button onClick={resignSession} className="w-full text-left px-4 py-2.5 text-amber-300 font-bold text-sm hover:bg-amber-500/10 transition">
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
                <div className="w-full max-w-sm bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                  <div className="text-amber-200 text-sm font-bold text-center mb-3">Team prize: {totalTeamPrize.toLocaleString()} coins</div>
                  <div className="grid grid-cols-1 gap-3">
                    {winningTeamPlayers.map((player) => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={player.avatar_url || FALLBACK_AVATAR} alt={player.name} className="w-12 h-12 rounded-full border-2 border-amber-400 object-cover" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
                          <div className="min-w-0">
                            <div className="text-white font-bold truncate">{player.name}</div>
                            <div className="text-amber-300 text-sm font-black">+{perPlayerPrize.toLocaleString()} coins</div>
                          </div>
                        </div>
                        <div className={`text-[10px] font-black leading-tight px-2 py-1 rounded-full shrink-0 ${currentSession.winner_team === 'A' ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/40' : 'bg-violet-400/20 text-violet-200 border border-violet-300/40'}`}>
                          Team {currentSession.winner_team}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
              )}
            </div>
          ) : showResult && winner ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl animate-bounce">🏆</div>
              <div className="text-white font-black text-3xl">WINNER!</div>
              <img src={winner.avatar_url || FALLBACK_AVATAR} alt={winner.name} className="w-24 h-24 rounded-full border-4 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.8)] object-cover" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
              <div className="text-amber-300 font-black text-2xl">{winner.name}</div>
              <div className="bg-amber-500/20 border border-amber-500/40 rounded-2xl px-6 py-3 text-center">
                <div className="text-amber-300 text-sm font-bold">Won</div>
                <div className="text-amber-200 text-3xl font-black">🪙 {winnerCoins.toLocaleString()}</div>
              </div>
            </div>
          ) : currentSession ? (
            <div className={`relative flex flex-col flex-1 ${currentSession?.status === 'playing' ? 'gap-1 mt-0' : 'gap-2'}`}>
              {/* Info bar */}
              <div className="flex items-center justify-between bg-slate-800 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Entry</div>
                  <div className="text-amber-400 font-black text-xs">🪙 {currentSession.entry_cost.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Players</div>
                  <div className="text-white font-black text-xs">{visiblePlayers.length}/{currentSession.max_players}</div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Prize</div>
                  <div className="text-emerald-400 font-black text-xs">🪙 {netPrize.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">My Coins</div>
                  <div className={`font-black text-xs ${userCoins >= currentSession.entry_cost ? 'text-white' : 'text-rose-400'}`}>
                    🪙 {(userCoins || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Playing layout */}
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
                  const isAutoForViewer = isTeamMode() && (p.left_at) && (() => {
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
                        animation: isTurnPulseCard
                          ? 'ludoTurnCardGlow 360ms ease-out 1'
                          : (isCurrentTurn ? 'ludoActiveTurnCardGlow 1.2s ease-in-out infinite' : 'none'),
                        maxWidth: '60px',
                      }}
                    >
                      <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name} className="w-7 h-7 rounded-full object-cover"
                        style={{ border: `2px solid ${PLAYER_COLORS[colorIdx]}`, opacity: isAutoForViewer ? 0.75 : 1 }}
                        onError={e => e.currentTarget.src = FALLBACK_AVATAR}
                      />
                      <div className="text-white text-[9px] font-bold max-w-[56px] truncate text-center leading-tight">{p.name}</div>
                      {isTeamMode() && team && (
                        <div className="relative">
                          <div className={`text-[9px] font-black leading-tight px-1.5 py-[1px] rounded-full ${team === 'A' ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/40' : 'bg-violet-400/20 text-violet-200 border border-violet-300/40'}`}>{team}</div>
                          {isAutoForViewer && (
                            <span className="pointer-events-none absolute -top-[2px] -right-[2px] text-[9px] leading-none font-semibold px-[5px] py-[1px] rounded-full bg-amber-900/95 text-amber-100 border border-amber-400/40 opacity-[0.85]">Auto</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-0.5">
                        {[0,1,2,3].map(i => (
                          <div key={i} className="w-[9px] h-[9px] rounded-full border-2 shadow"
                            style={{ backgroundColor: i < piecesFinished ? PLAYER_COLORS[colorIdx] : 'transparent', borderColor: PLAYER_COLORS[colorIdx] }}
                          />
                        ))}
                      </div>
                    </div>
                  );

                  const emojiButton = (
  <div className="relative shrink-0">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEmojiPickerFor(prev =>
          prev === String(p.user_id) ? null : String(p.user_id)
        );
      }}
      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15
        text-sm flex items-center justify-center active:scale-95 transition"
      title="Send emoji"
    >
      😊
    </button>

    {emojiPickerFor === String(p.user_id) && (
  <div
  className="fixed z-[120] left-3 right-3 bottom-[120px]
    max-h-[260px] overflow-y-auto
    grid grid-cols-5 gap-2 rounded-2xl bg-slate-950/95
    border border-white/15 p-2 shadow-2xl backdrop-blur-md"
  onClick={(e) => e.stopPropagation()}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
>
    {LUDO_EMOJIS.map((em) => (
      <button
        key={em.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sendLudoEmoji(p.user_id, em);
        }}
        className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/15
          flex items-center justify-center active:scale-90 transition"
        title={em.label}
      >
        <RoomEmojiAsset
          src={em.src}
          alt={em.label}
          className="w-9 h-9 object-contain pointer-events-none"
          style={{
            transform: em.flip ? "scaleX(-1)" : undefined,
          }}
        />
      </button>
    ))}
  </div>
)}

    {ludoEmojiEffects
  .filter(x => String(x.senderUserId) === String(p.user_id))
  .map(x => {
    const em = LUDO_EMOJIS.find(e => e.id === x.emoji);
    if (!em) return null;

    const targetPlayer = players.find(
      pl => String(pl.user_id) === String(x.targetUserId)
    );

    const isSelfTarget = String(x.targetUserId) === String(x.senderUserId);

const dx = isSelfTarget ? 0 : 110;
const dy = isSelfTarget ? -70 : -45;

    return (
      <div
        key={x.id}
        className="pointer-events-none absolute -top-8 left-1/2 z-[95]"
        style={{
          "--emoji-dx": `${dx}px`,
          "--emoji-dy": `${dy}px`,
          animation: "ludoEmojiFly 1.8s ease-out forwards",
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.65))",
        }}
      >
        <RoomEmojiAsset
          src={em.src}
          alt={em.label}
          className="w-16 h-16 object-contain"
          style={{
            transform: em.flip ? "scaleX(-1)" : undefined,
          }}
          loop={false}
        />
      </div>
    );
  })}
  </div>
);

                  return (
  <div key={p.id} className={`flex items-center gap-1 sm:gap-2 min-h-[64px] sm:min-h-[80px] ${isFinishFx ? 'animate-bounce' : ''}`}>
    {diceSide === 'left' && renderDiceSlot(p)}
    {playerCard}
    {emojiButton}
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
                    <div className="mt-1 shrink-0 min-h-[64px] sm:min-h-[80px]">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex-1 flex justify-start">{renderPlayerWithDice(topLeft)}</div>
                        <div className="flex-1 flex justify-end">{renderPlayerWithDice(topRight)}</div>
                      </div>
                    </div>

                    <div className="mt-1 flex-1 flex flex-col justify-center items-center min-h-0 w-full relative">
                      {finishToast && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none rounded-full bg-amber-400/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg animate-bounce">
                          {finishToast}
                        </div>
                      )}
                      <div
                        className={`relative bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-500 flex items-center justify-center shrink min-h-0 ${recentFinishedUserId ? 'animate-pulse' : ''}`}
                        style={{
                          boxShadow: recentFinishedUserId
                            ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 24px rgba(251,191,36,0.35)'
                            : undefined,
                          maxHeight: '100%', maxWidth: '100%', aspectRatio: '1 / 1'
                        }}
                      >
                        <canvas ref={canvasRef} width={600} height={600} onClick={handleCanvasClick} className="w-full h-full rounded-lg object-contain" />
                        {isTeamMode() && playersWithVisuals.map(({ player: bp, visualIdx: vi }) => {
                          const bTeam = getEffectiveTeam(bp);
                          const cornerClass = ['bottom-2 left-2 sm:bottom-3 sm:left-3','bottom-2 right-2 sm:bottom-3 sm:right-3','top-2 right-2 sm:top-3 sm:right-3','top-2 left-2 sm:top-3 sm:left-3'][vi];
                          return (
                            <div key={bp.id} className={`pointer-events-none absolute ${cornerClass} z-10 w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] flex items-center justify-center rounded-full text-[8px] sm:text-[9px] font-black border shadow-md ${bTeam === 'A' ? 'bg-cyan-500/85 text-white border-cyan-300/70' : 'bg-violet-500/85 text-white border-violet-300/70'}`}>
                              {bTeam}
                            </div>
                          );
                        })}
                      </div>
                    </div>

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
                <div className={`relative bg-slate-800 rounded-xl p-1.5 border border-white/5 transition-all duration-300 mx-auto w-full max-w-[500px] ${recentFinishedUserId ? 'animate-pulse' : ''}`}
                  style={{ boxShadow: recentFinishedUserId ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 24px rgba(251,191,36,0.35)' : undefined }}>
                  {finishToast && (
                    <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-amber-400/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg animate-bounce">{finishToast}</div>
                  )}
                  <canvas ref={canvasRef} width={600} height={600} onClick={handleCanvasClick} className="w-full aspect-square rounded-lg" />
                </div>
              )}

              {/* Waiting: team selection or player list */}
              {currentSession.status === 'waiting' && isTeamMode() && players.length === 4 ? (
                <div className="flex flex-col gap-3">
                  <div className="text-center text-white/70 text-xs font-bold uppercase tracking-wider">🎯 Assign Teams</div>
                  <div className="grid grid-cols-2 gap-3">
                    {['A', 'B'].map(teamLetter => (
                      <div key={teamLetter} className={`${teamLetter === 'A' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-violet-500/10 border-violet-500/30'} border-2 rounded-xl p-3`}>
                        <div className={`${teamLetter === 'A' ? 'text-cyan-300' : 'text-violet-300'} font-bold text-sm text-center mb-2`}>Team {teamLetter}</div>
                        <div className="flex flex-col gap-2">
                          {getTeamPlayers(teamLetter).map(p => {
                            const colorIdx = getPlayerColorIndex(p);
                            const isSelected = String(selectedTeamPlayerId) === String(p.user_id);
                            const effSeat = getEffectiveSeat(p);
                            return (
                              <button key={p.id} onClick={() => togglePlayerTeam(p.user_id)}
                                className={`flex items-center gap-2 ${teamLetter === 'A' ? 'bg-cyan-400/10 hover:bg-cyan-400/20 border-cyan-400/30' : 'bg-violet-400/10 hover:bg-violet-400/20 border-violet-400/30'} border rounded-lg px-2 py-2 transition cursor-pointer active:scale-95 ${isSelected ? 'ring-2 ring-white scale-[1.02]' : ''}`}
                              >
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[effSeat - 1] || PLAYER_COLORS[colorIdx] }} />
                                <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name} className="w-6 h-6 rounded-full object-cover" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
                                <span className="text-white text-xs font-bold truncate flex-1">{p.name}</span>
                                {String(p.user_id) === String(user?.id) && <span className="text-amber-300 text-[8px] shrink-0">You</span>}
                                {(p.left_at) && <span className="text-amber-200 text-[8px] shrink-0 px-1 py-[1px] rounded-full bg-white/10 border border-amber-300/40">Auto</span>}
                                <span className="text-white/30 text-[7px] shrink-0 font-mono">s:{effSeat}</span>
                              </button>
                            );
                          })}
                          {getTeamPlayers(teamLetter).length < 2 && (
                            <div className="flex items-center justify-center py-3 text-white/40 text-xs">
                              {2 - getTeamPlayers(teamLetter).length} slot{2 - getTeamPlayers(teamLetter).length !== 1 ? 's' : ''} available
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={assignRandomTeams} className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs active:scale-95 transition">🔀 Random Teams</button>
                  <button onClick={saveTeams} disabled={!teamsDirty || savingTeams} className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/40 text-white font-bold text-xs active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {savingTeams ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '💾 Save Teams'}
                  </button>
                  <div className="text-center text-white/50 text-[10px]">
                    {areTeamsComplete() ? <span className="text-green-400">✓ Teams ready</span> : <span>Swap players between teams to balance</span>}
                  </div>
                </div>
              ) : currentSession.status !== 'playing' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {visiblePlayers.map(p => {
                    const colorIdx = getPlayerColorIndex(p);
                    const isResignedTeammate = isTeamMode() && (p.left_at) && (() => {
                      const me = players.find(pl => String(pl.user_id) === String(user?.id));
                      return me && String(me.user_id) !== String(p.user_id) && getEffectiveTeam(me) === getEffectiveTeam(p);
                    })();
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[colorIdx] }} />
                        <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name} className="w-7 h-7 rounded-full object-cover" onError={e => e.currentTarget.src = FALLBACK_AVATAR} />
                        <span className="text-white text-xs font-bold truncate">{p.name}</span>
                        {isResignedTeammate && <span className="text-amber-200 text-[9px] shrink-0 px-1.5 py-[1px] rounded-full bg-white/10 border border-amber-300/40 ml-auto">Auto</span>}
                        {String(p.user_id) === String(user?.id) && <span className="text-amber-300 text-[9px] shrink-0">You</span>}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-1">
                {!isJoined && !isFull && currentSession.status === 'waiting' && (
                  <button onClick={joinSession} disabled={joining} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs disabled:opacity-50 active:scale-95 transition">
                    {joining ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Join 🪙 ${currentSession.entry_cost.toLocaleString()}`}
                  </button>
                )}
                {isJoined && currentSession.status === 'waiting' && (
                  <button onClick={leaveSession} disabled={leaving} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 font-bold text-xs bg-white/5 active:scale-95 transition">
                    {leaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Leave & Refund'}
                  </button>
                )}
                {canModerate && currentSession.status === 'waiting' && (
                  <button onClick={startGame} disabled={isTeamMode() ? !areTeamsComplete() : activePlayers.length < 2} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-black text-xs disabled:opacity-50 active:scale-95 transition">
                    🎯 Start Ludo
                  </button>
                )}
              </div>
            </div>
          ) : (
            canModerate ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="text-center text-white/50 text-sm">No active Ludo game. Create one!</div>
                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">👥 Number of Players</div>
                  <div className="grid grid-cols-3 gap-2">
                    {MAX_PLAYERS_OPTIONS.map(n => (
                      <button key={n} onClick={() => setMaxPlayers(n)}
                        className={`py-3 rounded-xl font-black text-lg active:scale-95 transition ${maxPlayers === n ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">🤝 Mode</div>
                  <button onClick={() => { if (maxPlayers !== 4) return; setTeamMode(v => !v); }} disabled={maxPlayers !== 4}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs active:scale-95 transition ${maxPlayers === 4 ? (teamMode ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20') : 'bg-white/5 text-white/40 cursor-not-allowed'}`}>
                    Team 2v2 {teamMode ? 'ON' : 'OFF'}
                  </button>
                  {maxPlayers !== 4 && <div className="text-[10px] text-white/45 mt-1">Team mode is available only with 4 players.</div>}
                </div>
                <div>
                  <div className="text-white/70 text-xs font-bold mb-2 uppercase tracking-wider">🪙 Entry Cost</div>
                  <div className="grid grid-cols-3 gap-2">
                    {ENTRY_COST_OPTIONS.map(c => (
                      <button key={c} onClick={() => setEntryCost(c)}
                        className={`py-2.5 rounded-xl font-bold text-xs active:scale-95 transition ${entryCost === c ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                        {c === 0 ? '🆓' : c >= 1000 ? (c/1000)+'k' : c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <div className="text-amber-200/70 text-[10px] font-bold uppercase mb-1">
                    {entryCost === 0 ? 'Free to play' : 'Winner gets (after 10% fee)'}
                  </div>
                  <div className="text-amber-400 font-black text-2xl">
                    {entryCost === 0 ? '🆓 No entry cost' : `🪙 ${Math.floor(entryCost * maxPlayers * 0.9).toLocaleString()}`}
                  </div>
                </div>
                <button onClick={createSession} disabled={creating} className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 via-blue-500 to-green-500 text-white font-black text-sm active:scale-95 transition disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🎯 Create Ludo Game'}
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