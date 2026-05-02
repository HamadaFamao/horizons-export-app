import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Plus, Trash2, BrainCircuit, Target, Trophy, Sparkles, Timer } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#1e293b"/><circle cx="64" cy="52" r="22" fill="#334155"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#334155"/></svg>`);

const ENTRY_COST_OPTIONS = [0, 100, 200, 500, 1000, 5000];
const TIME_OPTIONS = [10, 15, 20, 30];

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
  const [newQuestions, setNewQuestions] = useState([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' }
  ]);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

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
  const [focusedInput, setFocusedInput] = useState(false);
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
        loadPlayers(payload.session.id);
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

  const generateWithAI = async () => {
    if (!aiTopic.trim()) return;
    setGeneratingAI(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Generate 5 multiple choice trivia questions about "${aiTopic}". 
Return ONLY a JSON array, no markdown, no explanation:
[{"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A or B or C or D"}]`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setNewQuestions(parsed);
    } catch (_err) {
      alert('Failed to generate questions');
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
          total_questions: validQs.length,
          status: 'waiting',
        })
        .select()
        .single();
      if (error) throw error;

      // Insert questions
      await supabase.from('room_trivia_questions').insert(
        validQs.map((q, i) => ({
          session_id: session.id,
          question_order: i + 1,
          ...q,
        }))
      );

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
          ts: Date.now(),
        },
      });

      await loadPlayers(currentSession.id);
    }
  };

  const cancelSession = async () => {
    if (!currentSession?.id || !canModerate) return;
    if (!window.confirm('Cancel trivia? All players will be refunded.')) return;

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
    setFocusedInput(true);
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 300);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
        setFocusedInput(false);
      }
    }, 200);
  };

  const isJoined = players.some(p => String(p.user_id) === String(user?.id));
  const myPlayer = players.find(p => String(p.user_id) === String(user?.id));
  const OPTION_COLORS = {
    A: 'from-blue-500 to-blue-600',
    B: 'from-emerald-500 to-emerald-600',
    C: 'from-amber-500 to-amber-600',
    D: 'from-rose-500 to-rose-600',
  };
  const OPTION_LABELS = { A: 'A', B: 'B', C: 'C', D: 'D' };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-slate-900 sm:bg-slate-900/95 sm:backdrop-blur-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-t sm:border border-white/10 max-h-[90dvh] sm:max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-xl shadow-lg shadow-purple-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 text-lg tracking-tight leading-none">Trivia Master</div>
              {currentSession?.status === 'active' && currentQuestion && (
                <div className="text-white/50 text-[10px] font-bold uppercase tracking-wider mt-1">
                  Question {currentQIndex} of {currentSession.total_questions}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 shadow-inner">
              <span className="text-sm">🪙</span>
              <span className="text-amber-400 font-black text-sm">
                {(userCoins || 0).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="text-white/50 hover:text-white transition-colors text-lg bg-white/5 w-8 h-8 rounded-full flex items-center justify-center"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-rose-400 transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:pb-4"
          style={{
            paddingBottom: focusedInput ? 280 : 32,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>

          ) : showResult ? (
            // Results screen
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 rounded-full animate-pulse" />
                <Trophy className="w-20 h-20 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-bounce" />
              </div>
              <div className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 font-black text-3xl tracking-widest uppercase">Winner!</div>
              
              <div className="relative mt-2">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full blur opacity-50" />
                <img
                  src={winner?.avatar_url || FALLBACK_AVATAR}
                  alt={winner?.name}
                  className="relative w-24 h-24 rounded-full border-4 border-slate-900 object-cover"
                />
              </div>
              <div className="text-white font-black text-2xl">{winner?.name}</div>
              
              {winnerCoins > 0 && (
                <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 rounded-2xl px-8 py-4 text-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                  <div className="text-amber-300 text-4xl font-black drop-shadow-md">
                    🪙 {winnerCoins.toLocaleString()}
                  </div>
                </div>
              )}
              
              {/* Leaderboard */}
              <div className="w-full space-y-2 mt-4 px-2">
                {leaderboard.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 shadow-sm">
                    <span className="text-xl w-6 text-center">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                    <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/20" />
                    <span className="text-white font-bold flex-1 truncate">{p.name}</span>
                    <span className="text-amber-400 font-black bg-amber-400/10 px-2 py-1 rounded-lg">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

          ) : currentSession?.status === 'active' && currentQuestion ? (
            // Active game - question screen
            <div className="flex flex-col gap-4">
              {/* Timer */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  <span className="text-white/80 text-sm font-bold">Q {currentQIndex} <span className="text-white/40">/ {currentSession.total_questions}</span></span>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-lg ${timeLeft <= 5 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-white/10 text-white'}`}>
                  <Timer className="w-5 h-5" />
                  {timeLeft}s
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                  style={{ width: `${(timeLeft / (currentSession.time_per_question || 15)) * 100}%` }}
                />
              </div>

              {/* Question */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-lg">
                <p className="text-white font-black text-xl leading-snug drop-shadow-md">
                  {currentQuestion.question_text}
                </p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                {['A','B','C','D'].map(opt => {
                  const optText = currentQuestion[`option_${opt.toLowerCase()}`];
                  const isSelected = selectedAnswer === opt;
                  const isCorrect = answerResult?.correctAnswer === opt;
                  const isWrong = isSelected && !answerResult?.isCorrect;

                  let bg = `bg-gradient-to-br ${OPTION_COLORS[opt]}`;
                  if (answerResult) {
                    if (isCorrect) bg = 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
                    else if (isWrong) bg = 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400';
                    else bg = 'bg-white/5 border-white/10 opacity-50';
                  }

                  return (
                    <button
                      key={opt}
                      onClick={() => submitAnswer(opt)}
                      disabled={!!selectedAnswer}
                      className={`${bg} rounded-2xl p-4 text-left transition-all duration-300 active:scale-95 disabled:cursor-default border ${!answerResult ? 'border-white/10 hover:brightness-110' : ''} relative overflow-hidden group`}
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="w-8 h-8" />
                      </div>
                      <div className="text-white/70 text-xs font-black mb-1.5">{OPTION_LABELS[opt]}</div>
                      <div className="text-white font-bold text-base leading-tight relative z-10">{optText}</div>
                    </button>
                  );
                })}
              </div>

              {/* Answer feedback */}
              {answerResult && (
                <div className={`text-center py-3 rounded-xl font-black text-lg shadow-lg border ${
                  answerResult.isCorrect 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  {answerResult.isCorrect ? `✅ Correct! +${answerResult.points} pts` : `❌ Wrong! Correct was ${answerResult.correctAnswer}`}
                </div>
              )}

              {/* My score */}
              {myPlayer && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
                    <span className="text-white/50 text-xs font-bold uppercase tracking-wider">My Score</span>
                    <span className="text-amber-400 font-black text-sm">{myPlayer.score} pts</span>
                  </div>
                </div>
              )}

              {/* Next question button for moderator */}
              {canModerate && (
                <button
                  onClick={nextQuestion}
                  disabled={!timeExpired}
                  className={`w-full py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all shadow-lg mt-2 ${
                    timeExpired
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-500/25'
                      : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                  }`}
                >
                  {!timeExpired
                    ? `⏳ Wait ${timeLeft}s...`
                    : currentQIndex >= (currentSession.total_questions ?? 0)
                    ? '🏁 End Game'
                    : `⏭ Next Question (${currentQIndex}/${currentSession.total_questions})`
                  }
                </button>
              )}

              {/* Players scores */}
              <div className="space-y-2 mt-4">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 px-1">Live Scores</div>
                {[...players].sort((a,b) => b.score - a.score).map((p, i) => {
                  const counts = playerAnswerCounts[p.user_id] || { correct: 0, wrong: 0 };
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className="text-sm w-5 text-center">{['🥇','🥈','🥉'][i] || `${i + 1}`}</span>
                      <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                        className="w-7 h-7 rounded-full object-cover border border-white/20" />
                      <span className="text-white text-sm font-bold flex-1 truncate">{p.name}</span>
                      <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded-lg">
                        <span className="text-emerald-400 text-xs font-black">✅ {counts.correct}</span>
                        <span className="text-rose-400 text-xs font-black">❌ {counts.wrong}</span>
                      </div>
                      <span className="text-amber-400 font-black text-sm w-8 text-right">{p.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          ) : currentSession ? (
            // Waiting room
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-white/40 text-[10px] uppercase font-black tracking-wider mb-1">Entry</div>
                  <div className="text-amber-400 font-black text-sm">
                    {currentSession.entry_cost > 0 ? `🪙 ${currentSession.entry_cost}` : 'Free'}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-white/40 text-[10px] uppercase font-black tracking-wider mb-1">Questions</div>
                  <div className="text-white font-black text-sm">{currentSession.total_questions}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-white/40 text-[10px] uppercase font-black tracking-wider mb-1">Time/Q</div>
                  <div className="text-white font-black text-sm">{currentSession.time_per_question}s</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
                  <div className="text-white/40 text-[10px] uppercase font-black tracking-wider mb-1">Players</div>
                  <div className="text-white font-black text-sm">{players.length}</div>
                </div>
              </div>

              {/* Players list */}
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1 px-1">Players Joined</div>
              <div className="grid grid-cols-2 gap-2">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 shadow-sm">
                    <img src={p.avatar_url || FALLBACK_AVATAR} alt={p.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/20" />
                    <span className="text-white text-sm font-bold truncate flex-1">{p.name}</span>
                    {String(p.user_id) === String(user?.id) && (
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                {!isJoined && (
                  <button onClick={joinSession} disabled={joining}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2">
                    {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Join {currentSession.entry_cost > 0 ? `🪙 ${currentSession.entry_cost}` : 'Free'}</>}
                  </button>
                )}
                {isJoined && (
                  <button onClick={leaveSession} disabled={leaving}
                    className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/80 font-bold text-sm bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {leaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Leave Game'}
                  </button>
                )}
                {canModerate && players.length >= 1 && (
                  <button onClick={startGame}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-black text-sm active:scale-95 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
                    <Target className="w-5 h-5"/> Start Trivia
                  </button>
                )}
                {canModerate && (
                  <button onClick={cancelSession}
                    className="px-4 py-3.5 rounded-xl border border-rose-500/40 text-rose-400 font-bold text-sm bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 transition-all">
                    Cancel
                  </button>
                )}
              </div>
            </div>

          ) : canModerate ? (
            // Create session form
            <div className="flex flex-col gap-2">
              {!focusedInput && (
                <>
                  <div className="text-center text-white/50 text-sm mb-4">Configure your Trivia game</div>

                  {/* Entry cost */}
                  <div className="mb-4">
                    <div className="text-white/60 text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-amber-400">🪙</span> Entry Cost
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {ENTRY_COST_OPTIONS.map(c => (
                        <button key={c} onClick={() => setEntryCost(c)}
                          className={`py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all border ${
                            entryCost === c
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                          }`}>
                          {c === 0 ? 'Free' : c >= 1000 ? `${c / 1000}k` : c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time per question */}
                  <div className="mb-5">
                    <div className="text-white/60 text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-blue-400" /> Seconds per Question
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {TIME_OPTIONS.map(t => (
                        <button key={t} onClick={() => setTimePerQ(t)}
                          className={`py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all border ${
                            timePerQ === t
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                          }`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Generate */}
                  <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <div className="text-purple-300 text-xs font-bold uppercase tracking-wider">Generate with AI</div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder="Topic (e.g. Football, Science...)"
                        className="flex-1 bg-black/20 border border-white/10 focus:border-purple-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder:text-white/30 transition-all"
                      />
                      <button onClick={generateWithAI} disabled={generatingAI || !aiTopic.trim()}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2">
                        {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" /> Questions ({newQuestions.length})
                  </div>
                  <button
                    onClick={() => setNewQuestions(prev => [...prev, {
                      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A'
                    }])}
                    className="flex items-center gap-1 text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Add Question
                  </button>
                </div>

                <div className="space-y-3 pr-2">
                  {newQuestions.map((q, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 shadow-sm relative group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="bg-white/10 text-white/70 text-xs font-black px-2 py-1 rounded-md">Q {i + 1}</span>
                        {newQuestions.length > 1 && (
                          <button onClick={() => setNewQuestions(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-400/70 hover:text-rose-400 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text" value={q.question_text}
                        onChange={e => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, question_text: e.target.value } : x))}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder="Enter question here..."
                        className="w-full bg-black/20 border border-white/10 focus:border-blue-500/50 rounded-lg px-3 py-2.5 text-white text-sm outline-none placeholder:text-white/30 transition-colors"
                      />
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {['a','b','c','d'].map(opt => (
                          <div key={opt} className="flex items-center gap-2">
                            <button
                              onClick={() => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, correct_answer: opt.toUpperCase() } : x))}
                              className={`w-8 h-8 rounded-lg text-xs font-black shrink-0 transition-all border ${
                                q.correct_answer === opt.toUpperCase() 
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                              }`}
                            >
                              {opt.toUpperCase()}
                            </button>
                            <input
                              type="text" value={q[`option_${opt}`]}
                              onChange={e => setNewQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, [`option_${opt}`]: e.target.value } : x))}
                              onFocus={handleInputFocus}
                              onBlur={handleInputBlur}
                              placeholder={`Option ${opt.toUpperCase()}`}
                              className="flex-1 bg-black/20 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-white text-sm outline-none placeholder:text-white/30 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={createSession} disabled={creating}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-black text-sm active:scale-95 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><BrainCircuit className="w-5 h-5"/> Create Trivia Game</>}
              </button>
            </div>

          ) : (
            <div className="text-center text-white/40 py-20 px-4">
              <div className="flex justify-center mb-6">
                <div className="bg-gradient-to-br from-white/5 to-white/10 p-6 rounded-full border border-white/10 shadow-xl">
                  <Target className="w-16 h-16 text-white/20" />
                </div>
              </div>
              <div className="text-xl font-black text-white/70 mb-2 tracking-wide">No Active Game</div>
              <div className="text-sm text-white/40">Wait for the host to start a new trivia session</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}