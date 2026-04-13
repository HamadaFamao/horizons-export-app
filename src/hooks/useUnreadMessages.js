import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useUnreadMessages(userId) {
  const [totalUnread, setTotalUnread] = useState(0);
  const channelRef = useRef(null);

  const fetchUnreadCount = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('unread_messages')
      .select('unread_count')
      .eq('user_id', userId);

    if (!error && data) {
      const total = data.reduce(
        (sum, row) => sum + (Number(row.unread_count) || 0),
        0
      );
      setTotalUnread(total);
    }
  };

  useEffect(() => {
    if (!userId) return;

    fetchUnreadCount();

    const channel = supabase
      .channel(`unread_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unread_messages',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { totalUnread, fetchUnreadCount };
}
