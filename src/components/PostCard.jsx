import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Heart, MessageCircle, Share2, Bookmark, Gift, Eye, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PostCard({ post, currentUserId, onUpdate }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.is_liked || false);
  const [saved, setSaved] = useState(post.is_saved || false);
  const [likeCount, setLikeCount] = useState(Number(post.like_count || 0));
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [viewed, setViewed] = useState(false);

  const handleLike = async () => {
    if (!currentUserId) return;
    const prev = liked;
    setLiked(!liked);
    setLikeCount(prev ? likeCount - 1 : likeCount + 1);
    try {
      const { data, error } = await supabase.rpc('toggle_post_like', { p_post_id: post.id });
      if (error) throw error;
      setLiked(data.liked);
      setLikeCount(Number(data.like_count));
    } catch {
      setLiked(prev);
      setLikeCount(prev ? likeCount + 1 : likeCount - 1);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    const prev = saved;
    setSaved(!saved);
    try {
      await supabase.rpc('toggle_post_save', { p_post_id: post.id });
    } catch {
      setSaved(prev);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      await navigator.share({ url });
    } else {
      await navigator.clipboard.writeText(url);
    }
    await supabase.rpc('add_post_share', { p_post_id: post.id }).catch(() => {});
  };

  const handleVideoPlay = async () => {
    if (!playing) {
      videoRef.current?.play();
      setPlaying(true);
      if (!viewed) {
        setViewed(true);
        await supabase.rpc('increment_post_view', { p_post_id: post.id }).catch(() => {});
      }
    } else {
      videoRef.current?.pause();
      setPlaying(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('post_comments')
        .select('*, profiles:user_id(name, avatar_url, profile_id)')
        .eq('post_id', post.id)
        .eq('is_active', true)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
        .limit(20);
      setComments(data || []);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    if (!showComments) fetchComments();
    setShowComments(!showComments);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) return;
    setSubmittingComment(true);
    try {
      const { data } = await supabase.rpc('add_post_comment', {
        p_post_id: post.id,
        p_content: newComment.trim(),
      });
      if (data?.success) {
        setNewComment('');
        fetchComments();
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <img
          src={post.user_avatar || '/default-avatar.svg'}
          alt={post.user_name}
          className="w-10 h-10 rounded-full object-cover cursor-pointer"
          onClick={() => navigate(`/user/${post.user_profile_id}`)}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-gray-900 text-sm cursor-pointer hover:underline truncate"
            onClick={() => navigate(`/user/${post.user_profile_id}`)}
          >
            {post.user_name}
          </p>
          <p className="text-xs text-gray-400">
            {post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : ''}
          </p>
        </div>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="relative bg-black">
          {post.type === 'video' ? (
            <div className="relative aspect-[9/16] max-h-[500px]">
              <video
                ref={videoRef}
                src={post.media_url}
                className="w-full h-full object-contain"
                loop
                playsInline
                poster={post.thumbnail_url || undefined}
                onEnded={() => setPlaying(false)}
              />
              {!playing && (
                <button
                  onClick={handleVideoPlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/20"
                >
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <Play className="w-7 h-7 text-gray-900 ml-1" />
                  </div>
                </button>
              )}
              {playing && (
                <button
                  onClick={handleVideoPlay}
                  className="absolute inset-0"
                />
              )}
              {/* View count */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                <Eye className="w-3 h-3" />
                <span>{(post.view_count || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <img
              src={post.media_url}
              alt={post.caption || 'post'}
              className="w-full max-h-[500px] object-cover"
            />
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-800 leading-relaxed">{post.caption}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 group"
            >
              <Heart
                className={cn(
                  'w-6 h-6 transition-all',
                  liked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-gray-400 group-hover:text-rose-400'
                )}
              />
              <span className={cn('text-sm font-medium', liked ? 'text-rose-500' : 'text-gray-500')}>
                {likeCount > 0 ? likeCount.toLocaleString() : ''}
              </span>
            </button>

            {/* Comment */}
            <button
              onClick={handleToggleComments}
              className="flex items-center gap-1.5 group"
            >
              <MessageCircle className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition" />
              <span className="text-sm font-medium text-gray-500">
                {Number(post.comment_count || 0) > 0 ? Number(post.comment_count).toLocaleString() : ''}
              </span>
            </button>

            {/* Share */}
            <button onClick={handleShare} className="group">
              <Share2 className="w-6 h-6 text-gray-400 group-hover:text-green-400 transition" />
            </button>

            {/* Gift (فيديو بس) */}
            {post.type === 'video' && (
              <button className="group">
                <Gift className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition" />
              </button>
            )}
          </div>

          {/* Save */}
          <button onClick={handleSave} className="group">
            <Bookmark
              className={cn(
                'w-6 h-6 transition-all',
                saved ? 'fill-indigo-500 text-indigo-500' : 'text-gray-400 group-hover:text-indigo-400'
              )}
            />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-3 space-y-3">
            <div className="h-px bg-gray-100" />
            {loadingComments ? (
              <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <img
                    src={c.profiles?.avatar_url || '/default-avatar.svg'}
                    className="w-7 h-7 rounded-full object-cover shrink-0 cursor-pointer"
                    onClick={() => navigate(`/user/${c.profiles?.profile_id}`)}
                  />
                  <div className="bg-gray-50 rounded-2xl px-3 py-2 flex-1">
                    <p className="text-xs font-semibold text-gray-900">{c.profiles?.name}</p>
                    <p className="text-sm text-gray-700">{c.content}</p>
                  </div>
                </div>
              ))
            )}

            {/* Add Comment */}
            {currentUserId && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-indigo-600 transition"
                >
                  Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
