import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

      // (A) Try view (source of truth عندك)
      const resView = await supabase
        .from('v_agency_members_list')
        .select('agency_id, user_id, name, avatar_url, profile_id, gems')
        .eq('agency_id', agencyId)
        .limit(limit);

      if (!resView.error) {
        data = resView.data;
      } else {
        // (B) Try RPC fallback (optional)
        const resRpc = await supabase.rpc('get_agency_members_list', {
          p_agency_id: agencyId,
          // p_viewer_id موجود في الدالة عندك - لو احتاجته
          p_viewer_id: currentUserId || null,
        });

        if (!resRpc.error) {
          data = resRpc.data;
        } else {
          error = resView.error || resRpc.error;
        }
      }

      if (error) throw error;

      setRows(Array.isArray(data) ? data : []);
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
  }, [agencyId, limit]);

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

                      {/* gems: على حسب الview هيكون null لغير المسموح */}
                      {m?.gems !== null && m?.gems !== undefined ? (
                        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          💎 {m.gems}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}