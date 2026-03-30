import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  getTotalUnreadCount,
  subscribeToUnreadMessages,
} from '@/lib/messagingUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const UnreadContext = createContext();

export const UnreadProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByThread, setUnreadByThread] = useState({});
  const [hasAgencyUnread, setHasAgencyUnread] = useState(false);
  const [agencyChatId, setAgencyChatId] = useState(null);

  const fetchUnreadStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      // 1. Total count (Private Messages)
      const total = await getTotalUnreadCount(user.id);
      setTotalUnread(total);

      // 2. Per thread count (Private Messages)
      const { data: unreadData } = await supabase
          .from('unread_messages')
          .select('thread_id, unread_count')
          .eq('user_id', user.id);

      if (unreadData) {
          const byThread = {};
          unreadData.forEach((item) => {
            byThread[item.thread_id] = item.unread_count;
          });
          setUnreadByThread(byThread);
      }
    } catch (err) {
      console.error("Failed to fetch unread status", err);
    }
  }, [user]);

  // Fetch Agency Chat Status
  const fetchAgencyStatus = useCallback(async () => {
    if (!user) return;

    try {
      // Get the agency chat ID for this user
      const { data: chatId, error: chatError } = await supabase.rpc('get_my_agency_chat_id');
      
      if (chatError || !chatId) {
        setAgencyChatId(null);
        return;
      }
      
      setAgencyChatId(chatId);

      // Get last read time
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_read_agency_at, profile_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Check for any messages newer than last_read
        const { count, error } = await supabase
          .from('agency_messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId)
          .gt('created_at', profile.last_read_agency_at || '2000-01-01')
          .neq('sender_profile_id', profile.profile_id); // Don't count own messages

        if (!error && count > 0) {
          setHasAgencyUnread(true);
        }
      }
    } catch (error) {
      console.error("Error fetching agency status:", error);
    }
  }, [user]);

  // Initial Load & Subscription for Private Messages
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      setUnreadByThread({});
      setHasAgencyUnread(false);
      return;
    }

    fetchUnreadStatus();
    fetchAgencyStatus();

    const unsubscribe = subscribeToUnreadMessages(user.id, (payload) => {
      fetchUnreadStatus();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, fetchUnreadStatus, fetchAgencyStatus]);

  // Subscription for Agency Messages
  useEffect(() => {
    if (!user || !agencyChatId) return;

    const channel = supabase
      .channel(`global_agency_check:${agencyChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agency_messages',
          filter: `chat_id=eq.${agencyChatId}`,
        },
        async (payload) => {
          // Check if sender is me
          const { data: profile } = await supabase
             .from('profiles')
             .select('profile_id')
             .eq('id', user.id)
             .single();
             
          if (profile && payload.new.sender_profile_id !== profile.profile_id) {
             // New message from someone else
             
             // If we are currently ON the agency chat page and it's visible, don't mark unread
             const isOnPage = location.pathname === `/agency-chat/${agencyChatId}`;
             const isVisible = !document.hidden;

             if (isOnPage && isVisible) {
               // Update last read immediately
               markAgencyRead();
             } else {
               setHasAgencyUnread(true);
               
               // Show toast if not focused or not on page
               if (!isOnPage || !isVisible) {
                 toast({
                   title: "Agency Chat",
                   description: "New message in your agency chat",
                   duration: 4000,
                 });
               }
             }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, agencyChatId, location.pathname, toast]);

  const getThreadUnread = useCallback((threadId) => {
    return unreadByThread[threadId] || 0;
  }, [unreadByThread]);

  const resetThreadUnread = useCallback((threadId) => {
    setUnreadByThread((prev) => ({
      ...prev,
      [threadId]: 0,
    }));
  }, []);

  const markAgencyRead = useCallback(async () => {
    if (!user) return;
    
    setHasAgencyUnread(false);
    
    try {
      await supabase
        .from('profiles')
        .update({ last_read_agency_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err) {
      console.error("Error marking agency read:", err);
    }
  }, [user]);

  const value = {
    totalUnread,
    unreadByThread,
    getThreadUnread,
    resetThreadUnread,
    refreshUnread: fetchUnreadStatus,
    hasAgencyUnread,
    markAgencyRead,
    agencyChatId
  };

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  );
};

export const useUnread = () => {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within UnreadProvider');
  }
  return context;
};