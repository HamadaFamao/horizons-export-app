import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, Edit, Ban, Shield, Trash2, Eye } from 'lucide-react';
import CountrySelect from '@/components/CountrySelect';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [banningUser, setBanningUser] = useState(null);
  const [banDuration, setBanDuration] = useState('24');
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  const { toast } = useToast();

  const BAN_OPTIONS = [
    { label: '1 hour',   value: '1' },
    { label: '24 hours', value: '24' },
    { label: '3 days',   value: '72' },
    { label: '7 days',   value: '168' },
    { label: '30 days',  value: '720' },
    { label: 'Permanent', value: '0' },
  ];

  const STAFF_ROLES = [
    { label: 'None',        value: '' },
    { label: 'Manager',     value: 'manager' },
    { label: 'Super Admin', value: 'super_admin' },
    { label: 'Moderator',   value: 'moderator' },
    { label: 'Finance',     value: 'finance' },
  ];

  const handleBanUser = async () => {
    if (!banningUser) return;
    setIsBanning(true);
    try {
      const hours = parseInt(banDuration);
      const bannedUntil = hours === 0 ? null : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('user_bans').upsert({
        user_id: banningUser.user_uuid,
        banned_until: bannedUntil,
        reason: banReason || null,
        is_active: true,
        banned_by: (await supabase.auth.getUser()).data?.user?.id,
      }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: hours === 0 ? '⛔ User permanently banned' : `👢 User banned for ${banDuration}h` });
      setBanningUser(null);
      setBanReason('');
      setBanDuration('24');
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async (userId) => {
    const { error } = await supabase
      .from('user_bans')
      .update({ is_active: false })
      .eq('user_id', userId);
    if (!error) toast({ title: '✅ User unbanned' });
    fetchUsers();
  };

  const handleDeleteAvatar = async (user) => {
    if (!window.confirm('Delete this user\'s avatar?')) return;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('profile_id', user.profile_id);
    if (!error) {
      toast({ title: '🗑️ Avatar deleted' });
      fetchUsers();
    }
  };

  const handleSetStaffRole = async (userId, role) => {
    const { error } = await supabase
      .from('profiles')
      .update({ staff_role: role || null })
      .eq('id', userId);
    if (!error) toast({ title: '✅ Role updated' });
    else toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from('v_users_admin').select('*');
    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,profile_id.eq.${parseInt(searchTerm) || 0}`);
    }
    
    const { data, error } = await query
        .order('profile_created_at', { ascending: false })
        .limit(50);
        
    if (error) {
        toast({ title: "Error fetching users", description: error.message, variant: 'destructive' });
    } else {
        setUsers(data);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleSaveChanges = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    
    const { profile_id, name, gender, age, living_in_code, from_code, avatar_url, bio, occupation, staff_role, user_uuid } = editingUser;

    const { error } = await supabase.from('profiles').update({
        name, gender, age, living_in_code, from_code, avatar_url, bio, occupation
    }).eq('profile_id', profile_id);

    if (error) {
        toast({ title: "Error saving user", description: error.message, variant: 'destructive' });
    } else {
      if (staff_role !== undefined) {
        await supabase.from('profiles').update({ staff_role: staff_role || null }).eq('id', user_uuid);
      }
      toast({ title: "✅ User updated successfully" });
      setEditingUser(null);
      fetchUsers();
    }
    setIsSaving(false);
  };
  
  const handleEditFieldChange = (key, value) => {
    setEditingUser(prev => ({...prev, [key]: value}));
  }

  const handleEditCountryChange = (key, opt) => {
    setEditingUser(prev => ({...prev, [key]: opt?.code || null}));
  }
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Users Management</h1>
      
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input 
          placeholder="Search by name, email, or profile_id..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Profile ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Living In</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : users.map(user => (
              <TableRow key={user.user_uuid}>
                <TableCell className="flex items-center gap-2">
                    <img 
                        src={user.avatar_url || DEFAULT_AVATAR} 
                        onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                        alt="avatar" 
                        className="w-10 h-10 rounded-full object-cover"
                    />
                    <span>{user.name}</span>
                </TableCell>
                <TableCell>{user.profile_id}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.gender}</TableCell>
                <TableCell>{user.age}</TableCell>
                <TableCell>{user.from_country}</TableCell>
                <TableCell>{user.living_in_country}</TableCell>
                <TableCell>{new Date(user.profile_created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setViewingUser(user)} title="View Profile">
                      <Eye className="h-4 w-4" />
                    </Button>
                   <Dialog open={editingUser?.user_uuid === user.user_uuid} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setEditingUser(user)} title="Edit">
                                <Edit className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit User: {editingUser?.name} ({editingUser?.profile_id})</DialogTitle>
                          </DialogHeader>
                          {editingUser && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                <div>
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" value={editingUser.name || ''} onChange={(e) => handleEditFieldChange('name', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="age">Age</Label>
                                    <Input id="age" type="number" value={editingUser.age || ''} onChange={(e) => handleEditFieldChange('age', e.target.valueAsNumber)} />
                                </div>
                                <div>
                                    <Label htmlFor="gender">Gender</Label>
                                    <Select value={editingUser.gender} onValueChange={v => handleEditFieldChange('gender', v)}>
                                        <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                        <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="avatar_url">Avatar URL</Label>
                                    <Input id="avatar_url" value={editingUser.avatar_url || ''} onChange={(e) => handleEditFieldChange('avatar_url', e.target.value)} />
                                </div>
                                <div>
                                    <CountrySelect
                                        label="Living In"
                                        value={editingUser.living_in_code}
                                        onChange={(opt) => handleEditCountryChange('living_in_code', opt)}
                                    />
                                </div>
                                <div>
                                     <CountrySelect
                                        label="From"
                                        value={editingUser.from_code}
                                        onChange={(opt) => handleEditCountryChange('from_code', opt)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="bio">Bio</Label>
                                    <Textarea id="bio" rows={3} value={editingUser.bio || ''} onChange={(e) => handleEditFieldChange('bio', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="occupation">Occupation</Label>
                                    <Input id="occupation" value={editingUser.occupation || ''} onChange={(e) => handleEditFieldChange('occupation', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="staff_role">Staff Role</Label>
                                    <Select value={editingUser.staff_role || ''} onValueChange={v => handleEditFieldChange('staff_role', v)}>
                                        <SelectTrigger><SelectValue placeholder="No role" /></SelectTrigger>
                                        <SelectContent>
                                            {STAFF_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Avatar Preview</Label>
                                    <div className="flex items-center gap-3 mt-1">
                                        <img src={editingUser.avatar_url || DEFAULT_AVATAR} alt="avatar"
                                            className="w-16 h-16 rounded-full object-cover border"
                                            onError={e => e.target.src = DEFAULT_AVATAR} />
                                        <Button variant="outline" size="sm" className="text-red-600"
                                            onClick={() => handleEditFieldChange('avatar_url', '')}>
                                            <Trash2 className="h-4 w-4 mr-1" /> Clear Avatar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" size="sm" 
                      className="text-orange-600 hover:bg-orange-50"
                      onClick={() => { setBanningUser(user); setBanDuration('24'); setBanReason(''); }}
                      title="Ban User">
                      <Ban className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteAvatar(user)}
                      title="Delete Avatar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && <TableRow><TableCell colSpan={9} className="text-center p-4 text-gray-500">No users found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banningUser} onOpenChange={(o) => !o && setBanningUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🚫 Ban User: {banningUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Ban Duration</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BAN_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Reason for ban..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanningUser(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleBanUser} disabled={isBanning}>
              {isBanning ? <Loader2 className="animate-spin" /> : '⛔ Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}