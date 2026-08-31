import { supabase } from '@/lib/supabaseClient';

/**
 * إرسال هدية داخل الروم فقط
 * هذا المسار يجب أن يستخدم RPC الخاص بالروم
 * وليس sendGiftSecure الخاص بالشات الخاص
 */
export async function sendLiveRoomGift({
  roomId,
  receiverId,
  giftId,
  message = '',
  quantity = 1
}) {
  if (!roomId) throw new Error('missing_room_id');
  if (!receiverId) throw new Error('missing_receiver_id');
  if (!giftId) throw new Error('missing_gift_id');

  console.log('[LIVE_ROOM_GIFT_SERVICE_SEND]', {
    roomId,
    receiverId,
    giftId,
    message,
    quantity
  });

  const { data, error } = await supabase.rpc('frontend_send_live_room_gift', {
    p_room_id: roomId,
    p_receiver_id: receiverId,
    p_gift_id: giftId,
    p_message: message || null,
    p_quantity: quantity || 1
  });

  console.log('[LIVE_ROOM_GIFT_RPC_RESULT]', { data, error });

  if (error) {
    throw error;
  }

  if (!data || data.success === false || data.status === 'error') {
    throw new Error(
      data?.error ||
      data?.error_code ||
      data?.error_message ||
      'gift_failed'
    );
  }

  console.log("[LIVE_ROOM_GIFT_SERVICE_RETURN]", data);
  return data;
}

export async function fetchLiveRoomGiftEventFull(eventId) {
  const { data, error } = await supabase
    .from('v_live_room_gift_events_full')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
}

export function buildLiveRoomGiftEffect(eventRow, language = 'en') {
  if (!eventRow) return null;

  const giftName =
    language === 'ar'
      ? (eventRow.gift_name_ar || eventRow.gift_name_en || 'هدية')
      : (eventRow.gift_name_en || eventRow.gift_name_ar || 'Gift');

  return {
    id: `room-gift-${eventRow.id}`,
    event_id: eventRow.id,
    room_id: eventRow.room_id,
    gift_id: eventRow.gift_id,
    gift_code: eventRow.gift_code || null,
    gift_name: giftName,

    sender_id: eventRow.sender_id,
    sender_name: eventRow.sender_name || 'User',
    sender_avatar: eventRow.sender_avatar || null,

    receiver_id: eventRow.receiver_id,
    receiver_name: eventRow.receiver_name || 'User',
    receiver_avatar: eventRow.receiver_avatar || null,

    created_at: eventRow.created_at,
    quantity: 1,

    icon_url: eventRow.icon_url || null,
    animation_type: eventRow.animation_type || 'floating',
    animation_asset_url: eventRow.animation_asset_url || null,
    animation_asset_type: (eventRow.animation_asset_type || '').toString().trim().toLowerCase(),
    animation_duration_ms: Number(eventRow.animation_duration_ms || 3000),
    effect_level: eventRow.effect_level || 'small',
    display_size: eventRow.display_size || 'small',

    show_in_room_overlay: eventRow.show_in_room_overlay !== false,
    show_in_room_chat: eventRow.show_in_room_chat !== false,
    show_in_global_ticker: !!eventRow.show_in_global_ticker,

    overlay_image_url: eventRow.overlay_image_url || null,
    ticker_image_url: eventRow.ticker_image_url || null,
    sound_key: eventRow.sound_key || null,

    coins_spent: Number(eventRow.coins_spent || 0),
    gems_awarded: Number(eventRow.gems_awarded || 0)
  };
}