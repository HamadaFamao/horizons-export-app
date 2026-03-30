import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

/**
 * AgencySection (RPC-based Join + Inbox)
 * ✅ No i18n dependency
 * ✅ Fetch families with table fallback: agencies -> families
 * ✅ Minimal select (id, name) to avoid missing-column issues
 * ✅ Members count fetched from agency_memberships (best effort)
 *
 * ✅ NEW (User Inbox):
 * - List my pending join requests (Cancel)
 * - List my pending invites (Accept / Reject)
 *
 * ✅ Join request uses RPC:
 * - request_to_join_agency(p_agency_id [, p_note])
 * - submit_agency_join_request(p_agency_id)
 */

const TABLE_CANDIDATES = ['agencies', 'families']; // fallback

export default function AgencySection({ profile, onProfileUpdate }) {
  // ----------------------------
  // Profile mapping (tolerant)
  // ----------------------------
  const familyId = profile?.family_id ?? profile?.agency_id ?? null;
  const familyName = profile?.family_name ?? profile?.agency_name ?? null;
  const familyCode = profile?.family_code ?? profile?.agency_code ?? null;

  const isInFamily = !!familyId || !!familyName;

  // ----------------------------
  // State (browse)
  // ----------------------------
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [memberCounts, setMemberCounts] = useState({}); // { [agencyId]: count }
  const [search, setSearch] = useState('');
  const [requestingId, setRequestingId] = useState(null);
  const [inlineError, setInlineError] = useState('');

  // ----------------------------
  // State (Inbox)
  // ----------------------------
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [myPendingRequests, setMyPendingRequests] = useState([]); // from list_my_agency_pending_requests
  const [myInvites, setMyInvites] = useState([]); // from list_my_agency_invites
  const [agencyNameMap, setAgencyNameMap] = useState({}); // { [agencyId]: name }

  const [cancelingId, setCancelingId] = useState(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState(null);
  const [rejectingInviteId, setRejectingInviteId] = useState(null);

  // Derived: pending flag from inbox OR profile
  const pendingFromInbox = useMemo(() => {
    const pr = Array.isArray(myPendingRequests) && myPendingRequests.length > 0;
    const pi = Array.isArray(myInvites) && myInvites.some((x) => (x?.status || '').toLowerCase() === 'pending');
    return pr || pi;
  }, [myPendingRequests, myInvites]);

  const pendingFamilyRequest =
    profile?.family_request_status === 'pending' ||
    profile?.agency_request_status === 'pending' ||
    profile?.agency_join_status === 'pending' ||
    profile?.family_join_status === 'pending' ||
    pendingFromInbox ||
    false;

  // ----------------------------
  // Helpers
  // ----------------------------
  const safeLower = (v) => String(v || '').toLowerCase();

  const fetchAgenciesMapBestEffort = async (ids) => {
    const uniq = Array.from(new Set((ids || []).filter(Boolean)));
    if (uniq.length === 0) return {};

    for (const table of TABLE_CANDIDATES) {
      try {
        const { data, error } = await supabase.from(table).select('id, name').in('id', uniq);
        if (error) throw error;

        const map = {};
        for (const r of data || []) {
          if (r?.id) map[r.id] = r?.name || r.id;
        }
        return map;
      } catch (e) {
        console.warn(`[AgencySection] fetchAgenciesMap failed on ${table}:`, e?.message || e);
      }
    }

    // fallback: map to ids
    const map = {};
    uniq.forEach((id) => (map[id] = id));
    return map;
  };

  // ----------------------------
  // Fetch families with fallback
  // ----------------------------
  useEffect(() => {
    let mounted = true;

    const fetchMemberCountsSafe = async (familyIds) => {
      try {
        const { data, error } = await supabase
          .from('agency_memberships')
          .select('agency_id')
          .in('agency_id', familyIds);

        if (error) throw error;

        const map = {};
        for (const row of data || []) {
          const id = row?.agency_id;
          if (!id) continue;
          map[id] = (map[id] || 0) + 1;
        }
        if (mounted) setMemberCounts(map);
      } catch (err) {
        console.warn('[AgencySection] agency_memberships not available:', err?.message || err);
        if (mounted) setMemberCounts({});
      }
    };

    const fetchWithFallback = async () => {
      setLoading(true);
      setInlineError('');
      setFamilies([]);
      setMemberCounts({});

      for (const table of TABLE_CANDIDATES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('id, name')
            .order('name', { ascending: true });

          if (error) throw error;
          if (!mounted) return;

          const list = Array.isArray(data) ? data : [];
          setFamilies(list);

          const ids = list.map((x) => x.id).filter(Boolean);
          if (ids.length) fetchMemberCountsSafe(ids);

          setLoading(false);
          return;
        } catch (err) {
          console.warn(`[AgencySection] Failed to read from "${table}":`, err?.message || err);
        }
      }

      if (!mounted) return;
      setLoading(false);
      setInlineError(
        `Couldn't load families. احتمال:
- اسم الجدول مختلف عن (agencies / families)
- أو RLS مانع القراءة`
      );
    };

    fetchWithFallback();

    return () => {
      mounted = false;
    };
  }, []);

  // ----------------------------
  // Filter
  // ----------------------------
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return families;

    return families.filter((f) => {
      const n = (f?.name || '').toLowerCase();
      return n.includes(q);
    });
  }, [families, search]);

  // ----------------------------
  // RPC: Submit join request
  // ----------------------------
  const submitJoinRequestRPC = async ({ agencyId, note = null }) => {
    // 1) Preferred: request_to_join_agency(p_agency_id [, p_note])
    try {
      const payload =
        note !== null && note !== undefined
          ? { p_agency_id: agencyId, p_note: note }
          : { p_agency_id: agencyId };

      const { data, error } = await supabase.rpc('request_to_join_agency', payload);
      if (!error) return { fn: 'request_to_join_agency', data };

      console.warn('[AgencySection] request_to_join_agency error:', error?.message || error);
    } catch (e) {
      console.warn('[AgencySection] request_to_join_agency failed:', e?.message || e);
    }

    // 2) Fallback: submit_agency_join_request(p_agency_id)
    const { data, error } = await supabase.rpc('submit_agency_join_request', {
      p_agency_id: agencyId,
    });
    if (error) throw error;
    return { fn: 'submit_agency_join_request', data };
  };

  const requestToJoin = async (family) => {
    if (!family?.id) return;

    try {
      setRequestingId(family.id);
      setInlineError('');

      await submitJoinRequestRPC({ agencyId: family.id });

      // Update UI state (best effort)
      onProfileUpdate?.({
        agency_request_status: 'pending',
        family_request_status: 'pending',
        agency_join_status: 'pending',
        family_join_status: 'pending',
      });

      await loadInbox(); // ✅ عشان المستخدم يشوف الطلب في Inbox فوراً
    } catch (err) {
      console.error('[AgencySection] request join error:', err);
      setInlineError(`Request failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setRequestingId(null);
    }
  };

  // ----------------------------
  // Inbox: load my pending requests + my invites
  // ----------------------------
  const loadInbox = async () => {
    try {
      setInboxLoading(true);
      setInboxError('');
      setMyPendingRequests([]);
      setMyInvites([]);

      // 1) Pending join requests (for current user)
      const resReq = await supabase.rpc('list_my_agency_pending_requests');
      if (resReq.error) throw resReq.error;

      const reqList = Array.isArray(resReq.data) ? resReq.data : [];
      const pendingReq = reqList.filter((x) => safeLower(x?.status) === 'pending');

      // 2) My invites (pending)
      const resInv = await supabase.rpc('list_my_agency_invites');
      if (resInv.error) throw resInv.error;

      const invList = Array.isArray(resInv.data) ? resInv.data : [];
      const pendingInv = invList.filter((x) => safeLower(x?.status) === 'pending');

      // 3) Build agency name map
      const ids = [
        ...pendingReq.map((x) => x?.agency_id),
        ...pendingInv.map((x) => x?.agency_id),
      ].filter(Boolean);

      const map = await fetchAgenciesMapBestEffort(ids);

      setAgencyNameMap(map);
      setMyPendingRequests(pendingReq);
      setMyInvites(pendingInv);
    } catch (e) {
      console.error('[AgencySection] loadInbox error:', e);
      setInboxError(e?.message || 'Failed to load inbox');
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    // Inbox مهم فقط لو مش منضم
    if (isInFamily) return;
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInFamily]);

  // ----------------------------
  // Inbox actions
  // ----------------------------
  const cancelJoinRequest = async (requestId) => {
    try {
      if (!requestId) return;
      setCancelingId(requestId);
      setInboxError('');

      const { data, error } = await supabase.rpc('cancel_agency_join_request', {
        p_request_id: requestId,
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.message || 'Cancel failed');

      await loadInbox();

      // Best effort to clear pending flag
      onProfileUpdate?.({
        agency_request_status: null,
        family_request_status: null,
        agency_join_status: null,
        family_join_status: null,
      });
    } catch (e) {
      console.error('[AgencySection] cancelJoinRequest error:', e);
      setInboxError(e?.message || 'Failed to cancel request');
    } finally {
      setCancelingId(null);
    }
  };

  const acceptInvite = async (inviteId, agencyId) => {
    try {
      if (!inviteId) return;
      setAcceptingInviteId(inviteId);
      setInboxError('');

      // accept_agency_invite(p_invite_id uuid) -> text (عندك overloads، ده المناسب لجدول agency_invites.id uuid)
      const { data, error } = await supabase.rpc('accept_agency_invite', {
        p_invite_id: inviteId,
      });

      if (error) throw error;

      // ✅ حدّث البروفايل فوراً عشان الواجهة تعتبره Joined
      const agencyName = agencyNameMap?.[agencyId] || null;

      onProfileUpdate?.({
        agency_id: agencyId,
        agency_name: agencyName,
        family_id: agencyId,
        family_name: agencyName,
        // pending flags clear
        agency_request_status: null,
        family_request_status: null,
        agency_join_status: null,
        family_join_status: null,
      });

      // refresh inbox (اختياري)
      await loadInbox();

      // eslint-disable-next-line no-unused-vars
      const _txt = typeof data === 'string' ? data : null;
    } catch (e) {
      console.error('[AgencySection] acceptInvite error:', e);
      setInboxError(e?.message || 'Failed to accept invite');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const rejectInvite = async (inviteId) => {
    try {
      if (!inviteId) return;
      setRejectingInviteId(inviteId);
      setInboxError('');

      const { data, error } = await supabase.rpc('reject_agency_invite', {
        p_invite_id: inviteId,
      });

      if (error) throw error;

      await loadInbox();
      // eslint-disable-next-line no-unused-vars
      const _txt = typeof data === 'string' ? data : null;
    } catch (e) {
      console.error('[AgencySection] rejectInvite error:', e);
      setInboxError(e?.message || 'Failed to reject invite');
    } finally {
      setRejectingInviteId(null);
    }
  };

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 mb-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Family</h2>
          <p className="text-sm text-gray-600 mt-1">
            Join a family to unlock exclusive rewards and community.
          </p>
        </div>

        {pendingFamilyRequest && !isInFamily && (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        )}
      </div>

      {inlineError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-line">
          {inlineError}
        </div>
      ) : null}

      {/* If already in family */}
      {isInFamily && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Your Family</p>
              <p className="text-lg font-semibold text-gray-900">{familyName || '—'}</p>
              {familyCode ? (
                <p className="text-sm text-gray-600 mt-1">
                  Code: <span className="font-mono">{familyCode}</span>
                </p>
              ) : null}
            </div>

            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Joined
            </span>
          </div>
        </div>
      )}

      {/* Inbox (Only if not joined) */}
      {!isInFamily && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Your Inbox</h3>
            <Button variant="outline" size="sm" onClick={loadInbox} disabled={inboxLoading}>
              Refresh
            </Button>
          </div>

          {inboxLoading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : inboxError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-line">
              {inboxError}
            </div>
          ) : (
            <>
              {/* Pending Invites */}
              <div className="rounded-xl border border-gray-200 p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Invites</p>

                {myInvites.length === 0 ? (
                  <p className="text-sm text-gray-500">No pending invites.</p>
                ) : (
                  <div className="space-y-3">
                    {myInvites.map((inv) => {
                      const aName = agencyNameMap?.[inv.agency_id] || inv.agency_id;
                      return (
                        <div
                          key={inv.invite_id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{aName}</p>
                            <p className="text-xs text-gray-500">
                              Invite ID: <span className="font-mono">{inv.invite_id}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              disabled={rejectingInviteId === inv.invite_id}
                              onClick={() => rejectInvite(inv.invite_id)}
                            >
                              {rejectingInviteId === inv.invite_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Reject'
                              )}
                            </Button>

                            <Button
                              disabled={acceptingInviteId === inv.invite_id}
                              onClick={() => acceptInvite(inv.invite_id, inv.agency_id)}
                            >
                              {acceptingInviteId === inv.invite_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Accept'
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pending Join Requests */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Join Requests</p>

                {myPendingRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">No pending join requests.</p>
                ) : (
                  <div className="space-y-3">
                    {myPendingRequests.map((req) => {
                      const aName = agencyNameMap?.[req.agency_id] || req.agency_id;
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{aName}</p>
                            <p className="text-xs text-gray-500">
                              Request ID: <span className="font-mono">{req.id}</span>
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            disabled={cancelingId === req.id}
                            onClick={() => cancelJoinRequest(req.id)}
                          >
                            {cancelingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Cancel'
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Browse Families */}
      {!isInFamily && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Browse Active Families</h3>

          <div className="mb-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search families by name..."
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No families found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((f) => {
                const count = memberCounts?.[f.id];
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{f.name}</p>

                      {typeof count === 'number' ? (
                        <p className="text-xs text-gray-600 mt-1">{count} members</p>
                      ) : null}
                    </div>

                    <Button
                      onClick={() => requestToJoin(f)}
                      disabled={requestingId === f.id || pendingFamilyRequest}
                      className="min-w-[140px]"
                      variant={pendingFamilyRequest ? 'outline' : 'default'}
                    >
                      {requestingId === f.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : pendingFamilyRequest ? (
                        'Pending'
                      ) : (
                        'Request to Join'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}