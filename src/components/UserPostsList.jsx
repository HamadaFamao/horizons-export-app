import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Eye, MessageCircle, Heart, Share2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_AVATAR } from '@/lib/constants';

export default function UserPostsList({ userId, userName, onPostDeleted }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'photos' | 'videos'
  const { toast } = useToast();

  useEffect(() => {
    fetchUserPosts();
  }, [userId]);

  const fetchUserPosts = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (filter === 'photos') query = query.eq('type', 'photo');
      if (filter === 'videos') query = query.eq('type', 'video');

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      toast({ title: 'Error fetching posts', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_active: false })
        .eq('id', postId);

      if (error) throw error;

      toast({ title: '🗑️ Post deleted' });
      setPosts(posts.filter(p => p.id !== postId));
      if (onPostDeleted) onPostDeleted();
    } catch (err) {
      toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' });
    }
  };

  const handleViewPost = (postId) => {
    // Navigate to post detail page
    window.location.href = `/post/${postId}`;
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilter('all');
            fetchUserPosts();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 All
        </button>
        <button
          onClick={() => {
            setFilter('photos');
            fetchUserPosts();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'photos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📷 Photos
        </button>
        <button
          onClick={() => {
            setFilter('videos');
            fetchUserPosts();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'videos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🎥 Videos
        </button>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No posts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Post Header */}
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleDateString()} at{' '}
                      {new Date(post.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewPost(post.id)}
                    title="View Post"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDeletePost(post.id)}
                    title="Delete Post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Post Media */}
              {post.media_url && (
                <div className="relative bg-gray-100 aspect-square overflow-hidden">
                  {post.type === 'video' ? (
                    <video
                      src={post.media_url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      alt="post"
                      className="w-full h-full object-cover"
                      onError={e => {
                        e.target.src = DEFAULT_AVATAR;
                      }}
                    />
                  )}
                </div>
              )}

              {/* Post Caption */}
              {post.caption && (
                <div className="p-3 border-t border-gray-100">
                  <p className="text-sm text-gray-700">{post.caption}</p>
                </div>
              )}

              {/* Engagement Stats */}
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>👁️ {post.view_count || 0} views</span>
                <span>Visibility: {post.visibility}</span>
              </div>

              {/* Engagement Buttons */}
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-gray-600">
                <button className="flex items-center gap-2 text-xs hover:text-red-600 transition">
                  <Heart className="w-4 h-4" />
                  <span>Like</span>
                </button>
                <button className="flex items-center gap-2 text-xs hover:text-blue-600 transition">
                  <MessageCircle className="w-4 h-4" />
                  <span>Comment</span>
                </button>
                <button className="flex items-center gap-2 text-xs hover:text-green-600 transition">
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
                <button className="flex items-center gap-2 text-xs hover:text-yellow-600 transition">
                  <Bookmark className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
