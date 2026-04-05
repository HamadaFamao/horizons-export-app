import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Upload, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function AvatarModal({ userId, currentAvatar, galleryPhotos = [], onAvatarUpdate, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Handle new avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const timestamp = Date.now();
      // Sanitize filename
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${userId}/avatar-${timestamp}-${cleanFileName}`;

      // Check if bucket exists and create if not
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === 'profile-photos');

      if (!bucketExists) {
        console.log('[AvatarModal] Creating bucket "profile-photos"...');
        const { error: createError } = await supabase.storage.createBucket('profile-photos', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/gif', 'image/jpeg', 'image/webp'],
          fileSizeLimit: 5242880, // 5MB
        });

        if (createError) {
          console.error('[AvatarModal] Create bucket error:', createError);
          throw new Error(`Failed to create storage bucket: ${createError.message}`);
        }

        console.log('[AvatarModal] Bucket "profile-photos" created successfully');
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filename);

      const avatarUrl = publicUrlData.publicUrl;

      // Update profile avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      console.log('✅ Avatar updated:', avatarUrl);
      
      if (onAvatarUpdate) {
        onAvatarUpdate(avatarUrl);
      }
      
      toast({
        title: "Success",
        description: "Avatar updated successfully!",
        className: "bg-green-50 border-green-200"
      });

      setUploading(false);
      onClose();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive"
      });
      setUploading(false);
    }
  };

  // Handle selecting gallery photo as avatar
  const handleSelectGalleryPhoto = async (photoUrl) => {
    setSelectedPhoto(photoUrl);
    setUploading(true);

    try {
      // Update profile avatar_url to the selected gallery photo
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: photoUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      console.log('✅ Avatar set from gallery:', photoUrl);
      
      if (onAvatarUpdate) {
        onAvatarUpdate(photoUrl);
      }

      toast({
        title: "Success",
        description: "Avatar updated from gallery!",
        className: "bg-green-50 border-green-200"
      });

      setUploading(false);
      onClose();
    } catch (error) {
      console.error('Error setting avatar:', error);
      toast({
        title: "Error",
        description: "Failed to set avatar",
        variant: "destructive"
      });
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all scale-100">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">Change Avatar</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Upload New Photo */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload New Photo</h3>
            <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                 <Loader2 size={32} className="text-blue-500 animate-spin mb-2" />
              ) : (
                 <Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition" />
              )}
              <p className="text-sm text-gray-600 font-medium group-hover:text-blue-600 transition">
                {uploading ? 'Uploading...' : 'Click to upload'}
              </p>
            </label>
          </div>

          {/* Or Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-medium">or choose from gallery</span>
            </div>
          </div>

          {/* Choose from Gallery */}
          {galleryPhotos && galleryPhotos.length > 0 ? (
            <div>
              <div className="grid grid-cols-3 gap-3">
                {galleryPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectGalleryPhoto(photo)}
                    disabled={uploading}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                      selectedPhoto === photo || currentAvatar === photo
                        ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2'
                        : 'border-gray-200 hover:border-blue-500 hover:shadow-md'
                    } disabled:opacity-50`}
                  >
                    <img
                      src={photo}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {(selectedPhoto === photo || currentAvatar === photo) && (
                      <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center backdrop-blur-[1px]">
                        {uploading && selectedPhoto === photo ? (
                            <Loader2 size={24} className="text-white animate-spin" />
                        ) : (
                            <Check size={24} className="text-white drop-shadow-md" />
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">No gallery photos yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-6 flex gap-3 sticky bottom-0 bg-white">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition h-12"
            disabled={uploading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}