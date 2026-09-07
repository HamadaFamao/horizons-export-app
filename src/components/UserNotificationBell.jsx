import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MESSAGE_SELECT = `
  id,
  is_read,
  read_at,
  created_at,
  admin_messages!inner(
    id,
    title,
    content,
    media_url,
    message_type,
    created_at
  )
`;

export default function UserNotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchMessages = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_recipients')
        .select(MESSAGE_SELECT)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const nextMessages = (data || []).filter((item) => {
        const types = item.admin_messages?.message_type || [];
        return types.includes('notification') || types.includes('chat');
      });
      setMessages(nextMessages);
      setUnreadCount(nextMessages.filter((item) => !item.is_read).length);
    } catch (error) {
      console.error('[USER_MESSAGES_FETCH_ERROR]', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setUnreadCount(0);
      return undefined;
    }

    fetchMessages();

    const channel = supabase
      .channel(`user-admin-messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMessages((current) => current.filter((item) => item.id !== payload.old.id));
            return;
          }
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAsRead = async (messageId) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message || message.is_read) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('message_recipients')
      .update({ is_read: true, read_at: readAt })
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[USER_MESSAGE_MARK_READ_ERROR]', error);
      return;
    }

    setMessages((current) => current.map((item) => (
      item.id === messageId ? { ...item, is_read: true, read_at: readAt } : item
    )));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllAsRead = async () => {
    const unreadIds = messages.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('message_recipients')
      .update({ is_read: true, read_at: readAt })
      .in('id', unreadIds)
      .eq('user_id', user.id);

    if (error) {
      console.error('[USER_MESSAGES_MARK_ALL_READ_ERROR]', error);
      return;
    }

    setMessages((current) => current.map((item) => ({ ...item, is_read: true, read_at: readAt })));
    setUnreadCount(0);
  };

  const deleteMessage = async (event, messageId) => {
    event.stopPropagation();
    const message = messages.find((item) => item.id === messageId);
    const { error } = await supabase
      .from('message_recipients')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[USER_MESSAGE_DELETE_ERROR]', error);
      return;
    }

    setMessages((current) => current.filter((item) => item.id !== messageId));
    if (message && !message.is_read) setUnreadCount((count) => Math.max(0, count - 1));
  };

  if (!user?.id) return null;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 transition hover:bg-gray-100"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 flex max-h-96 w-96 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-gray-900">الإشعارات والرسائل</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button type="button" onClick={markAllAsRead} className="text-xs font-medium text-indigo-600">
                  تحديد الكل كمقروء
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400" aria-label="Close notifications">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">جاري التحميل...</div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">لا توجد رسائل</div>
            ) : messages.map((message) => (
              <div
                key={message.id}
                onClick={() => markAsRead(message.id)}
                className={cn('flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3', !message.is_read && 'bg-indigo-50')}
              >
                {!message.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />}
                <div className="min-w-0 flex-1">
                  {message.admin_messages?.title && <h4 className="truncate text-sm font-semibold text-gray-900">{message.admin_messages.title}</h4>}
                  <p className="line-clamp-2 text-sm text-gray-600">{message.admin_messages?.content}</p>
                  <time className="mt-1 block text-xs text-gray-400" dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleDateString('ar-EG')}
                  </time>
                </div>
                <button type="button" onClick={(event) => deleteMessage(event, message.id)} className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Delete message">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
