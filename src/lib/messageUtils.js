import { supabase } from './supabaseClient';

/**
 * Fetch the thread between two users or create if it doesn't exist
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<{status: 'ok'|'error', thread?: Object, error?: string}>}
 */
export async function getOrCreateThread(userId1, userId2) {
  if (!userId1 || !userId2) {
    return { status: 'error', error: 'Missing user IDs' };
  }

  try {
    // Try to find existing thread
    const { data: existingThread, error: queryError } = await supabase
      .from('threads')
      .select('*')
      .or(
        `and(user_a.eq.${userId1},user_b.eq.${userId2}),and(user_a.eq.${userId2},user_b.eq.${userId1})`
      )
      .single();

    if (existingThread) {
      return { status: 'ok', thread: existingThread };
    }

    // Create new thread if it doesn't exist
    const { data: newThread, error: createError } = await supabase
      .from('threads')
      .insert({
        user_a: userId1,
        user_b: userId2,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createError) {
      console.error('Error creating thread:', createError);
      return { status: 'error', error: createError.message };
    }

    return { status: 'ok', thread: newThread };
  } catch (err) {
    console.error('Exception in getOrCreateThread:', err);
    return { status: 'error', error: err.message };
  }
}

/**
 * Fetch a thread by its ID
 * @param {string} threadId 
 * @returns {Promise<{status: 'ok'|'error', thread?: Object, error?: string}>}
 */
export async function getThreadById(threadId) {
    if (!threadId) return { status: 'error', error: 'Missing threadId' };
    
    try {
        const { data: thread, error } = await supabase
            .from('threads')
            .select('*')
            .eq('id', threadId)
            .single();
            
        if (error) return { status: 'error', error: error.message };
        return { status: 'ok', thread };
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}

/**
 * Determine if current user is user_a or user_b in a thread
 * @param {Object} thread - Thread object
 * @param {string} currentUserId - Current user ID
 * @returns {'user_a' | 'user_b' | null}
 */
export function getUserRole(thread, currentUserId) {
  if (!thread || !currentUserId) return null;
  if (thread.user_a === currentUserId) return 'user_a';
  if (thread.user_b === currentUserId) return 'user_b';
  return null;
}

/**
 * Get the delete flag column name for current user
 * @param {string} userRole - 'user_a' or 'user_b'
 * @returns {string} - 'deleted_for_user_a' or 'deleted_for_user_b'
 */
export function getDeleteFlagColumn(userRole) {
  return userRole === 'user_a' ? 'deleted_for_user_a' : 'deleted_for_user_b';
}

/**
 * Load messages for a thread, respecting delete flags
 * @param {string} threadId - Thread ID
 * @param {string} currentUserId - Current user ID
 * @returns {Promise<{status: 'ok'|'error', messages?: Array, thread?: Object, error?: string}>}
 */
export async function loadThreadMessages(threadId, currentUserId) {
  if (!threadId || !currentUserId) {
    return { status: 'error', error: 'Missing threadId or currentUserId' };
  }

  try {
    // First, get the thread to determine user role
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (threadError) {
      console.error('Error fetching thread:', threadError);
      return { status: 'error', error: threadError.message };
    }

    const userRole = getUserRole(thread, currentUserId);
    if (!userRole) {
      return { status: 'error', error: 'User not in this thread' };
    }

    const deleteFlag = getDeleteFlagColumn(userRole);

    // Load messages, filtering out deleted ones for this user
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq(deleteFlag, false) // Only show messages not deleted for this user
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
      return { status: 'error', error: messagesError.message };
    }

    return { status: 'ok', messages: messages || [], thread };
  } catch (err) {
    console.error('Exception in loadThreadMessages:', err);
    return { status: 'error', error: err.message };
  }
}

/**
 * Mark messages as seen for the current user
 * @param {string} threadId - Thread ID
 * @param {string} currentUserId - Current user ID
 * @returns {Promise<{status: 'ok'|'error', error?: string}>}
 */
export async function markMessagesAsSeen(threadId, currentUserId) {
  if (!threadId || !currentUserId) {
    return { status: 'error', error: 'Missing threadId or currentUserId' };
  }

  try {
    // Mark all messages from OTHER user as seen
    const { error } = await supabase
      .from('messages')
      .update({ seen_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .neq('sender_id', currentUserId) // Messages from other user
      .is('seen_at', null); // Only unseen messages

    if (error) {
      console.error('Error marking messages as seen:', error);
      return { status: 'error', error: error.message };
    }
    
    // Also reset unread count in unread_messages table
    await supabase
      .from('unread_messages')
      .update({ unread_count: 0 })
      .eq('user_id', currentUserId)
      .eq('thread_id', threadId);

    return { status: 'ok' };
  } catch (err) {
    console.error('Exception in markMessagesAsSeen:', err);
    return { status: 'error', error: err.message };
  }
}

/**
 * Delete a message for the current user
 * @param {string} messageId - Message ID
 * @param {string} userRole - 'user_a' or 'user_b'
 * @returns {Promise<{status: 'ok'|'error', error?: string}>}
 */
export async function deleteMessageForUser(messageId, userRole) {
  if (!messageId || !userRole) {
    return { status: 'error', error: 'Missing messageId or userRole' };
  }

  try {
    const deleteFlag = getDeleteFlagColumn(userRole);

    const { error } = await supabase
      .from('messages')
      .update({ [deleteFlag]: true })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      return { status: 'error', error: error.message };
    }

    return { status: 'ok' };
  } catch (err) {
    console.error('Exception in deleteMessageForUser:', err);
    return { status: 'error', error: err.message };
  }
}

/**
 * Check if current user has seen any message from the other user
 * @param {Array} messages - Array of messages
 * @param {string} currentUserId - Current user ID
 * @returns {boolean} - True if any message from other user is seen
 */
export function hasSeenMessages(messages, currentUserId) {
  if (!messages || messages.length === 0) return false;
  
  // Check if any message from other user has been seen
  return messages.some(
    (msg) => msg.sender_id !== currentUserId && msg.seen_at !== null
  );
}

/**
 * Check if all messages from current user have been seen
 * @param {Array} messages - Array of messages
 * @param {string} currentUserId - Current user ID
 * @returns {boolean} - True if all messages from current user are seen
 */
export function allOwnMessagesSeen(messages, currentUserId) {
  if (!messages || messages.length === 0) return false;
  
  const ownMessages = messages.filter((msg) => msg.sender_id === currentUserId);
  if (ownMessages.length === 0) return false;
  
  return ownMessages.every((msg) => msg.seen_at !== null);
}