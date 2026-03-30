export function getVipInfo(profile) {
  const now = new Date();

  // Check if profile has required VIP fields
  // We explicitly check is_vip because sometimes we might want to soft-disable VIP without clearing dates
  if (!profile?.is_vip || !profile?.vip_number || !profile?.vip_until) {
    return {
      isVip: false,
      label: null,
      tier: null,
      expiresLabel: null,
      expiresAt: null,
      remainingDays: null,
    };
  }

  // Parse vip_until timestamp
  const expiresAt = new Date(profile.vip_until);
  
  // Check if date is valid and not in the past
  if (isNaN(expiresAt.getTime()) || expiresAt <= now) {
    return {
      isVip: false,
      label: null,
      tier: null,
      expiresLabel: null,
      expiresAt: null,
      remainingDays: null,
    };
  }

  // Calculate remaining days
  const msDiff = expiresAt.getTime() - now.getTime();
  const remainingDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  // Get VIP tier label
  let label = "";
  // Ensure tier is a number
  const tier = Number(profile.vip_number);

  switch (tier) {
    case 1:
      label = "Spark Week";
      break;
    case 2:
      label = "VIP Silver";
      break;
    case 3:
      label = "VIP Gold";
      break;
    case 4:
      label = "VIP Platinum";
      break;
    default:
      label = "VIP";
  }

  // Generate expiry label
  let expiresLabel = "";
  if (remainingDays > 1) {
    expiresLabel = `Expires in ${remainingDays} days`;
  } else if (remainingDays === 1) {
    expiresLabel = "Expires in 1 day";
  } else {
    // Should be caught by expiresAt <= now check, but safe fallback
    expiresLabel = "";
  }

  return {
    isVip: true,
    label,
    tier,
    expiresLabel,
    expiresAt,
    remainingDays,
  };
}

export function getVipStyle(vipNumber) {
  // Returns badge and avatar ring classes based on VIP tier
  
  if (!vipNumber || vipNumber === 0) {
    return {
      badgeClassName: null, // Don't show badge
      avatarRingClassName: '', // No ring
    };
  }

  switch (vipNumber) {
    case 1: // Spark Week - Light purple
      return {
        badgeClassName: 'bg-purple-100 text-purple-700',
        avatarRingClassName: 'ring-2 ring-purple-300',
      };

    case 2: // VIP Silver - Silver/Grey
      return {
        badgeClassName: 'bg-slate-100 text-slate-700',
        avatarRingClassName: 'ring-2 ring-slate-400',
      };

    case 3: // VIP Gold - Current gold style (unchanged)
      return {
        badgeClassName: 'bg-yellow-50 text-yellow-700',
        avatarRingClassName: 'ring-4 ring-yellow-400',
      };

    case 4: // VIP Platinum - Gradient
      return {
        badgeClassName: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
        avatarRingClassName: 'ring-4 ring-purple-400',
      };

    default:
      return {
        badgeClassName: 'bg-yellow-50 text-yellow-700',
        avatarRingClassName: 'ring-4 ring-yellow-400',
      };
  }
}