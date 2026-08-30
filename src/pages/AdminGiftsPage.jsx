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

const TAB_RULES = {
  gifts: {
    category: 'general',
    is_lucky: false,
    is_vip_only: false,
    is_exclusive: false,
    bag_only: false,
    gems_formula: (cost) => cost,
    animation_type: 'floating',
    effect_level: 'small',
    show_in_room_overlay: true,
    show_in_room_chat: true,
    show_in_global_ticker: false,
    is_room_gift_enabled: true,
  },
  vip: {
    category: 'general',
    is_lucky: false,
    is_vip_only: true,
    is_exclusive: false,
    bag_only: false,
    gems_formula: (cost) => cost,
    animation_type: 'burst',
    effect_level: 'medium',
    show_in_room_overlay: true,
    show_in_room_chat: true,
    show_in_global_ticker: true,
    is_room_gift_enabled: true,
  },
  lucky: {
    category: 'general',
    is_lucky: true,
    is_vip_only: false,
    is_exclusive: false,
    bag_only: false,
    gems_formula: (cost) => Math.round(cost * 0.10),
    animation_type: 'sparkle',
    effect_level: 'medium',
    show_in_room_overlay: true,
    show_in_room_chat: true,
    show_in_global_ticker: false,
    is_room_gift_enabled: true,
  },
  exclusive: {
    category: 'general',
    is_lucky: false,
    is_vip_only: false,
    is_exclusive: true,
    bag_only: false,
    gems_formula: (cost) => cost,
    animation_type: 'fullscreen',
    effect_level: 'global',
    show_in_room_overlay: true,
    show_in_room_chat: true,
    show_in_global_ticker: true,
    is_room_gift_enabled: true,
  },
  bag: {
    category: 'slot',
    is_lucky: false,
    is_vip_only: false,
    is_exclusive: false,
    bag_only: true,
    gems_formula: (cost) => cost,
    animation_type: 'burst',
    effect_level: 'medium',
    show_in_room_overlay: true,
    show_in_room_chat: true,
    show_in_global_ticker: false,
    is_room_gift_enabled: false,
  },
  store: {
    category: 'store',
    is_lucky: false,
    is_vip_only: false,
    is_exclusive: false,
    bag_only: false,
    gems_formula: (cost) => 0,
    animation_type: 'floating',
    effect_level: 'small',
    show_in_room_overlay: false,
    show_in_room_chat: false,
    show_in_global_ticker: false,
    is_room_gift_enabled: false,
  },
  all: null,
};

const TABS = [
  {
    key: 'gifts',
    label: '🎁 Gifts',
    desc: 'Regular sendable gifts — category: general, not lucky/vip/exclusive',
    filter: (g) => g.category === 'general' && !g.is_lucky && !g.is_vip_only && !g.is_exclusive,
  },
  {
    key: 'vip',
    label: '👑 VIP',
    desc: 'VIP-only gifts — is_vip_only: true',
    filter: (g) => g.is_vip_only === true,
  },
  {
    key: 'lucky',
    label: '🍀 Lucky',
    desc: 'Lucky gifts with multipliers — is_lucky: true',
    filter: (g) => g.is_lucky === true,
  },
  {
    key: 'exclusive',
    label: '💎 Exclusive',
    desc: 'Exclusive gifts for specific users — is_exclusive: true',
    filter: (g) => g.is_exclusive === true,
  },
  {
    key: 'bag',
    label: '🎒 Bag',
    desc: 'Game & competition prizes — category: slot',
    filter: (g) => g.category === 'slot',
  },
  {
    key: 'store',
    label: '🏪 Store',
    desc: 'Vehicles, frames & profile decorations — category: store',
    filter: (g) => g.category === 'store',
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
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingAnimation, setUploadingAnimation] = useState(false);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [giftToDelete, setGiftToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [form, setForm] = useState(getEmptyFormData());
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  function getEmptyFormData() {
    return {
      code: '',
      name_en: '',
      name_ar: '',
      category: 'general',
      is_vip_only: false,
      is_lucky: false,
      is_exclusive: false,
      bag_only: false,
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
      is_room_gift_enabled: true,
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

  const handleOpenCreate = () => {
    const rules = TAB_RULES[activeTab];
    setForm({
      name_en: '',
      name_ar: '',
      code: '',
      cost: '',
      gems_awarded: '',
      sort_order: 0,
      reward_level: 0,
      is_active: true,
      category: rules?.category || 'general',
      is_lucky: rules?.is_lucky || false,
      is_vip_only: rules?.is_vip_only || false,
      is_exclusive: rules?.is_exclusive || false,
      bag_only: rules?.bag_only || false,
      animation_type: rules?.animation_type || 'floating',
      effect_level: rules?.effect_level || 'small',
      animation_duration_ms: 3000,
      show_in_room_overlay: rules?.show_in_room_overlay !== false,
      show_in_room_chat: rules?.show_in_room_chat !== false,
      show_in_global_ticker: rules?.show_in_global_ticker || false,
      is_room_gift_enabled: rules?.is_room_gift_enabled !== false,
    });
    setSelectedGift(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateGift = async () => {
    const rules = TAB_RULES[activeTab];
    const cost = Number(form.cost) || 0;
    const gems_awarded = rules?.gems_formula
      ? rules.gems_formula(cost)
      : Number(form.gems_awarded) || 0;

    const giftData = {
      code: form.code?.trim(),
      name_en: form.name_en?.trim(),
      name_ar: form.name_ar?.trim() || null,
      cost,
      gems_awarded,
      sort_order: Number(form.sort_order) || 0,
      reward_level: Number(form.reward_level) || 0,
      is_active: form.is_active !== false,
      is_room_gift_enabled: form.is_room_gift_enabled !== false,
      icon_url: form.icon_url || null,
      animation_type: form.animation_type || 'floating',
      animation_asset_url: form.animation_asset_url || null,
      animation_asset_type: form.animation_asset_type || null,
      animation_duration_ms: Number(form.animation_duration_ms) || 3000,
      effect_level: form.effect_level || 'small',
      sound_key: form.sound_key || null,
      show_in_room_chat: form.show_in_room_chat !== false,
      show_in_room_overlay: form.show_in_room_overlay !== false,
      show_in_global_ticker: !!form.show_in_global_ticker,
      category: form.category || 'general',
      is_vip_only: !!form.is_vip_only,
      is_lucky: !!form.is_lucky,
      is_exclusive: !!form.is_exclusive,
      bag_only: !!form.bag_only,
    };

    console.log('[AdminGiftsPage] Creating new gift:', giftData);
    try {
      const { data, error } = await supabase
        .from('gift_catalog')
        .insert([giftData])
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
        setForm(getEmptyFormData());
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
    const rules = TAB_RULES[activeTab];
    const cost = Number(form.cost) || 0;
    const gems_awarded = rules?.gems_formula
      ? rules.gems_formula(cost)
      : Number(form.gems_awarded) || 0;

    const giftData = {
      code: form.code?.trim(),
      name_en: form.name_en?.trim(),
      name_ar: form.name_ar?.trim() || null,
      cost,
      gems_awarded,
      sort_order: Number(form.sort_order) || 0,
      reward_level: Number(form.reward_level) || 0,
      is_active: form.is_active !== false,
      is_room_gift_enabled: form.is_room_gift_enabled !== false,
      icon_url: form.icon_url || null,
      animation_type: form.animation_type || 'floating',
      animation_asset_url: form.animation_asset_url || null,
      animation_asset_type: form.animation_asset_type || null,
      animation_duration_ms: Number(form.animation_duration_ms) || 3000,
      effect_level: form.effect_level || 'small',
      sound_key: form.sound_key || null,
      show_in_room_chat: form.show_in_room_chat !== false,
      show_in_room_overlay: form.show_in_room_overlay !== false,
      show_in_global_ticker: !!form.show_in_global_ticker,
      category: form.category || 'general',
      is_vip_only: !!form.is_vip_only,
      is_lucky: !!form.is_lucky,
      is_exclusive: !!form.is_exclusive,
      bag_only: !!form.bag_only,
    };

    console.log('[AdminGiftsPage] Updating gift:', selectedGift.id, giftData);
    try {
      const { data, error } = await supabase
        .from('gift_catalog')
        .update(giftData)
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
        setForm(getEmptyFormData());
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

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!form.code) {
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
    const filePath = `${form.code}/${fileName}`;

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
        setForm(prev => ({ ...prev, icon_url: publicUrl }));
      } else {
        console.log('[ADMIN_GIFT_UPLOAD_GIF_SUCCESS]', publicUrl);
        setForm(prev => ({ ...prev, animation_asset_url: publicUrl }));
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
    const nextForm = {
      code: gift.code || '',
      name_en: gift.name_en || '',
      name_ar: gift.name_ar || '',
      category: gift.category || 'general',
      is_vip_only: gift.is_vip_only || false,
      is_lucky: gift.is_lucky || false,
      is_exclusive: gift.is_exclusive || false,
      bag_only: gift.bag_only || false,
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
      is_room_gift_enabled: gift.is_room_gift_enabled !== false,
      is_active: gift.is_active !== false,
      sort_order: gift.sort_order || 0,
      chat_unlock_hours: gift.chat_unlock_hours || 0
    };

    const rules = TAB_RULES[activeTab];
    if (rules?.gems_formula && gift.cost > 0) {
      nextForm.gems_awarded = rules.gems_formula(gift.cost);
    }

    setForm(nextForm);
    setIsEditModalOpen(true);
  };

  const handleUploadFile = async (file, bucket, folder, onSuccess, setLoading) => {
    if (!file) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onSuccess(urlData.publicUrl);
      toast({ title: '✅ Uploaded successfully!', className: 'bg-green-50 border-green-200 text-green-800' });
    } catch (e) {
      toast({ title: 'Upload Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (gift) => {
    handleOpenEdit(gift);
  };

  const openDeleteDialog = (gift) => {
    setGiftToDelete(gift);
    setDeleteDialogOpen(true);
  };

  const handleDeleteGift = async () => {
    if (!giftToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('gift_catalog')
        .delete()
        .eq('id', giftToDelete.id);
      if (error) throw error;
      toast({ title: '✅ Gift deleted', className: 'bg-green-50 border-green-200 text-green-800' });
      setDeleteDialogOpen(false);
      setGiftToDelete(null);
      await fetchGifts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const renderGiftForm = () => (
    <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="gift_rose"
          />
        </div>
        <div>
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input
            id="sort_order"
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name_en">Name (English) *</Label>
          <Input
            id="name_en"
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            placeholder="Rose"
          />
        </div>
        <div>
          <Label htmlFor="name_ar">Name (Arabic)</Label>
          <Input
            id="name_ar"
            value={form.name_ar}
            onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            placeholder="وردة"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Category</Label>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={form.category || 'general'}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="general">🎁 Gifts (General)</option>
          <option value="slot">🎒 Bag (Slot/Game prizes)</option>
          <option value="store">🏪 Store (Decorations)</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded-lg hover:bg-gray-50">
          <input
            type="checkbox"
            checked={!!form.is_vip_only}
            onChange={(e) => setForm({ ...form, is_vip_only: e.target.checked, is_lucky: false, is_exclusive: false })}
          />
          👑 VIP Only
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded-lg hover:bg-gray-50">
          <input
            type="checkbox"
            checked={!!form.is_lucky}
            onChange={(e) => setForm({ ...form, is_lucky: e.target.checked, is_vip_only: false, is_exclusive: false })}
          />
          🍀 Lucky
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded-lg hover:bg-gray-50">
          <input
            type="checkbox"
            checked={!!form.is_exclusive}
            onChange={(e) => setForm({ ...form, is_exclusive: e.target.checked, is_vip_only: false, is_lucky: false })}
          />
          💎 Exclusive
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="cost">Cost (Coins) *</Label>
          <Input
            id="cost"
            type="number"
            value={form.cost}
            onChange={(e) => {
              const cost = Number(e.target.value) || 0;
              const rules = TAB_RULES[activeTab];
              const gems = rules?.gems_formula ? rules.gems_formula(cost) : cost;
              setForm({ ...form, cost: e.target.value, gems_awarded: gems });
            }}
          />
        </div>
        <div>
          <Label htmlFor="gems_awarded">Gems Awarded *</Label>
          <Input
            id="gems_awarded"
            type="number"
            value={form.gems_awarded}
            onChange={(e) => setForm({ ...form, gems_awarded: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="reward_level">Reward Level</Label>
          <Input
            id="reward_level"
            type="number"
            value={form.reward_level}
            onChange={(e) => setForm({ ...form, reward_level: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      {TAB_RULES[activeTab]?.gems_formula && form.cost && (
        <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
          💡 Auto gems:
          {activeTab === 'lucky'
            ? ` ${Math.round(Number(form.cost) * 0.10)} gems (10% of cost)`
            : ` ${Number(form.cost)} gems (100% of cost)`}
        </p>
      )}

      <div className="space-y-1">
        <Label>Icon URL</Label>
        <div className="flex gap-2 items-center">
          <Input
            value={form.icon_url || ''}
            onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
            placeholder="https://..."
            className="flex-1"
          />
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*,.gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(
                  file, 'Gifts', 'icons',
                  (url) => setForm(f => ({ ...f, icon_url: url })),
                  setUploadingIcon
                );
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploadingIcon} asChild>
              <span>
                {uploadingIcon
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
              </span>
            </Button>
          </label>
        </div>
        {form.icon_url && (
          <img src={form.icon_url} alt="icon preview"
            className="w-16 h-16 object-contain rounded-lg border mt-1 bg-gray-50" />
        )}
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Animation Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="animation_type">Animation Type</Label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.animation_type || 'floating'}
              onChange={(e) => setForm({ ...form, animation_type: e.target.value })}
            >
              <option value="floating">Floating</option>
              <option value="burst">Burst</option>
              <option value="sparkle">Sparkle</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
          </div>
          <div>
            <Label htmlFor="effect_level">Effect Level</Label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.effect_level || 'small'}
              onChange={(e) => setForm({ ...form, effect_level: e.target.value })}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="global">Global</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Animation Asset URL</Label>
          <div className="flex gap-2 items-center">
            <Input
              value={form.animation_asset_url || ''}
              onChange={(e) => setForm({ ...form, animation_asset_url: e.target.value })}
              placeholder="https://..."
              className="flex-1"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,.gif,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(
                    file, 'Gifts', 'animations',
                    (url) => setForm(f => ({ ...f, animation_asset_url: url })),
                    setUploadingAnimation
                  );
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploadingAnimation} asChild>
                <span>
                  {uploadingAnimation
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
                </span>
              </Button>
            </label>
          </div>
          {form.animation_asset_url && (
            <div className="mt-1">
              {form.animation_asset_url.match(/\.(mp4|webm|mov)$/i) ? (
                <video src={form.animation_asset_url} className="w-32 h-32 rounded-lg border object-contain bg-gray-50" autoPlay loop muted />
              ) : (
                <img src={form.animation_asset_url} alt="animation preview"
                  className="w-32 h-32 object-contain rounded-lg border bg-gray-50" />
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="animation_asset_type">Animation Asset Type</Label>
            <Input
              id="animation_asset_type"
              value={form.animation_asset_type}
              onChange={(e) => setForm({ ...form, animation_asset_type: e.target.value })}
              placeholder="lottie, gif, webm"
            />
          </div>
          <div>
            <Label htmlFor="animation_duration_ms">Duration (ms)</Label>
            <Input
              id="animation_duration_ms"
              type="number"
              value={form.animation_duration_ms}
              onChange={(e) => setForm({ ...form, animation_duration_ms: parseInt(e.target.value) || 1000 })}
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
            value={form.overlay_image_url}
            onChange={(e) => setForm({ ...form, overlay_image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="ticker_image_url">Ticker Image URL</Label>
          <Input
            id="ticker_image_url"
            value={form.ticker_image_url}
            onChange={(e) => setForm({ ...form, ticker_image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1">
          <Label>Sound</Label>
          <div className="flex gap-2 items-center">
            <Input
              value={form.sound_key || ''}
              onChange={(e) => setForm({ ...form, sound_key: e.target.value })}
              placeholder="Sound URL or key..."
              className="flex-1"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(
                    file, 'room-songs', 'gift-sounds',
                    (url) => setForm(f => ({ ...f, sound_key: url })),
                    setUploadingSound
                  );
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploadingSound} asChild>
                <span>
                  {uploadingSound
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
                </span>
              </Button>
            </label>
          </div>
          {form.sound_key && form.sound_key.startsWith('http') && (
            <audio controls src={form.sound_key} className="w-full mt-1 h-8" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Feature Flags</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_room_overlay"
            checked={form.show_in_room_overlay}
            onCheckedChange={(checked) => setForm({ ...form, show_in_room_overlay: checked })}
          />
          <Label htmlFor="show_in_room_overlay" className="cursor-pointer">Show in Room Overlay</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_room_chat"
            checked={form.show_in_room_chat}
            onCheckedChange={(checked) => setForm({ ...form, show_in_room_chat: checked })}
          />
          <Label htmlFor="show_in_room_chat" className="cursor-pointer">Show in Room Chat</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show_in_global_ticker"
            checked={form.show_in_global_ticker}
            onCheckedChange={(checked) => setForm({ ...form, show_in_global_ticker: checked })}
          />
          <Label htmlFor="show_in_global_ticker" className="cursor-pointer">Show in Global Ticker</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_room_gift_enabled"
            checked={form.is_room_gift_enabled !== false}
            onChange={(e) => setForm({ ...form, is_room_gift_enabled: e.target.checked })}
          />
          <Label htmlFor="is_room_gift_enabled" className="cursor-pointer">
            🎙️ Show in Room Gift Panel
          </Label>
        </div>
      </div>

      <div>
        <Label htmlFor="chat_unlock_hours">Chat Unlock Hours</Label>
        <Input
          id="chat_unlock_hours"
          type="number"
          value={form.chat_unlock_hours}
          onChange={(e) => setForm({ ...form, chat_unlock_hours: parseInt(e.target.value) || 0 })}
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
              <Button onClick={handleOpenCreate}>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{giftToDelete?.name_en}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGift}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminGiftsPage;