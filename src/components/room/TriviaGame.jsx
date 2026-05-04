import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Plus, Trash2, BrainCircuit, Target, Trophy, Sparkles, Timer } from 'lucide-react';
import kromboLogo from '../../assets/krombo-logo.svg';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#1e293b"/><circle cx="64" cy="52" r="22" fill="#334155"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#334155"/></svg>`);

const ENTRY_COST_OPTIONS = [0, 100, 200, 500, 1000, 5000];
const TIME_OPTIONS = [10, 15, 20, 30];
const POINTS_OPTIONS = [50, 100, 200, 500, 1000];
const TRIVIA_BRAND_NAME = 'Dash';
const TRIVIA_SUBTITLE = 'Quiz Arena';

export default function TriviaGame({
  open,
  onClose,
  roomId,
  user,
  canModerate,
  userCoins,
  onCoinsUpdated,
  onTriviaResult,
  channelRef,
  isVIP,
}) {
  const [currentSession, setCurrentSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Create form
  const [entryCost, setEntryCost] = useState(0);
  const [timePerQ, setTimePerQ] = useState(15);
  const [pointsPerQ, setPointsPerQ] = useState(100);
  const [newQuestions, setNewQuestions] = useState([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' }
  ]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState(null);
  const [winnerCoins, setWinnerCoins] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeExpired, setTimeExpired] = useState(false);
  const [playerAnswerCounts, setPlayerAnswerCounts] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [gameMode, setGameMode] = useState('solo');
  const [teams, setTeams] = useState([]);
  const [newTeams, setNewTeams] = useState([
    { name: 'Team A', color: '#6366f1', max_members: 5 },
    { name: 'Team B', color: '#ec4899', max_members: 5 },
  ]);
  const [winnerTeam, setWinnerTeam] = useState(null);
  const audioRef = useRef(null);

  const timerRef = useRef(null);
  const questionsRef = useRef([]);
  const resultFiredRef = useRef(false);
  const channelSubscriptionRef = useRef(null);

  useEffect(() => {
    if (!open || !roomId) return;
    loadSession();
  }, [open, roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!open || !roomId) return;

    const channel = supabase
      .channel(`trivia_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_trivia_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const s = payload.new;
        setCurrentSession(s);

        if (s?.status === 'finished') {
          handleSessionFinished(s);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_trivia_players',
      }, () => {
        if (currentSession?.id) loadPlayers(currentSession.id);
      })
      .subscribe();

    // Listen for all trivia broadcasts
    if (channelRef?.current) {
      channelRef.current.on?.('broadcast', { event: 'trivia_session_created' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        setCurrentSession(payload.session);
        setPlayers([]);
        setCurrentQuestion(null);
        setTeams([]);
        loadPlayers(payload.session.id);
        if (payload.session.mode === 'team') loadTeams(payload.session.id);
      });

      channelRef.current.on?.('broadcast', { event: 'trivia_player_joined' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        loadPlayers(payload.session_id);
      });

      channelRef.current.on?.('broadcast', { event: 'trivia_question' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        setCurrentSession(prev => prev ? { ...prev, status: 'active' } : prev);
        setCurrentQIndex(payload.question_order);
        setCurrentQuestion(payload.question);
        setSelectedAnswer(null);
        setAnswerResult(null);
        setTimeExpired(false);
        // Don't reset counts - accumulate across all questions
        setQuestionStartedAt(Date.now());
        setTimeLeft(payload.time_per_question);
        startTimer(payload.time_per_question);
      });

      channelRef.current.on?.('broadcast', { event: 'trivia_answer_submitted' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        setPlayerAnswerCounts(prev => {
          const key = payload.user_id;
          const current = prev[key] || { correct: 0, wrong: 0 };
          return {
            ...prev,
            [key]: {
              correct: current.correct + (payload.is_correct ? 1 : 0),
              wrong: current.wrong + (!payload.is_correct ? 1 : 0),
            }
          };
        });
      });

      channelRef.current.on?.('broadcast', { event: 'trivia_team_updated' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        loadTeams(payload.session_id);
        loadPlayers(payload.session_id);
      });

      channelRef.current.on?.('broadcast', { event: 'trivia_ended' }, ({ payload }) => {
        if (String(payload.room_id) !== String(roomId)) return;
        handleSessionFinished(payload);
      });
    }

    channelSubscriptionRef.current = channel;
    return () => {
      clearInterval(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [open, roomId, currentSession?.id]);

  useEffect(() => {
    if (!open) return;
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        ctx.close();
      } catch {}
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, [open]);

  const startTimer = (seconds) => {
    clearInterval(timerRef.current);
    setTimeLeft(seconds);
    setTimeExpired(false);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimeExpired(true);
          playSound('timeout');
          return 0;
        }
        if (prev <= 6) playSound('tick');
        return prev - 1;
      });
    }, 1000);
  };

  const playSound = (type) => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'tick') {
        oscillator.frequency.value = 880;
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
      } else if (type === 'correct') {
        oscillator.frequency.value = 523;
        oscillator.frequency.setValueAtTime(523, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
      } else if (type === 'wrong') {
        oscillator.frequency.value = 200;
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } else if (type === 'timeout') {
        oscillator.frequency.value = 300;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } else if (type === 'next') {
        oscillator.frequency.value = 440;
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.setValueAtTime(550, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      }
    } catch {}
  };

  const handleSessionFinished = async (sessionData) => {
    if (resultFiredRef.current) return;
    resultFiredRef.current = true;
    clearInterval(timerRef.current);

    const playersList = await loadPlayers(sessionData.id || currentSession?.id);
    const sorted = [...playersList].sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);

    const w = sorted[0];
    if (w) {
      setWinner(w);
      setWinnerCoins(sessionData.winner_coins || 0);
      setShowResult(true);

      // Team mode winner
      if (sessionData.winner_team_id) {
        const wTeam = teams.find(t => t.id === sessionData.winner_team_id) || {
          name: sessionData.winner_team_name || 'Winner Team',
          color: '#6366f1',
          total_score: sessionData.winner_team_score || 0,
        };
        setWinnerTeam(wTeam);
      }

      if (String(w.user_id) === String(user?.id)) {
        onTriviaResult?.({
          winnerName: w.name,
          winnerAvatar: w.avatar_url,
          winnerId: w.user_id,
          winnerCoins: sessionData.winner_coins || 0,
          totalPlayers: playersList.length,
        });
      }
    }

    setTimeout(() => {
      resultFiredRef.current = false;
      setCurrentSession(null);
      setPlayers([]);
      setShowResult(false);
      setWinner(null);
      setCurrentQuestion(null);
      setLeaderboard([]);
    }, 8000);
  };

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_trivia_sessions')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(data || null);
      if (data?.id) {
        await loadPlayers(data.id);
        await loadQuestions(data.id);
        if (data.mode === 'team') await loadTeams(data.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (sessionId) => {
    if (!sessionId) return [];
    const { data } = await supabase
      .from('room_trivia_players')
      .select('*')
      .eq('session_id', sessionId)
      .is('refunded_at', null)
      .order('score', { ascending: false });

    if (!data?.length) {
      setPlayers([]);
      return [];
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', data.map(p => p.user_id));

    const map = new Map((profiles || []).map(p => [p.id, p]));
    const merged = data.map(p => ({
      ...p,
      name: map.get(p.user_id)?.name || 'User',
      avatar_url: map.get(p.user_id)?.avatar_url || null,
    }));

    setPlayers(merged);
    return merged;
  };

  const loadQuestions = async (sessionId) => {
    const { data } = await supabase
      .from('room_trivia_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });
    const qs = data || [];
    setQuestions(qs);
    questionsRef.current = qs;
    return qs;
  };

  const loadTeams = async (sessionId) => {
    if (!sessionId) return [];
    const { data } = await supabase
      .from('room_trivia_teams')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const teamsData = data || [];

    // Load captain profiles
    const captainIds = teamsData.map(t => t.captain_user_id).filter(Boolean);
    let profilesMap = new Map();
    if (captainIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', captainIds);
      profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    }

    const merged = teamsData.map(t => ({
      ...t,
      captain_name: profilesMap.get(t.captain_user_id)?.name || 'User',
      captain_avatar: profilesMap.get(t.captain_user_id)?.avatar_url || null,
    }));

    setTeams(merged);
    return merged;
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) return;
    setGeneratingAI(true);
    try {
      // IMPORTANT: Edge Function name in Supabase is quick-worker
      console.log('[Trivia AI] invoking quick-worker with topic:', aiTopic.trim());

      const { data, error } = await supabase.functions.invoke('quick-worker', {
        body: { topic: aiTopic.trim(), count: aiCount },
      });

      console.log('[Trivia AI] response data:', data);
      console.log('[Trivia AI] response error:', error);

      if (error) {
        throw new Error(
          error.context?.error ||
          error.context?.message ||
          error.message ||
          JSON.stringify(error)
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!Array.isArray(data?.questions) || data.questions.length === 0) {
        throw new Error('No questions generated');
      }

      const normalized = data.questions.map((q) => ({
        question_text: q.question_text || '',
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_answer: ['A', 'B', 'C', 'D'].includes(q.correct_answer)
          ? q.correct_answer
          : 'A',
      }));

      setNewQuestions(normalized);
    } catch (err) {
      console.error('[Trivia AI] failed:', err);
      alert('Failed to generate: ' + (err?.message || 'Unknown error'));
    } finally {
      setGeneratingAI(false);
    }
  };

  const createSession = async () => {
    if (!canModerate || !roomId || !user?.id) return;
    const validQs = newQuestions.filter(q =>
      q.question_text.trim() && q.option_a && q.option_b && q.option_c && q.option_d
    );
    if (validQs.length === 0) {
      alert('Add at least 1 question');
      return;
    }

    setCreating(true);
    try {
      const { data: session, error } = await supabase
        .from('room_trivia_sessions')
        .insert({
          room_id: roomId,
          created_by: user.id,
          entry_cost: entryCost,
          time_per_question: timePerQ,
          points_per_question: pointsPerQ,
          total_questions: validQs.length,
          mode: gameMode,
          status: 'waiting',
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('room_trivia_questions').insert(
        validQs.map((q, i) => ({
          session_id: session.id,
          question_order: i + 1,
          ...q,
        }))
      );

      // Create teams if team mode
      let createdTeams = [];
      if (gameMode === 'team') {
        const { data: teamsData } = await supabase
          .from('room_trivia_teams')
          .insert(newTeams.filter(t => t.name.trim()).map(t => ({
            session_id: session.id,
            name: t.name,
            color: t.color,
            max_members: t.max_members,
          })))
          .select();
        createdTeams = teamsData || [];
        setTeams(createdTeams);
      }

      setCurrentSession(session);
      setPlayers([]);
      setQuestions(validQs);

      // Broadcast new session to all users
      channelRef?.current?.send({
        type: 'broadcast',
        event: 'trivia_session_created',
        payload: {
          room_id: roomId,
          session: session,
          ts: Date.now(),
        },
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const joinTeam = async (teamId) => {
    if (!currentSession?.id || !user?.id) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_trivia_team', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
        p_team_id: teamId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);
      await loadTeams(currentSession.id);

      channelRef?.current?.send({
        type: 'broadcast',
        event: 'trivia_team_updated',
        payload: {
          room_id: roomId,
          session_id: currentSession.id,
          ts: Date.now(),
        },
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const joinSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_trivia_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);

      // Broadcast player joined
      channelRef?.current?.send({
        type: 'broadcast',
        event: 'trivia_player_joined',
        payload: {
          room_id: roomId,
          session_id: currentSession.id,
          ts: Date.now(),
        },
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const leaveSession = async () => {
    if (!currentSession?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { data, error } = await supabase.rpc('leave_trivia_session', {
        p_session_id: currentSession.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      onCoinsUpdated?.();
      await loadPlayers(currentSession.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setLeaving(false);
    }
  };

  const startGame = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (players.length < 1) {
      alert('Need at least 1 player');
      return;
    }

    const qs = await loadQuestions(currentSession.id);
    if (!qs.length) {
      alert('No questions found');
      return;
    }

    await supabase
      .from('room_trivia_sessions')
      .update({ status: 'active', current_question: 1, question_started_at: new Date().toISOString() })
      .eq('id', currentSession.id);

    // Broadcast first question (hide correct answer)
    const firstQ = qs[0];
    const questionPayload = {
      room_id: roomId,
      question_order: 1,
      time_per_question: currentSession.time_per_question,
      question: {
        id: firstQ.id,
        question_text: firstQ.question_text,
        option_a: firstQ.option_a,
        option_b: firstQ.option_b,
        option_c: firstQ.option_c,
        option_d: firstQ.option_d,
      },
    };

    channelRef?.current?.send({
      type: 'broadcast',
      event: 'trivia_question',
      payload: questionPayload,
    });

    setCurrentQIndex(1);
    setCurrentQuestion(questionPayload.question);
    setQuestionStartedAt(Date.now());
    setTimeLeft(currentSession.time_per_question);
    startTimer(currentSession.time_per_question);
  };

  const nextQuestion = async () => {
    if (!canModerate || !currentSession?.id) return;

    // Always use ref to avoid stale state
    let qs = questionsRef.current;
    if (!qs.length) {
      qs = await loadQuestions(currentSession.id);
    }

    const nextIdx = currentQIndex + 1;

    if (nextIdx > currentSession.total_questions) {
      // Finish game
      const { data } = await supabase.rpc('finish_trivia_session', {
        p_session_id: currentSession.id,
      });

      channelRef?.current?.send({
        type: 'broadcast',
        event: 'trivia_ended',
        payload: {
          room_id: roomId,
          id: currentSession.id,
          winner_coins: data?.winner_coins || 0,
        },
      });
      return;
    }

    const nextQ = qs[nextIdx - 1];
    if (!nextQ) {
      console.error('Question not found at index', nextIdx - 1, 'qs length:', qs.length);
      return;
    }

    await supabase
      .from('room_trivia_sessions')
      .update({ current_question: nextIdx, question_started_at: new Date().toISOString() })
      .eq('id', currentSession.id);

    const questionPayload = {
      room_id: roomId,
      question_order: nextIdx,
      time_per_question: currentSession.time_per_question,
      question: {
        id: nextQ.id,
        question_text: nextQ.question_text,
        option_a: nextQ.option_a,
        option_b: nextQ.option_b,
        option_c: nextQ.option_c,
        option_d: nextQ.option_d,
      },
    };

    playSound('next');
    channelRef?.current?.send({
      type: 'broadcast',
      event: 'trivia_question',
      payload: questionPayload,
    });

    setCurrentQIndex(nextIdx);
    setCurrentQuestion(questionPayload.question);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setTimeExpired(false);
    setQuestionStartedAt(Date.now());
    setTimeLeft(currentSession.time_per_question);
    startTimer(currentSession.time_per_question);
  };

  const submitAnswer = async (answer) => {
    if (!currentSession?.id || !user?.id || selectedAnswer) return;
    if (!isJoined) return; // Viewers can't answer
    setSelectedAnswer(answer);
    const timeTaken = Date.now() - (questionStartedAt || Date.now());

    const { data, error } = await supabase.rpc('submit_trivia_answer', {
      p_session_id: currentSession.id,
      p_user_id: user.id,
      p_question_order: currentQIndex,
      p_answer: answer,
      p_time_taken_ms: timeTaken,
    });

    if (!error && data?.success) {
      setAnswerResult({
        isCorrect: data.is_correct,
        correctAnswer: data.correct_answer,
        points: data.points,
      });
      playSound(data.is_correct ? 'correct' : 'wrong');
      onCoinsUpdated?.();

      // Broadcast answer count update
      channelRef?.current?.send({
        type: 'broadcast',
        event: 'trivia_answer_submitted',
        payload: {
          room_id: roomId,
          session_id: currentSession.id,
          user_id: user.id,
          is_correct: data.is_correct,
          time_ms: timeTaken,
          ts: Date.now(),
        },
      });

      await loadPlayers(currentSession.id);
    }
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (!window.confirm(`Cancel ${TRIVIA_BRAND_NAME}? All players will be refunded.`)) return;

    await supabase
      .from('room_trivia_sessions')
      .update({ status: 'finished' })
      .eq('id', currentSession.id);

    // Refund all
    const { data: ps } = await supabase
      .from('room_trivia_players')
      .select('user_id')
      .eq('session_id', currentSession.id)
      .is('refunded_at', null);

    if (ps?.length && currentSession.entry_cost > 0) {
      for (const p of ps) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('coins')
          .eq('user_id', p.user_id)
          .maybeSingle();

        if (wallet) {
          await supabase
            .from('wallets')
            .update({ coins: (wallet.coins || 0) + currentSession.entry_cost })
            .eq('user_id', p.user_id);
        }
      }
    }

    setCurrentSession(null);
    setPlayers([]);
    setCurrentQuestion(null);
    onCoinsUpdated?.();
  };

  const handleInputFocus = (e) => {
    const target = e.target;
    // Double timeout ensures smooth scrolling even if keyboard animation is slow
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  };

  const isJoined = players.some(p => String(p.user_id) === String(user?.id));
  const myPlayer = players.find(p => String(p.user_id) === String(user?.id));
  
  const OPTION_COLORS = {
    A: 'from-blue-600 to-cyan-500 shadow-blue-500/30',
    B: 'from-emerald-600 to-teal-500 shadow-emerald-500/30',
    C: 'from-amber-500 to-orange-500 shadow-amber-500/30',
    D: 'from-rose-600 to-pink-500 shadow-rose-500/30',
  };
  const OPTION_LABELS = { A: 'A', B: 'B', C: 'C', D: 'D' };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl transition-opacity duration-500" />
      <div
        className="relative w-full max-w-md bg-slate-900/95 sm:backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85dvh] border-t sm:border border-white/10 ring-1 ring-white/5"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-md opacity-40 group-hover:opacity-70 transition duration-500 animate-pulse"></div>
              <img 
                src={kromboLogo} 
                alt="Krombo Logo" 
                className="relative w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transform group-hover:rotate-12 transition-transform duration-300"
              />
            </div>
            <div>
              <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 text-3xl tracking-tight leading-none drop-shadow-[0_0_10px_rgba(216,180,254,0.6)]">{TRIVIA_BRAND_NAME}</h1>
              <p className="text-white/80 text-sm font-bold tracking-widest mt-1 uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-fuchsia-300" /> {TRIVIA_SUBTITLE}
              </p>
              {currentSession?.status === 'active' && currentQuestion && (
                <div className="inline-block bg-white/10 px-2 py-0.5 rounded-md text-white/80 text-[10px] font-black uppercase tracking-widest mt-1.5 border border-white/10 shadow-sm">
                  Question {currentQIndex} / {currentSession.total_questions}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <span className="text-sm drop-shadow-md">🪙</span>
              <span className="text-amber-400 font-black text-sm drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">
                {(userCoins || 0).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="text-white/50 hover:text-white transition-colors text-lg bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-rose-400 transition-colors bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-8 sm:pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" />
            </div>

          ) : showResult ? (
            // Results screen
            <div className="flex flex-col items-center gap-5 py-8">
              {winnerTeam ? (
                <>
                  <div className="relative mt-4 mb-6">
                    <div className="absolute -inset-4 bg-gradient-to-r from-white/20 to-white/0 rounded-full blur-2xl opacity-60 animate-[spin_4s_linear_infinite]" style={{ backgroundColor: winnerTeam.color }}></div>
                    <div className="relative bg-slate-900/90 border-4 rounded-3xl px-10 py-8 text-center shadow-2xl backdrop-blur-xl transform hover:scale-105 transition-transform duration-500" style={{ borderColor: winnerTeam.color, boxShadow: `0 0 40px ${winnerTeam.color}80` }}>
                      <Trophy className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-bounce" style={{ color: winnerTeam.color }} />
                      <div className="font-black text-5xl tracking-widest uppercase mt-4 drop-shadow-lg"
                        style={{ color: winnerTeam.color }}>
                        {winnerTeam.name}
                      </div>
                      <div className="text-white/80 text-xl font-bold mt-2 tracking-widest uppercase">Champions!</div>
                      <div className="mt-6 bg-black/40 border border-white/10 rounded-2xl px-8 py-4 text-center inline-block">
                        <div className="text-white/50 text-sm font-bold uppercase tracking-widest mb-1">Team Score</div>
                        <div className="font-black text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" style={{ color: winnerTeam.color }}>
                          {winnerTeam.total_score || 0} <span className="text-2xl text-white/40">pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Team members */}
                  <div className="w-full space-y-3 px-2">
                    <div className="text-center mb-2">
                      <span className="text-white/60 font-black text-sm uppercase tracking-widest">Winning Roster</span>
                    </div>
                    {players.filter(p => p.team_id === winnerTeam.id).map((p, i) => (
                      <div key={p.id} className="flex items-center gap-4 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-2xl px-5 py-3 shadow-lg transform hover:-translate-y-1 transition-all duration-300" style={{ borderLeftColor: winnerTeam.color, borderLeftWidth: '4px' }}>
                        <span className="text-xl w-6 text-center drop-shadow-md">{['🥇','🥈','🥉'][i] || '🏅'}</span>
                        <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-md" />
                        <span className="text-white font-black text-lg flex-1">{p.name}</span>
                        <span className="font-black text-lg px-3 py-1 rounded-xl bg-black/30 border border-white/10" style={{ color: winnerTeam.color }}>{p.score} pts</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 blur-xl opacity-50 animate-pulse rounded-full"></div>
                    <div className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-500 font-black text-5xl tracking-widest uppercase drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] relative z-10 animate-bounce">
                      Winner!
                    </div>
                  </div>
                  
                  <div className="relative mt-4 mb-2">
                    <div className="absolute -inset-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 rounded-full blur-xl opacity-70 animate-[spin_4s_linear_infinite]" />
                    <div className="absolute -inset-2 bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full blur-md opacity-80 animate-pulse" />
                    <img
                      src={winner?.avatar_url || FALLBACK_AVATAR}
                      alt={winner?.name}
                      className="relative w-32 h-32 rounded-full border-4 border-amber-300 object-cover shadow-[0_0_30px_rgba(251,191,36,0.8)] transform hover:scale-110 transition-transform duration-500"
                    />
                    <Trophy className="absolute -bottom-2 -right-2 w-10 h-10 text-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,1)] animate-bounce" />
                  </div>
                  <div className="text-white font-black text-4xl drop-shadow-lg mt-2">{winner?.name}</div>
                  
                  {winnerCoins > 0 && (
                    <div className="relative group mt-4">
                      <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-2xl blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                      <div className="relative bg-slate-900/80 ring-1 ring-amber-400/50 rounded-2xl px-10 py-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.4)] backdrop-blur-sm transform hover:scale-105 transition-transform duration-300">
                        <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-2xl pointer-events-none">
                          <Sparkles className="absolute top-2 left-2 w-4 h-4 text-amber-300 animate-ping opacity-75" />
                          <Sparkles className="absolute bottom-2 right-2 w-5 h-5 text-yellow-200 animate-pulse opacity-75" />
                        </div>
                        <div className="text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 text-6xl font-black drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] flex items-center justify-center gap-3">
                          <span className="animate-bounce">🪙</span> 
                          <span>{winnerCoins.toLocaleString()}</span>
                        </div>
                        <div className="text-amber-400/80 text-sm font-bold uppercase tracking-widest mt-2">Total Winnings</div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Leaderboard */}
              <div className="w-full space-y-3 mt-8 px-2">
                <div className="text-center mb-4">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 font-black text-2xl uppercase tracking-widest drop-shadow-md">
                    Final Standings
                  </span>
                </div>
                {leaderboard.slice(0, 5).map((p, i) => {
                  const totalSec = p.total_time_ms ? (p.total_time_ms / 1000).toFixed(1) : null;
                  const isFirst = i === 0;
                  return (
                    <div key={p.id} className={`flex items-center gap-4 transition-all duration-300 border rounded-2xl px-5 py-4 shadow-lg transform hover:-translate-y-1 ${
                      isFirst 
                        ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-105 z-10' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}>
                      <div className="relative flex items-center justify-center w-10 h-10">
                        {isFirst && <div className="absolute inset-0 bg-amber-400 blur-md opacity-50 rounded-full animate-pulse"></div>}
                        <span className="relative text-3xl drop-shadow-lg z-10">{['👑','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                      </div>
                      <div className="relative">
                        {isFirst && <div className="absolute -inset-1 bg-amber-400 rounded-full blur-sm opacity-50"></div>}
                        <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                          className={`relative w-12 h-12 rounded-full object-cover border-2 shadow-md ${isFirst ? 'border-amber-300' : 'border-white/20'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black truncate text-lg ${isFirst ? 'text-amber-300 drop-shadow-md' : 'text-white'}`}>{p.name}</div>
                        {totalSec && (
                          <div className="text-blue-300/80 text-xs font-bold flex items-center gap-1">
                            <Timer className="w-3 h-3" /> {totalSec}s total
                          </div>
                        )}
                      </div>
                      <div className={`font-black px-4 py-2 rounded-xl shadow-inner border ${
                        isFirst 
                          ? 'bg-amber-400/20 border-amber-400/40 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)] text-xl' 
                          : 'bg-white/5 border-white/10 text-amber-400/80 text-lg'
                      }`}>
                        {p.score} <span className="text-xs opacity-70">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          ) : currentSession?.status === 'active' && currentQuestion ? (
            // Active game - question screen
            <div className="flex flex-col gap-4">
              {/* Timer */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 bg-white/10 border border-white/5 px-4 py-2 rounded-xl shadow-inner backdrop-blur-sm">
                  <BrainCircuit className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]" />
                  <span className="text-white/90 text-sm font-black">Q {currentQIndex} <span className="text-white/40">/ {currentSession.total_questions}</span></span>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xl shadow-2xl border backdrop-blur-md transition-colors duration-300 ${timeLeft <= 5 ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse shadow-[0_0_25px_rgba(225,29,72,0.6)]' : 'bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}>
                  <Timer className={`w-6 h-6 ${timeLeft <= 5 ? 'animate-ping' : ''}`} />
                  {timeLeft}s
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 sm:h-4 bg-slate-900/80 rounded-full overflow-hidden mb-4 border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear relative ${timeLeft <= 5 ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.8)]' : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]'}`}
                  style={{ width: `${(timeLeft / (currentSession.time_per_question || 15)) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                  <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                </div>
              </div>

              {/* Question - Enhanced Visuals */}
              <div className="relative mt-4 mb-6 group">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-blue-600 rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition duration-500 animate-pulse" />
                <div className="relative bg-slate-900/95 border border-white/20 rounded-3xl p-8 sm:p-10 text-center shadow-[0_0_40px_rgba(168,85,247,0.3)] backdrop-blur-2xl">
                  <Sparkles className="absolute top-4 right-4 w-6 h-6 text-purple-300/70 animate-ping" />
                  <BrainCircuit className="absolute bottom-4 left-4 w-6 h-6 text-blue-300/70 animate-pulse" />
                  <p className="text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-purple-200 font-black text-2xl sm:text-3xl leading-snug drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                    {currentQuestion.question_text}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {['A','B','C','D'].map(opt => {
                  const optText = currentQuestion[`option_${opt.toLowerCase()}`];
                  const isSelected = selectedAnswer === opt;
                  const isCorrect = answerResult?.correctAnswer === opt;
                  const isWrong = isSelected && !answerResult?.isCorrect;

                  let bg = `bg-gradient-to-br ${OPTION_COLORS[opt]} shadow-lg`;
                  if (answerResult) {
                    if (isCorrect) bg = 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.8)] scale-[1.05] z-10 ring-4 ring-emerald-400/50';
                    else if (isWrong) bg = 'bg-gradient-to-br from-rose-500 to-rose-700 border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.5)] opacity-90 scale-95';
                    else bg = 'bg-white/5 border-white/10 opacity-30 grayscale-[70%] scale-95';
                  } else {
                    bg += ' hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:-translate-y-1.5 hover:scale-[1.02] hover:brightness-125';
                  }

                  return (
                    <button
                      key={opt}
                      onClick={() => submitAnswer(opt)}
                      disabled={!!selectedAnswer}
                      className={`${bg} rounded-2xl p-5 sm:p-6 text-left transition-all duration-300 active:scale-95 disabled:cursor-default border ${!answerResult ? 'border-white/20' : ''} relative overflow-hidden group`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors duration-300" />
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity duration-300 transform group-hover:rotate-12 group-hover:scale-110">
                        <Target className="w-12 h-12" />
                      </div>
                      <div className="text-white/90 text-sm font-black mb-2 drop-shadow-md flex items-center gap-2">
                        <span className="bg-white/20 px-2 py-0.5 rounded-md shadow-sm">{OPTION_LABELS[opt]}</span>
                      </div>
                      <div className="text-white font-bold text-lg sm:text-xl leading-tight relative z-10 drop-shadow-lg">{optText}</div>
                    </button>
                  );
                })}
              </div>

              {/* Answer feedback */}
              {answerResult && (
                <div className={`text-center py-5 rounded-2xl font-black text-2xl shadow-2xl border mt-4 transform transition-all duration-500 animate-[bounce_0.5s_ease-in-out] ${
                  answerResult.isCorrect 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.4)]' 
                    : 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_30px_rgba(225,29,72,0.4)]'
                }`}>
                  {answerResult.isCorrect ? (
                    <div className="flex items-center justify-center gap-3">
                      <Sparkles className="w-8 h-8 text-emerald-300 animate-spin" />
                      <span>Correct! +{answerResult.points} pts</span>
                      <Sparkles className="w-8 h-8 text-emerald-300 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <X className="w-8 h-8 text-rose-400 animate-ping" />
                      <span>Wrong! Correct was {answerResult.correctAnswer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* My score */}
              {myPlayer && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-full px-6 py-2.5 flex items-center gap-3 shadow-[0_0_15px_rgba(245,158,11,0.15)] backdrop-blur-sm transform hover:scale-105 transition-transform">
                    <span className="text-amber-200/70 text-xs font-black uppercase tracking-widest">My Score</span>
                    <span className="text-amber-400 font-black text-xl drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">{myPlayer.score} <span className="text-sm opacity-70">pts</span></span>
                  </div>
                </div>
              )}

              {/* Next question button for moderator */}
              {canModerate && (
                <button
                  onClick={nextQuestion}
                  disabled={!timeExpired}
                  className={`relative w-full py-5 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-xl mt-5 overflow-hidden group ${
                    timeExpired
                      ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:shadow-[0_0_40px_rgba(59,130,246,0.7)] bg-[length:200%_auto] hover:bg-right duration-500'
                      : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                  }`}
                >
                  {timeExpired && <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />}
                  <span className="relative flex items-center justify-center gap-2">
                    {!timeExpired
                      ? <><Loader2 className="w-5 h-5 animate-spin"/> Wait {timeLeft}s...</>
                      : currentQIndex >= (currentSession.total_questions ?? 0)
                      ? <><Trophy className="w-6 h-6 group-hover:animate-bounce"/> End Game</>
                      : <><Sparkles className="w-6 h-6 group-hover:animate-pulse"/> Next Question ({currentQIndex}/{currentSession.total_questions})</>
                    }
                  </span>
                </button>
              )}

              {/* Players scores */}
              <div className="space-y-2.5 mt-6">
                <div className="text-white/70 text-sm font-black uppercase tracking-widest mb-4 px-1 flex items-center gap-2 border-b border-white/10 pb-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Live Leaderboard
                </div>

                {/* Team scores */}
                {currentSession.mode === 'team' && teams.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[...teams].sort((a,b) => (b.total_score||0) - (a.total_score||0)).map(team => (
                      <div key={team.id} className="rounded-2xl p-4 text-center border-2 shadow-lg transform hover:-translate-y-1 transition-transform"
                        style={{ borderColor: team.color + '50', background: `linear-gradient(135deg, ${team.color}20, transparent)` }}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: team.color, color: team.color }} />
                          <span className="text-white text-sm font-black drop-shadow-md">{team.name}</span>
                        </div>
                        <div className="font-black text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ color: team.color }}>
                          {team.total_score || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {[...players].sort((a,b) => {
                  if (b.score !== a.score) return b.score - a.score;
                  return (a.total_time_ms || 0) - (b.total_time_ms || 0);
                }).map((p, i) => {
                  const counts = playerAnswerCounts[p.user_id] || { correct: 0, wrong: 0 };
                  const totalSec = p.total_time_ms ? (p.total_time_ms / 1000).toFixed(1) : null;
                  const isTop = i === 0 && p.score > 0;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 transition-all duration-300 border rounded-xl px-3 py-3 shadow-sm ${
                      isTop ? 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.1)]' : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}>
                      <span className="text-xl w-8 text-center drop-shadow-md">{['🥇','🥈','🥉'][i] || <span className="text-sm text-white/40 font-black">{i + 1}</span>}</span>
                      <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                        className={`w-9 h-9 rounded-full object-cover border shadow-sm ${isTop ? 'border-amber-400/50' : 'border-white/20'}`} />
                      <span className={`text-sm font-bold flex-1 truncate ${isTop ? 'text-amber-100' : 'text-white'}`}>{p.name}</span>
                      <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-lg shadow-inner">
                        <span className="text-emerald-400 text-xs font-black flex items-center gap-0.5"><Target className="w-3 h-3"/>{counts.correct}</span>
                        <span className="text-rose-400 text-xs font-black flex items-center gap-0.5"><X className="w-3 h-3"/>{counts.wrong}</span>
                        {totalSec && (
                          <span className="text-blue-300 text-xs font-black ml-1 border-l border-white/10 pl-2 flex items-center gap-0.5"><Timer className="w-3 h-3"/>{totalSec}s</span>
                        )}
                      </div>
                      <span className={`font-black text-base w-12 text-right ${isTop ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-amber-400/70'}`}>{p.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          ) : currentSession ? (
            // Waiting room
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-amber-500/20 blur-md rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-lg backdrop-blur-sm transform group-hover:-translate-y-1 transition-all duration-300">
                    <div className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1.5">Entry</div>
                    <div className="text-amber-400 font-black text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                      {currentSession.entry_cost > 0 ? `🪙 ${currentSession.entry_cost}` : 'Free'}
                    </div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-lg backdrop-blur-sm transform group-hover:-translate-y-1 transition-all duration-300">
                    <div className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1.5">Questions</div>
                    <div className="text-white font-black text-base drop-shadow-md">{currentSession.total_questions}</div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-lg backdrop-blur-sm transform group-hover:-translate-y-1 transition-all duration-300">
                    <div className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1.5">Time/Q</div>
                    <div className="text-white font-black text-base drop-shadow-md">{currentSession.time_per_question}s</div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center justify-center shadow-lg backdrop-blur-sm transform group-hover:-translate-y-1 transition-all duration-300">
                    <div className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1.5">Mode</div>
                    <div className="text-white font-black text-base drop-shadow-md">{currentSession.mode === 'team' ? '👥' : '🎯'}</div>
                  </div>
                </div>
              </div>

              {/* TEAM MODE - Show teams */}
              {currentSession.mode === 'team' ? (
                <div className="space-y-4">
                  <div className="text-white/70 text-sm font-black uppercase tracking-widest px-1 flex items-center gap-2 border-b border-white/10 pb-2">
                    <Target className="w-4 h-4 text-blue-400 animate-pulse" /> Choose Your Team
                  </div>
                  {teams.map(team => {
                    const teamPlayers = players.filter(p => p.team_id === team.id);
                    const myTeam = players.find(p => String(p.user_id) === String(user?.id) && p.team_id === team.id);
                    const isFull = teamPlayers.length >= team.max_members;

                    return (
                      <div key={team.id}
                        className="relative border-2 rounded-2xl p-5 space-y-4 overflow-hidden group transition-all duration-300 hover:shadow-lg"
                        style={{ borderColor: team.color + '50', background: `linear-gradient(135deg, ${team.color}15, transparent)` }}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: team.color }}></div>
                        <div className="relative flex items-center justify-between z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: team.color, color: team.color }} />
                            <span className="text-white font-black text-xl drop-shadow-md">{team.name}</span>
                            <span className="bg-black/40 px-2 py-1 rounded-lg text-white/60 text-xs font-bold border border-white/5">{teamPlayers.length}/{team.max_members}</span>
                          </div>
                          {!myTeam && !isFull && (
                            <button
                              onClick={() => joinTeam(team.id)}
                              disabled={joining}
                              className="px-5 py-2 rounded-xl text-white font-black text-sm active:scale-95 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                              style={{ backgroundColor: team.color, boxShadow: `0 0 15px ${team.color}40` }}
                            >
                              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Team'}
                            </button>
                          )}
                          {myTeam && (
                            <span className="px-4 py-2 rounded-xl text-sm font-black text-white shadow-inner border border-white/20"
                              style={{ backgroundColor: team.color }}>
                              ✓ Your Team
                            </span>
                          )}
                          {isFull && !myTeam && (
                            <span className="bg-black/50 px-4 py-2 rounded-xl text-white/40 text-sm font-bold border border-white/10">Full</span>
                          )}
                        </div>

                        {/* Team members */}
                        <div className="relative flex flex-wrap gap-2.5 z-10">
                          {teamPlayers.map(p => (
                            <div key={p.id} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 shadow-sm hover:bg-black/60 transition-colors">
                              <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                                className="w-6 h-6 rounded-full object-cover border border-white/20" />
                              <span className="text-white/90 text-sm font-bold">{p.name}</span>
                            </div>
                          ))}
                          {teamPlayers.length === 0 && (
                            <span className="text-white/30 text-sm italic">No members yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="text-white/70 text-sm font-black uppercase tracking-widest mb-3 px-1 flex items-center gap-2 border-b border-white/10 pb-2">
                    <Target className="w-4 h-4 text-blue-400 animate-pulse" /> Players Joined ({players.length})
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {players.map(p => (
                      <div key={p.id} className="flex items-center gap-3 bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                        <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-sm" />
                        <span className="text-white text-sm font-bold truncate flex-1 drop-shadow-sm">{p.name}</span>
                        {String(p.user_id) === String(user?.id) && (
                          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-lg shadow-[0_0_10px_rgba(251,191,36,0.2)]">You</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mt-6">
                {currentSession.mode === 'solo' && !isJoined && (
                  <button onClick={joinSession} disabled={joining}
                    className="relative flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white font-black text-lg disabled:opacity-50 active:scale-95 transition-all shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:shadow-[0_0_40px_rgba(245,158,11,0.7)] flex items-center justify-center gap-3 overflow-hidden group bg-[length:200%_auto] hover:bg-right duration-500">
                    <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                    {joining ? <Loader2 className="w-6 h-6 animate-spin" /> : <>
                      <Sparkles className="w-5 h-5 animate-pulse" />
                      Join {currentSession.entry_cost > 0 ? `🪙 ${currentSession.entry_cost}` : 'Free'}
                    </>}
                  </button>
                )}
                {isJoined && (
                  <button onClick={leaveSession} disabled={leaving}
                    className="flex-1 py-4 rounded-2xl border border-white/20 text-white/80 font-bold text-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {leaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Leave Game'}
                  </button>
                )}
                {canModerate && players.length >= 1 && (
                  <button onClick={startGame}
                    className="relative flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500 text-white font-black text-lg active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] flex items-center justify-center gap-3 overflow-hidden group bg-[length:200%_auto] hover:bg-right duration-500">
                    <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                    <Target className="w-6 h-6 group-hover:animate-ping"/> Start {TRIVIA_BRAND_NAME}
                  </button>
                )}
                {canModerate && (
                  <button onClick={cancelSession}
                    className="px-6 py-4 rounded-2xl border border-rose-500/40 text-rose-400 font-bold text-lg bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(225,29,72,0.2)] hover:shadow-[0_0_25px_rgba(225,29,72,0.4)]">
                    Cancel
                  </button>
                )}
              </div>
            </div>

          ) : canModerate ? (
            // Create session form
            <div className="flex flex-col gap-4 pb-[50vh] sm:pb-0">
              <div className="text-center text-white/60 text-sm mb-4 font-medium">Configure your {TRIVIA_BRAND_NAME} game</div>

              {/* Game Mode */}
              <div className="mb-5">
                <div className="text-white/60 text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" /> Game Mode
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameMode('solo')}
                    className={`relative py-4 rounded-2xl font-black text-base active:scale-95 transition-all border-2 overflow-hidden group ${
                      gameMode === 'solo'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {gameMode === 'solo' && <div className="absolute inset-0 bg-purple-500/10 blur-xl animate-pulse"></div>}
                    <span className="relative flex items-center justify-center gap-2">
                      <span className="text-xl">🎯</span> Solo
                    </span>
                  </button>
                  <button
                    onClick={() => setGameMode('team')}
                    className={`relative py-4 rounded-2xl font-black text-base active:scale-95 transition-all border-2 overflow-hidden group ${
                      gameMode === 'team'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {gameMode === 'team' && <div className="absolute inset-0 bg-blue-500/10 blur-xl animate-pulse"></div>}
                    <span className="relative flex items-center justify-center gap-2">
                      <span className="text-xl">👥</span> Teams
                    </span>
                  </button>
                </div>
              </div>

              {/* Teams setup - only in team mode */}
              {gameMode === 'team' && (
                <div className="mb-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-blue-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="text-base">👥</span> Teams Setup
                    </div>
                    <button
                      onClick={() => setNewTeams(prev => [...prev, {
                        name: `Team ${String.fromCharCode(65 + prev.length)}`,
                        color: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'][prev.length] || '#6366f1',
                        max_members: 5,
                      }])}
                      className="flex items-center gap-1.5 text-xs text-blue-400 font-black bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
                    >
                      <Plus className="w-3 h-3" /> Add Team
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newTeams.map((team, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={team.color}
                          onChange={e => setNewTeams(prev => prev.map((t, idx) => idx === i ? {...t, color: e.target.value} : t))}
                          className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent shadow-sm"
                        />
                        <input
                          type="text"
                          value={team.name}
                          onChange={e => setNewTeams(prev => prev.map((t, idx) => idx === i ? {...t, name: e.target.value} : t))}
                          placeholder="Team name..."
                          className="flex-1 bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 rounded-xl px-4 py-2.5 text-white text-sm font-medium outline-none transition-all"
                        />
                        <input
                          type="number"
                          value={team.max_members}
                          onChange={e => setNewTeams(prev => prev.map((t, idx) => idx === i ? {...t, max_members: Number(e.target.value)} : t))}
                          min="2" max="20"
                          className="w-16 bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 rounded-xl px-2 py-2.5 text-white text-sm font-medium outline-none text-center transition-all"
                        />
                        {newTeams.length > 2 && (
                          <button
                            onClick={() => setNewTeams(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-400/70 hover:text-rose-400 p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry cost */}
              <div className="mb-5">
                <div className="text-white/60 text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-amber-400 drop-shadow-md">🪙</span> Entry Cost
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {ENTRY_COST_OPTIONS.map(c => (
                    <button key={c} onClick={() => setEntryCost(c)}
                      className={`relative py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all border-2 overflow-hidden ${
                        entryCost === c 
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20 hover:text-white/80'
                      }`}>
                      {entryCost === c && <div className="absolute inset-0 bg-amber-500/10 blur-md animate-pulse"></div>}
                      <span className="relative">{c === 0 ? 'Free' : c >= 1000 ? `${c / 1000}k` : c}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time per question */}
              <div className="mb-5">
                <div className="text-white/60 text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                  <Timer className="w-4 h-4 text-blue-400 drop-shadow-md" /> Seconds per Question
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {TIME_OPTIONS.map(t => (
                    <button key={t} onClick={() => setTimePerQ(t)}
                      className={`relative py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all border-2 overflow-hidden ${
                        timePerQ === t 
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20 hover:text-white/80'
                      }`}>
                      {timePerQ === t && <div className="absolute inset-0 bg-blue-500/10 blur-md animate-pulse"></div>}
                      <span className="relative">{t}s</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Points per question */}
              <div className="mb-6">
                <div className="text-white/60 text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-emerald-400 drop-shadow-md">⭐</span> Points per Question
                </div>
                <div className="grid grid-cols-5 gap-2.5">
                  {POINTS_OPTIONS.map(p => (
                    <button key={p} onClick={() => setPointsPerQ(p)}
                      className={`relative py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all border-2 overflow-hidden ${
                        pointsPerQ === p
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20 hover:text-white/80'
                      }`}>
                      {pointsPerQ === p && <div className="absolute inset-0 bg-emerald-500/10 blur-md animate-pulse"></div>}
                      <span className="relative">{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Generate */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-3xl p-6 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <Sparkles className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.5)] animate-pulse" />
                  <div className="text-purple-300 text-sm font-black uppercase tracking-widest">Generate with AI</div>
                </div>
                <div className="flex gap-3 mb-4 relative z-10">
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder="Topic (e.g. Football, Science...)"
                    className="flex-1 bg-black/40 border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/30 rounded-xl px-5 py-3.5 text-white text-sm font-medium outline-none placeholder:text-white/30 transition-all scroll-mt-20 shadow-inner"
                  />
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 shadow-inner">
                    <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Questions:</span>
                    {[3,5,7,10].map(n => (
                      <button key={n} onClick={() => setAiCount(n)}
                        className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${
                          aiCount === n
                            ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                            : 'text-white/50 hover:text-white hover:bg-white/10'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={isVIP ? generateWithAI : () => alert('👑 VIP only feature')}
                    disabled={generatingAI || !aiTopic.trim()}
                    className={`relative px-6 py-3 rounded-xl text-white font-black text-sm active:scale-95 transition-all flex items-center gap-2 overflow-hidden group ${
                      isVIP
                        ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-blue-500 disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.7)] bg-[length:200%_auto] hover:bg-right duration-500'
                        : 'bg-white/10 border border-white/20 cursor-pointer'
                    }`}
                  >
                    {isVIP && <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />}
                    {generatingAI
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : isVIP ? <><Sparkles className="w-4 h-4"/> Go</> : 'VIP👑'
                    }
                  </button>
                </div>
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="text-white/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-400 drop-shadow-md" /> Questions ({newQuestions.length})
                  </div>
                  <button
                    onClick={() => setNewQuestions(prev => [...prev, {
                      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A'
                    }])}
                    className="flex items-center gap-2 text-sm text-blue-400 font-black hover:text-blue-300 transition-all bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:-translate-y-0.5"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>

                <div className="space-y-5 pb-2 pr-2">
                  {newQuestions.map((q, i) => (
                    <React.Fragment key={i}>
                      <div className="bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-6 space-y-4 shadow-lg relative group hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-white/10 text-white/90 text-sm font-black px-3 py-1.5 rounded-lg shadow-inner border border-white/5">Q {i + 1}</span>
                          {newQuestions.length > 1 && (
                            <button onClick={() => setNewQuestions(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-rose-400/70 hover:text-rose-400 transition-all p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 hover:shadow-[0_0_10px_rgba(225,29,72,0.2)]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text" value={q.question_text}
                          onChange={e => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, question_text: e.target.value } : x))}
                          onFocus={handleInputFocus}
                          placeholder="Enter question here..."
                          className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 rounded-xl px-5 py-3.5 text-white text-sm font-medium outline-none placeholder:text-white/30 transition-all scroll-mt-20 shadow-inner"
                        />
                        <div className="grid grid-cols-1 gap-3 mt-4">
                          {['a','b','c','d'].map(opt => (
                            <div key={opt} className="flex items-center gap-3">
                              <button
                                onClick={() => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, correct_answer: opt.toUpperCase() } : x))}
                                className={`relative w-12 h-12 rounded-xl text-base font-black shrink-0 transition-all border-2 overflow-hidden ${
                                  q.correct_answer === opt.toUpperCase() 
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105' 
                                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20 hover:text-white/80'
                                }`}
                              >
                                {q.correct_answer === opt.toUpperCase() && <div className="absolute inset-0 bg-emerald-500/10 blur-md animate-pulse"></div>}
                                <span className="relative">{opt.toUpperCase()}</span>
                              </button>
                              <input
                                type="text" value={q[`option_${opt}`]}
                                onChange={e => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, [`option_${opt}`]: e.target.value } : x))}
                                onFocus={handleInputFocus}
                                placeholder={`Option ${opt.toUpperCase()}`}
                                className="flex-1 bg-black/40 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30 rounded-xl px-5 py-3 text-white text-sm font-medium outline-none placeholder:text-white/30 transition-all scroll-mt-20 shadow-inner"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Add question button after each question */}
                      <button
                        onClick={() => {
                          const newQ = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' };
                          setNewQuestions(prev => {
                            const next = [...prev];
                            next.splice(i + 1, 0, newQ);
                            return next;
                          });
                          setTimeout(() => handleInputFocus({ target: document.querySelector(`[data-q="${i+1}"]`) }), 200);
                        }}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-blue-500/30 text-blue-400/70 hover:border-blue-500/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all text-sm font-black flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                      >
                        <Plus className="w-5 h-5" /> Add Question Here
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <button onClick={createSession} disabled={creating}
                className="relative w-full py-5 rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-blue-500 text-white font-black text-lg active:scale-95 transition-all shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.7)] disabled:opacity-50 flex items-center justify-center gap-3 mt-6 overflow-hidden group bg-[length:200%_auto] hover:bg-right duration-500">
                <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                {creating ? <Loader2 className="w-7 h-7 animate-spin" /> : <><BrainCircuit className="w-7 h-7 group-hover:animate-pulse"/> Create {TRIVIA_BRAND_NAME} Game</>}
              </button>
            </div>

          ) : (
            <div className="text-center text-white/40 py-32 px-4 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-blue-500/5 rounded-3xl blur-3xl pointer-events-none"></div>
              <div className="flex justify-center mb-8 relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 p-8 rounded-full border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.05)] transform hover:scale-110 transition-transform duration-500">
                  <Target className="w-20 h-20 text-white/30 drop-shadow-lg animate-[spin_10s_linear_infinite]" />
                </div>
              </div>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white/80 to-white/50 mb-3 tracking-widest drop-shadow-sm uppercase">No Active Game</div>
              <div className="text-lg text-white/40 font-medium">Wait for the host to start a new <span className="text-purple-300/70 font-bold">{TRIVIA_BRAND_NAME}</span> session</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}