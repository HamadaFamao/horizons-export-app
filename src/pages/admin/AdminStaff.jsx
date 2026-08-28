import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERMISSIONS = [
  { key: 'can_manage_agencies',    label: '🏢 Agencies' },
  { key: 'can_manage_withdrawals', label: '💰 Withdrawals' },
  { key: 'can_manage_rooms',       label: '🎙️ Rooms' },
  { key: 'can_manage_users',       label: '👥 Users' },
  { key: 'can_manage_gifts',       label: '🎁 Gifts' },
  { key: 'can_manage_rewards',     label: '🏆 Rewards' },
  { key: 'can_manage_plans',       label: '📋 Plans' },
  { key: 'can_manage_coins',       label: '🪙 Coins' },
  { key: 'can_manage_finance',     label: '💳 Finance' },
  { key: 'can_manage_reports',     label: '📊 Reports' },
  { key: 'can_manage_banners',     label: '🖼️ Banners' },
  { key: 'can_send_notifications', label: '🔔 Notifications' },
  { key: 'can_manage_settings',    label: '⚙️ Settings' },
  { key: 'can_manage_seed',        label: '🌱 Seed Data' },
  { key: 'can_manage_tools',       label: '🔧 Tools' },
  { key: 'can_manage_staff',       label: '👤 Staff' },
];

const ROLES = ['moderator', 'manager', 'admin'];

const ROLE_COLORS = {
  manager: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  moderator: 'bg-green-100 text-green-700',
};

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="24">👤</text>
  </svg>
`);

export default function AdminStaff() {
  const { toast } = useToast();
  const { staffRole } = useAdminPermissions();
  const isManager = staffRole === 'manager' || staffRole === 'admin';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newProfileId, setNewProfileId] = useState('');
  const [newRole, setNewRole] = useState('moderator');
  const [adding, setAdding] = useState(false);

  const [edits, setEdits] = useState({});

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('v_staff_users').select('*');
      if (error) throw error;
      setStaff(data || []);

      const initial = {};
      (data || []).forEach((member) => {
        initial[member.id] = {
          can_manage_agencies: member.can_manage_agencies,
          can_manage_withdrawals: member.can_manage_withdrawals,
          can_manage_rooms: member.can_manage_rooms,
          can_manage_users: member.can_manage_users,
          can_manage_banners: member.can_manage_banners,
          can_send_notifications: member.can_send_notifications,
          can_manage_finance: member.can_manage_finance,
        };
      });
      setEdits(initial);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const togglePermission = (userId, key) => {
    if (!isManager) return;
    setEdits((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: !prev[userId]?.[key] },
    }));
  };

  const handleSavePermissions = async (userId) => {
    setSavingId(userId);
    try {
      const perms = edits[userId];
      const { data, error } = await supabase.rpc('admin_update_staff_permissions', {
        p_user_id: userId,
        p_can_manage_agencies:    perms.can_manage_agencies,
        p_can_manage_withdrawals: perms.can_manage_withdrawals,
        p_can_manage_rooms:       perms.can_manage_rooms,
        p_can_manage_users:       perms.can_manage_users,
        p_can_manage_banners:     perms.can_manage_banners,
        p_can_send_notifications: perms.can_send_notifications,
        p_can_manage_finance:     perms.can_manage_finance,
        p_can_manage_gifts:       perms.can_manage_gifts,
        p_can_manage_rewards:     perms.can_manage_rewards,
        p_can_manage_plans:       perms.can_manage_plans,
        p_can_manage_coins:       perms.can_manage_coins,
        p_can_manage_reports:     perms.can_manage_reports,
        p_can_manage_settings:    perms.can_manage_settings,
        p_can_manage_seed:        perms.can_manage_seed,
        p_can_manage_tools:       perms.can_manage_tools,
        p_can_manage_staff:       perms.can_manage_staff,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Permissions saved', className: 'bg-green-50 border-green-200 text-green-800' });
      await fetchStaff();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const handleChangeRole = async (userId, role) => {
    if (!isManager) return;
    try {
      const { data, error } = await supabase.rpc('admin_update_staff_role', {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Role updated', className: 'bg-green-50 border-green-200 text-green-800' });
      await fetchStaff();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!isManager) return;
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      const { data, error } = await supabase.rpc('admin_update_staff_role', {
        p_user_id: userId,
        p_role: null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Member removed' });
      await fetchStaff();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleAddMember = async () => {
    if (!newProfileId.trim()) {
      toast({ title: 'Validation', description: 'Profile ID required.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.rpc('admin_add_staff_member', {
        p_profile_id: Number(newProfileId.trim()),
        p_role: newRole,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast({ title: '✅ Member added!', className: 'bg-green-50 border-green-200 text-green-800' });
      setShowAdd(false);
      setNewProfileId('');
      setNewRole('moderator');
      await fetchStaff();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const hasChanges = (member) => {
    const edit = edits[member.id];
    if (!edit) return false;
    return PERMISSIONS.some((perm) => edit[perm.key] !== member[perm.key]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage team members and their permissions</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              size="sm"
              onClick={() => setShowAdd(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Member
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {staff.map((member) => (
            <div key={member.id} className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={member.avatar_url || DEFAULT_AVATAR}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover border"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div>
                    <p className="font-bold text-gray-900">{member.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">#{member.profile_id}</p>
                  </div>
                  {member.has_individual_permissions && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      <Shield className="w-3 h-3 mr-1" /> Custom
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isManager ? (
                    <select
                      className="text-xs border rounded-lg px-2 py-1 font-medium"
                      value={member.staff_role || ''}
                      onChange={(e) => handleChangeRole(member.id, e.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge className={cn('text-xs', ROLE_COLORS[member.staff_role] || 'bg-gray-100 text-gray-700')}>
                      {member.staff_role}
                    </Badge>
                  )}

                  {isManager && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERMISSIONS.map((perm) => {
                  const val = edits[member.id]?.[perm.key] ?? false;
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      disabled={!isManager}
                      onClick={() => togglePermission(member.id, perm.key)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium border transition text-left',
                        val
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400',
                        isManager && 'cursor-pointer hover:opacity-80',
                        !isManager && 'cursor-default',
                      )}
                    >
                      {val ? '✅' : '⬜'} {perm.label}
                    </button>
                  );
                })}
              </div>

              {isManager && hasChanges(member) && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={savingId === member.id}
                    onClick={() => handleSavePermissions(member.id)}
                  >
                    {savingId === member.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...
                      </>
                    ) : (
                      '💾 Save Changes'
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Profile ID</Label>
              <Input
                type="number"
                value={newProfileId}
                onChange={(e) => setNewProfileId(e.target.value)}
                placeholder="e.g. 200150"
                disabled={adding}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={adding}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={adding}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
