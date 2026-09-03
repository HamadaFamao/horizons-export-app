import { supabase } from './supabaseClient';

/**
 * Fetch active gifts from v_active_gift_catalog view
 */
export async function fetchActiveGifts() {
  console.log('[GIFTS_FETCH] Fetching gifts from v_active_gift_catalog...');

  const { data, error } = await supabase
    .from('v_active_gift_catalog')
    .select('*')
    .eq('is_profile_gift_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[GIFTS_FETCH_ERROR]', error);
    throw error;
  }

  console.log('[GIFTS_FETCH_SUCCESS]', data);
  return data || [];
}

/**
 * Send gift using secure Postgres function
 * 
 * @param {string} senderId - Sender user ID
 * @param {string} recipientId - Recipient user ID
 * @param {number} giftId - Gift ID from gift_items
 * @param {string|null} message - Optional message
 * @returns {Promise<{status: 'ok'|'error', error_code?: string, error_message?: string, sender_wallet?: Object, recipient_wallet?: Object}>}
 */
export async function sendGift(senderId, recipientId, giftId, message = null) {
  if (!senderId || !recipientId || !giftId) {
    return {
      status: 'error',
      error_code: 'invalid_params',
      error_message: 'Missing required parameters',
    };
  }

  if (senderId === recipientId) {
    return {
      status: 'error',
      error_code: 'self_gift',
      error_message: 'Cannot send gift to yourself',
    };
  }

  try {
    console.log('🎁 Calling send_gift_secure with:', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_gift_id: giftId,
      p_message: message,
    });

    // Call the secure Postgres function via RPC
    const { data, error } = await supabase.rpc('send_gift_secure', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_gift_id: giftId,
      p_message: message || '',
    });

    console.log('📦 RPC response:', { data, error });

    // Check for error
    if (error) {
      console.error('❌ RPC error:', error);

      let errorCode = 'unknown_error';
      // Map DB errors to friendly codes
      if (error.message && error.message.includes('INSUFFICIENT_COINS')) {
        errorCode = 'insufficient_coins';
      } else if (error.message && error.message.includes('GIFT_NOT_FOUND')) {
        errorCode = 'gift_not_found';
      } else if (error.message && error.message.includes('NOT_AUTHENTICATED')) {
        errorCode = 'not_authenticated';
      } else if (error.message && error.message.includes('UNAUTHORIZED')) {
        errorCode = 'unauthorized';
      } else {
        // Pass through original error message if generic
        return {
          status: 'error',
          error_code: 'db_error',
          error_message: error.message
        };
      }

      return {
        status: 'error',
        error_code: errorCode,
        error_message: error.message,
      };
    }

    // Check if data is null or empty (RPC returns a TABLE, so we expect an array)
    if (!data || data.length === 0) {
      console.error('❌ No data returned from send_gift_secure');
      return {
        status: 'error',
        error_code: 'no_data',
        error_message: 'Failed to send gift. Please try again.',
      };
    }

    // Extract wallet data from response (first row)
    const result = data[0];
    const { sender_wallet, recipient_wallet } = result;

    console.log('✅ Gift sent successfully:', { sender_wallet, recipient_wallet });

    return {
      status: 'ok',
      sender_wallet,
      recipient_wallet,
    };
  } catch (err) {
    console.error('❌ Exception in sendGift:', err);
    return {
      status: 'error',
      error_code: 'exception',
      error_message: err.message,
    };
  }
}

/**
 * Fetch sent gifts for a user
 */
export async function fetchUserGifts(userId, type = 'sent', limit = 10) {
  if (!userId) return [];

  try {
    let query = supabase
      .from('sent_gifts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type === 'sent') {
      query = query.eq('sender_id', userId);
    } else if (type === 'received') {
      query = query.eq('receiver_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching gifts:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in fetchUserGifts:', err);
    return [];
  }
}