import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, Ban, Lock, Unlock, MessageSquare, Mic, MicOff, Trash2, Shield, RefreshCw } from 'lucide-react';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" rx="16" fill="#e5e7eb"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="30">🏠</text>
    </svg>
  `);

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  // Modals
  const [banningRoom, setBanningRoom] = useState(null);
  const [managingRoom, setManagingRoom] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const { staffRole } = useAdminPermissions();
  const { toast } = useToast();
  const isManager = staffRole === 'manager';

  // ============================================
  // FETCH ROOMS
  // ============================================
  const fetchRooms = async (currentPage = page) => {
    setLoading(true);
    try {
      let query = supabase
        .from('live_rooms')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,public_room_id.eq.${parseInt(searchTerm) || 0}`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // جيب بيانات الـ owners
      const ownerIds = [...new Set((data || []).map(r => r.owner_user_id).filter(Boolean))];
      let ownersMap = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, profile_id, staff_role, isadmin')
          .in('id', ownerIds);
        (owners || []).forEach(o => { ownersMap[o.id] = o; });
      }

      // Get participant counts
      const roomIds = (data || []).map(r => r.id);
      let participantMap = {};
      if (roomIds.length > 0) {
        const { data: seats } = await supabase
          .from('live_room_mic_seats')
          .select('room_id, user_id')
          .in('room_id', roomIds)
          .not('user_id', 'is', null)
          .not('user_id', 'eq', '');

        (seats || []).forEach(s => {
          participantMap[s.room_id] = (participantMap[s.room_id] || 0) + 1;
        });
      }

      setRooms((data || []).map(r => ({
        ...r,
        owner: ownersMap[r.owner_user_id] || null,
        participant_count: participantMap[r.id] || 0
      })));
      setTotalCount(count || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-rooms-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_rooms' },
        (payload) => {
          // حدّث الـ room في الـ list
          setRooms(prev => prev.map(r =>
            r.id === payload.new.id ? { ...r, ...payload.new } : r
          ));
          // حدّث الـ managing modal لو مفتوح
          setManagingRoom(prev =>
            prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchRooms(0);
  };

  // ============================================
  // FETCH ROOM USERS
  // ============================================
  const fetchRoomUsers = async (roomId) => {
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('live_room_mic_seats')
        .select('seat_no, user_id, locked')
        .eq('room_id', roomId)
        .not('user_id', 'is', null);

      // جيب بيانات الـ profiles منفصلة
      const userIds = (data || []).map(s => s.user_id).filter(Boolean);
      let profilesMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, profile_id, staff_role, isadmin')
          .in('id', userIds);
        (profiles || []).forEach(p => { profilesMap[p.id] = p; });
      }

      setRoomUsers((data || []).map(s => ({
        ...s,
        seat_index: s.seat_no,
        is_muted: s.locked,
        profile: profilesMap[s.user_id] || null
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ============================================
  // ROOM ACTIONS
  // ============================================

  // حظر غرفة
  const handleBanRoom = async (room) => {
    if (!window.confirm(`Ban room "${room.title}"? This will deactivate it.`)) return;
    const { error } = await supabase
      .from('live_rooms')
      .update({ is_active: false })
      .eq('id', room.id);
    if (!error) {
      toast({ title: '⛔ Room banned' });
      fetchRooms();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // فك حظر غرفة
  const handleUnbanRoom = async (room) => {
    const { error } = await supabase
      .from('live_rooms')
      .update({ is_active: true })
      .eq('id', room.id);
    if (!error) {
      toast({ title: '✅ Room unbanned' });
      fetchRooms();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // فتح قفل الغرفة (للأدمن فقط)
  const handleUnlockRoom = async (room) => {
    if (!isManager) return;
    const { error } = await supabase
      .from('live_rooms')
      .update({ is_locked: false, lock_pin: null, lock_expires_at: null })
      .eq('id', room.id);
    if (!error) {
      toast({ title: '🔓 Room unlocked' });
      fetchRooms();
      if (managingRoom?.id === room.id) setManagingRoom(prev => ({ ...prev, is_locked: false }));
    }
  };

  // إغلاق الشات
  const handleToggleChat = async (room) => {
  const newVal = !room.chat_disabled;
  console.log('Toggle chat:', room.id, 'newVal:', newVal);
  
  const { data, error } = await supabase
    .from('live_rooms')
    .update({ chat_disabled: newVal })
    .eq('id', room.id)
    .select();
  
  console.log('Result:', data, error);
  
  if (!error) {
    toast({ title: newVal ? '🔇 Chat disabled' : '💬 Chat enabled' });
    setRooms(prev => prev.map(r => 
      r.id === room.id ? { ...r, chat_disabled: newVal } : r
    ));
    setManagingRoom(prev => 
      prev?.id === room.id ? { ...prev, chat_disabled: newVal } : prev
    );
  } else {
    toast({ title: 'Error', description: error.message, variant: 'destructive' });
  }
};

  // مسح خلفية الغرفة
  const handleClearBackground = async (room) => {
    if (!window.confirm('Clear room background?')) return;
    const { error } = await supabase
      .from('live_rooms')
      .update({ background_url: null })
      .eq('id', room.id);
    if (!error) {
      toast({ title: '🗑️ Background cleared' });
      fetchRooms();
      if (managingRoom?.id === room.id) setManagingRoom(prev => ({ ...prev, background_url: null }));
    }
  };

  // كتم مايك مستخدم
  const handleMuteUser = async (roomId, userId) => {
    const { error } = await supabase
        .from('live_room_mic_seats')
        .update({ locked: true })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (!error) {
      toast({ title: '🔇 User muted' });
      setRoomUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_muted: true } : u));
    }
  };

  // فك كتم مايك مستخدم
  const handleUnmuteUser = async (roomId, userId) => {
    const { error } = await supabase
        .from('live_room_mic_seats')
        .update({ locked: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (!error) {
      toast({ title: '🎤 User unmuted' });
      setRoomUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_muted: false } : u));
    }
  };

  // طرد مستخدم من الغرفة
  const handleKickUser = async (roomId, userId, profile) => {
    // منع طرد الأدمن
    if (profile?.staff_role || profile?.isadmin) {
      toast({ title: '⚠️ Cannot kick admin users', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Kick ${profile?.name} from room?`)) return;
    const { error } = await supabase
      .from('live_room_mic_seats')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (!error) {
      toast({ title: '👢 User kicked' });
      setRoomUsers(prev => prev.filter(u => u.user_id !== userId));
    }
  };

  // حظر مستخدم من داخل الغرفة
  const handleBanUserFromRoom = async (userId, profile) => {
    if (profile?.staff_role || profile?.isadmin) {
      toast({ title: '⚠️ Cannot ban admin users', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Ban ${profile?.name}? This will ban them from the entire platform for 24h.`)) return;
    const { error } = await supabase.from('user_bans').upsert({
      user_id: userId,
      banned_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Banned by admin from room',
      is_active: true,
      banned_by: (await supabase.auth.getUser()).data?.user?.id,
    }, { onConflict: 'user_id' });
    if (!error) {
      toast({ title: '⛔ User banned for 24h' });
      setRoomUsers(prev => prev.filter(u => u.user_id !== userId));
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Rooms Management</h1>
        <Button variant="outline" size="sm" onClick={() => fetchRooms()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input
          placeholder="Search by title or room ID..."
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
              <TableHead>Room</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chat</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : rooms.map(room => (
              <TableRow key={room.id} className={!room.is_active ? 'opacity-50 bg-red-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <img
                      src={room.avatar_url || DEFAULT_AVATAR}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                      alt="room"
                      width={40}
                      height={40}
                      loading="lazy"
                      className="w-10 h-10 min-w-10 min-h-10 rounded-lg object-cover bg-gray-200"
                    />
                    <div>
                      <p className="font-medium text-sm">{room.title || 'Untitled'}</p>
                      {room.is_locked && <span className="text-xs text-amber-600">🔒 Locked</span>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-500">#{room.public_room_id}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className="font-medium">{room.owner?.name || '—'}</p>
                    <p className="text-xs text-slate-400">#{room.owner?.profile_id}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{room.participant_count}</span>
                </TableCell>
                <TableCell>
                  {room.is_active ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
                  ) : (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Banned</span>
                  )}
                </TableCell>
                <TableCell>
                  {room.chat_disabled ? (
                    <span className="text-xs text-red-500">Disabled</span>
                  ) : (
                    <span className="text-xs text-green-500">Enabled</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {new Date(room.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* زر إدارة الغرفة */}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setManagingRoom(room); fetchRoomUsers(room.id); }}
                      title="Manage Room"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>

                    {/* فتح القفل - للـ manager بس */}
                    {room.is_locked && isManager && (
                      <Button
                        variant="outline" size="sm"
                        className="text-amber-600 hover:bg-amber-50"
                        onClick={() => handleUnlockRoom(room)}
                        title="Unlock Room"
                      >
                        <Unlock className="h-4 w-4" />
                      </Button>
                    )}

                    {/* إغلاق/فتح الشات */}
                    <Button
                      variant="outline" size="sm"
                      className={room.chat_disabled ? 'text-green-600 hover:bg-green-50' : 'text-slate-600 hover:bg-slate-50'}
                      onClick={() => handleToggleChat(room)}
                      title={room.chat_disabled ? 'Enable Chat' : 'Disable Chat'}
                    >
                      {room.chat_disabled ? <MessageSquare className="h-4 w-4" /> : <MessageSquare className="h-4 w-4 text-red-500" />}
                    </Button>

                    {/* حظر/فك حظر الغرفة */}
                    {room.is_active ? (
                      <Button
                        variant="outline" size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleBanRoom(room)}
                        title="Ban Room"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline" size="sm"
                        className="text-green-600 hover:bg-green-50"
                        onClick={() => handleUnbanRoom(room)}
                        title="Unban Room"
                      >
                        <Unlock className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rooms.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center p-4 text-gray-500">No rooms found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 px-2">
        <span className="text-sm text-slate-500">
          Showing {Math.min(page * PAGE_SIZE + 1, totalCount)}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} rooms
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || loading}
            onClick={() => { setPage(p => p - 1); fetchRooms(page - 1); }}>
            ← Prev
          </Button>
          <span className="text-sm font-medium">Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE) || 1}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
            onClick={() => { setPage(p => p + 1); fetchRooms(page + 1); }}>
            Next →
          </Button>
        </div>
      </div>

      {/* ============================================ */}
      {/* MANAGE ROOM MODAL */}
      {/* ============================================ */}
      <Dialog open={!!managingRoom} onOpenChange={o => !o && setManagingRoom(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              🛡️ Manage Room: {managingRoom?.title} <span className="text-slate-400 text-sm">#{managingRoom?.public_room_id}</span>
            </DialogTitle>
          </DialogHeader>

          {managingRoom && (
            <div className="space-y-6 py-2">

              {/* Room Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Owner</p>
                  <p className="font-medium">{managingRoom.owner?.name || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Participants</p>
                  <p className="font-medium">{managingRoom.participant_count}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={`font-medium ${managingRoom.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {managingRoom.is_active ? 'Active' : 'Banned'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Chat</p>
                  <p className={`font-medium ${managingRoom.chat_disabled ? 'text-red-600' : 'text-green-600'}`}>
                    {managingRoom.chat_disabled ? 'Disabled' : 'Enabled'}
                  </p>
                </div>
              </div>

              {/* Room Controls */}
              <div>
                <Label className="text-base font-semibold">🎮 Room Controls</Label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* فتح القفل - manager فقط */}
                  {managingRoom.is_locked && isManager && (
                    <Button variant="outline" size="sm" className="text-amber-600"
                      onClick={() => handleUnlockRoom(managingRoom)}>
                      <Unlock className="h-4 w-4 mr-1" /> Unlock Room
                    </Button>
                  )}

                  {/* إغلاق/فتح الشات */}
                  <Button variant="outline" size="sm"
                    className={managingRoom.chat_disabled ? 'text-green-600' : 'text-red-600'}
                    onClick={() => handleToggleChat(managingRoom)}>
                    {managingRoom.chat_disabled
                      ? <><MessageSquare className="h-4 w-4 mr-1" /> Enable Chat</>
                      : <><MessageSquare className="h-4 w-4 mr-1" /> Disable Chat</>
                    }
                  </Button>

                  {/* مسح الخلفية */}
                  {managingRoom.background_url && (
                    <Button variant="outline" size="sm" className="text-red-600"
                      onClick={() => handleClearBackground(managingRoom)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Clear Background
                    </Button>
                  )}

                  {/* حظر/فك حظر الغرفة */}
                  {managingRoom.is_active ? (
                    <Button variant="outline" size="sm" className="text-red-600"
                      onClick={() => { handleBanRoom(managingRoom); setManagingRoom(null); }}>
                      <Ban className="h-4 w-4 mr-1" /> Ban Room
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="text-green-600"
                      onClick={() => { handleUnbanRoom(managingRoom); setManagingRoom(null); }}>
                      <Unlock className="h-4 w-4 mr-1" /> Unban Room
                    </Button>
                  )}
                </div>
              </div>

              {/* Room Users */}
              <div>
                <Label className="text-base font-semibold">👥 Room Participants ({roomUsers.length})</Label>
                {loadingUsers ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
                ) : roomUsers.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">No participants in this room</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {roomUsers.map(seat => {
                      const isAdminUser = seat.profile?.staff_role || seat.profile?.isadmin;
                      return (
                        <div key={seat.user_id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${isAdminUser ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Seat {seat.seat_index}</span>
                            <p className="text-sm font-medium">{seat.profile?.name || '—'}</p>
                            {isAdminUser && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                {seat.profile?.staff_role || 'Admin'}
                              </span>
                            )}
                            {seat.is_muted && <span className="text-xs text-red-500">🔇 Muted</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* كتم/فك كتم المايك */}
                            {!isAdminUser && (
                              <>
                                <Button variant="outline" size="sm"
                                  onClick={() => seat.is_muted
                                    ? handleUnmuteUser(managingRoom.id, seat.user_id)
                                    : handleMuteUser(managingRoom.id, seat.user_id)
                                  }
                                  title={seat.is_muted ? 'Unmute' : 'Mute'}
                                >
                                  {seat.is_muted
                                    ? <Mic className="h-3 w-3 text-green-600" />
                                    : <MicOff className="h-3 w-3 text-red-600" />
                                  }
                                </Button>

                                {/* طرد */}
                                <Button variant="outline" size="sm"
                                  className="text-orange-600 hover:bg-orange-50"
                                  onClick={() => handleKickUser(managingRoom.id, seat.user_id, seat.profile)}
                                  title="Kick User"
                                >
                                  👢
                                </Button>

                                {/* حظر */}
                                <Button variant="outline" size="sm"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleBanUserFromRoom(seat.user_id, seat.profile)}
                                  title="Ban User"
                                >
                                  <Ban className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {isAdminUser && (
                              <span className="text-xs text-purple-500 italic">Protected</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManagingRoom(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}