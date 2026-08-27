import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, RefreshCw, Loader2, Coins, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_CONFIG = {
  topup: {
    label: 'Top-Up',
    icon: ArrowUpCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    amountColor: 'text-green-600',
    prefix: '+'
  },
  deduct: {
    label: 'Deduction',
    icon: ArrowDownCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    amountColor: 'text-red-500',
    prefix: '-'
  },
  transfer: {
    label: 'Transfer to Client',
    icon: ArrowRightLeft,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    amountColor: 'text-indigo-600',
    prefix: '-'
  },
};

export default function RechargeAgentActivityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ data: acts, error: actErr }, { data: bal }] = await Promise.all([
        supabase.rpc('get_recharge_agent_activity', { p_limit: 100 }),
        supabase.rpc('get_recharge_agent_balance_for_current_user'),
      ]);

      if (actErr) throw actErr;
      setActivities(acts || []);
      setBalance(bal || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  // حساب إجماليات
  const totalTopups = activities
    .filter(a => a.type === 'topup')
    .reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = activities
    .filter(a => a.type === 'deduct')
    .reduce((s, a) => s + Math.abs(Number(a.amount)), 0);
  const totalTransfers = activities
    .filter(a => a.type === 'transfer')
    .reduce((s, a) => s + Math.abs(Number(a.amount)), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon"
            onClick={() => navigate('/recharge-agent')}
            className="-ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Recharge Activity</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-purple-800 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">
            Current Recharge Balance
          </p>
          <p className="text-4xl font-bold">{balance.toLocaleString()}</p>
          <p className="text-indigo-200 text-sm mt-1">Coins</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Added</p>
            <p className="text-lg font-bold text-green-600">
              +{totalTopups.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">coins</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Transferred</p>
            <p className="text-lg font-bold text-indigo-600">
              -{totalTransfers.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">coins</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Deducted</p>
            <p className="text-lg font-bold text-red-500">
              -{totalDeductions.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">coins</p>
          </div>
        </div>

        {/* Activity List */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Transaction History</h2>

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">{error}</div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((item, idx) => {
                const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.topup;
                const Icon = config.icon;
                const absAmount = Math.abs(Number(item.amount));

                return (
                  <div key={idx}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                    <div className={cn('p-2.5 rounded-full shrink-0', config.bg)}>
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{config.label}</p>
                      {item.note && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">"{item.note}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.created_at
                          ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                          : '—'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={cn('font-bold text-base', config.amountColor)}>
                        {config.prefix}{absAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">coins</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
