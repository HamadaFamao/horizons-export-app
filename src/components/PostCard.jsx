import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import PostGiftPanel from '@/components/PostGiftPanel';
import { useToast } from '@/components/ui/use-toast';
import { Heart, MessageCircle, Share2, Bookmark, Gift, Eye, Play, Loader2, X, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PostCard({ post, currentUserId, onUpdate }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.is_liked || false);
  const [saved, setSaved] = useState(post.is_saved || false);
  const [likeCount, setLikeCount] = useState(Number(post.like_count || 0));
  const [viewCount, setViewCount] = useState(Number(post.view_count || 0));
  const [showComments, setShowComments] = useState(false);
  const [showPostReport, setShowPostReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRepostConfirm, setShowRepostConfirm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState(post.visibility || 'public');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [postGifts, setPostGifts] = useState([]);
  const [showGifts, setShowGifts] = useState(false);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const videoRef = useRef(null);
  const reportMenuRef = useRef(null);
  const ownerMenuRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [viewed, setViewed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!showPostReport) return;

    const handlePointerDown = (event) => {
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target)) {
        setShowPostReport(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowPostReport(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPostReport]);

  useEffect(() => {
    if (!showOwnerMenu) return;

    const handlePointerDown = (event) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(event.target)) {
        setShowOwnerMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowOwnerMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOwnerMenu]);

  useEffect(() => {
    if (post?.visibility) {
      setSelectedPrivacy(post.visibility);
    }
  }, [post?.visibility]);

  const fetchPostGifts = async () => {
    setLoadingGifts(true);
    try {
      const { data } = await supabase
        .from('post_gifts')
        .select(`
          id, gems_awarded, coins_spent, created_at,
          sender:sender_id (name, avatar_url, profile_id),
          gift:gift_id (name_en, icon_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setPostGifts(data || []);
    } finally {
      setLoadingGifts(false);
    }
  };

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
        const { error: viewErr } = await supabase.rpc('increment_post_view', { p_post_id: post.id });
        console.log('[VIEW_COUNT]', { post_id: post.id, error: viewErr });
        if (!viewErr) setViewCount(prev => prev + 1);
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
        .select('*, profiles:user_id(name, avatar_url, profile_id), replies:post_comments(id, content, created_at, profiles:user_id(name, avatar_url, profile_id))')
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

  const handleSubmitReply = async (parentId) => {
    if (!replyContent.trim() || !currentUserId) return;
    try {
      const { data } = await supabase.rpc('add_post_comment', {
        p_post_id: post.id,
        p_content: replyContent.trim(),
        p_parent_id: parentId,
      });
      if (data?.success) {
        setReplyContent('');
        setReplyTo(null);
        fetchComments();
      }
    } catch (err) {
      console.error(err);
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

        {post.is_pinned && (
          <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
            📌 Pinned
          </span>
        )}

        {currentUserId === post.user_id && post.visibility && post.visibility !== 'public' && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            {post.visibility === 'private' ? '🔒' :
             post.visibility === 'friends' ? '👫' :
             post.visibility === 'followers' ? '👥' : ''}
          </span>
        )}

        {currentUserId === post.user_id && (
          <div className="relative" ref={ownerMenuRef}>
            <button
              onClick={() => setShowOwnerMenu(!showOwnerMenu)}
              className="text-gray-400 hover:text-gray-600 transition p-1"
              aria-label="Open owner post menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showOwnerMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden w-44">
                <button
                  onClick={async () => {
                    setShowOwnerMenu(false);
                    await supabase.from('posts')
                      .update({ is_pinned: !post.is_pinned })
                      .eq('id', post.id);
                    if (onUpdate) onUpdate();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  📌 {post.is_pinned ? 'Unpin' : 'Pin Post'}
                </button>

                <button
                  onClick={() => {
                    setShowOwnerMenu(false);
                    setSelectedPrivacy(post.visibility || 'public');
                    setShowPrivacyModal(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  🔒 Privacy
                </button>

                <button
                  onClick={() => { setShowOwnerMenu(false); setShowRepostConfirm(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  🔄 Repost
                </button>

                <button
                  onClick={async () => {
                    setShowOwnerMenu(false);
                    if (!window.confirm('Delete this post?')) return;
                    await supabase.from('posts').update({ is_active: false }).eq('id', post.id);
                    if (onUpdate) onUpdate();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
        )}

        {currentUserId && currentUserId !== post.user_id && (
          <div className="relative ml-auto" ref={reportMenuRef}>
            <button
              onClick={() => setShowPostReport(!showPostReport)}
              className="text-gray-300 hover:text-gray-500 transition p-1"
              aria-label="Report post"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showPostReport && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border z-10 overflow-hidden w-36">
                <button
                  onClick={() => {
                    setShowPostReport(false);
                    setShowReportModal(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  🚩 Report Post
                </button>
                <button
                  onClick={() => { setShowPostReport(false); setShowRepostConfirm(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  🔄 Repost
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">🚩 Report Post</h3>
            <div className="space-y-2 mb-4">
              {['Spam', 'Inappropriate content', 'Harassment', 'Misinformation', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 rounded-xl text-sm transition',
                    reportReason === reason
                      ? 'bg-red-50 text-red-600 font-medium border border-red-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {reportReason === reason ? '✓ ' : ''}{reason}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowReportModal(false); setReportReason(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reportReason) return;
                  setSubmittingReport(true);
                  try {
                    await supabase.from('post_reports').insert({
                      post_id: post.id,
                      reporter_id: currentUserId,
                      reason: reportReason,
                    });
                    toast({ title: '✅ Report submitted', description: 'Thank you for your feedback.', className: 'bg-green-50 border-green-200 text-green-800' });
                    setShowReportModal(false);
                    setReportReason('');
                  } catch {
                    toast({ title: 'Already reported', variant: 'destructive' });
                  } finally {
                    setSubmittingReport(false);
                  }
                }}
                disabled={!reportReason || submittingReport}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
              >
                {submittingReport ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">🔒 Post Privacy</h3>
            <div className="space-y-2">
              {[
                { key: 'public', label: '🌍 Public', desc: 'Everyone can see this' },
                { key: 'followers', label: '👥 Followers', desc: 'Only your followers' },
                { key: 'friends', label: '👫 Friends', desc: 'Only your friends' },
                { key: 'private', label: '🔒 Private', desc: 'Only you' },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={async () => {
                    await supabase.from('posts')
                      .update({ visibility: v.key })
                      .eq('id', post.id);
                    setShowPrivacyModal(false);
                    if (onUpdate) onUpdate();
                    toast({ title: `✅ Privacy set to ${v.label}`, className: 'bg-green-50 border-green-200 text-green-800' });
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl transition flex items-start gap-3',
                    post.visibility === v.key
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{v.label}</p>
                    <p className="text-xs text-gray-400">{v.desc}</p>
                  </div>
                  {post.visibility === v.key && (
                    <span className="ml-auto text-indigo-600 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="relative bg-black">
          {post.type === 'video' ? (
            <div className="relative w-full" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
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
                <span>{viewCount.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <img
              src={post.media_url}
              alt={post.caption || 'post'}
              className="w-full object-contain max-h-[70vh]"
              style={{ background: '#000' }}
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
            {post.type === 'video' && currentUserId && currentUserId !== post.user_id && (
              <button
                onClick={() => setShowGiftPanel(true)}
                className="group"
              >
                <Gift className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition" />
              </button>
            )}

            {post.type === 'video' && Number(post.gift_count || 0) > 0 && (
              <button
                onClick={() => {
                  setShowGifts(!showGifts);
                  if (!showGifts) fetchPostGifts();
                }}
                className="flex items-center gap-1 text-xs text-purple-500 font-medium"
              >
                <Gift className="w-4 h-4" />
                {Number(post.gift_count).toLocaleString()} gifts
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
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl px-3 py-2">
                      <p className="text-xs font-semibold text-gray-900">{c.profiles?.name}</p>
                      <p className="text-sm text-gray-700">{c.content}</p>
                    </div>
                    <button
                      onClick={() => {
                        setReplyTo((prev) => (prev === c.id ? null : c.id));
                        setReplyContent('');
                      }}
                      className="text-xs text-gray-400 hover:text-indigo-500 mt-1 ml-2 transition"
                    >
                      Reply
                    </button>

                    {replyTo === c.id && currentUserId && (
                      <div className="flex gap-2 mt-2 ml-2">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(c.id)}
                          placeholder={`Reply to ${c.profiles?.name}...`}
                          className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <button
                          onClick={() => handleSubmitReply(c.id)}
                          disabled={!replyContent.trim()}
                          className="bg-indigo-500 text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                        >
                          Reply
                        </button>
                      </div>
                    )}

                    {/* Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-2 ml-2 space-y-2">
                        {c.replies.map(r => (
                          <div key={r.id} className="flex gap-2">
                            <img
                              src={r.profiles?.avatar_url || '/default-avatar.svg'}
                              className="w-6 h-6 rounded-full object-cover shrink-0 cursor-pointer"
                              onClick={() => navigate(`/user/${r.profiles?.profile_id}`)}
                            />
                            <div className="bg-indigo-50 rounded-2xl px-3 py-1.5 flex-1">
                              <p className="text-xs font-semibold text-gray-900">{r.profiles?.name}</p>
                              <p className="text-xs text-gray-700">{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

        {/* Gifts Section */}
        {showGifts && post.type === 'video' && (
          <div className="mt-3 space-y-2">
            <div className="h-px bg-gray-100" />
            <p className="text-xs font-semibold text-gray-500">🎁 Gifts Received</p>
            {loadingGifts ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-purple-400" />
            ) : postGifts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No gifts yet</p>
            ) : (
              <div className="space-y-2">
                {/* صاحب المحتوى يشوف كل التفاصيل */}
                {currentUserId === post.user_id ? (
                  postGifts.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <img
                        src={g.sender?.avatar_url || '/default-avatar.svg'}
                        className="w-7 h-7 rounded-full object-cover cursor-pointer"
                        onClick={() => navigate(`/user/${g.sender?.profile_id}`)}
                      />
                      <div className="flex-1">
                        <p
                          className="text-xs font-semibold text-gray-900 cursor-pointer hover:underline"
                          onClick={() => navigate(`/user/${g.sender?.profile_id}`)}
                        >
                          {g.sender?.name}
                        </p>
                        <p className="text-xs text-gray-400">sent {g.gift?.name_en}</p>
                      </div>
                      <div className="text-right">
                        {g.gift?.icon_url && (
                          <img src={g.gift.icon_url} className="w-8 h-8 object-contain" />
                        )}
                        <p className="text-xs text-green-600 font-semibold">
                          +{g.gems_awarded} 💎
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  /* الزائر يشوف الإجمالي بس */
                  <div className="flex items-center justify-between bg-purple-50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-500" />
                      <p className="text-sm font-semibold text-purple-700">
                        {postGifts.length} gift{postGifts.length !== 1 ? 's' : ''} sent
                      </p>
                    </div>
                    <p className="text-sm font-bold text-green-600">
                      +{postGifts.reduce((sum, g) => sum + (g.gems_awarded || 0), 0).toLocaleString()} 💎
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showGiftPanel && (
        <PostGiftPanel
          postId={post.id}
          onClose={() => setShowGiftPanel(false)}
          onGiftSent={() => {
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {/* Repost indicator */}
      {post.repost_of && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-xs text-gray-400 border-b border-gray-50">
          <span>🔄</span>
          <span className="font-medium text-gray-500">Reposted from</span>
          {post.original_user_name && (
            <span
              className="font-bold text-indigo-500 cursor-pointer hover:underline"
              onClick={() => navigate(`/user/${post.original_user_profile_id}`)}
            >
              {post.original_user_name}
            </span>
          )}
        </div>
      )}

      {showRepostConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowRepostConfirm(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">🔄 Repost</h3>
            <p className="text-sm text-gray-500 mb-4">
              This post will appear on your profile with a reference to the original author.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRepostConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase.from('posts').insert({
                      user_id: currentUserId,
                      type: post.type,
                      caption: post.caption,
                      media_url: post.media_url,
                      thumbnail_url: post.thumbnail_url,
                      duration_seconds: post.duration_seconds,
                      visibility: 'public',
                      repost_of: post.id,
                      repost_user_id: post.user_id,
                    });
                    if (error) throw error;
                    toast({ title: '✅ Reposted!', className: 'bg-green-50 border-green-200 text-green-800' });
                    setShowRepostConfirm(false);
                  } catch {
                    toast({ title: 'Error reposting', variant: 'destructive' });
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Repost ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
