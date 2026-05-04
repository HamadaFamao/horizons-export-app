// src/components/room/CrackGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X } from 'lucide-react';

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#1e293b"/><circle cx="64" cy="52" r="22" fill="#334155"/><path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#334155"/></svg>`);

const EGGS = [
  { id: 1,  order: 1,  group: 'normal', emoji: '🥚', color: '#e2e8f0', glow: 'rgba(226,232,240,0.6)', base_cost: 100,  base_win: 200,   attempts: 1 },
  { id: 2,  order: 2,  group: 'normal', emoji: '🥚', color: '#fef08a', glow: 'rgba(254,240,138,0.6)', base_cost: 150,  base_win: 300,   attempts: 2 },
  { id: 3,  order: 3,  group: 'normal', emoji: '🥚', color: '#86efac', glow: 'rgba(134,239,172,0.6)', base_cost: 200,  base_win: 450,   attempts: 2 },
  { id: 4,  order: 4,  group: 'normal', emoji: '🥚', color: '#93c5fd', glow: 'rgba(147,197,253,0.6)', base_cost: 300,  base_win: 700,   attempts: 2 },
  { id: 5,  order: 5,  group: 'normal', emoji: '🥚', color: '#f9a8d4', glow: 'rgba(249,168,212,0.6)', base_cost: 500,  base_win: 1200,  attempts: 2 },
  { id: 6,  order: 6,  group: 'bronze', emoji: '🥚', color: '#cd7f32', glow: 'rgba(205,127,50,0.7)',  base_cost: 800,  base_win: 2000,  attempts: 2 },
  { id: 7,  order: 7,  group: 'bronze', emoji: '🥚', color: '#b87333', glow: 'rgba(184,115,51,0.7)',  base_cost: 1000, base_win: 2800,  attempts: 2 },
  { id: 8,  order: 8,  group: 'bronze', emoji: '🥚', color: '#a0522d', glow: 'rgba(160,82,45,0.7)',   base_cost: 1500, base_win: 4500,  attempts: 2 },
  { id: 9,  order: 9,  group: 'silver', emoji: '🥚', color: '#94a3b8', glow: 'rgba(148,163,184,0.8)', base_cost: 2000, base_win: 6000,  attempts: 2 },
  { id: 10, order: 10, group: 'silver', emoji: '🥚', color: '#cbd5e1', glow: 'rgba(203,213,225,0.8)', base_cost: 3000, base_win: 9500,  attempts: 2 },
  { id: 11, order: 11, group: 'silver', emoji: '🥚', color: '#e2e8f0', glow: 'rgba(226,232,240,0.9)', base_cost: 5000, base_win: 16000, attempts: 2 },
  { id: 12, order: 12, group: 'gold',   emoji: '🥚', color: '#f59e0b', glow: 'rgba(245,158,11,1.0)',  base_cost: 8000, base_win: 25000, attempts: 2 },
];

const GROUP_CONFIG = {
  normal: { label: 'Normal',  bg: 'from-slate-800 to-slate-900',   border: 'border-slate-600/30' },
  bronze: { label: 'Bronze',  bg: 'from-amber-950 to-stone-900',   border: 'border-amber-700/40' },
  silver: { label: 'Silver',  bg: 'from-slate-700 to-slate-800',   border: 'border-slate-400/40' },
  gold:   { label: '🏆 Gold', bg: 'from-yellow-900 to-amber-950',  border: 'border-yellow-500/60' },
};

const MULTIPLIERS = [
  { value: 1,  label: 'Basic',  color: '#94a3b8', desc: '×1' },
  { value: 3,  label: 'Pro',    color: '#818cf8', desc: '×3' },
  { value: 10, label: 'Elite',  color: '#f59e0b', desc: '×10' },
];

export default function CrackGame({
  open,
  onClose,
  user,
  userCoins,
  onCoinsUpdated,
  onCrackResult,
}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cracking, setCracking] = useState(false);
  const [selectedMultiplier, setSelectedMultiplier] = useState(1);
  const [lastResult, setLastResult] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFail, setShowFail] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [crackedEggs, setCrackedEggs] = useState(new Set());
  const [winEffect, setWinEffect] = useState(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    loadSession();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) {
      setLastResult(null);
      setShowSuccess(false);
      setShowFail(false);
      setShowComplete(false);
    }
  }, [open]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playSound = (type) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'crack') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'win') {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
          o.start(ctx.currentTime + i * 0.1);
          o.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
      } else if (type === 'fail') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'complete') {
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.4);
          o.start(ctx.currentTime + i * 0.08);
          o.stop(ctx.currentTime + i * 0.08 + 0.4);
        });
      }
    } catch {}
  };

  const loadSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('crack_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSession(data);
        // Rebuild cracked eggs (all before current)
        const cracked = new Set();
        for (let i = 1; i < data.current_egg_id; i++) cracked.add(i);
        setCrackedEggs(cracked);
      } else {
        setSession(null);
        setCrackedEggs(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_crack_session', {
        p_user_id: user.id,
        p_multiplier: selectedMultiplier,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      const s = typeof data.session === 'string'
        ? JSON.parse(data.session)
        : data.session;

      setSession(s);
      setCrackedEggs(new Set());
      setLastResult(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const crackEgg = async () => {
    if (!session?.id || !user?.id || cracking || animating) return;

    setCracking(true);
    setAnimating(true);
    setLastResult(null);
    setShowSuccess(false);
    setShowFail(false);

    playSound('crack');

    try {
      const { data, error } = await supabase.rpc('crack_egg', {
        p_user_id: user.id,
        p_session_id: session.id,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      setLastResult(data);

      setTimeout(() => {
        if (data.cracked) {
          playSound(data.completed_all ? 'complete' : 'win');
          setShowSuccess(true);
          setWinEffect(data.win_amount);
          setTimeout(() => setWinEffect(null), 2500);

          // Mark current egg as cracked
          setCrackedEggs(prev => new Set([...prev, session.current_egg_id]));

          if (data.completed_all) {
            setShowComplete(true);
            setTimeout(() => {
              setShowComplete(false);
              setShowSuccess(false);
              // Reset session to show tier selection again
              setSession(null);
              setCrackedEggs(new Set());
              setLastResult(null);
            }, 3500);
          } else {
            setTimeout(() => setShowSuccess(false), 2500);
            setSession(prev => ({
              ...prev,
              current_egg_id: data.next_egg_id,
              attempts_left: data.attempts_left,
              total_won: (prev?.total_won || 0) + (data.win_amount || 0),
            }));
          }

          // Global banner for silver/gold
          const currentEggForBanner = EGGS.find(e => e.id === session.current_egg_id);
          if (currentEggForBanner && data.win_amount >= 5000) {
            onCrackResult?.({
              winAmount: data.win_amount,
              eggGroup: currentEggForBanner.group,
              eggOrder: currentEggForBanner.order,
              isGlobal: currentEggForBanner.group === 'gold',
            });
          }

        } else {
          playSound('fail');
          setShowFail(true);
          setTimeout(() => setShowFail(false), 2000);

          setSession(prev => ({
            ...prev,
            current_egg_id: data.go_back ? data.back_to_egg_id : prev.current_egg_id,
            attempts_left: data.attempts_left,
          }));

          if (data.go_back) {
            // Remove cracked state of current egg
            setCrackedEggs(prev => {
              const next = new Set(prev);
              next.delete(session.current_egg_id);
              return next;
            });
          }
        }

        onCoinsUpdated?.();
        setAnimating(false);
        setCracking(false);
      }, 800);

    } catch (err) {
      alert(err.message);
      setAnimating(false);
      setCracking(false);
    }
  };

  const currentEgg = session ? EGGS.find(e => e.id === session.current_egg_id) : null;
  const groups = ['normal', 'bronze', 'silver', 'gold'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] border-t sm:border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl drop-shadow-lg">🥚</span>
            <div>
              <div className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 text-xl tracking-tight">Crack!</div>
              <div className="text-white/50 text-xs font-bold">Break eggs, win coins</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-amber-400 font-black text-sm">{(userCoins || 0).toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-rose-400 transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>

          ) : !session ? (
            // Select multiplier & start
            <div className="p-5 flex flex-col gap-5">
              <div className="text-center">
                <div className="text-5xl mb-3 animate-bounce">🥚</div>
                <div className="text-white font-black text-xl mb-1">Choose Your Tier</div>
                <div className="text-white/50 text-sm">Higher tier = bigger rewards!</div>
              </div>

              <div className="space-y-3">
                {MULTIPLIERS.map(m => {
                  const egg1Cost = 100 * m.value;
                  const egg12Win = 25000 * m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setSelectedMultiplier(m.value)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                        selectedMultiplier === m.value
                          ? 'border-opacity-100 bg-white/10 scale-[1.02]'
                          : 'border-white/10 bg-white/5 hover:bg-white/8'
                      }`}
                      style={{
                        borderColor: selectedMultiplier === m.value ? m.color : undefined,
                        boxShadow: selectedMultiplier === m.value ? `0 0 20px ${m.color}40` : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-black" style={{ color: m.color }}>{m.desc}</div>
                          <div>
                            <div className="text-white font-black text-base">{m.label}</div>
                            <div className="text-white/50 text-xs">Start: 🪙{egg1Cost.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/40">Max win</div>
                          <div className="font-black text-sm" style={{ color: m.color }}>
                            🪙{egg12Win.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Egg preview */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Egg Journey</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {EGGS.map(egg => (
                    <div key={egg.id} className="flex flex-col items-center gap-1">
                      <div
                        className="w-8 h-10 rounded-full flex items-center justify-center text-lg border"
                        style={{
                          background: `radial-gradient(circle at 35% 35%, white 0%, ${egg.color} 60%)`,
                          borderColor: egg.color,
                          boxShadow: `0 0 8px ${egg.glow}`,
                        }}
                      />
                      <span className="text-white/30 text-[8px] font-bold">
                        {(egg.base_cost * selectedMultiplier / 1000 >= 1)
                          ? `${egg.base_cost * selectedMultiplier / 1000}k`
                          : egg.base_cost * selectedMultiplier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={startSession}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-black text-lg active:scale-95 transition-all shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:brightness-110"
              >
                🥚 Start Cracking!
              </button>
            </div>

          ) : (
            // Active game
            <div className="p-4 flex flex-col gap-4">
              {/* Current egg card FIRST */}
              {currentEgg && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-white font-black text-base">
                        Egg #{currentEgg.order}
                        <span className="ml-2 text-sm font-bold opacity-60">
                          {GROUP_CONFIG[currentEgg.group].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-white/50 text-xs">Cost:</span>
                        <span className="text-amber-400 font-black text-xs">
                          🪙{(currentEgg.base_cost * session.multiplier).toLocaleString()}
                        </span>
                        <span className="text-white/30 text-xs">→</span>
                        <span className="text-emerald-400 font-black text-xs">
                          🪙{(currentEgg.base_win * session.multiplier).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex">
                      {Array.from({ length: currentEgg.attempts }, (_, i) => (
                        <span key={i} className="text-lg">
                          {i < session.attempts_left ? '❤️' : '🖤'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {animating && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl z-10"
                          style={{ animation: 'hammerSwing 0.4s ease-in-out forwards' }}>
                          🔨
                        </div>
                      )}

                      <style>{`
                        @keyframes hammerSwing {
                          0%   { transform: translateX(-50%) rotate(-60deg) translateY(-20px); opacity: 1; }
                          60%  { transform: translateX(-50%) rotate(10deg) translateY(10px); opacity: 1; }
                          80%  { transform: translateX(-50%) rotate(-5deg) translateY(5px); opacity: 1; }
                          100% { transform: translateX(-50%) rotate(0deg) translateY(0px); opacity: 0; }
                        }
                        @keyframes eggShake {
                          0%,100% { transform: rotate(0deg) scale(1); }
                          20% { transform: rotate(-8deg) scale(1.05); }
                          40% { transform: rotate(8deg) scale(1.05); }
                          60% { transform: rotate(-5deg) scale(1.02); }
                          80% { transform: rotate(5deg) scale(1.02); }
                        }
                        @keyframes eggCrack {
                          0%   { transform: scale(1); filter: brightness(1); }
                          30%  { transform: scale(1.15); filter: brightness(1.5); }
                          60%  { transform: scale(0.95); filter: brightness(0.8); }
                          100% { transform: scale(1); filter: brightness(1); }
                        }
                        @keyframes winFloat {
                          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
                          20%  { transform: translateY(-20px) scale(1.2); opacity: 1; }
                          70%  { transform: translateY(-60px) scale(1); opacity: 1; }
                          100% { transform: translateY(-100px) scale(0.8); opacity: 0; }
                        }
                      `}</style>

                      <button
                        onClick={crackEgg}
                        disabled={cracking || animating || userCoins < currentEgg.base_cost * session.multiplier}
                        className="relative flex items-center justify-center disabled:cursor-not-allowed transition-all active:scale-90"
                        style={{ animation: animating ? 'eggShake 0.4s ease-in-out' : 'none' }}
                      >
                        <div className="absolute inset-0 rounded-full blur-2xl opacity-60"
                          style={{ background: currentEgg.glow }} />
                        <div
                          className="relative w-36 h-44 rounded-[50%] flex items-center justify-center cursor-pointer border-4 transition-all"
                          style={{
                            background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 25%, ${currentEgg.color} 60%, ${currentEgg.color}88 100%)`,
                            borderColor: `${currentEgg.color}80`,
                            boxShadow: `0 0 30px ${currentEgg.glow}, inset 0 -10px 30px rgba(0,0,0,0.2)`,
                            animation: animating ? 'eggCrack 0.5s ease-in-out' : 'none',
                          }}
                        >
                          {animating && (
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 144 176">
                              <path d="M72 20 L65 60 L78 90 L60 130" stroke="rgba(0,0,0,0.3)" strokeWidth="2" fill="none" strokeDasharray="4,2"/>
                              <path d="M72 20 L80 70 L68 100 L85 140" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" fill="none" strokeDasharray="3,3"/>
                            </svg>
                          )}
                          {cracking
                            ? <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
                            : <span className="text-4xl select-none drop-shadow-lg">
                                {userCoins < currentEgg.base_cost * session.multiplier ? '🔒' : '🥚'}
                              </span>
                          }
                        </div>
                        {!cracking && !animating && userCoins >= currentEgg.base_cost * session.multiplier && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs font-bold whitespace-nowrap animate-pulse">
                            Tap to crack!
                          </div>
                        )}

                        {/* Win effect overlay */}
                        {winEffect && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <div
                              className="flex flex-col items-center gap-1"
                              style={{ animation: 'winFloat 2.5s ease-out forwards' }}
                            >
                              <div className="text-5xl">🎉</div>
                              <div
                                className="font-black text-2xl px-4 py-2 rounded-2xl border-2"
                                style={{
                                  color: '#fbbf24',
                                  background: 'rgba(0,0,0,0.85)',
                                  borderColor: '#f59e0b',
                                  textShadow: '0 0 20px rgba(251,191,36,0.8)',
                                  boxShadow: '0 0 30px rgba(245,158,11,0.6)',
                                }}
                              >
                                +🪙{winEffect.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                    <div className="mt-8 text-center">
                      <div className={`text-sm font-bold ${userCoins < currentEgg.base_cost * session.multiplier ? 'text-rose-400' : 'text-white/50'}`}>
                        {userCoins < currentEgg.base_cost * session.multiplier
                          ? '❌ Not enough coins'
                          : `🪙 ${(currentEgg.base_cost * session.multiplier).toLocaleString()} per attempt`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Tier</div>
                  <div className="font-black text-sm" style={{ color: MULTIPLIERS.find(m => m.value === session.multiplier)?.color }}>
                    {MULTIPLIERS.find(m => m.value === session.multiplier)?.label}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Won</div>
                  <div className="text-emerald-400 font-black text-sm">🪙{(session.total_won || 0).toLocaleString()}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase font-bold">Attempts</div>
                  <div className="text-white font-black text-sm">
                    {Array.from({ length: currentEgg?.attempts || 1 }, (_, i) => (
                      <span key={i}>{i < session.attempts_left ? '❤️' : '🖤'}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Eggs grid by group */}
              {groups.map(group => {
                const groupEggs = EGGS.filter(e => e.group === group);
                const cfg = GROUP_CONFIG[group];
                return (
                  <div key={group} className={`rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-3`}>
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-2.5 px-1">
                      {cfg.label}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {groupEggs.map(egg => {
                        const isCurrent = session.current_egg_id === egg.id;
                        const isCracked = crackedEggs.has(egg.id);
                        const isLocked = egg.id > session.current_egg_id;
                        const actualCost = egg.base_cost * session.multiplier;
                        const actualWin = egg.base_win * session.multiplier;

                        return (
                          <div
                            key={egg.id}
                            className="flex flex-col items-center gap-1.5 relative"
                          >
                            {/* Egg */}
                            <div
                              className={`relative w-12 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                isCurrent ? 'scale-110' : ''
                              } ${isLocked ? 'opacity-30 grayscale' : ''}`}
                              style={{
                                background: isCracked
                                  ? 'rgba(0,0,0,0.3)'
                                  : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.8) 0%, ${egg.color} 50%, ${egg.color}99 100%)`,
                                border: isCurrent
                                  ? `2px solid ${egg.color}`
                                  : '2px solid rgba(255,255,255,0.1)',
                                boxShadow: isCurrent
                                  ? `0 0 20px ${egg.glow}, 0 0 40px ${egg.glow}`
                                  : 'none',
                              }}
                            >
                              {isCracked ? (
                                <span className="text-xl">✅</span>
                              ) : isLocked ? (
                                <span className="text-lg">🔒</span>
                              ) : isCurrent ? (
                                <span className="text-2xl"
                                  style={{
                                    animation: animating ? 'none' : 'pulse 1.5s infinite',
                                    filter: `drop-shadow(0 0 8px ${egg.color})`,
                                  }}
                                >
                                  🥚
                                </span>
                              ) : (
                                <span className="text-lg">🥚</span>
                              )}

                              {/* Current indicator */}
                              {isCurrent && !animating && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
                              )}
                            </div>

                            {/* Cost */}
                            <div className="text-center">
                              <div className={`text-[9px] font-black ${isCurrent ? 'text-amber-400' : 'text-white/30'}`}>
                                🪙{actualCost >= 1000 ? `${actualCost/1000}k` : actualCost}
                              </div>
                              {isCurrent && (
                                <div className="text-[9px] text-emerald-400 font-black">
                                  +{actualWin >= 1000 ? `${actualWin/1000}k` : actualWin}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Result feedback */}
              {showSuccess && lastResult && (
                <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-4 text-center animate-in zoom-in duration-300">
                  <div className="text-4xl mb-1">🎉</div>
                  <div className="text-emerald-400 font-black text-xl">
                    +🪙{(lastResult.win_amount || 0).toLocaleString()}
                  </div>
                  {showComplete && (
                    <div className="text-amber-400 font-black text-sm mt-1">
                      🏆 All eggs cracked! Starting over...
                    </div>
                  )}
                </div>
              )}

              {showFail && lastResult && (
                <div className="bg-rose-500/20 border border-rose-500/50 rounded-2xl p-4 text-center animate-in zoom-in duration-300">
                  <div className="text-4xl mb-1">💥</div>
                  <div className="text-rose-400 font-black text-lg">
                    {lastResult.go_back
                      ? '😬 Went back one step!'
                      : lastResult.attempts_left > 0
                      ? `${lastResult.attempts_left} attempt${lastResult.attempts_left > 1 ? 's' : ''} left!`
                      : 'No luck this time!'
                    }
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}