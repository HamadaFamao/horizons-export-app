import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, Edit } from 'lucide-react';
import CountrySelect from '@/components/CountrySelect';
import { DEFAULT_AVATAR } from '@/lib/constants';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

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
    
    const { id, profile_id, name, gender, age, living_in_code, from_code, avatar_url } = editingUser;

    const { error } = await supabase.from('profiles').update({
        name, gender, age, living_in_code, from_code, avatar_url
    }).eq('profile_id', profile_id);

    if (error) {
        toast({ title: "Error saving user", description: error.message, variant: 'destructive' });
    } else {
        toast({ title: "User updated successfully" });
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
                   <Dialog open={editingUser?.user_uuid === user.user_uuid} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
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
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && <TableRow><TableCell colSpan={9} className="text-center p-4 text-gray-500">No users found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}