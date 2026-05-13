import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Plus,
  Trash2,
  Diamond,
  AlertTriangle,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { GEM_USD_RATE } from '@/config/rates';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const PAYOUT_METHODS = [
  { value: 'recharge_agent', label: 'Recharge Agent' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto', label: 'Crypto Wallet' },
  { value: 'other', label: 'Other' },
  { value: 'manual', label: 'Manual / Custom' }
];

const DEFAULT_SPLIT_STRUCTURE = {
  method: 'recharge_agent',
  gems: '',
  note: '',
  agentId: '',
  bank: { full_name: '', bank_name: '', iban_or_account: '', swift_optional: '', country: '' },
  paypal: { paypal_email: '' },
  crypto: { network: '', wallet_address: '' },
  manual: { details: '' }
};

const calculateUsd = (gems) => {
  const val = parseInt(gems, 10);
  if (isNaN(val) || val <= 0) return '0.00';
  return (val * GEM_USD_RATE).toFixed(2);
};

const getInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return '';
};

const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="24">👤</text>
    </svg>
  `);

// Helper: first day of current month (UTC) => "YYYY-MM-01"
const getCurrentCycleMonth = () => {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return utc.toISOString().slice(0, 10);
};

// SplitRow component
const SplitRow = ({
  split,
  onUpdate,
  onRemove,
  rechargeAgents,
  loadingAgents,
  agentsError,
  onRetryAgents,
  canRemove
}) => {
  const handleMethodChange = (val) => onUpdate(split.id, 'method', val);

  const handleGemsChange = (e) => {
    const rawVal = e.target.value;
    const val = rawVal.replace(/[^0-9]/g, '');
    onUpdate(split.id, 'gems', val);
  };

  const handleAgentChange = (val) => onUpdate(split.id, 'agentId', val);

  const handleNoteChange = (e) => onUpdate(split.id, 'note', e.target.value);

  const selectedAgent = useMemo(
    () => rechargeAgents.find(ag => String(ag.id) === String(split.agentId)),
    [rechargeAgents, split.agentId]
  );

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4 relative group animate-in fade-in duration-300 pointer-events-auto">
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 z-10"
          onClick={() => onRemove(split.id)}
          title="Remove split"
          type="button"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 relative z-0">
          <Label className="text-xs font-medium text-slate-500">Payout Method</Label>
          <div className="relative">
            <select
              className="flex h-10 w-full appearance-none items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer relative z-10 pointer-events-auto"
              value={split.method}
              onChange={(e) => handleMethodChange(e.target.value)}
            >
              {PAYOUT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none z-0" />
          </div>
        </div>

        <div className="space-y-1.5 relative z-0">
          <Label className="text-xs font-medium text-slate-500">Amount (Gems)</Label>
          <div className="relative">
            <Diamond className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10 pointer-events-none" />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              className="pl-9 font-semibold pointer-events-auto"
              value={split.gems}
              onChange={handleGemsChange}
            />
            <div className="absolute right-3 top-2.5 text-xs font-medium text-slate-400 pointer-events-none z-10">
              ≈ ${calculateUsd(split.gems)}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        {split.method === 'recharge_agent' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-500">Select Recharge Agent</Label>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onRetryAgents();
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors disabled:opacity-50 pointer-events-auto"
                disabled={loadingAgents}
              >
                <RefreshCw className={cn("w-3 h-3", loadingAgents && "animate-spin")} />
                {loadingAgents ? 'Loading...' : 'Refresh List'}
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {loadingAgents ? (
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading agents...
                </div>
              ) : agentsError ? (
                <div className="text-sm text-red-600">Failed to load agents.</div>
              ) : rechargeAgents.length === 0 ? (
                <div className="text-sm text-slate-500">No active agents found.</div>
              ) : (
                rechargeAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAgentChange(String(agent.id))}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                      selectedAgent?.id === agent.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={agent.profiles?.avatar_url || FALLBACK_AVATAR}
                      alt={agent.name || 'Agent'}
                      className="w-10 h-10 rounded-full object-cover border"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (agent.profiles?.id) {
                          window.open(`/user/${agent.profiles.id}`, '_blank');
                        }
                      }}
                    />
                    <div className="text-left">
                      <div className="font-semibold text-slate-900">{agent.name || agent.profiles?.name || 'Unknown Agent'}</div>
                      <div className="text-xs text-slate-500">
                        {agent.country_code || '—'} • ID: {agent.profiles?.profile_id || 'N/A'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mt-3 pt-2">
          <Input
            className="text-xs bg-slate-50 border-slate-200 pointer-events-auto"
            placeholder="Split Note (Optional)"
            value={split.note}
            onChange={handleNoteChange}
          />
        </div>
      </div>
    </div>
  );
};

export default function WithdrawalRequestModal({ isOpen, onClose, availableGems, onSuccess, isCycleWithdrawal = false }) {
  const { toast } = useToast();

  const [splits, setSplits] = useState([{ ...DEFAULT_SPLIT_STRUCTURE, id: 'init-1' }]);
  const [overallNote, setOverallNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agents
  const [rechargeAgents, setRechargeAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState(false);

  // Duplicate guard for same cycle_month
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);
  const cycleMonth = useMemo(() => getCurrentCycleMonth(), []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    setAgentsError(false);

    try {
      const { data, error } = await supabase
        .from('recharge_agents')
        .select(`
          id,
          name,
          country_code,
          contact_info,
          is_active,
          user_id,
          profiles:user_id (
            id,
            name,
            avatar_url,
            profile_id
          )
        `)
        .eq('is_active', true);
      if (error) throw error;

      const mapped = (data || []).map((agent) => ({
        ...agent,
        profiles: Array.isArray(agent.profiles) ? agent.profiles[0] || null : agent.profiles || null,
      }));

      setRechargeAgents(mapped);
    } catch (err) {
      console.error('[WithdrawalModal] Error fetching agents:', err);
      setAgentsError(true);
      setRechargeAgents([]);

      toast({
        title: "Connection Issue",
        description: "Could not load recharge agents. Please try refreshing the list.",
        variant: "destructive",
      });
    } finally {
      setLoadingAgents(false);
    }
  }, [toast]);

  // Check if user already has a request in current month cycle
  const checkExistingRequestThisCycle = useCallback(async () => {
    setCheckingExisting(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userData?.user?.id;
      if (!userId) {
        setExistingRequest(null);
        return;
      }

      const { data, error } = await supabase
        .from('gem_withdrawal_requests')
        .select('id, status, cycle_month, created_at')
        .eq('user_id', userId)
        .eq('cycle_month', cycleMonth)
        .in('status', ['pending', 'approved', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      setExistingRequest(data?.[0] || null);
    } catch (err) {
      console.error('[WithdrawalModal] checkExistingRequestThisCycle error:', err);
      setExistingRequest(null);
    } finally {
      setCheckingExisting(false);
    }
  }, [cycleMonth]);

  // On open
  useEffect(() => {
    if (isOpen) {
      fetchAgents();
      checkExistingRequestThisCycle();
    }
  }, [isOpen, fetchAgents, checkExistingRequestThisCycle]);

  // Reset form when opens
  useEffect(() => {
    if (isOpen) {
      const initialAmount = availableGems > 0 ? String(availableGems) : '';
      setSplits([{ ...DEFAULT_SPLIT_STRUCTURE, id: `reset-${Date.now()}`, gems: initialAmount }]);
      setOverallNote('');
      setIsSubmitting(false);
    }
  }, [isOpen, availableGems]);

  const addSplit = useCallback(() => {
    setSplits(prev => [...prev, { ...DEFAULT_SPLIT_STRUCTURE, id: `split-${Date.now()}` }]);
  }, []);

  const removeSplit = useCallback((id) => {
    setSplits(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }, []);

  const handleUpdateSplit = useCallback((id, field, value, nestedField = null) => {
    setSplits(prev => prev.map(split => {
      if (split.id !== id) return split;
      if (nestedField) {
        return { ...split, [field]: { ...split[field], [nestedField]: value } };
      }
      return { ...split, [field]: value };
    }));
  }, []);

  const totalRequested = useMemo(() => {
    return splits.reduce((sum, split) => sum + (parseInt(split.gems, 10) || 0), 0);
  }, [splits]);

  const remaining = useMemo(() => (availableGems || 0) - totalRequested, [availableGems, totalRequested]);
  const isOverLimit = remaining < 0;

  const hasActiveRequestForThisCycle = !!existingRequest;

  const handleSubmit = async () => {
    if (checkingExisting) return;

    // HARD BLOCK: stop duplicate submissions
    if (hasActiveRequestForThisCycle) {
      toast({
        title: "Already Submitted",
        description: `You already have a request for this month (ID #${existingRequest.id}).`,
        variant: "destructive"
      });
      return;
    }

    if (totalRequested <= 0) {
      toast({ title: "Validation Error", description: "Total gems must be greater than 0.", variant: "destructive" });
      return;
    }
    if (isOverLimit) {
      toast({ title: "Validation Error", description: "Requested amount exceeds available balance.", variant: "destructive" });
      return;
    }

    for (const split of splits) {
      if (split.method === 'recharge_agent' && !split.agentId) {
        toast({ title: "Validation Error", description: "Please select a recharge agent for all agent splits.", variant: "destructive" });
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const cleanSplits = splits
        .map(s => ({ ...s, gems: Number(s.gems) || 0 }))
        .filter(s => s.gems > 0);

      const payloadSplits = cleanSplits.map(split => ({
        payout_method: split.method,
        gems: split.gems,
        recharge_agent_id: split.method === 'recharge_agent' ? parseInt(split.agentId, 10) : null,
        payout_details: {},
        note: split.note || ''
      }));

      const { data, error } = await supabase.rpc('create_gem_withdrawal_request', {
        p_splits: payloadSplits,
        p_note: overallNote || null
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);

      toast({
        title: "Request Submitted",
        description: `Withdrawal #${data.request_id} created successfully.`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      // refresh guard after submit
      await checkExistingRequestThisCycle();

      if (onSuccess) onSuccess();
      onClose(false);

    } catch (err) {
      console.error("[WithdrawalModal] Withdrawal error:", err);
      let msg = err.message || 'Request failed';

      const lower = String(msg).toLowerCase();
      if (msg === 'insufficient_cycle_balance') msg = "Requested amount exceeds your unlocked cycle balance.";
      if (msg === 'insufficient_gems') msg = "Insufficient gems in wallet.";

      // if backend says duplicate => lock UI immediately
      if (
        lower.includes('duplicate') ||
        lower.includes('already exists') ||
        lower.includes('unique') ||
        lower.includes('active request')
      ) {
        toast({
          title: "Already Submitted",
          description: "A withdrawal request already exists for this month.",
          variant: "destructive"
        });
        await checkExistingRequestThisCycle();
        return;
      }

      toast({ title: "Request Failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose(open)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 bg-white z-50 pointer-events-auto">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Request Withdrawal</DialogTitle>
          <DialogDescription>
            {isCycleWithdrawal ? "Withdraw funds from your currently active cycle." : "Optimize your payout by splitting across methods."}
            <span className="ml-2 text-xs text-slate-400">Cycle: {cycleMonth}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pointer-events-auto">
          {/* Duplicate guard banner */}
          {checkingExisting ? (
            <Alert className="bg-slate-50 border-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle className="mr-2">Checking...</AlertTitle>
              <AlertDescription className="mr-2">
                Checking if you already submitted a request for this month.
              </AlertDescription>
            </Alert>
          ) : hasActiveRequestForThisCycle ? (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="mr-2">Request Already Exists</AlertTitle>
              <AlertDescription className="mr-2">
                You already have a withdrawal request for this month (ID #{existingRequest.id}). You can’t submit another one.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <Label className="text-xs text-slate-500 uppercase">{isCycleWithdrawal ? "Cycle Limit" : "Available"}</Label>
              <div className="text-xl font-bold text-slate-900 flex items-center gap-1">
                {(availableGems || 0).toLocaleString()}
                <Diamond className="w-4 h-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="text-xs text-slate-500 font-medium">≈ ${calculateUsd(availableGems || 0)}</div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 uppercase">Requested</Label>
              <div className={cn("text-xl font-bold flex items-center gap-1", isOverLimit ? "text-red-600" : "text-slate-900")}>
                {totalRequested.toLocaleString()}
                <Diamond className="w-4 h-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="text-xs text-slate-500 font-medium">≈ ${calculateUsd(totalRequested)}</div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 uppercase">Remaining</Label>
              <div className={cn("text-xl font-bold flex items-center gap-1", isOverLimit ? "text-red-600" : "text-green-600")}>
                {remaining.toLocaleString()}
                <Diamond className="w-4 h-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="text-xs text-slate-500 font-medium">≈ ${calculateUsd(remaining)}</div>
            </div>
          </div>

          {isOverLimit && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm border border-red-100">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Over limit by {Math.abs(remaining).toLocaleString()} gems.
            </div>
          )}

          {/* Splits */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Payment Splits</h3>
              <Button onClick={addSplit} variant="outline" size="sm" className="h-8 gap-1 pointer-events-auto">
                <Plus className="w-3.5 h-3.5" /> Add Split
              </Button>
            </div>

            <div className="space-y-4">
              {splits.map((split) => (
                <SplitRow
                  key={split.id}
                  split={split}
                  onUpdate={handleUpdateSplit}
                  onRemove={removeSplit}
                  rechargeAgents={rechargeAgents}
                  loadingAgents={loadingAgents}
                  agentsError={agentsError}
                  onRetryAgents={fetchAgents}
                  canRemove={splits.length > 1}
                />
              ))}
            </div>
          </div>

          {/* Overall Note */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Request Note</Label>
            <Textarea
              placeholder="Optional instructions for the admin..."
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              className="min-h-[60px] pointer-events-auto"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0 flex items-center justify-between sm:justify-end gap-2 pointer-events-auto">
          <Button
            variant="outline"
            onClick={() => onClose(false)}
            disabled={isSubmitting}
            type="button"
            className="pointer-events-auto"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              checkingExisting ||
              hasActiveRequestForThisCycle ||
              isOverLimit ||
              totalRequested <= 0
            }
            className="bg-purple-600 hover:bg-purple-700 min-w-[120px] pointer-events-auto"
            type="submit"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}