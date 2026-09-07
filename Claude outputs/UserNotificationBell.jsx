import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, X, MessageSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserNotificationBell() {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('message_recipients')
          .select(`
            id,
            is_read,
            created_at,
            admin_messages(
              id,
              title,
              content,
              media_url,
              message_type,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .in('admin_messages.message_type', ['notification'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.is_read).length || 0);
      } catch (err) {
        console.error('[FETCH_NOTIFICATIONS_ERROR]', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_recipients',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        console.log('[NEW_NOTIFICATION]', payload);
        // Refetch to get full message details
        fetchNotifications();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'message_recipients',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        console.log('[NOTIFICATION_UPDATE]', payload);
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('message_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[MARK_READ_ERROR]', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('message_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('[MARK_ALL_READ_ERROR]', err);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('message_recipients')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => prev - 1);
    } catch (err) {
      console.error('[DELETE_NOTIFICATION_ERROR]', err);
    }
  };

  if (!user?.id) return null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  تحديد الكل كمقروء
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Bell className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bell className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 text-center">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer',
                    !notif.is_read && 'bg-indigo-50'
                  )}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {!notif.is_read ? (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-gray-300" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {notif.admin_messages?.title && (
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {notif.admin_messages.title}
                        </h4>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {notif.admin_messages?.content}
                      </p>

                      {/* Media Preview */}
                      {notif.admin_messages?.media_url && (
                        <div className="mt-2">
                          {notif.admin_messages.media_url.includes('video') ? (
                            <video
                              src={notif.admin_messages.media_url}
                              className="w-full max-h-32 rounded-lg"
                              controls
                            />
                          ) : (
                            <img
                              src={notif.admin_messages.media_url}
                              alt="notification"
                              className="w-full max-h-32 rounded-lg object-cover"
                            />
                          )}
                        </div>
                      )}

                      {/* Time */}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-center">
              <a
                href="/notifications"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                عرض جميع الإشعارات →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NotificationCount({ className = '' }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from('message_recipients')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('admin_messages.message_type', ['notification']);

      setUnreadCount(count || 0);
    };

    fetchCount();

    // Subscribe to changes
    const channel = supabase
      .channel(`count:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_recipients',
        filter: `user_id=eq.${user.id}&is_read=eq.false`,
      }, () => fetchCount())
      .subscribe();

    return () => channel.unsubscribe();
  }, [user?.id]);

  if (unreadCount === 0) return null;

  return (
    <span className={cn('bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full', className)}>
      {unreadCount}
    </span>
  );
}
