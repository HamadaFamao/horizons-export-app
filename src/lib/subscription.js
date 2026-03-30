import { supabase } from '@/lib/supabaseClient';

// Map plan IDs to VIP tier levels
const TIER_MAPPING = {
  'spark-week': 1,
  'vip-silver': 2,
  'vip-gold': 3,
  'vip-platinum': 4,
  'vip-diamond-elite': 4, // Map to highest tier for now
};

// Helper to calculate duration interval string for Postgres
export const getDurationInterval = (planId, billingPeriod = 'monthly') => {
  if (planId === 'spark-week') return '7 days';
  return billingPeriod === 'yearly' ? '365 days' : '30 days';
};

export const VIP_PLANS = {
  // Spark Week
  'spark-week': {
    vip_number: 1,
    duration_interval: '7 days',
    name: 'Spark Week'
  },
  // Silver
  'vip-silver-monthly': {
    vip_number: 2,
    duration_interval: '30 days',
    name: 'VIP Silver Monthly'
  },
  'vip-silver-yearly': {
    vip_number: 2,
    duration_interval: '365 days',
    name: 'VIP Silver Yearly'
  },
  // Gold
  'vip-gold-monthly': {
    vip_number: 3,
    duration_interval: '30 days',
    name: 'VIP Gold Monthly'
  },
  'vip-gold-yearly': {
    vip_number: 3,
    duration_interval: '365 days',
    name: 'VIP Gold Yearly'
  },
  // Platinum
  'vip-platinum-monthly': {
    vip_number: 4,
    duration_interval: '30 days',
    name: 'VIP Platinum Monthly'
  },
  'vip-platinum-yearly': {
    vip_number: 4,
    duration_interval: '365 days',
    name: 'VIP Platinum Yearly'
  },
  // Diamond
  'vip-diamond-elite-monthly': {
    vip_number: 4,
    duration_interval: '30 days',
    name: 'VIP Diamond Elite Monthly'
  },
  'vip-diamond-elite-yearly': {
    vip_number: 4,
    duration_interval: '365 days',
    name: 'VIP Diamond Elite Yearly'
  }
};

/**
 * Purchases a VIP plan for a user.
 * Simulates the backend logic by creating a subscription and activating VIP status.
 * 
 * @param {string} userId - The user's UUID
 * @param {string} planId - The plan ID (e.g. 'vip-gold')
 * @param {string} billingPeriod - 'monthly' or 'yearly' (ignored for spark-week)
 */
export async function purchaseVipPlan(userId, planId, billingPeriod = 'monthly') {
  try {
    const vipNumber = TIER_MAPPING[planId];
    if (!vipNumber) {
      throw new Error(`Unknown plan ID: ${planId}`);
    }

    const durationInterval = getDurationInterval(planId, billingPeriod);
    const planSlug = planId === 'spark-week' ? planId : `${planId}-${billingPeriod}`;

    // 1. Create subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        plan_slug: planSlug,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error('Subscription creation failed:', subError);
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    // 2. Activate VIP status via database function
    const { error: vipError } = await supabase.rpc('set_vip_status', {
      p_user_id: userId,
      p_vip_number: vipNumber,
      p_duration: durationInterval,
    });

    if (vipError) {
      console.error('VIP activation failed:', vipError);
      throw new Error(`Failed to activate VIP: ${vipError.message}`);
    }

    return {
      success: true,
      subscription,
      vip_tier: vipNumber,
      duration: durationInterval
    };
  } catch (error) {
    console.error('Purchase error:', error);
    throw error;
  }
}