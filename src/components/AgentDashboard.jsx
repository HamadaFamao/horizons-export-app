import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, Users, Wallet, Copy, Share2 } from 'lucide-react';
import WithdrawalRequestModal from '@/components/modals/WithdrawalRequestModal';

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="24">👤</text>
    </svg>
  `);

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatGems = (v) => toNumber(v).toLocaleString();
const formatUsd = (v) => toNumber(v).toFixed(2);

export default function AgentDashboard({ profile: profileProp = null, embedded = true }) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(profileProp);
  const [error, setError] = useState('');

  const [agencyId, setAgencyId] = useState(null);
  const [agencyName, setAgencyName] = useState('');

  const [members, setMembers] = useState([]);
  const [lastCycle, setLastCycle] = useState(null);
  const [lockedGems, setLockedGems] = useState(0);
  const [lockedUsd, setLockedUsd] = useState(0);
  const [, setActiveCycleId] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [snapshotRows, setSnapshotRows] = useState([]);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isAgent = useMemo(() => {
    return (
      profile?.is_agent === true ||
      profile?.agent === true ||
      profile?.role === 'agent' ||
      profile?.account_type === 'agent' ||
      false
    );
  }, [profile]);

  const fetchProfile = async () => {
    if (profileProp) {
      setProfile(profileProp);
      return profileProp;
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user?.id) {
      throw new Error('Not authenticated');
    }

    const { data, error: pErr } = await supabase
      .from('profiles')
      .select('id, profile_id, name, is_agent, agency_id, agency_name, family_id, family_name')
      .eq('id', user.id)
      .single();

    if (pErr) throw pErr;
    setProfile(data);
    return data;
  };

  const fetchDashboard = async ({ initial = false, profileOverride = null } = {}) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user?.id) throw new Error('Not authenticated');

      const { data: ua } = await supabase
        .from('v_user_agency')
        .select('agency_id, agency_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const profileRef = profileOverride || profile;
      const activeAgencyId = ua?.agency_id ?? profileRef?.agency_id ?? profileRef?.family_id ?? null;
      const activeAgencyName = ua?.agency_name ?? profileRef?.agency_name ?? profileRef?.family_name ?? '';

      setAgencyId(activeAgencyId);
      setAgencyName(activeAgencyName || 'Unknown Agency');

      if (!activeAgencyId) {
        setMembers([]);
      } else {
        const { data: membersData, error: mErr } = await supabase
          .from('agency_memberships')
          .select(`
            user_id,
            joined_at,
            withdrawal_method,
            withdrawal_note,
            profiles:user_id (
              id,
              name,
              avatar_url,
              profile_id
            )
          `)
          .eq('agency_id', activeAgencyId)
          .neq('user_id', user.id)
          .is('left_at', null)
          .order('joined_at', { ascending: false });

        if (mErr) throw mErr;

        setMembers(
          (membersData || []).map((m) => ({
            ...m,
            profile: Array.isArray(m.profiles) ? m.profiles[0] || null : m.profiles || null,
          }))
        );
      }

      const { data: activeCycle, error: cycleErr } = await supabase
        .from('agency_withdrawal_cycles')
        .select('id, locked_gems, locked_usd, status, cycle_month')
        .eq('agency_user_id', user.id)
        .eq('status', 'open')
        .order('cycle_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleErr) throw cycleErr;
      setLastCycle(activeCycle || null);
      setLockedGems(activeCycle?.locked_gems || 0);
      setLockedUsd(activeCycle?.locked_usd || 0);
      setActiveCycleId(activeCycle?.id || null);

      const { data: pendingReq, error: pendingErr } = await supabase
        .from('gem_withdrawal_requests')
        .select('id, gems_requested, status, created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingErr) throw pendingErr;
      setPendingRequest(pendingReq || null);

      const { data: snapshotData, error: snapErr } = await supabase
        .from('agency_earnings_snapshots')
        .select('snapshot_json, cycle_month')
        .eq('agency_user_id', user.id)
        .order('cycle_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapErr) throw snapErr;

      const byUserRaw = snapshotData?.snapshot_json?.by_user;
      const rawRows = Array.isArray(byUserRaw)
        ? byUserRaw
        : byUserRaw && typeof byUserRaw === 'object'
          ? Object.values(byUserRaw)
          : [];

      let parsed = rawRows.map((row) => ({
        user_id: row.user_id || null,
        name: row.name || row.member_name || null,
        gems: toNumber(row.gems ?? row.locked_gems ?? row.total_gems),
        usd: toNumber(row.usd ?? row.locked_usd ?? row.total_usd),
      }));

      const missingNameIds = [...new Set(parsed.filter((r) => !r.name && r.user_id).map((r) => r.user_id))];
      if (missingNameIds.length > 0) {
        const { data: names } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', missingNameIds);
        const namesMap = {};
        (names || []).forEach((p) => {
          namesMap[p.id] = p.name;
        });
        parsed = parsed.map((r) => ({
          ...r,
          name: r.name || namesMap[r.user_id] || 'Unknown',
        }));
      }

      setSnapshotRows(parsed);
    } catch (e) {
      setError(e?.message || 'Failed to load agent dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const loadedProfile = await fetchProfile();
        if (!mounted) return;
        await fetchDashboard({ initial: true, profileOverride: loadedProfile || profileProp || null });
      } catch (e) {
        if (mounted) {
          setLoading(false);
          setError(e?.message || 'Failed to initialize dashboard');
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileProp]);

  const reportText = useMemo(() => {
    return (snapshotRows || [])
      .map((r) => `Member: ${r.name || 'Unknown'} | Gems: ${formatGems(r.gems)} | USD: $${formatUsd(r.usd)}`)
      .join('\n');
  }, [snapshotRows]);

  const handleCopyReport = async () => {
    try {
      if (!reportText) {
        toast({ title: 'No data', description: 'No earnings rows to copy.' });
        return;
      }
      await navigator.clipboard.writeText(reportText);
      toast({ title: '✅ Copied', description: 'Earnings report copied as text.' });
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Copy failed.', variant: 'destructive' });
    }
  };

  const handleShareReport = async () => {
    try {
      if (!reportText) {
        toast({ title: 'No data', description: 'No earnings rows to share.' });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `Earnings Report - ${agencyName || 'Agency'}`,
          text: reportText,
        });
      } else {
        toast({ title: 'Not supported', description: 'Share is not supported on this device.' });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast({ title: 'Error', description: e?.message || 'Share failed.', variant: 'destructive' });
      }
    }
  };

  if (loading) {
    return (
      <div className={embedded ? '' : 'bg-white rounded-2xl shadow-lg p-6'}>
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agent dashboard...
        </div>
      </div>
    );
  }

  if (!isAgent) return null;

  return (
    <div className={embedded ? 'space-y-5' : 'bg-white rounded-2xl shadow-lg p-6 space-y-5'}>
      <div className="rounded-2xl border bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900">{agencyName || 'Unknown Agency'}</h2>
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">Agent</Badge>
              <Badge variant="secondary" className="bg-white text-slate-700 border">
                {members.length} Members
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1">Manage earnings, withdrawals, and your members from one place.</p>
          </div>

          <Button variant="outline" onClick={() => fetchDashboard()} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600 whitespace-pre-line">{error}</div> : null}

      <div className="rounded-2xl border bg-white p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Earnings Summary</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Locked Gems (Last Cycle)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatGems(lockedGems)}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Locked USD (Last Cycle)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">${formatUsd(lockedUsd)}</p>
          </div>

          <div className="rounded-xl border bg-indigo-600 text-white p-4 flex flex-col justify-between">
            <p className="text-xs uppercase tracking-wide text-indigo-100">Withdrawal</p>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!!pendingRequest || lockedGems === 0}
              className="mt-3 w-full py-3 rounded-xl bg-white text-indigo-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {pendingRequest ? '⏳ Request Pending' : 'Withdraw'}
            </button>
          </div>
        </div>

        {pendingRequest && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mt-3">
            <span className="text-amber-600 text-lg">⏳</span>
            <div>
              <div className="text-sm font-semibold text-amber-800">
                Withdrawal Pending Review
              </div>
              <div className="text-xs text-amber-600">
                {pendingRequest.gems_requested} gems • Status: {pendingRequest.status}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <h3 className="font-semibold text-slate-900">My Members</h3>
          </div>

          <Button variant="outline" onClick={() => setReportOpen(true)}>
            View Full Earnings Report
          </Button>
        </div>

        <div className="border rounded-xl overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Withdrawal Method</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 p-6">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={m.profile?.avatar_url || DEFAULT_AVATAR}
                          alt={m.profile?.name || 'Member'}
                          className="w-9 h-9 rounded-full object-cover bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{m.profile?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">#{m.profile?.profile_id || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.withdrawal_method === 'agent' ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Via Agent</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-200">
                          Self
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Full Earnings Report</DialogTitle>
          </DialogHeader>

          <div className="border rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Gems</TableHead>
                  <TableHead>USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshotRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center p-5 text-slate-500">
                      No snapshot data found.
                    </TableCell>
                  </TableRow>
                ) : (
                  snapshotRows.map((row, idx) => (
                    <TableRow key={`${row.user_id || 'row'}-${idx}`}>
                      <TableCell>{row.name || 'Unknown'}</TableCell>
                      <TableCell>{formatGems(row.gems)}</TableCell>
                      <TableCell>${formatUsd(row.usd)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCopyReport} className="flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Copy
            </Button>
            <Button variant="outline" onClick={handleShareReport} className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WithdrawalRequestModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableGems={lockedGems}
        onSuccess={() => {
          toast({
            title: 'Withdrawal request submitted',
            description: 'Withdrawal request submitted - pending review',
          });
          fetchDashboard();
        }}
        isCycleWithdrawal={true}
      />
    </div>
  );
}