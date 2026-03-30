
import { supabase } from "./supabaseClient";

export async function sendGiftSecure({ senderId, recipientId, giftId, roomId, message }) {
  if (!roomId) {
    throw new Error('roomId is required for send_live_room_gift');
  }

  const { data, error } = await supabase.rpc('send_live_room_gift', {
    p_room_id: roomId,
    p_receiver_id: recipientId,
    p_gift_id: giftId,
    p_message: message || null
  });

  if (error) {
    // Try fallback
    const fallbackRes = await supabase.rpc('send_live_room_gift', {
      room_id: roomId,
      receiver_id: recipientId,
      gift_id: giftId,
      message: message || null
    });
    
    if (fallbackRes.error) {
       console.error('[SEND_GIFT_SECURE_ERROR]', fallbackRes.error);
       return { status: "error", error_message: fallbackRes.error.message };
    }
    
    if (fallbackRes.data && fallbackRes.data.success === false) {
       return { status: "error", error_message: fallbackRes.data.error || "Failed" };
    }
    
    return { status: "ok", ...fallbackRes.data };
  }

  if (data && data.success === false) {
    return { status: "error", error_message: data.error || "Failed" };
  }

  return { status: "ok", ...data };
}
