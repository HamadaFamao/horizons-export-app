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
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import CountrySelect from '@/components/CountrySelect';
import { DEFAULT_AVATAR } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import { useRef } from 'react';

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
  const addPhotoInputRef = useRef(null);

  const { staffRole } = useAdminPermissions();
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
    { label: '— None',        value: 'none' },
    { label: '👑 Manager',     value: 'manager' },
    { label: '🔵 Super Admin', value: 'super_admin' },
    { label: '🟢 Moderator',   value: 'moderator' },
    { label: '🟡 Finance',     value: 'finance' },
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
    
    const { profile_id, name, gender, age, living_in_code, from_code, avatar_url, bio, occupation, marital_status, lookingfor, staff_role, user_uuid } = editingUser;
    console.log('[SAVE_DEBUG]', { 
      profile_id, user_uuid, staff_role,
      gender: editingUser.gender,
      from_code: editingUser.from_code,
      living_in_code: editingUser.living_in_code,
      marital_status: editingUser.marital_status,
      lookingfor: editingUser.lookingfor
    });

    const { error } = await supabase.from('profiles').update({
      name, gender, age, living_in_code, from_code, avatar_url, bio, occupation, marital_status, lookingfor
    }).eq('profile_id', profile_id);

    if (error) {
        toast({ title: "Error saving user", description: error.message, variant: 'destructive' });
    } else {
      // save staff_role separately using profile_id (more reliable)
      const newStaffRole = (staff_role === 'none' || !staff_role) ? null : staff_role;
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ staff_role: newStaffRole })
        .eq('profile_id', profile_id);
      
      if (roleError) {
        console.error('[STAFF_ROLE_UPDATE_ERROR]', roleError);
        toast({ title: "⚠️ Profile saved but role update failed", description: roleError.message, variant: 'destructive' });
      } else {
        toast({ title: "✅ User updated successfully" });
      }
      setEditingUser(null);
      fetchUsers();
    }
    setIsSaving(false);
  };
  
  const handleEditFieldChange = (key, value) => {
    setEditingUser(prev => ({...prev, [key]: value}));
  }

  const parsePhotos = (photos) => {
    if (!photos) return [];
    if (Array.isArray(photos)) return photos;
    try { return JSON.parse(photos); } catch { return []; }
  };

  const handleEditCountryChange = (key, opt) => {
    console.log('[COUNTRY_SELECT]', key, opt);
    const code = opt?.code || opt?.value || opt || null;
    setEditingUser(prev => ({...prev, [key]: code}));
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
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                                    <select
                                        value={editingUser.gender || ''}
                                        onChange={e => handleEditFieldChange('gender', e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    >
                                        <option value="">Select gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
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
                                  <Label htmlFor="marital_status">Marital Status</Label>
                                  <select
                                    value={editingUser.marital_status || ''}
                                    onChange={e => handleEditFieldChange('marital_status', e.target.value || null)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  >
                                    <option value="">—</option>
                                    <option value="single">Single</option>
                                    <option value="married">Married</option>
                                    <option value="divorced">Divorced</option>
                                    <option value="widowed">Widowed</option>
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="lookingfor">Looking For</Label>
                                  <select
                                    value={editingUser.lookingfor || ''}
                                    onChange={e => handleEditFieldChange('lookingfor', e.target.value || null)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  >
                                    <option value="">—</option>
                                    <option value="friendship">Friendship</option>
                                    <option value="dating">Dating</option>
                                    <option value="relationship">Relationship</option>
                                    <option value="marriage">Marriage</option>
                                  </select>
                                </div>
                                {staffRole === 'manager' && (
                                  <div>
                                      <Label htmlFor="staff_role">Staff Role</Label>
                                      <select
                                          value={(editingUser.staff_role || 'none').toLowerCase()}
                                          onChange={e => handleEditFieldChange('staff_role', e.target.value === 'none' ? null : e.target.value)}
                                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                                      >
                                          {STAFF_ROLES.map(r => (
                                              <option key={r.value} value={r.value}>{r.label}</option>
                                          ))}
                                      </select>
                                      <p className="text-xs text-slate-400 mt-1">
                                          Current: {editingUser.staff_role || 'none'}
                                      </p>
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                    <Label>Avatar Preview</Label>
                                    <div className="flex items-center gap-3 mt-1">
                                        <img src={editingUser.avatar_url || DEFAULT_AVATAR} alt="avatar"
                                            className="w-16 h-16 rounded-full object-cover border"
                                            onError={e => e.target.src = DEFAULT_AVATAR} />
                                        <div className="flex flex-col gap-2">
                                            <label className="cursor-pointer">
                                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50 transition">
                                                    📤 Upload Avatar
                                                </span>
                                                <input type="file" accept="image/*" className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const ext = file.name.split('.').pop();
                                                        const path = `${editingUser.user_uuid}/${Date.now()}.${ext}`;
                                                        const { error: upErr } = await supabase.storage
                                                            .from('profile-photos')
                                                            .upload(path, file, { upsert: true });
                                                        if (upErr) { toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' }); return; }
                                                        const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
                                                        handleEditFieldChange('avatar_url', urlData.publicUrl);
                                                        toast({ title: '✅ Avatar uploaded' });
                                                    }}
                                                />
                                            </label>
                                            <Button variant="outline" size="sm" className="text-red-600"
                                                onClick={() => handleEditFieldChange('avatar_url', null)}>
                                                <Trash2 className="h-4 w-4 mr-1" /> Clear Avatar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 border-t pt-4 mt-2">
                                    <Label className="text-base font-semibold">📸 Profile Photos ({parsePhotos(editingUser.photos).length})</Label>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {parsePhotos(editingUser.photos).map((photo) => (
                                            <div key={photo.id} className="relative group rounded-lg overflow-hidden border aspect-square bg-slate-100">
                                                <img src={photo.url} alt="photo"
                                                    className="w-full h-full object-cover"
                                                    onError={e => e.target.src = DEFAULT_AVATAR} />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-1">
                                                    {!photo.is_primary && (
                                                        <button
                                                            className="text-xs text-white bg-blue-500 rounded px-2 py-1 w-full text-center"
                                                            onClick={async () => {
                                                                await supabase.from('photos').update({ is_primary: false }).eq('user_id', editingUser.user_uuid);
                                                                await supabase.from('photos').update({ is_primary: true }).eq('id', photo.id);
                                                                await supabase.from('profiles').update({ avatar_url: photo.url }).eq('id', editingUser.user_uuid);
                                                                handleEditFieldChange('avatar_url', photo.url);
                                                                const updated = parsePhotos(editingUser.photos).map(p => ({ ...p, is_primary: p.id === photo.id }));
                                                                handleEditFieldChange('photos', updated);
                                                                toast({ title: '⭐ Set as primary' });
                                                            }}
                                                        >⭐ Set Primary</button>
                                                    )}
                                                    <button
                                                        className="text-xs text-white bg-red-500 rounded px-2 py-1 w-full text-center"
                                                        onClick={async () => {
                                                            if (!window.confirm('Delete this photo?')) return;
                                                            const { error } = await supabase.from('photos').delete().eq('id', photo.id);
                                                            if (!error) {
                                                                const updated = parsePhotos(editingUser.photos).filter(p => p.id !== photo.id);
                                                                handleEditFieldChange('photos', updated);
                                                                toast({ title: '🗑️ Photo deleted' });
                                                            }
                                                        }}
                                                    >🗑️ Delete</button>
                                                </div>
                                                {photo.is_primary && (
                                                    <div className="absolute top-1 left-1 bg-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded">⭐ PRIMARY</div>
                                                )}
                                            </div>
                                        ))}

                                        <div className="cursor-pointer aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition"
                                            onClick={() => addPhotoInputRef.current?.click()}>
                                            <span className="text-3xl text-slate-400">+</span>
                                            <span className="text-xs text-slate-500 mt-1">Add Photo</span>
                                            <input ref={addPhotoInputRef} type="file" accept="image/*" style={{display:'none'}}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const ext = file.name.split('.').pop();
                                                    const path = `${editingUser.user_uuid}/${Date.now()}.${ext}`;
                                                    const { error: upErr } = await supabase.storage
                                                        .from('profile-photos')
                                                        .upload(path, file, { upsert: false });
                                                    if (upErr) { toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' }); return; }
                                                    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
                                                    const isPrimary = parsePhotos(editingUser.photos).length === 0;
                                                    const { data: newPhoto, error: dbErr } = await supabase.from('photos').insert({
                                                        user_id: editingUser.user_uuid,
                                                        profile_id: editingUser.profile_id,
                                                        url: urlData.publicUrl,
                                                        is_primary: isPrimary,
                                                        is_public: true,
                                                    }).select().single();
                                                    if (!dbErr && newPhoto) {
                                                        const updated = [...parsePhotos(editingUser.photos), newPhoto];
                                                        handleEditFieldChange('photos', updated);
                                                        if (isPrimary) handleEditFieldChange('avatar_url', urlData.publicUrl);
                                                        toast({ title: '✅ Photo uploaded' });
                                                    }
                                                }}
                                            />
                                        </div>
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