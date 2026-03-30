import { insertGiftMessage } from './giftMessageHelper';

/**
 * Handle successful gift send - shared UI updates for both chat and profile
 * 
 * @param {Object} params
 * @param {Object} params.result - Response from sendGiftSecure
 * @param {Object} params.giftData - Gift data { gift_id, gift_name, message, ... }
 * @param {Function} params.setWallet - State setter for wallet (optional)
 * @param {Function} params.showToast - Toast notification function
 * @param {Function} params.setShowGiftModal - State setter to close modal
 * @param {Object} params.language - Current language ('en' or 'ar')
 * @param {string} params.senderId - UUID of sender
 * @param {string} params.recipientId - UUID of recipient
 * @param {Function} params.onGiftMessageCreated - Callback when message is created (optional)
 */
export async function handleGiftSendSuccess({
  result,
  giftData,
  setWallet,
  showToast,
  setShowGiftModal,
  language,
  senderId,
  recipientId,
  onGiftMessageCreated,
}) {
  console.log('✅ Gift sent successfully:', result);

  // 1. Show success toast
  showToast({
    title: language === 'ar' ? 'تم الإرسال!' : 'Sent!',
    description: language === 'ar'
      ? 'تم إرسال الهدية بنجاح 🎁'
      : 'Gift sent successfully 🎁',
    className: "bg-green-50 border-green-200 text-green-800"
  });

  // 2. Update wallet state with returned data (if setter provided)
  if (result.sender_wallet && setWallet) {
    console.log('💰 Updating wallet state locally:', result.sender_wallet);
    setWallet({
      coins: result.sender_wallet.coins,
      gems: result.sender_wallet.gems,
      level: result.sender_wallet.level,
      xp: result.sender_wallet.xp,
    });
  }

  // 3. Insert gift message into chat using the shared helper
  if (giftData && senderId && recipientId) {
    try {
      console.log('💬 Creating gift message in chat...');

      console.log('[CHAT_GIFT_HELPER_INPUT]', {
        giftId: giftData?.gift_id || giftData?.gift?.id || null,
        giftName: giftData?.giftName || giftData?.gift?.name_en || giftData?.name_en || 'Gift',
        iconUrl: giftData?.iconUrl || giftData?.gift?.icon_url || giftData?.icon_url || '',
        message: giftData?.message || '',
      });

      const messageResult = await insertGiftMessage({
        senderId,
        recipientId,
        giftId: giftData?.gift_id || giftData?.gift?.id || null,
        giftName: giftData?.giftName || giftData?.gift?.name_en || giftData?.name_en || 'Gift',
        iconUrl: giftData?.iconUrl || giftData?.gift?.icon_url || giftData?.icon_url || '',
        message: giftData?.message || '',
      });

      if (messageResult.status === 'ok') {
        console.log('✅ Gift message created:', messageResult.message);

        if (onGiftMessageCreated && messageResult?.message) {
          onGiftMessageCreated(messageResult.message);
        }
      } else {
        console.warn('⚠️ Failed to create gift message:', messageResult.error);
        // Don't fail the whole operation if message insert fails
      }
    } catch (err) {
      console.error('⚠️ Error creating gift message:', err);
      // Don't fail the whole operation if message insert fails
    }
  }

  // 4. Close modal
  if (setShowGiftModal) {
    setShowGiftModal(false);
  }
}

/**
 * Handle gift send error - shared error handling for both chat and profile
 */
export function handleGiftSendError({
  result,
  showToast,
  navigate,
  language,
}) {
  console.error('❌ Gift sending failed:', result);

  let errorMsg = result.error_message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
  let errorTitle = language === 'ar' ? 'خطأ' : 'Error';
  let action = null;

  if (result.error_code === 'insufficient_coins') {
    errorMsg = language === 'ar'
      ? 'رصيدك غير كافى، اشحن الكوينز أولاً.'
      : 'Not enough coins. Please top up.';
    action = {
      label: language === 'ar' ? 'اشحن الآن' : 'Top Up Now',
      onClick: () => navigate('/plans'),
    };
  } else if (result.error_code === 'self_gift') {
    errorMsg = language === 'ar'
      ? 'لا يمكنك إرسال هدية لنفسك'
      : 'Cannot send gift to yourself';
  } else if (result.error_code === 'gift_not_found') {
    errorMsg = language === 'ar'
      ? 'الهدية غير موجودة'
      : 'Gift not found';
  } else if (result.error_code === 'not_authenticated') {
    errorMsg = language === 'ar'
      ? 'يجب تسجيل الدخول أولاً'
      : 'Please log in first';
  } else if (result.error_code === 'unauthorized') {
    errorMsg = language === 'ar'
      ? 'غير مصرح'
      : 'Unauthorized';
  }

  showToast({
    title: errorTitle,
    description: errorMsg,
    variant: 'destructive',
    action: action ? (
      <button
        onClick={action.onClick}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-transparent px-3 text-sm font-medium ring-offset-white transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-slate-100/40 group-[.destructive]:hover:border-red-500/30 group-[.destructive]:hover:bg-red-500/10 group-[.destructive]:hover:text-slate-50 group-[.destructive]:focus:ring-red-500"
      >
        {action.label}
      </button>
    ) : null
  });
}