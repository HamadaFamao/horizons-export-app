import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Coins, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'user',  label: '👤 User Wallet',          desc: 'Add coins to a regular user wallet' },
  { key: 'agent', label: '🔄 Recharge Agent Balance', desc: 'Add coins to recharge agent balance' },
];

export default function AdminCoins() {
  const { toast } = useToast();
  const { staffRole } = useAdminPermissions();
  const canManage = staffRole === 'manager' || staffRole === 'admin';

  const [activeTab, setActiveTab] = useState('user');
  const [profileId, setProfileId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [operation, setOperation] = useState('add'); // 'add' | 'deduct'
  const [submitting, setSubmitting] = useState(false);

  // Profile preview
  const [preview, setPreview] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async () => {
    if (!profileId.trim()) return;
    setSearching(true);
    setPreview(null);
    setSearchError('');
    try {
      const { data, error } = await supabase.rpc('admin_get_wallet_info', {
        p_profile_id: Number(profileId.trim()),
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      setPreview(data);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) {
      toast({ title: 'Search for a user first', variant: 'destructive' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    const finalAmount = operation === 'deduct' ? -Number(amount) : Number(amount);
    const action = operation === 'add' ? 'Add' : 'Deduct';

    if (!window.confirm(`${action} ${Number(amount).toLocaleString()} coins ${operation === 'add' ? 'to' : 'from'} ${preview.agent_name || 'this user'}?`)) return;

    setSubmitting(true);
    try {
      let data, error;

      if (activeTab === 'user') {
        // للمستخدم العادي: نستخدم amount موجب أو سالب
        ({ data, error } = await supabase.rpc('admin_add_coins_to_user', {
          p_profile_id: Number(profileId.trim()),
          p_amount: Math.abs(Number(amount)) * (operation === 'deduct' ? -1 : 1),
          p_reason: reason.trim() || null,
        }));
      } else {
        if (operation === 'deduct') {
          toast({ title: 'Deduct not supported for recharge agents yet', variant: 'destructive' });
          return;
        }
        ({ data, error } = await supabase.rpc('admin_add_coins_to_recharge_agent', {
          p_profile_id: Number(profileId.trim()),
          p_amount: Number(amount),
          p_reason: reason.trim() || null,
        }));
      }

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      toast({
        title: `✅ ${Number(amount).toLocaleString()} coins ${operation === 'add' ? 'added to' : 'deducted from'} ${preview.agent_name || 'user'}!`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      setAmount('');
      setReason('');
      setPreview(null);
      setProfileId('');
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Coins Management</h1>
        <p className="text-muted-foreground mt-1">Manually add coins to user or recharge agent wallets</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {TABS.map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setActiveTab(tab.key);
              setPreview(null);
              setProfileId('');
              setAmount('');
              setReason('');
              setSearchError('');
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        {TABS.find(t => t.key === activeTab)?.desc}
      </p>

      {/* Form */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">

        {/* Profile ID + Search */}
        <div className="space-y-2">
          <Label>{activeTab === 'user' ? 'User Profile ID' : 'Recharge Agent Profile ID'}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 200150"
              value={profileId}
              onChange={(e) => { setProfileId(e.target.value); setPreview(null); setSearchError(''); }}
              disabled={submitting}
            />
            <Button variant="outline" onClick={handleSearch}
              disabled={searching || !profileId.trim()}>
              {searching
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {searchError}
            </p>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div className="flex-1">
              <p className="font-bold text-gray-900">{preview.agent_name || preview.name || 'User'}</p>
              <p className="text-xs text-gray-500">#{profileId}
                {preview.agent_country && ` • ${preview.agent_country}`}
              </p>
              <div className="flex gap-3 mt-1 flex-wrap">
                {activeTab === 'user' ? (
                  <>
                    <span className="text-xs text-amber-600 font-semibold">
                      🪙 {Number(preview.coins || 0).toLocaleString()} coins
                    </span>
                    <span className="text-xs text-emerald-600 font-semibold">
                      💎 {Number(preview.gems || 0).toLocaleString()} gems
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 font-semibold">
                    🪙 {Number(preview.agent_balance || 0).toLocaleString()} recharge balance
                  </span>
                )}
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          </div>
        )}

        {/* Operation */}
        <div className="space-y-2">
          <Label>Operation</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOperation('add')}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm font-medium transition',
                operation === 'add'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              ➕ Add Coins
            </button>
            <button
              type="button"
              onClick={() => setOperation('deduct')}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm font-medium transition',
                operation === 'deduct'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              ➖ Deduct Coins
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label>Amount (Coins)</Label>
          <Input
            type="number"
            placeholder="e.g. 1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            min="1"
          />
          {amount && Number(amount) > 0 && (
            <p className="text-xs text-gray-500">
              ≈ ${(Number(amount) * 0.01).toFixed(2)} USD
            </p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label>Reason <span className="text-gray-400 text-xs">(Optional)</span></Label>
          <Textarea
            placeholder="e.g. Competition reward, compensation..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            className="min-h-[80px]"
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12"
          disabled={submitting || !preview || !amount || Number(amount) <= 0}
          onClick={handleSubmit}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            <><Coins className="w-4 h-4 mr-2" />
              {operation === 'add' ? '➕ Add' : '➖ Deduct'} {amount ? Number(amount).toLocaleString() : '0'} Coins
            </>
          )}
        </Button>
      </div>
    </div>
  );
}