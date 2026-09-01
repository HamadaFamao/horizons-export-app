import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PhotoGallery({ userId, photos = [], onPhotosUpdate, isOwner = false }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const openLightbox = (idx) => setLightboxIndex(idx);

  const closeLightbox = () => setLightboxIndex(null);

  const showPrevPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      return prev === 0 ? photos.length - 1 : prev - 1;
    });
  };

  const showNextPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      return prev === photos.length - 1 ? 0 : prev + 1;
    });
  };

  // Handle photo upload - KEEP EXACT SAME LOGIC
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File too large. Max 5MB allowed.");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const filename = `${userId}/${timestamp}.${fileExt}`;

      // Upload to Supabase storage
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

      const photoUrl = publicUrlData.publicUrl;

      // Insert into photos table
      // Assuming 'photos' table has profile_id or user_id that matches the auth.uid()
      // The `profile_id` column on the `photos` table might be a bigint, while `user_id` is uuid.
      // Based on the database schema, 'photos' has both user_id (uuid) and profile_id (bigint).
      // The `trg_set_photo_profile_id` trigger sets profile_id from profiles.id (UUID),
      // but it seems it uses `p.id = new.user_id` where `p.id` is UUID.
      // The `profile_id` in `photos` table is `bigint` and `profiles.id` is `uuid`.
      // This is a potential mismatch based on the provided DB schema.
      // For now, I'll insert `user_id` (UUID) as it matches `auth.uid()`, and rely on the trigger to populate `profile_id`.
      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          user_id: userId,
          url: photoUrl,
          is_public: true,
          is_primary: photos.length === 0 // First photo is primary
        })
        .select(); // Select to ensure we get the full inserted row if needed

      if (insertError) throw insertError;

      // Update parent state
      const updatedPhotos = [...photos, photoUrl];
      if (onPhotosUpdate) {
        onPhotosUpdate(updatedPhotos);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
        className: "bg-green-50 border-green-200"
      });

    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to upload photo',
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle photo delete - KEEP EXACT SAME LOGIC
  const handleDeletePhoto = async (photoUrl) => {
    if (!window.confirm('Delete this photo?')) return;

    setDeleting(photoUrl);

    try {
      // Delete from database first
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('url', photoUrl)
        .eq('user_id', userId);

      if (dbError) throw dbError;

      // Try to delete from storage (optional, okay if fails/orphan)
      try {
        const urlParts = photoUrl.split('profile-photos/');
        if (urlParts.length > 1) {
            const storagePath = urlParts[1]; // Extract path after bucket name
            await supabase.storage
                .from('profile-photos')
                .remove([storagePath]);
        }
      } catch (e) {
          console.warn("Could not delete file from storage, but DB record removed.", e);
      }

      // Update parent component
      const updatedPhotos = photos.filter(p => p !== photoUrl);
      if (onPhotosUpdate) {
        onPhotosUpdate(updatedPhotos);
      }

      toast({
        title: "Success",
        description: "Photo deleted",
        className: "bg-green-50 border-green-200"
      });

    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Error",
        description: 'Failed to delete photo',
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">My Photos</h2>

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group">
              <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-square">
                <img
                  src={photo}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                  onClick={() => openLightbox(idx)}
                  onError={(e) => {
                    e.currentTarget.parentElement.parentElement.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition duration-300 flex items-center justify-center gap-2">
                  {isOwner ? (
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      disabled={deleting === photo}
                      className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition disabled:opacity-50 shadow-lg"
                      aria-label="Delete photo"
                    >
                      {deleting === photo ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                  ) : (
                    <button
                      onClick={() => openLightbox(idx)}
                      className="bg-white/20 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                      aria-label="View photo"
                    >
                      <span className="text-lg">🔍</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isOwner && (
            <label className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-square border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer flex items-center justify-center group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className="text-center">
                {uploading ? (
                  <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-2" />
                ) : (
                  <Plus size={32} className="text-gray-400 mx-auto mb-2 group-hover:text-blue-500 transition" />
                )}
                <p className="text-sm text-gray-600 group-hover:text-blue-600 transition font-medium">
                  {uploading ? 'Uploading...' : 'Add Photo'}
                </p>
              </div>
            </label>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-gray-300 mb-4">
            <Plus size={56} />
          </div>
          <p className="text-gray-600 mb-6 font-medium">No photos yet</p>
          {isOwner && (
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition cursor-pointer font-semibold shadow-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              {uploading ? 'Uploading...' : 'Add Your First Photo'}
            </label>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-20"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            ✕
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={showPrevPhoto}
                className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/25 text-white w-12 h-12 rounded-full text-3xl flex items-center justify-center"
                aria-label="Previous photo"
              >
                ‹
              </button>

              <button
                onClick={showNextPhoto}
                className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/25 text-white w-12 h-12 rounded-full text-3xl flex items-center justify-center"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          <img
            src={lightboxPhoto}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}