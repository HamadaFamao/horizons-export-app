import { supabase } from './supabaseClient';

/**
 * Get or create a thread between two users
 */
export const getOrCreateThread = async (currentUserId, otherUserId) => {
  if (!currentUserId || !otherUserId) {
    throw new Error('Both user IDs are required');
  }

  try {
    // Check if thread already exists
    const { data: existingThread, error: selectError } = await supabase
      .from('threads')
      .select('id')
      .or(
        `and(user_a.eq.${currentUserId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${currentUserId})`
      )
      .single();

    if (existingThread) {
      return existingThread.id;
    }

    // Create new thread
    const { data: newThread, error: insertError } = await supabase
      .from('threads')
      .insert({
        user_a: currentUserId,
        user_b: otherUserId,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return newThread.id;
  } catch (error) {
    console.error('Error getting/creating thread:', error);
    throw error;
  }
};

/**
 * Fetch all threads for current user with last message info
 */
export const fetchUserThreads = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const { data: threads, error } = await supabase
      .from('threads')
      .select(
        `
        id,
        user_a,
        user_b,
        created_at,
        messages (
          id,
          content:body,
          created_at,
          sender_id
        )
      `
      )
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with participant profile data
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.user_a === userId ? thread.user_b : thread.user_a;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, age, avatar_url')
          .eq('id', otherUserId)
          .single();

        const sortedMessages = (thread.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        const lastMessage = sortedMessages[0] || null;

        return {
          id: thread.id,
          otherUserId,
          otherUserProfile: profile,
          lastMessage: lastMessage?.content || 'No messages yet',
          lastMessageTime: lastMessage?.created_at || thread.created_at,
          lastMessageSenderId: lastMessage?.sender_id,
        };
      })
    );

    return enrichedThreads.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );
  } catch (error) {
    console.error('Error fetching threads:', error);
    throw error;
  }
};

/**
 * Fetch all messages for a thread
 */
export const fetchThreadMessages = async (threadId) => {
  if (!threadId) {
    throw new Error('Thread ID is required');
  }

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, thread_id, sender_id, content:body, created_at, seen_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return messages || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

/**
 * Send a message
 */
export const sendMessage = async (threadId, senderId, content) => {
  if (!threadId || !senderId || !content?.trim()) {
    throw new Error('Thread ID, sender ID, and content are required');
  }

  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        body: content.trim(),
      })
      .select('id, thread_id, sender_id, content:body, created_at, seen_at')
      .single();

    if (error) throw error;
    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time messages for a thread
 */
export const subscribeToThreadMessages = (threadId, callback) => {
  if (!threadId) {
    console.error('Thread ID is required for subscription');
    return () => {};
  }

  const channel = supabase
    .channel(`messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const newMessage = {
          ...payload.new,
          content: payload.new.body, 
        };
        callback(newMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Format relative time for message timestamps
 */
export const formatMessageTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

/**
 * Mark messages as read for a thread
 */
export const markThreadAsRead = async (userId, threadId) => {
  if (!userId || !threadId) return;

  try {
    // We reset unread_count to 0 for this user/thread
    await supabase
      .from('unread_messages')
      .update({ unread_count: 0 })
      .eq('user_id', userId)
      .eq('thread_id', threadId);
  } catch (error) {
    console.error('Error marking thread as read:', error);
  }
};

/**
 * Get unread count for a specific thread
 */
export const getThreadUnreadCount = async (userId, threadId) => {
  if (!userId || !threadId) return 0;

  try {
    const { data, error } = await supabase
      .from('unread_messages')
      .select('unread_count')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .single();

    if (error || !data) return 0;
    return data.unread_count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

/**
 * Get total unread count across all threads
 */
export const getTotalUnreadCount = async (userId) => {
  if (!userId) return 0;

  try {
    const { data, error } = await supabase
      .from('unread_messages')
      .select('unread_count')
      .eq('user_id', userId);

    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
  } catch (error) {
    console.error('Error getting total unread count:', error);
    return 0;
  }
};

/**
 * Subscribe to unread message changes for a user
 */
export const subscribeToUnreadMessages = (userId, callback) => {
  if (!userId) return () => {};

  const channel = supabase
    .channel(`unread:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'unread_messages',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribe to new messages globally to update unread state
 */
export const subscribeToNewMessages = (userId, callback) => {
  if (!userId) return () => {};

  // We listen to all insertions to see if we are the target
  const channel = supabase
    .channel(`messages:global`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        // Since messages table doesn't store recipient directly in our schema
        // we might rely on the 'unread_messages' subscription mostly.
        // However, if we want immediate ping, we can try to deduce.
        // Ideally, the `unread_messages` update is enough.
        // We will keep this if we want to process the message content itself.
        
        // For now, simply callback if it exists
        if (callback) callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};