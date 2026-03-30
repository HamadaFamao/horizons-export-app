
import { getOrCreateThread, sendMessage } from './messagingUtils';

/**
 * Insert a gift message into the chat thread between two users
 * 
 * Uses the existing messaging infrastructure (threads + messages table).
 * Creates a specially formatted message that the UI renders as a gift bubble.
 * 
 * @param {Object} params
 * @param {string} params.senderId - UUID of the user sending the gift
 * @param {string} params.recipientId - UUID of the user receiving the gift
 * @param {number} params.giftId - ID of the gift (used for reference)
 * @param {string} params.giftName - Display name of the gift (e.g., "Rose")
 * @param {string} params.iconUrl - Optional URL for the gift icon
 * @param {string} params.message - Optional custom message from sender
 * 
 * @returns {Promise<{status: 'ok'|'error', error?: string, message?: Object}>}
 */
export async function insertGiftMessage(params) {
  const {
    senderId,
    recipientId,
    giftId,
    giftName = 'Gift',
    iconUrl = '',
    message = '',
  } = params;

  // Validate inputs
  if (!senderId || !recipientId) {
    console.error('❌ Missing required parameters for gift message');
    return {
      status: 'error',
      error: 'Missing required parameters: senderId, recipientId',
    };
  }

  try {
    console.log('💬 Creating gift message:', {
      senderId,
      recipientId,
      giftId,
      giftName,
      iconUrl,
      message,
    });

    // 1. Ensure a conversation thread exists between the two users
    const threadId = await getOrCreateThread(senderId, recipientId);

    // 2. Create the gift message content
    // Format: SENT_GIFT_JSON:{JSON_STRING}
    const safeMessage = message ? String(message) : '';

    const payload = {
      giftId: giftId || null,
      giftName: giftName || 'Gift',
      iconUrl: iconUrl || '',
      message: safeMessage,
    };

    const giftContent = `SENT_GIFT_JSON:${JSON.stringify(payload)}`;

    console.log('💬 Gift message payload:', giftContent);

    // 3. Insert into messages table using the shared messaging utility
    // This handles the correct schema (thread_id, sender_id, body)
    const newMessage = await sendMessage(threadId, senderId, giftContent);

    if (!newMessage) {
      console.error('❌ No data returned from gift message insert');
      return {
        status: 'error',
        error: 'Failed to create gift message',
      };
    }

    console.log('✅ Gift message created successfully:', newMessage.id);

    return {
      status: 'ok',
      message: newMessage, // Return the full message object for the UI
    };
  } catch (err) {
    console.error('❌ Exception in insertGiftMessage:', err);
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}
