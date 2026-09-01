import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PostCard from '@/components/PostCard';
import { Loader2, Bookmark, Heart, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'saved', label: 'Saved', icon: Bookmark, fn: 'get_saved_posts' },
  { key: 'liked', label: 'Liked', icon: Heart, fn: 'get_liked_posts' },
];

export default function SavedPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const offsetRef = useRef(0);

  const initialTab = searchParams.get('tab') || 'saved';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 12;

  const fetchPosts = useCallback(async (reset = false) => {
    if (!user?.id) return;

    const currentOffset = reset ? 0 : offsetRef.current;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
      const { data, error } = await supabase.rpc(tab.fn, {
        p_limit: LIMIT,
        p_offset: currentOffset,
      });

      if (error) throw error;

      const mapped = (data || []).map((p) => ({
        id: p.post_id,
        user_id: p.post_user_id,
        user_name: p.post_user_name,
        user_avatar: p.post_user_avatar,
        user_profile_id: p.post_user_profile_id,
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

      if (reset) {
        setPosts(mapped);
        offsetRef.current = LIMIT;
      } else {
        setPosts((prev) => [...prev, ...mapped]);
        offsetRef.current += LIMIT;
      }

      setHasMore((data || []).length === LIMIT);
    } catch (err) {
      console.error('[SavedPostsPage]', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'saved';
    setActiveTab(tab);
    setPosts([]);
    offsetRef.current = 0;
    setHasMore(true);
    if (user?.id) {
      fetchPosts(true);
    }
  }, [searchParams, user?.id, fetchPosts]);

  const handleTabChange = (tab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">My Collection</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition',
                    activeTab === tab.key
                      ? tab.key === 'saved'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-rose-500 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-5xl mb-3">
                {activeTab === 'saved' ? '🔖' : '❤️'}
              </div>
              <p className="text-gray-500 text-sm font-medium">
                {activeTab === 'saved' ? 'No saved posts yet' : 'No liked posts yet'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {activeTab === 'saved'
                  ? 'Save posts to find them here later'
                  : 'Like posts to find them here later'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  onUpdate={() => fetchPosts(true)}
                />
              ))}

              {hasMore && (
                <button
                  onClick={() => fetchPosts(false)}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Load more'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
