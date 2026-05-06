// src/components/room/SlotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Package } from 'lucide-react';

const BET_OPTIONS = [
  { amount: 100,  label: '100', color: 'from-slate-500 to-slate-600',    glow: 'shadow-slate-500/40'   },
  { amount: 500,  label: '500', color: 'from-emerald-500 to-emerald-700', glow: 'shadow-emerald-500/40' },
  { amount: 1000, label: '1K',  color: 'from-blue-500 to-blue-700',      glow: 'shadow-blue-500/40'    },
  { amount: 5000, label: '5K',  color: 'from-amber-500 to-orange-600',   glow: 'shadow-amber-500/40'   },
];

const ALL_SYMBOLS = ['🍒','🍋','🍇','⭐','🔔','💎','🏆'];

const RESULT_CONFIG = {
  jackpot:   { label:'JACKPOT!',  color:'text-yellow-300', bg:'from-yellow-500/30 to-orange-500/30', border:'border-yellow-400'  },
  gift_win:  { label:'GIFT WIN!', color:'text-pink-300',   bg:'from-pink-500/30 to-purple-500/30',   border:'border-pink-400'    },
  big_win:   { label:'BIG WIN!',  color:'text-emerald-300',bg:'from-emerald-500/30 to-cyan-500/30',  border:'border-emerald-400' },
  small_win: { label:'WIN!',      color:'text-blue-300',   bg:'from-blue-500/20 to-indigo-500/20',   border:'border-blue-400'    },
  no_win:    { label:'Try Again', color:'text-white/40',   bg:'from-white/5 to-white/5',             border:'border-white/10'    },
};

function Reel({ spinning, finalSymbol, delay = 0 }) {
  const [display, setDisplay] = useState('🎰');
  const [settled, setSettled] = useState(false);
  const ivRef = useRef(null);
  const toRef = useRef(null);

  useEffect(() => {
    if (!spinning) {
      // لما الـ spinning يوقف، اعرض الرمز الصح مباشرة
      if (finalSymbol && finalSymbol !== '🎰') {
        setDisplay(finalSymbol);
        setSettled(true);
      } else {
        setSettled(false);
      }
      clearInterval(ivRef.current);
      clearTimeout(toRef.current);
      return;
    }
    setSettled(false);
    setDisplay('🎰');
    toRef.current = setTimeout(() => {
      ivRef.current = setInterval(() => {
        setDisplay(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
      }, 80);
    }, delay * 300);
    return () => { clearInterval(ivRef.current); clearTimeout(toRef.current); };
  }, [spinning, finalSymbol]);

  return (
    <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
      settled
        ? 'border-amber-400/60 bg-gradient-to-b from-slate-700 to-slate-800 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
        : spinning
          ? 'border-white/20 bg-slate-800/80'
          : 'border-white/10 bg-slate-800/50'
    }`}>
      <span className={`text-5xl sm:text-6xl select-none transition-all duration-200 ${spinning && !settled ? 'opacity-60' : 'opacity-100'} ${settled ? 'animate-[reelPop_0.3s_ease-out]' : ''}`}>
        {display}
      </span>
      {settled && <div className="absolute inset-0 rounded-2xl bg-amber-400/5 pointer-events-none" />}
    </div>
  );
}

export default function SlotGame({ open, onClose, roomId, user, userCoins, onCoinsUpdated, onSlotResult }) {
  const [bet, setBet]               = useState(100);
  const [spinning, setSpinning]     = useState(false);
  const [reels, setReels]           = useState(['🎰','🎰','🎰']);
  const [result, setResult]         = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [bagItems, setBagItems]     = useState([]);
  const [showBag, setShowBag]       = useState(false);
  const [loadingBag, setLoadingBag] = useState(false);
  const [totalWon, setTotalWon]     = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [spinsCount, setSpinsCount] = useState(0);
  const audioCtxRef = useRef(null);
  const timerRef    = useRef(null);

  const ensureAudio = async () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch { return null; }
  };

  const playWin = async (type) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    const freqs =
      type === 'jackpot' || type === 'gift_win' ? [523,659,784,1047,1319] :
      type === 'big_win'   ? [523,659,784] :
      type === 'small_win' ? [523,784] : [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
      o.start(ctx.currentTime + i * 0.1);
      o.stop(ctx.currentTime + i * 0.1 + 0.31);
    });
  };

  const loadBag = async () => {
    if (!user?.id) return;
    setLoadingBag(true);
    try {
      const { data } = await supabase.rpc('get_user_bag', { p_user_id: user.id });
      if (data?.success) setBagItems(data.items || []);
    } finally { setLoadingBag(false); }
  };

  useEffect(() => { if (open && user?.id) loadBag(); }, [open, user?.id]);

  useEffect(() => {
    if (!open) {
      setSpinning(false); setShowResult(false); setResult(null); setShowBag(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [open]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleSpin = async () => {
    if (spinning || !user?.id || userCoins < bet) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSpinning(true); setShowResult(false); setResult(null);
    try {
      const { data, error } = await supabase.rpc('play_slot_spin', {
        p_user_id: user.id, p_room_id: roomId, p_bet_amount: bet,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      setReels([data.reel1, data.reel2, data.reel3]);
      setResult(data);
      setTotalSpent(p => p + bet);
      setSpinsCount(p => p + 1);
      if (data.coins_won > 0) setTotalWon(p => p + data.coins_won);
      onCoinsUpdated?.();
      timerRef.current = setTimeout(() => {
        setSpinning(false); setShowResult(true);
        playWin(data.result_type);
        if (data.gift_id) loadBag();
        if (data.result_type === 'jackpot' || data.result_type === 'gift_win') {
          onSlotResult?.({ resultType: data.result_type, coinsWon: data.coins_won, giftName: data.gift_name, giftIcon: data.gift_icon, betAmount: bet });
        }
      }, 3200);
    } catch (err) { setSpinning(false); alert(err.message || 'Failed to spin'); }
  };

  if (!open) return null;
  const cfg = result ? RESULT_CONFIG[result.result_type] : null;
  const canSpin = !spinning && userCoins >= bet;
  const totalBagItems = bagItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="fixed inset-0 z-[85]" onClick={onClose}>
      <style>{`
        @keyframes reelPop { 0%{transform:scale(1.3)} 60%{transform:scale(0.95)} 100%{transform:scale(1)} }
        @keyframes jackpotPulse { 0%,100%{text-shadow:0 0 20px #fbbf24,0 0 40px #f59e0b;transform:scale(1)} 50%{text-shadow:0 0 40px #fbbf24,0 0 80px #f59e0b;transform:scale(1.06)} }
        @keyframes shimmerSlot { 0%{background-position:-200% center} 100%{background-position:200% center} }
      `}</style>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col max-h-[92dvh] rounded-t-3xl overflow-hidden"
        style={{ background:'linear-gradient(180deg,#0f0a1e 0%,#1a0f2e 50%,#0d1117 100%)', borderTop:'1px solid rgba(251,191,36,0.3)', boxShadow:'0 -20px 60px rgba(251,191,36,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎰</div>
            <div>
              <div className="font-black text-xl text-transparent bg-clip-text"
                style={{ backgroundImage:'linear-gradient(90deg,#fbbf24,#f59e0b,#fcd34d)', backgroundSize:'200% auto', animation:'shimmerSlot 3s linear infinite' }}>
                SLOT MACHINE
              </div>
              <div className="text-white/40 text-xs">Win coins & exclusive gifts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBag(v => !v)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${showBag ? 'bg-purple-500/30 border-purple-400/60 text-purple-200' : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'}`}>
              <Package className="w-4 h-4" />
              <span className="text-xs font-bold">Bag</span>
              {totalBagItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center">
                  {totalBagItems}
                </span>
              )}
            </button>
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-amber-300 font-black text-sm">{(userCoins||0).toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showBag ? (
            /* BAG */
            <div className="p-4">
              <div className="text-white font-black text-base mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" />
                My Gift Bag
                <span className="text-white/40 text-sm font-normal ml-1">{totalBagItems} items</span>
              </div>
              {loadingBag ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : bagItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎁</div>
                  <div className="text-white/40 text-sm">No gifts yet</div>
                  <div className="text-white/25 text-xs mt-1">Win gifts from the slot machine!</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {bagItems.map(item => (
                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 relative">
                      {item.quantity > 1 && (
                        <div className="absolute top-2 right-2 bg-pink-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          ×{item.quantity}
                        </div>
                      )}
                      {item.gift_icon
                        ? <img src={item.gift_icon} alt={item.gift_name} className="w-14 h-14 object-contain" />
                        : <div className="text-4xl">🎁</div>
                      }
                      <div className="text-white text-xs font-bold text-center">{item.gift_name}</div>
                      <div className="flex items-center gap-1 text-purple-300 text-[11px] font-bold">
                        <span>💎</span><span>{item.gems_awarded} gems</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* GAME */
            <div className="p-4 flex flex-col gap-5">
              {/* Stats */}
              {spinsCount > 0 && (
                <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2.5 text-xs">
                  {[
                    ['Spins',  spinsCount,                          'text-white'],
                    ['Spent',  `🪙 ${totalSpent.toLocaleString()}`, 'text-rose-400'],
                    ['Won',    `🪙 ${totalWon.toLocaleString()}`,   'text-emerald-400'],
                    ['Net',    `${totalWon-totalSpent>=0?'+':''}${(totalWon-totalSpent).toLocaleString()}`, totalWon-totalSpent>=0?'text-emerald-300':'text-rose-300'],
                  ].map(([label, val, cls]) => (
                    <div key={label} className="text-center">
                      <div className="text-white/40">{label}</div>
                      <div className={`font-black ${cls}`}>{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Machine frame */}
              <div className="relative rounded-3xl overflow-hidden"
                style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81,#1e1b4b)', border:'2px solid rgba(251,191,36,0.4)', boxShadow:'0 0 40px rgba(251,191,36,0.15),inset 0 0 60px rgba(0,0,0,0.5)' }}>
                <div className="h-2 w-full" style={{ background:'linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)', backgroundSize:'200% 100%', animation:`shimmerSlot ${spinning?'0.4s':'3s'} linear infinite` }} />
                <div className="p-6">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    {[0,1,2].map(i => <Reel key={i} spinning={spinning} finalSymbol={reels[i]} delay={i} />)}
                  </div>

                  {showResult && result && cfg && (
                    <div className={`mb-5 rounded-2xl border p-4 text-center bg-gradient-to-r ${cfg.bg} ${cfg.border}`}>
                      <div className={`text-2xl font-black mb-1 ${cfg.color} ${result.result_type==='jackpot'?'animate-[jackpotPulse_1s_ease-in-out_infinite]':''}`}>
                        {cfg.label}
                      </div>
                      {(result.result_type==='jackpot'||result.result_type==='gift_win') ? (
                        <div className="flex flex-col items-center gap-2">
                          {result.gift_icon && <img src={result.gift_icon} alt={result.gift_name} className="w-16 h-16 object-contain drop-shadow-lg" />}
                          <div className="text-white font-bold text-sm">{result.gift_name} added to your Bag! 🎁</div>
                          {result.coins_won>0 && <div className="text-amber-300 font-black">+ 🪙 {result.coins_won.toLocaleString()} bonus</div>}
                        </div>
                      ) : result.coins_won>0 ? (
                        <div className="text-amber-300 font-black text-xl">+ 🪙 {result.coins_won.toLocaleString()}</div>
                      ) : (
                        <div className="text-white/30 text-sm">Better luck next time!</div>
                      )}
                    </div>
                  )}

                  <button onClick={handleSpin} disabled={!canSpin}
                    className={`w-full py-4 rounded-2xl font-black text-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${canSpin?'shadow-[0_0_30px_rgba(251,191,36,0.5)] hover:shadow-[0_0_40px_rgba(251,191,36,0.7)]':''}`}
                    style={{ background:canSpin?'linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)':'rgba(255,255,255,0.1)', color:canSpin?'#000':'rgba(255,255,255,0.3)' }}>
                    {spinning
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/>Spinning...</span>
                      : `🎰 SPIN — 🪙 ${bet.toLocaleString()}`
                    }
                  </button>
                </div>
                <div className="h-2 w-full" style={{ background:'linear-gradient(90deg,#8b5cf6,#3b82f6,#22c55e,#eab308,#f97316,#ef4444,#8b5cf6)', backgroundSize:'200% 100%', animation:`shimmerSlot ${spinning?'0.4s':'3s'} linear infinite` }} />
              </div>

              {/* Bet selector */}
              <div>
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">🪙 Bet per Spin</div>
                <div className="grid grid-cols-4 gap-2">
                  {BET_OPTIONS.map(opt => (
                    <button key={opt.amount} onClick={() => setBet(opt.amount)} disabled={spinning}
                      className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-60 border ${bet===opt.amount ? `bg-gradient-to-b ${opt.color} text-white border-white/30 shadow-lg ${opt.glow}` : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pay table */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">📊 Pay Table</div>
                <div className="space-y-2.5">
                  {[
                    { combo:'🏆🏆🏆', label:'JACKPOT',  reward:'Gift + ×10 coins', color:'text-yellow-300' },
                    { combo:'💎💎💎', label:'GIFT WIN', reward:'Exclusive Gift',     color:'text-pink-300'   },
                    { combo:'3 Same', label:'BIG WIN',  reward:'×5 coins',          color:'text-emerald-300'},
                    { combo:'2 Same', label:'WIN',      reward:'×2 coins',          color:'text-blue-300'   },
                  ].map((row,i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base w-20 font-bold">{row.combo}</span>
                        <span className={`text-xs font-black ${row.color}`}>{row.label}</span>
                      </div>
                      <span className="text-white/50 text-xs">{row.reward}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}