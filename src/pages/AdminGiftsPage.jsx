import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, Plus, Loader2, Upload } from 'lucide-react';

const TABS = [
  {
    key: 'gifts',
    label: '🎁 Gifts',
    desc: 'Regular sendable gifts',
    filter: (g) => g.category === 'general' && !g.is_lucky && !g.is_vip_only && !g.is_exclusive && !g.bag_only,
  },
  {
    key: 'vip',
    label: '👑 VIP',
    desc: 'VIP-only gifts',
    filter: (g) => g.is_vip_only,
  },
  {
    key: 'lucky',
    label: '🍀 Lucky',
    desc: 'Lucky gifts with multipliers',
    filter: (g) => g.is_lucky,
  },
  {
    key: 'exclusive',
    label: '💎 Exclusive',
    desc: 'Exclusive gifts for specific users',
    filter: (g) => g.is_exclusive,
  },
  {
    key: 'bag',
    label: '🎒 Bag',
    desc: 'Game & competition prizes (slot)',
    filter: (g) => g.bag_only || g.category === 'slot',
  },
  {
    key: 'all',
    label: '📋 All',
    desc: 'All gifts',
    filter: () => true,
  },
];

const AdminGiftsPage = () => {
  const [gifts, setGifts] = useState([]);
  const [activeTab, setActiveTab] = useState('gifts');
  const activeTabConfig = TABS.find(t => t.key === activeTab) || TABS[0];
  const filteredGifts = gifts.filter(activeTabConfig.filter);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  function getEmptyFormData() {
    return {
      code: '',
      name_en: '',
      name_ar: '',
      cost: 0,
      gems_awarded: 0,
      reward_level: 0,
      icon_url: '',
      animation_asset_url: '',
      animation_type: 'floating',
      animation_asset_type: '',
      animation_duration_ms: 1000,
      effect_level: 'small',
      show_in_room_overlay: false,
      show_in_room_chat: false,
      show_in_global_ticker: false,
      overlay_image_url: '',
      ticker_image_url: '',
      sound_key: '',
      is_room_gift_enabled: false,
      is_active: true,
      sort_order: 0,
      chat_unlock_hours: 0
    };
  }

  useEffect(() => {
    fetchGifts();
  }, []);

  const fetchGifts = async () => {
    console.log('[AdminGiftsPage] Fetching gifts from gift_catalog...');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gift_catalog')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[AdminGiftsPage] Error fetching gifts:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch gifts: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('[AdminGiftsPage] Successfully fetched gifts:', data.length);
        setGifts(data || []);
      }
    } catch (err) {
      console.error('[AdminGiftsPage] Exception while fetching gifts:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while fetching gifts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGift = async () => {
    console.log('[AdminGiftsPage] Creating new gift:', formData);
    try {
      const { data, error } = await supabase
        .from('gift_catalog')
        .insert([formData])
        .select();

      if (error) {
        console.error('[AdminGiftsPage] Error creating gift:', error);
        toast({
          title: 'Error',
          description: `Failed to create gift: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('[AdminGiftsPage] Successfully created gift:', data);
        toast({
          title: 'Success',
          description: 'Gift created successfully'
        });
        setIsCreateModalOpen(false);
        setFormData(getEmptyFormData());
        fetchGifts();
      }
    } catch (err) {
      console.error('[AdminGiftsPage] Exception while creating gift:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while creating gift',
        variant: 'destructive'
      });
    }
  };

  const handleEditGift = async () => {
    console.log('[AdminGiftsPage] Updating gift:', selectedGift.id, formData);
    try {
      const { data, error } = await supabase
        .from('gift_catalog')
        .update(formData)
        .eq('id', selectedGift.id)
        .select();

      if (error) {
        console.error('[AdminGiftsPage] Error updating gift:', error);
        toast({
          title: 'Error',
          description: `Failed to update gift: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('[AdminGiftsPage] Successfully updated gift:', data);
        toast({
          title: 'Success',
          description: 'Gift updated successfully'
        });
        setIsEditModalOpen(false);
        setSelectedGift(null);
        setFormData(getEmptyFormData());
        fetchGifts();
      }
    } catch (err) {
      console.error('[AdminGiftsPage] Exception while updating gift:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating gift',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteGift = async () => {
    console.log('[AdminGiftsPage] Deleting gift:', selectedGift.id);
    try {
      const { error } = await supabase
        .from('gift_catalog')
        .delete()
        .eq('id', selectedGift.id);

      if (error) {
        console.error('[AdminGiftsPage] Error deleting gift:', error);
        toast({
          title: 'Error',
          description: `Failed to delete gift: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('[AdminGiftsPage] Successfully deleted gift:', selectedGift.id);
        toast({
          title: 'Success',
          description: 'Gift deleted successfully'
        });
        setIsDeleteDialogOpen(false);
        setSelectedGift(null);
        fetchGifts();
      }
    } catch (err) {
      console.error('[AdminGiftsPage] Exception while deleting gift:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while deleting gift',
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!formData.code) {
      toast({
        title: 'Missing Code',
        description: 'Please enter a Gift Code before uploading files.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    const isIcon = type === 'icon';
    const fileName = isIcon ? `icon-${Date.now()}.png` : `anim-${Date.now()}.gif`;
    const filePath = `${formData.code}/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('Gifts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[ADMIN_GIFT_UPLOAD_ERROR]', error);
        toast({
          title: 'Upload Error',
          description: error.message,
          variant: 'destructive'
        });
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('Gifts')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      if (isIcon) {
        console.log('[ADMIN_GIFT_UPLOAD_ICON_SUCCESS]', publicUrl);
        setFormData(prev => ({ ...prev, icon_url: publicUrl }));
      } else {
        console.log('[ADMIN_GIFT_UPLOAD_GIF_SUCCESS]', publicUrl);
        setFormData(prev => ({ ...prev, animation_asset_url: publicUrl }));
      }

      toast({
        title: 'Success',
        description: `${isIcon ? 'Icon' : 'Animation'} uploaded successfully.`
      });

    } catch (err) {
      console.error('[ADMIN_GIFT_UPLOAD_ERROR]', err);
      toast({
        title: 'Upload Error',
        description: 'An unexpected error occurred during upload.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (gift) => {
    console.log('[AdminGiftsPage] Opening edit modal for gift:', gift.id);
    setSelectedGift(gift);
    setFormData({
      code: gift.code || '',
      name_en: gift.name_en || '',
      name_ar: gift.name_ar || '',
      cost: gift.cost || 0,
      gems_awarded: gift.gems_awarded || 0,
      reward_level: gift.reward_level || 0,
      icon_url: gift.icon_url || '',
      animation_asset_url: gift.animation_asset_url || '',
      animation_type: gift.animation_type || 'floating',
      animation_asset_type: gift.animation_asset_type || '',
      animation_duration_ms: gift.animation_duration_ms || 1000,
      effect_level: gift.effect_level || 'small',
      show_in_room_overlay: gift.show_in_room_overlay || false,
      show_in_room_chat: gift.show_in_room_chat || false,
      show_in_global_ticker: gift.show_in_global_ticker || false,
      overlay_image_url: gift.overlay_image_url || '',
      ticker_image_url: gift.ticker_image_url || '',
      sound_key: gift.sound_key || '',
      is_room_gift_enabled: gift.is_room_gift_enabled || false,
      is_active: gift.is_active !== undefined ? gift.is_active : true,
      sort_order: gift.sort_order || 0,
      chat_unlock_hours: gift.chat_unlock_hours || 0
    });
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (gift) => {
    console.log('[AdminGiftsPage] Opening delete dialog for gift:', gift.id);
    setSelectedGift(gift);
    setIsDeleteDialogOpen(true);
  };

  const renderGiftForm = () => (
    <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="gift_rose"
          />
        </div>
        <div>
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input
            id="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name_en">Name (English) *</Label>
          <Input
            id="name_en"
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            placeholder="Rose"
          />
        </div>
        <div>
          <Label htmlFor="name_ar">Name (Arabic)</Label>
          <Input
            id="name_ar"
            value={formData.name_ar}
            onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
            placeholder="وردة"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="cost">Cost (Coins) *</Label>
          <Input
            id="cost"
            type="number"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="gems_awarded">Gems Awarded *</Label>
          <Input
            id="gems_awarded"
            type="number"
            value={formData.gems_awarded}
            onChange={(e) => setFormData({ ...formData, gems_awarded: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="reward_level">Reward Level</Label>
          <Input
            id="reward_level"
            type="number"
            value={formData.reward_level}
            onChange={(e) => setFormData({ ...formData, reward_level: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="icon_url">Icon URL</Label>
        <div className="flex gap-2 items-center mt-1">
          <Input
            id="icon_url"
            value={formData.icon_url}
            onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
            placeholder="https://..."
            className="flex-1"
          />
          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'icon')}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />
            <Button type="button" variant="secondary" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Icon
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Animation Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="animation_type">Animation Type</Label>
            <Select
              value={formData.animation_type}
              onValueChange={(value) => setFormData({ ...formData, animation_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="floating">Floating</SelectItem>
                <SelectItem value="burst">Burst</SelectItem>
                <SelectItem value="sparkle">Sparkle</SelectItem>
                <SelectItem value="fullscreen">Fullscreen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="effect_level">Effect Level</Label>
            <Select
              value={formData.effect_level}
              onValueChange={(value) => setFormData({ ...formData, effect_level: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="animation_asset_url">Animation Asset URL</Label>
          <div className="flex gap-2 items-center mt-1">
            <Input
              id="animation_asset_url"
              value={formData.animation_asset_url}
              onChange={(e) => setFormData({ ...formData, animation_asset_url: e.target.value })}
              placeholder="https://..."
              className="flex-1"
            />
            <div className="relative">
              <Input
                type="file"
                accept="image/gif,video/*,application/json"
                onChange={(e) => handleFileUpload(e, 'anim')}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <Button type="button" variant="secondary" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload GIF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="animation_asset_type">Animation Asset Type</Label>
            <Input
              id="animation_asset_type"
              value={formData.animation_asset_type}
              onChange={(e) => setFormData({ ...formData, animation_asset_type: e.target.value })}
              placeholder="lottie, gif, webm"
            />
          </div>
          <div>
            <Label htmlFor="animation_duration_ms">Duration (ms)</Label>
            <Input
              id="animation_duration_ms"
              type="number"
              value={formData.animation_duration_ms}
              onChange={(e) => setFormData({ ...formData, animation_duration_ms: parseInt(e.target.value) || 1000 })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Display Settings</h4>
        <div>
          <Label htmlFor="overlay_image_url">Overlay Image URL</Label>
          <Input
            id="overlay_image_url"
            value={formData.overlay_image_url}
            onChange={(e) => setFormData({ ...formData, overlay_image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="ticker_image_url">Ticker Image URL</Label>
          <Input
            id="ticker_image_url"
            value={formData.ticker_image_url}
            onChange={(e) => setFormData({ ...formData, ticker_image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="sound_key">Sound Key</Label>
          <Input
            id="sound_key"
            value={formData.sound_key}
            onChange={(e) => setFormData({ ...formData, sound_key: e.target.value })}
            placeholder="gift_sound_1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Feature Flags</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_room_overlay"
            checked={formData.show_in_room_overlay}
            onCheckedChange={(checked) => setFormData({ ...formData, show_in_room_overlay: checked })}
          />
          <Label htmlFor="show_in_room_overlay" className="cursor-pointer">Show in Room Overlay</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_room_chat"
            checked={formData.show_in_room_chat}
            onCheckedChange={(checked) => setFormData({ ...formData, show_in_room_chat: checked })}
          />
          <Label htmlFor="show_in_room_chat" className="cursor-pointer">Show in Room Chat</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_global_ticker"
            checked={formData.show_in_global_ticker}
            onCheckedChange={(checked) => setFormData({ ...formData, show_in_global_ticker: checked })}
          />
          <Label htmlFor="show_in_global_ticker" className="cursor-pointer">Show in Global Ticker</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_room_gift_enabled"
            checked={formData.is_room_gift_enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, is_room_gift_enabled: checked })}
          />
          <Label htmlFor="is_room_gift_enabled" className="cursor-pointer">Enable as Room Gift</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="chat_unlock_hours">Chat Unlock Hours</Label>
        <Input
          id="chat_unlock_hours"
          type="number"
          value={formData.chat_unlock_hours}
          onChange={(e) => setFormData({ ...formData, chat_unlock_hours: parseInt(e.target.value) || 0 })}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gift Catalog Management</CardTitle>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(getEmptyFormData())}>
                <Plus className="h-4 w-4 mr-2" />
                Create Gift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create New Gift</DialogTitle>
              </DialogHeader>
              {renderGiftForm()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGift} disabled={uploading}>
                  Create Gift
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Tab Banner */}
          <div className="mb-6 bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-shrink-0 px-5 py-3.5 text-sm font-medium border-b-2 transition-all',
                    activeTab === tab.key
                      ? 'border-rose-500 text-rose-600 bg-rose-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {tab.label}
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {gifts.filter(tab.filter).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="px-5 py-2.5 bg-gray-50 border-t">
              <p className="text-xs text-gray-500">{activeTabConfig.desc}</p>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name (EN)</TableHead>
                  <TableHead>Name (AR)</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Gems</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No gifts found. Create your first gift to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGifts.map((gift) => (
                    <TableRow key={gift.id}>
                      <TableCell className="font-mono text-sm">{gift.code}</TableCell>
                      <TableCell>{gift.name_en}</TableCell>
                      <TableCell>{gift.name_ar}</TableCell>
                      <TableCell>{gift.cost}</TableCell>
                      <TableCell>{gift.gems_awarded}</TableCell>
                      <TableCell>{gift.reward_level}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${gift.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {gift.is_active ? 'Yes' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell>{gift.sort_order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(gift)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(gift)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Gift</DialogTitle>
          </DialogHeader>
          {renderGiftForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleEditGift} disabled={uploading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the gift "{selectedGift?.name_en}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGift} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminGiftsPage;