import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PostCard from '@/components/PostCard';

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          id, user_id, type, caption, media_url, thumbnail_url,
          duration_seconds, visibility, is_active, is_pinned, created_at,
          profiles!posts_user_id_fkey (name, avatar_url, profile_id)
        `)
        .eq('id', postId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
      } else if (!data) {
        setError('Post not found');
      } else {
        setPost({
          id: data.id,
          user_id: data.user_id,
          user_name: data.profiles?.name || 'Unknown user',
          user_avatar: data.profiles?.avatar_url,
          user_profile_id: data.profiles?.profile_id,
          type: data.type,
          caption: data.caption,
          media_url: data.media_url,
          thumbnail_url: data.thumbnail_url,
          duration_seconds: data.duration_seconds,
          visibility: data.visibility,
          is_active: data.is_active,
          is_pinned: data.is_pinned,
          created_at: data.created_at,
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          save_count: 0,
          share_count: 0,
          gift_count: 0,
          total_gems_from_gifts: 0,
          is_liked: false,
          is_saved: false,
        });
      }

      setLoading(false);
    };

    fetchPost();
  }, [postId]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 px-4 py-4 pb-20">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
            </div>
          ) : error ? (
            <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
              {error}
            </div>
          ) : (
            <PostCard
              post={post}
              currentUserId={user?.id}
              onUpdate={() => navigate(0)}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
