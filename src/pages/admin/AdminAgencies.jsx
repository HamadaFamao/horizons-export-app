import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import CycleCountdown from '@/components/CycleCountdown';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 20;
const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="24">👤</text>
    </svg>
  `);

export default function AdminAgencies() {
  const { toast } = useToast();
  const { staffRole } = useAdminPermissions();
  const isManager = staffRole === 'manager';

  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [managingAgency, setManagingAgency] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [openCycles, setOpenCycles] = useState({});

  // Create Agency
  const [showCreateAgency, setShowCreateAgency] = useState(false);
  const [newAgencyOwnerProfileId, setNewAgencyOwnerProfileId] = useState('');
  const [creatingAgency, setCreatingAgency] = useState(false);

  // Create Recharge Agent
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentProfileId, setNewAgentProfileId] = useState('');
  const [newAgentCountry, setNewAgentCountry] = useState('');
  const [newAgentContact, setNewAgentContact] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Open Cycle for Selected
  const [selectedAgencyOwners, setSelectedAgencyOwners] = useState(new Set());
  const [openingCycleForAll, setOpeningCycleForAll] = useState(false);
  const [batchCycleDeadline, setBatchCycleDeadline] = useState('');

  const [newAgencyName, setNewAgencyName] = useState('');
  const [newOwnerProfileId, setNewOwnerProfileId] = useState('');
  const [banReason, setBanReason] = useState('');

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  const fetchAgencies = async (currentPage = page) => {
    setLoading(true);
    try {
      let query = supabase
        .from('v_agencies_with_members_count')
        .select('*', { count: 'exact' });

      if (statusFilter === 'Active') {
        query = query.eq('is_active', true);
      }
      if (statusFilter === 'Banned') {
        query = query.eq('is_active', false);
      }
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm.trim()}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      const ownerIds = [...new Set((data || []).map((a) => a.owner_user_id).filter(Boolean))];
      let ownersMap = {};

      if (ownerIds.length > 0) {
        const { data: owners, error: ownersErr } = await supabase
          .from('profiles')
          .select('id, name, profile_id')
          .in('id', ownerIds);
        if (ownersErr) throw ownersErr;
        (owners || []).forEach((o) => {
          ownersMap[o.id] = o;
        });
      }

      const rows = (data || []).map((a) => ({
        ...a,
        owner: ownersMap[a.owner_user_id] || null,
      }));

      setAgencies(rows);
      setTotalCount(count || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch agencies.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenCycles = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_withdrawal_cycles')
        .select('agency_user_id, id, cycle_month, locked_gems, deadline, status')
        .eq('status', 'open');

      if (error) throw error;

      // نعمل map: agency_user_id → cycle
      const map = {};
      (data || []).forEach((c) => {
        map[c.agency_user_id] = c;
      });
      setOpenCycles(map);
    } catch (e) {
      console.error('fetchOpenCycles error:', e);
    }
  };

  const handleCreateAgency = async () => {
    if (!newAgencyName.trim() || !newAgencyOwnerProfileId.trim()) {
      toast({ title: 'Validation', description: 'Name and owner profile ID required.', variant: 'destructive' });
      return;
    }
    setCreatingAgency(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_agency_by_profile_id', {
        p_name: newAgencyName.trim(),
        p_owner_profile_id: Number(newAgencyOwnerProfileId.trim()),
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Agency created!', className: 'bg-green-50 border-green-200 text-green-800' });
      setShowCreateAgency(false);
      setNewAgencyName('');
      setNewAgencyOwnerProfileId('');
      fetchAgencies(0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingAgency(false);
    }
  };

  const handleCreateRechargeAgent = async () => {
    if (!newAgentName.trim() || !newAgentProfileId.trim()) {
      toast({ title: 'Validation', description: 'Name and profile ID required.', variant: 'destructive' });
      return;
    }
    setCreatingAgent(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_recharge_agent', {
        p_name: newAgentName.trim(),
        p_owner_profile_id: Number(newAgentProfileId.trim()),
        p_country_code: newAgentCountry.trim() || null,
        p_contact_info: newAgentContact.trim() || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Recharge agent created!', className: 'bg-green-50 border-green-200 text-green-800' });
      setShowCreateAgent(false);
      setNewAgentName(''); setNewAgentProfileId('');
      setNewAgentCountry(''); setNewAgentContact('');
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingAgent(false);
    }
  };

  const toggleAgencySelection = (ownerUserId) => {
    setSelectedAgencyOwners((prev) => {
      const next = new Set(prev);
      if (next.has(ownerUserId)) next.delete(ownerUserId);
      else next.add(ownerUserId);
      return next;
    });
  };

  const handleOpenCycleForSelected = async () => {
    if (selectedAgencyOwners.size === 0) {
      toast({ title: 'No agencies selected', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Open withdrawal cycle for ${selectedAgencyOwners.size} agency/agencies?`)) return;

    setOpeningCycleForAll(true);
    let success = 0, failed = 0;
    for (const ownerUserId of selectedAgencyOwners) {
      try {
        const { data, error } = await supabase.rpc('open_agency_cycle_for', {
          p_agency_user_id: ownerUserId,
          p_note: null,
          p_deadline: batchCycleDeadline ? new Date(batchCycleDeadline).toISOString() : null,
        });
        if (error || data?.success === false) failed++;
        else success++;
      } catch {
        failed++;
      }
    }
    toast({
      title: `Done: ${success} opened, ${failed} failed`,
      className: success > 0 ? 'bg-green-50 border-green-200 text-green-800' : undefined,
      variant: failed > 0 && success === 0 ? 'destructive' : undefined,
    });
    setSelectedAgencyOwners(new Set());
    fetchAgencies(0);
    fetchOpenCycles();
    setOpeningCycleForAll(false);
  };

  const fetchMembers = async (agencyId) => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_agency_members', {
        p_agency_id: agencyId
      });

      if (error) throw error;

      setMembers(data || []);
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch members.', variant: 'destructive' });
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchAgencies(0);
    fetchOpenCycles();
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (page === 0) return;
    fetchAgencies(page);
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchAgencies(0);
  };

  const handleOpenManage = async (agency) => {
    setManagingAgency(agency);
    setNewAgencyName(agency?.name || '');
    setNewOwnerProfileId('');
    setBanReason('');
    await fetchMembers(agency.id);
  };

  const handleSaveName = async () => {
    if (!managingAgency || updating) return;
    if (!newAgencyName.trim()) {
      toast({ title: 'Validation', description: 'Agency name is required.', variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ name: newAgencyName.trim() })
        .eq('id', managingAgency.id);

      if (error) throw error;

      toast({ title: '✅ Name updated' });
      setManagingAgency((prev) => (prev ? { ...prev, name: newAgencyName.trim() } : prev));
      fetchAgencies(page);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeOwner = async () => {
    if (!managingAgency || updating) return;
    if (!newOwnerProfileId.trim()) {
      toast({ title: 'Validation', description: 'Enter new owner profile ID.', variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const oldOwnerId = managingAgency.owner_user_id;

      const { data: newOwner, error: ownerErr } = await supabase
        .from('profiles')
        .select('id, name, profile_id')
        .eq('profile_id', newOwnerProfileId.trim())
        .single();

      if (ownerErr || !newOwner) {
        throw new Error(ownerErr?.message || 'Owner profile not found.');
      }

      const { error: agencyErr } = await supabase
        .from('agencies')
        .update({ owner_user_id: newOwner.id })
        .eq('id', managingAgency.id);

      if (agencyErr) throw agencyErr;

      const { error: upsertErr } = await supabase
        .from('agency_memberships')
        .upsert(
          {
            agency_id: managingAgency.id,
            user_id: newOwner.id,
            role: 'owner',
            left_at: null,
          },
          { onConflict: 'agency_id,user_id' }
        );

      if (upsertErr) throw upsertErr;

      if (oldOwnerId) {
        const { error: oldOwnerErr } = await supabase
          .from('agency_memberships')
          .update({ role: 'member' })
          .eq('agency_id', managingAgency.id)
          .eq('user_id', oldOwnerId)
          .is('left_at', null);

        if (oldOwnerErr) throw oldOwnerErr;
      }

      toast({ title: '✅ Agency owner changed' });
      setManagingAgency((prev) =>
        prev
          ? {
              ...prev,
              owner_user_id: newOwner.id,
              owner: {
                id: newOwner.id,
                name: newOwner.name,
                profile_id: newOwner.profile_id,
              },
            }
          : prev
      );
      setNewOwnerProfileId('');
      await fetchMembers(managingAgency.id);
      fetchAgencies(page);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleBanAgency = async () => {
    if (!managingAgency || updating) return;
    if (!window.confirm(`Ban agency "${managingAgency.name}"?`)) return;
    if (!banReason.trim()) {
      toast({ title: 'Validation', description: 'Please provide ban reason.', variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const authResult = await supabase.auth.getUser();
      const adminId = authResult?.data?.user?.id || null;

      const { error } = await supabase
        .from('agencies')
        .update({
          is_active: false,
          banned_at: new Date().toISOString(),
          banned_by: adminId,
          ban_reason: banReason.trim(),
        })
        .eq('id', managingAgency.id);

      if (error) throw error;

      toast({ title: '⛔ Agency banned' });
      setManagingAgency((prev) => (prev ? { ...prev, is_active: false } : prev));
      fetchAgencies(page);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleUnbanAgency = async () => {
    if (!managingAgency || updating) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          is_active: true,
          banned_at: null,
          banned_by: null,
          ban_reason: null,
        })
        .eq('id', managingAgency.id);

      if (error) throw error;

      toast({ title: '✅ Agency unbanned' });
      setManagingAgency((prev) => (prev ? { ...prev, is_active: true } : prev));
      fetchAgencies(page);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!managingAgency || !memberUserId || updating) return;
    if (!window.confirm('Remove this member from agency?')) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('agency_memberships')
        .update({ left_at: new Date().toISOString() })
        .eq('agency_id', managingAgency.id)
        .eq('user_id', memberUserId)
        .is('left_at', null);

      if (error) throw error;

      toast({ title: '✅ Member removed' });
      await fetchMembers(managingAgency.id);
      fetchAgencies(page);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Agencies Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateAgent(true)}
            className="text-purple-600 border-purple-200 hover:bg-purple-50">
            ➕ Recharge Agent
          </Button>
          <Button size="sm" onClick={() => setShowCreateAgency(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white">
            ➕ Create Agency
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchAgencies(page)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="Search by agency name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedAgencyOwners.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl mb-4">
          <span className="text-sm font-semibold text-indigo-800">
            {selectedAgencyOwners.size} selected
          </span>
          <Input
            type="datetime-local"
            className="h-8 text-xs w-48"
            value={batchCycleDeadline}
            onChange={(e) => setBatchCycleDeadline(e.target.value)}
            placeholder="Deadline (optional)"
          />
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={openingCycleForAll}
            onClick={handleOpenCycleForSelected}
          >
            {openingCycleForAll ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Opening...</>
            ) : (
              `🔓 Open Cycle for ${selectedAgencyOwners.size}`
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedAgencyOwners(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="accent-indigo-600"
                  checked={selectedAgencyOwners.size === agencies.length && agencies.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAgencyOwners(new Set(agencies.map(a => a.owner_user_id).filter(Boolean)));
                    } else {
                      setSelectedAgencyOwners(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <Loader2 className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : agencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center p-4 text-slate-500">
                  No agencies found.
                </TableCell>
              </TableRow>
            ) : (
              agencies.map((agency) => (
                <TableRow key={agency.id} className={!agency.is_active ? 'bg-red-50' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="accent-indigo-600 cursor-pointer"
                      checked={selectedAgencyOwners.has(agency.owner_user_id)}
                      onChange={() => toggleAgencySelection(agency.owner_user_id)}
                      disabled={!agency.owner_user_id}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{agency.name || '—'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{agency.owner?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">#{agency.owner?.profile_id || '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-semibold">{agency.members_count ?? 0}</TableCell>
                  <TableCell>
                    {agency.is_active ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Banned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {agency.created_at ? new Date(agency.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    {openCycles[agency.owner_user_id] ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-emerald-600 font-semibold">
                          🔓 Open ({openCycles[agency.owner_user_id].locked_gems?.toLocaleString()} 💎)
                        </span>
                        {openCycles[agency.owner_user_id].deadline ? (
                          <CycleCountdown
                            deadline={openCycles[agency.owner_user_id].deadline}
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No deadline</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenManage(agency)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4 px-2">
        <span className="text-sm text-slate-500">
          Showing {Math.min(page * PAGE_SIZE + 1, totalCount)}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} agencies
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <span className="text-sm font-medium">Page {page + 1} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={showCreateAgency} onOpenChange={setShowCreateAgency}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Agency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input
                value={newAgencyName}
                onChange={(e) => setNewAgencyName(e.target.value)}
                placeholder="Agency name..."
                disabled={creatingAgency}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Profile ID</Label>
              <Input
                type="number"
                value={newAgencyOwnerProfileId}
                onChange={(e) => setNewAgencyOwnerProfileId(e.target.value)}
                placeholder="e.g. 200163"
                disabled={creatingAgency}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateAgency(false)} disabled={creatingAgency}>
              Cancel
            </Button>
            <Button onClick={handleCreateAgency} disabled={creatingAgency}
              className="bg-indigo-600 hover:bg-indigo-700">
              {creatingAgency ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Agency'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateAgent} onOpenChange={setShowCreateAgent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Recharge Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="Agent name..." disabled={creatingAgent} />
            </div>
            <div className="space-y-2">
              <Label>Profile ID</Label>
              <Input type="number" value={newAgentProfileId}
                onChange={(e) => setNewAgentProfileId(e.target.value)}
                placeholder="e.g. 200150" disabled={creatingAgent} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Country Code</Label>
                <Input value={newAgentCountry} onChange={(e) => setNewAgentCountry(e.target.value)}
                  placeholder="e.g. EG" disabled={creatingAgent} />
              </div>
              <div className="space-y-2">
                <Label>Contact Info</Label>
                <Input value={newAgentContact} onChange={(e) => setNewAgentContact(e.target.value)}
                  placeholder="WhatsApp/Phone..." disabled={creatingAgent} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateAgent(false)} disabled={creatingAgent}>
              Cancel
            </Button>
            <Button onClick={handleCreateRechargeAgent} disabled={creatingAgent}
              className="bg-purple-600 hover:bg-purple-700">
              {creatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managingAgency} onOpenChange={(open) => !open && setManagingAgency(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Agency</DialogTitle>
          </DialogHeader>

          {managingAgency && (
            <div className="space-y-6 py-1">
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-semibold">Agency:</span> {managingAgency.name}
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h3 className="font-semibold">1. Change Name</h3>
                <div className="flex gap-2">
                  <Input
                    value={newAgencyName}
                    onChange={(e) => setNewAgencyName(e.target.value)}
                    placeholder="Agency name"
                    disabled={updating}
                  />
                  <Button onClick={handleSaveName} disabled={updating || !newAgencyName.trim()}>
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h3 className="font-semibold">2. Change Owner</h3>
                <div className="text-sm text-slate-500">
                  Current owner: {managingAgency.owner?.name || 'Unknown'} (#{managingAgency.owner?.profile_id || '—'})
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newOwnerProfileId}
                    onChange={(e) => setNewOwnerProfileId(e.target.value)}
                    placeholder="Enter new owner profile_id"
                    disabled={updating}
                  />
                  <Button onClick={handleChangeOwner} disabled={updating || !newOwnerProfileId.trim() || !isManager}>
                    Change Owner
                  </Button>
                </div>
                {!isManager && (
                  <p className="text-xs text-amber-600">Only manager can change agency owner.</p>
                )}
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h3 className="font-semibold">3. Ban / Unban Agency</h3>
                {managingAgency.is_active ? (
                  <>
                    <Label>Ban Reason</Label>
                    <Textarea
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Why are you banning this agency?"
                      disabled={updating}
                      maxLength={500}
                    />
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleBanAgency}
                      disabled={updating || !banReason.trim() || !isManager}
                    >
                      Ban Agency
                    </Button>
                    {!isManager && (
                      <p className="text-xs text-amber-600">Only manager can ban agencies.</p>
                    )}
                  </>
                ) : (
                  <Button onClick={handleUnbanAgency} disabled={updating || !isManager}>
                    Unban Agency
                  </Button>
                )}
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h3 className="font-semibold">4. Members</h3>

                {loadingMembers ? (
                  <div className="py-6 text-center">
                    <Loader2 className="mx-auto animate-spin" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-sm text-slate-500">No active members found.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-3 border rounded-lg p-3">
                        <img
                          src={m.avatar_url || DEFAULT_AVATAR}
                          alt={m.name || 'member'}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                          className="w-10 h-10 rounded-full object-cover bg-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{m.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">#{m.profile_id || '—'}</p>
                          <p className="text-xs text-slate-500">
                            Joined: {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Withdrawal: {m.withdrawal_method || '—'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleRemoveMember(m.user_id)}
                          disabled={updating || m.role === 'owner'}
                          title={m.role === 'owner' ? 'Owner cannot be removed' : 'Remove from agency'}
                        >
                          Remove from agency
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManagingAgency(null)} disabled={updating}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
