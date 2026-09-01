import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Image, Video, X, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function PostUploader({ onPostCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState('photo'); // 'photo' | 'video'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate
    const isVideo = selected.type.startsWith('video/');
    const isImage = selected.type.startsWith('image/');

    if (type === 'photo' && !isImage) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (type === 'video' && !isVideo) {
      toast({ title: 'Please select a video file', variant: 'destructive' });
      return;
    }

    // Size limits
    const maxSize = type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selected.size > maxSize) {
      toast({
        title: type === 'video' ? 'Video max size is 100MB' : 'Image max size is 10MB',
        variant: 'destructive'
      });
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!file || !user?.id) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to storage
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;

      // Create post in DB
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          type,
          caption: caption.trim() || null,
          media_url: mediaUrl,
          is_public: true,
        });

      if (postError) throw postError;

      toast({
        title: '✅ Post shared!',
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      // Reset
      setFile(null);
      setPreview(null);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onPostCreated) onPostCreated();

    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Type Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setType('photo'); handleRemoveFile(); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition',
            type === 'photo'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          <Image className="w-4 h-4" />
          Photo
        </button>
        <button
          onClick={() => { setType('video'); handleRemoveFile(); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition',
            type === 'video'
              ? 'bg-purple-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          <Video className="w-4 h-4" />
          Video
        </button>
      </div>

      {/* File Upload Area */}
      {!preview ? (
        <label className="block cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept={type === 'photo' ? 'image/*' : 'video/*'}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">
              {type === 'photo' ? 'Upload Photo' : 'Upload Video'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {type === 'photo' ? 'JPG, PNG, WEBP (max 10MB)' : 'MP4, WEBM (max 100MB)'}
            </p>
          </div>
        </label>
      ) : (
        <div className="relative rounded-xl overflow-hidden mb-4">
          {type === 'photo' ? (
            <img src={preview} alt="preview" className="w-full max-h-64 object-cover" />
          ) : (
            <video src={preview} className="w-full max-h-64 object-cover" controls />
          )}
          <button
            onClick={handleRemoveFile}
            className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Caption */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption..."
        maxLength={500}
        rows={2}
        className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none mt-3"
      />
      <p className="text-xs text-gray-400 text-right">{caption.length}/500</p>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="w-full mt-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
        ) : (
          'Share Post'
        )}
      </button>
    </div>
  );
}
