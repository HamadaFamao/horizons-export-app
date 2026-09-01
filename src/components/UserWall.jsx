import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from '@/components/PostCard';
import PostUploader from '@/components/PostUploader';
import { Loader2, Grid, Film, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

const FILTERS = [
  { key: 'all', label: 'All', icon: Grid },
  { key: 'photo', label: 'Photos', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
];

export default function UserWall({ profileId, isOwner = false }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const LIMIT = 12;

  const fetchPosts = useCallback(async (reset = false) => {
    if (!profileId) return;
    const currentOffset = reset ? 0 : offset;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data, error } = await supabase.rpc('get_user_posts', {
        p_profile_id: profileId,
        p_limit: LIMIT,
        p_offset: currentOffset,
      });

      if (error) throw error;

      // نحوّل الأسماء للـ PostCard
      const mapped = (data || []).map(p => ({
        id: p.post_id,
        user_id: p.post_user_id,
        type: p.post_type,
        caption: p.post_caption,
        media_url: p.post_media_url,
        thumbnail_url: p.post_thumbnail_url,
        duration_seconds: p.post_duration_seconds,
        view_count: p.post_view_count,
        like_count: p.like_count,
        comment_count: p.comment_count,
        save_count: p.save_count,
        share_count: p.share_count,
        gift_count: p.gift_count,
        total_gems_from_gifts: p.total_gems_from_gifts,
        is_liked: p.is_liked,
        is_saved: p.is_saved,
        created_at: p.post_created_at,
      }));

      const filtered = filter === 'all'
        ? mapped
        : mapped.filter(p => p.type === filter);

      if (reset) {
        setPosts(filtered);
        setOffset(LIMIT);
      } else {
        setPosts(prev => [...prev, ...filtered]);
        setOffset(prev => prev + LIMIT);
      }

      setHasMore((data || []).length === LIMIT);
    } catch (err) {
      console.error('[UserWall] fetchPosts error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profileId, filter, offset]);

  useEffect(() => {
    fetchPosts(true);
  }, [profileId, filter]);

  const handlePostCreated = () => {
    setShowUploader(false);
    fetchPosts(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Posts</h2>
        {isOwner && (
          <button
            onClick={() => setShowUploader(!showUploader)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              showUploader
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm hover:opacity-90'
            )}
          >
            {showUploader ? 'Cancel' : '+ New Post'}
          </button>
        )}
      </div>

      {/* Uploader */}
      {isOwner && showUploader && (
        <PostUploader onPostCreated={handlePostCreated} />
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition',
                filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-500 text-sm">
            {isOwner ? 'Share your first post!' : 'No posts yet'}
          </p>
          {isOwner && !showUploader && (
            <button
              onClick={() => setShowUploader(true)}
              className="mt-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              + Create Post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onUpdate={() => fetchPosts(true)}
            />
          ))}

          {/* Load More */}
          {hasMore && (
            <button
              onClick={() => fetchPosts(false)}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition disabled:opacity-50"
            >
              {loadingMore
                ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
