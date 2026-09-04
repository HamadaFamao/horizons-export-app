import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PostCard from '@/components/PostCard';
import { Loader2, Bookmark, Heart, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// v2: fix tab state sync
const TABS = [
  { key: 'saved', label: 'Saved', icon: Bookmark, fn: 'get_saved_posts' },
  { key: 'liked', label: 'Liked', icon: Heart, fn: 'get_liked_posts' },
];

export default function SavedPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  const offsetRef = useRef(0);

  const initialTab = searchParams.get('tab') || 'saved';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 12;

  const fetchPosts = useCallback(async (reset = false) => {
    if (!userId) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const currentOffset = reset ? 0 : offsetRef.current;
      let postIds = [];

      if (activeTab === 'saved') {
        const { data, error: savesError } = await supabase
          .from('post_saves')
          .select('post_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + LIMIT - 1);
        console.log('[SavedPosts] saves query:', { data, error: savesError, userId });
        postIds = (data || []).map(r => r.post_id);
      } else {
        const { data } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + LIMIT - 1);
        postIds = (data || []).map(r => r.post_id);
      }

      if (postIds.length === 0) {
        if (reset) setPosts([]);
        setHasMore(false);
        return;
      }

      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id, user_id, type, caption, media_url,
          thumbnail_url, duration_seconds, view_count,
          is_active, created_at,
          profiles!inner (name, avatar_url, profile_id)
        `)
        .in('id', postIds)
        .eq('is_active', true);

      if (error) throw error;

      console.log('[SavedPosts] posts:', postsData?.length);

      const mapped = (postsData || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        user_name: p.profiles?.name,
        user_avatar: p.profiles?.avatar_url,
        user_profile_id: p.profiles?.profile_id,
        type: p.type,
        caption: p.caption,
        media_url: p.media_url,
        thumbnail_url: p.thumbnail_url,
        duration_seconds: p.duration_seconds,
        view_count: p.view_count,
        like_count: 0,
        comment_count: 0,
        save_count: 0,
        share_count: 0,
        gift_count: 0,
        total_gems_from_gifts: 0,
        is_liked: activeTab === 'liked',
        is_saved: activeTab === 'saved',
        created_at: p.created_at,
      }));

      if (reset) {
        setPosts(mapped);
        offsetRef.current = mapped.length;
      } else {
        setPosts(prev => [...prev, ...mapped]);
        offsetRef.current += mapped.length;
      }
      setHasMore(postIds.length === LIMIT);
    } catch (err) {
      console.error('[SavedPostsPage] error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (!userId) return;
    fetchPosts(true);
  }, [activeTab, userId]);

  console.log('[SavedPosts] render state:', {
    loading,
    postsLength: posts.length,
    activeTab,
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
    setPosts([]);
    setHasMore(true);
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
