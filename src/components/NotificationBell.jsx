import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, UserPlus, Heart, MessageCircle, Bookmark, Gift, Users, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const NOTIFICATION_ICONS = {
  friend_request: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50' },
  friend_accepted: { icon: UserCheck, color: 'text-green-500', bg: 'bg-green-50' },
  follow: { icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
  post_like: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50' },
  post_comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  post_save: { icon: Bookmark, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  post_gift: { icon: Gift, color: 'text-purple-500', bg: 'bg-purple-50' },
  comment_reply: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-50' },
  gift_received: { icon: Gift, color: 'text-amber-500', bg: 'bg-amber-50' },
};

const NOTIFICATION_MESSAGES = {
  friend_request: (name) => `${name} sent you a friend request`,
  friend_accepted: (name) => `${name} accepted your friend request`,
  follow: (name) => `${name} started following you`,
  post_like: (name) => `${name} liked your post`,
  post_comment: (name) => `${name} commented on your post`,
  post_save: (name) => `${name} saved your post`,
  post_gift: (name) => `${name} sent a gift on your video`,
  comment_reply: (name) => `${name} replied to your comment`,
  gift_received: (name) => `${name} sent you a gift`,
};

export default function NotificationBell({ className }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [handledNotifs, setHandledNotifs] = useState(new Set());
  const panelRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchUnreadCount();

    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);

    // Friend requests count
    const { count: frCount } = await supabase
      .from('user_friends')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    setFriendRequests(frCount || 0);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.rpc('get_notifications', {
        p_limit: 30,
        p_offset: 0,
      });
      setNotifications(data || []);
      // Mark all as read
      await supabase.rpc('mark_notifications_read');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchNotifications();
  };

  const handleNotificationClick = (notif) => {
    setOpen(false);
    if (notif.entity_type === 'post' && notif.entity_id) {
      navigate(`/post/${notif.entity_id}`);
    } else if (notif.actor_profile_id) {
      navigate(`/user/${notif.actor_profile_id}`);
    }
  };

  const handleFriendAction = async (requesterId, action) => {
    const { data } = await supabase.rpc('handle_friend_request', {
      p_target_id: requesterId,
      p_action: action,
    });
    if (data?.success) {
      setHandledNotifs(prev => new Set([...prev, requesterId]));
      fetchNotifications();
      fetchUnreadCount();
    }
  };

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 hover:bg-gray-100 rounded-full transition"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-4 top-16 w-80 max-h-[80vh] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            {friendRequests > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {friendRequests} friend request{friendRequests > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => {
                const config = NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS.follow;
                const Icon = config.icon;
                const message = NOTIFICATION_MESSAGES[notif.type]?.(notif.actor_name || 'Someone') || 'New notification';

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition',
                      !notif.is_read && 'bg-blue-50/30'
                    )}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={notif.actor_avatar || '/default-avatar.svg'}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }}
                      />
                      <div className={cn('absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center', config.bg)}>
                        <Icon className={cn('w-3 h-3', config.color)} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>

                      {/* Friend Request Actions */}
                      {notif.type === 'friend_request' && !handledNotifs.has(notif.actor_id) && (
                        <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleFriendAction(notif.actor_id, 'accept')}
                            className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium hover:bg-indigo-700 transition"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleFriendAction(notif.actor_id, 'reject')}
                            className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium hover:bg-gray-200 transition"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {notif.type === 'friend_request' && handledNotifs.has(notif.actor_id) && (
                        <span className="text-xs text-green-600 font-medium mt-1 block">✅ Done</span>
                      )}

                      {notif.type === 'follow' && !handledNotifs.has(notif.actor_id) && (
                        <div className="mt-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { data } = await supabase.rpc('toggle_follow', { 
                                p_target_id: notif.actor_id 
                              });
                              if (data?.success) {
                                setHandledNotifs(prev => new Set([...prev, notif.actor_id]));
                              }
                            }}
                            className="bg-purple-600 text-white text-xs px-3 py-1 rounded-full font-medium hover:bg-purple-700 transition"
                          >
                            Follow Back
                          </button>
                        </div>
                      )}
                      {notif.type === 'follow' && handledNotifs.has(notif.actor_id) && (
                        <span className="text-xs text-green-600 font-medium mt-1 block">✅ Following</span>
                      )}
                    </div>

                    {!notif.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
