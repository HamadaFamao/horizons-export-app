import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

/**
 * AgencyMembersSection
 * - يعرض أعضاء العائلة/الوكالة
 * - يعتمد على view: v_agency_members_list (أو RPC get_agency_members_list كـ fallback)
 * - gems يظهر لصاحب الرصيد نفسه أو للوكيل فقط (والباقي Null) ✅
 *
 * ✅ NEW:
 * - جلب owner_user_id من agencies لتحديد هل الحالي وكيل (Owner) أم لا
 * - زر Leave للعضو (غير الوكيل)
 * - زر Remove/Kick للوكيل لكل عضو (ماعدا الوكيل نفسه)
 */

export default function AgencyMembersSection({
  profile,
  agencyId: agencyIdProp = null,
  title = 'Members',
  limit = 200,
}) {
  const agencyId = useMemo(() => {
    return (
      agencyIdProp ??
      profile?.agency_id ??
      profile?.family_id ??
      profile?.agent_agency_id ??
      profile?.managed_agency_id ??
      null
    );
  }, [agencyIdProp, profile]);

  const currentUserId = profile?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  // ✅ owner / permissions
  const [ownerUserId, setOwnerUserId] = useState(null);
  const isOwner = useMemo(() => {
    return !!currentUserId && !!ownerUserId && currentUserId === ownerUserId;
  }, [currentUserId, ownerUserId]);

  // actions loading
  const [leaving, setLeaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  // member self withdrawal preferences
  const [editingMethodMember, setEditingMethodMember] = useState(null);
  const [methodChoice, setMethodChoice] = useState('agent');
  const [methodNote, setMethodNote] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);

  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [inviteProfileId, setInviteProfileId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [decidingId, setDecidingId] = useState(null);

  // --------
  // Helpers
  // --------
  const openMemberProfile = (m) => {
    if (m?.profile_id) window.location.href = `/user/${m.profile_id}`;
    else if (m?.user_id) window.location.href = `/user/${m.user_id}`;
  };

  // --------
  // Fetch owner_user_id
  // --------
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setOwnerUserId(null);
      if (!agencyId) return;

      try {
        // agencies: (id uuid, owner_user_id uuid)
        const { data, error } = await supabase
          .from('agencies')
          .select('owner_user_id')
          .eq('id', agencyId)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        setOwnerUserId(data?.owner_user_id ?? null);
      } catch (e) {
        console.warn('[AgencyMembersSection] failed to load owner_user_id:', e?.message || e);
        if (mounted) setOwnerUserId(null);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [agencyId]);

  // --------
  // Fetch members
  // --------
  const fetchMembers = async () => {
    setErr('');
    setRows([]);

    if (!agencyId) return;

    setLoading(true);
    try {
      let data = null;
      let error = null;

      // ✅ NEW: استخدم get_agency_members_breakdown للوكيل (فيه gems breakdown كامل)
      // لو مش الوكيل، استخدم الـ view العادي (gems بس)
      if (isOwner) {
        const resBreakdown = await supabase.rpc('get_agency_members_breakdown', {
          p_agency_id: agencyId,
        });
        if (!resBreakdown.error) {
          data = resBreakdown.data;
        } else {
          error = resBreakdown.error;
        }
      } else {
        const resView = await supabase
          .from('v_agency_members_list')
          .select('agency_id, user_id, name, avatar_url, profile_id, gems')
          .eq('agency_id', agencyId)
          .limit(limit);
        if (!resView.error) {
          data = resView.data;
        } else {
          error = resView.error;
        }
      }

      if (error) throw error;

      const baseRows = Array.isArray(data) ? data : [];

      setRows(baseRows);
    } catch (e) {
      console.error('[AgencyMembersSection] load error:', e);
      setErr(e?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await fetchMembers();
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, limit, isOwner]);

  const filtered = useMemo(() => {
    const s = (q || '').trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = (r?.name || '').toLowerCase();
      const pid = String(r?.profile_id || '');
      return name.includes(s) || pid.includes(s);
    });
  }, [rows, q]);

  // --------
  // Actions
  // --------
  const leaveAgency = async () => {
    if (!agencyId) return;
    if (!currentUserId) return;

    const ok = window.confirm('هل أنت متأكد أنك تريد مغادرة العائلة؟');
    if (!ok) return;

    try {
      setLeaving(true);
      setErr('');

      // ✅ Try leave_agency_v2 then fallback leave_agency
      let res = await supabase.rpc('leave_agency_v2');
      if (res?.error) {
        res = await supabase.rpc('leave_agency');
      }
      if (res?.error) throw res.error;

      // بعد المغادرة: ننظف الواجهة
      await fetchMembers();

      // غالباً ProfilePage هيجيب العضوية من v_user_agency ويختفي Family تلقائياً بعد refresh
      window.location.reload();
    } catch (e) {
      console.error('[AgencyMembersSection] leaveAgency error:', e);
      setErr(e?.message || 'Failed to leave agency');
    } finally {
      setLeaving(false);
    }
  };

  const removeMember = async (m) => {
    if (!isOwner) return;
    if (!m?.profile_id && !m?.user_id) return;

    const name = m?.name || 'هذا العضو';
    const ok = window.confirm(`هل أنت متأكد أنك تريد إخراج ${name} من العائلة؟`);
    if (!ok) return;

    try {
      setRemovingUserId(m?.user_id || 'x');
      setErr('');

      // ✅ Prefer: agent_remove_member_from_agency(p_member_profile_id, p_note)
      if (m?.profile_id) {
        const { error } = await supabase.rpc('agent_remove_member_from_agency', {
          p_member_profile_id: m.profile_id,
          p_note: null,
        });

        if (!error) {
          await fetchMembers();
          return;
        }

        // fallback to remove_agency_member if exists
        const fallback = await supabase.rpc('remove_agency_member', {
          p_member_id: m.user_id,
          p_agency_id: agencyId,
          p_removed_by: currentUserId,
          p_reason: null,
        });

        if (fallback?.error) throw (fallback?.error || error);
      } else {
        // fallback فقط
        const fallback = await supabase.rpc('remove_agency_member', {
          p_member_id: m.user_id,
          p_agency_id: agencyId,
          p_removed_by: currentUserId,
          p_reason: null,
        });

        if (fallback?.error) throw fallback.error;
      }

      await fetchMembers();
    } catch (e) {
      console.error('[AgencyMembersSection] removeMember error:', e);
      setErr(e?.message || 'Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  };

  const openMethodModal = (m) => {
    if (!m?.user_id || !currentUserId || m.user_id !== currentUserId) return;
    setEditingMethodMember(m);
    setMethodChoice(m?.withdrawal_method === 'self' ? 'self' : 'agent');
    setMethodNote(m?.withdrawal_note || '');
  };

  const saveWithdrawalMethod = async () => {
    if (!agencyId || !currentUserId || !editingMethodMember) return;

    if (methodChoice === 'self' && !String(methodNote || '').trim()) {
      setErr('Please write your preferred payout method note when choosing Self.');
      return;
    }

    try {
      setSavingMethod(true);
      setErr('');

      const payload = {
        withdrawal_method: methodChoice,
        withdrawal_note: methodChoice === 'self' ? String(methodNote || '').trim() : null,
      };

      const { error } = await supabase
        .from('agency_memberships')
        .update(payload)
        .eq('user_id', currentUserId)
        .eq('agency_id', agencyId)
        .is('left_at', null);

      if (error) throw error;

      await fetchMembers();
      setEditingMethodMember(null);
    } catch (e) {
      console.error('[AgencyMembersSection] saveWithdrawalMethod error:', e);
      setErr(e?.message || 'Failed to update withdrawal method');
    } finally {
      setSavingMethod(false);
    }
  };

  const fetchJoinRequests = async () => {
    if (!isOwner || !agencyId) return;
    setJoinRequestsLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        'list_agency_join_requests_for_dashboard',
        { p_agency_id: agencyId }
      );
      if (error) throw error;
      setJoinRequests(
        (data || []).filter((r) => r.status === 'pending')
      );
    } catch (e) {
      console.error(e);
    } finally {
      setJoinRequestsLoading(false);
    }
  };

  const handleDecideRequest = async (requestId, approve) => {
    try {
      setDecidingId(requestId);
      const { error } = await supabase.rpc('decide_agency_join_request', {
        p_request_id: requestId,
        p_approve: approve,
      });
      if (error) throw error;
      await fetchJoinRequests();
      await fetchMembers();
    } catch (e) {
      setErr(e?.message || 'Failed');
    } finally {
      setDecidingId(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteProfileId.trim()) return;
    try {
      setInviting(true);
      const { error } = await supabase.rpc(
        'send_agency_invite_by_profile_id', {
          p_invited_profile_id: Number(inviteProfileId.trim()),
        }
      );
      if (error) throw error;
      setInviteProfileId('');
      setErr('');
      alert('✅ Invite sent!');
    } catch (e) {
      setErr(e?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    if (isOwner) fetchJoinRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, agencyId]);

  if (!agencyId) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Browse members and open their profiles.
          </p>

          {/* ✅ Owner badge */}
          {isOwner ? (
            <p className="text-xs text-emerald-700 mt-2">
              أنت الوكيل (Owner)
            </p>
          ) : ownerUserId ? (
            <p className="text-xs text-gray-500 mt-2">
              الوكيل موجود (Owner)
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            {rows?.length ? `${rows.length} member(s)` : ''}
          </div>

          {/* ✅ Leave button (for members only) */}
          {!isOwner && (
            <Button
              variant="outline"
              onClick={leaveAgency}
              disabled={leaving}
              className="whitespace-nowrap"
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Leave Family'
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or profile id..."
        />
      </div>

      {isOwner && (
        <div className="mb-6 space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-semibold text-indigo-900 mb-2">
              📨 Invite Member
            </p>
            <div className="flex gap-2">
              <Input
                value={inviteProfileId}
                onChange={(e) => setInviteProfileId(e.target.value)}
                placeholder="Enter Profile ID..."
                type="number"
                className="flex-1"
              />
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteProfileId.trim()}
                className="shrink-0"
              >
                {inviting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Invite'
                }
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-amber-900">
                📋 Join Requests
                {joinRequests.length > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {joinRequests.length}
                  </span>
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchJoinRequests}
                disabled={joinRequestsLoading}
              >
                {joinRequestsLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : '↻'
                }
              </Button>
            </div>

            {joinRequests.length === 0 ? (
              <p className="text-sm text-amber-700">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {joinRequests.map((req) => (
                  <div
                    key={req.request_id}
                    className="flex items-center justify-between gap-3 bg-white rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {req.requester_avatar_url ? (
                        <img
                          src={req.requester_avatar_url}
                          alt={req.requester_name}
                          className="w-10 h-10 rounded-full object-cover border bg-gray-100 cursor-pointer hover:opacity-80 transition"
                          onClick={() => window.open(
                            `/user/${req.requester_profile_id}`,
                            '_blank'
                          )}
                          onError={(e) => {
                            e.currentTarget.src = '';
                          }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg cursor-pointer hover:opacity-80 transition"
                          onClick={() => window.open(
                            `/user/${req.requester_profile_id}`,
                            '_blank'
                          )}
                        >
                          👤
                        </div>
                      )}
                      <div className="min-w-0">
                        <p
                          className="font-medium text-sm text-slate-900 truncate cursor-pointer hover:text-indigo-600 transition"
                          onClick={() => window.open(
                            `/user/${req.requester_profile_id}`,
                            '_blank'
                          )}
                        >
                          {req.requester_name || 'User'}
                        </p>
                        <p className="text-xs text-slate-500">
                          ID: {req.requester_profile_id || '—'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={decidingId === req.request_id}
                        onClick={() => handleDecideRequest(req.request_id, false)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={decidingId === req.request_id}
                        onClick={() => handleDecideRequest(req.request_id, true)}
                      >
                        {decidingId === req.request_id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'Accept'
                        }
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4 whitespace-pre-line">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading members...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No members found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const isMe = currentUserId && m?.user_id === currentUserId;
            const isThisOwner = ownerUserId && m?.user_id === ownerUserId;

            return (
              <div
                key={m.user_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {m?.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m?.name || 'member'}
                      className="w-10 h-10 rounded-full object-cover bg-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {m?.name || '—'}{' '}
                      {isMe ? <span className="text-xs text-gray-500">(You)</span> : null}
                      {isThisOwner ? (
                        <span className="ml-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          Agent
                        </span>
                      ) : null}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {m?.profile_id ? (
                        <span className="text-xs text-gray-600">
                          ID: <span className="font-mono">{m.profile_id}</span>
                        </span>
                      ) : null}

                      {m?.withdrawal_method ? (
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 border ${
                            m.withdrawal_method === 'agent'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-gray-700 bg-gray-50 border-gray-200'
                          }`}
                        >
                          {m.withdrawal_method === 'agent' ? 'Via Agent' : 'Self'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                          Not set
                        </span>
                      )}

                      {/* gems breakdown (للوكيل): إجمالي + قابل للسحب + نصيب الوكيل */}
                      {m?.total_gems !== null && m?.total_gems !== undefined ? (
                        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          💎 {m.total_gems} total
                        </span>
                      ) : m?.gems !== null && m?.gems !== undefined ? (
                        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          💎 {m.gems}
                        </span>
                      ) : null}

                      {m?.withdrawable_gems !== null && m?.withdrawable_gems !== undefined && isOwner ? (
                        <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                          ✅ {m.withdrawable_gems} withdrawable (${Number(m.payout_usd || 0).toFixed(2)})
                        </span>
                      ) : null}

                      {isOwner && m?.user_id !== ownerUserId && m?.agent_share_gems ? (
                        <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                          🤝 Agent share: {m.agent_share_gems}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isMe && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMethodModal(m)}
                      className="whitespace-nowrap"
                    >
                      Change
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => openMemberProfile(m)}>
                    View Profile
                  </Button>

                  {/* ✅ Remove button: only owner, not for himself */}
                  {isOwner && !isThisOwner && !isMe && (
                    <Button
                      variant="destructive"
                      onClick={() => removeMember(m)}
                      disabled={removingUserId === (m?.user_id || 'x')}
                      className="whitespace-nowrap"
                    >
                      {removingUserId === (m?.user_id || 'x') ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        'Remove'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingMethodMember} onOpenChange={(open) => !open && setEditingMethodMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Withdrawal Method</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Choose Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethodChoice('agent')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    methodChoice === 'agent'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Via Agent
                </button>
                <button
                  type="button"
                  onClick={() => setMethodChoice('self')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    methodChoice === 'self'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Self
                </button>
              </div>
            </div>

            {methodChoice === 'self' && (
              <div className="space-y-2">
                <Label>Preferred Payout Method</Label>
                <Textarea
                  value={methodNote}
                  onChange={(e) => setMethodNote(e.target.value.slice(0, 300))}
                  placeholder="Write your preferred payout details..."
                  maxLength={300}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-gray-500 text-right">{methodNote.length}/300</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingMethodMember(null)} disabled={savingMethod}>
              Cancel
            </Button>
            <Button onClick={saveWithdrawalMethod} disabled={savingMethod}>
              {savingMethod ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}