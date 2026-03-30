import { supabase } from './supabaseClient';

/**
 * Check and award daily reward if available
 * @param {string} userId 
 * @returns {Promise<{awarded: boolean, message?: string}>}
 */
export async function checkAndAwardDailyReward(userId) {
  if (!userId) return { awarded: false };

  try {
    // Call the RPC function to claim reward
    const { data, error } = await supabase.rpc('claim_daily_reward', {
      p_user_id: userId
    });

    if (error) {
      // If error contains "already claimed", just return false silently
      if (error.message && error.message.includes('already claimed')) {
        return { awarded: false };
      }
      console.error('Error claiming daily reward:', error);
      return { awarded: false };
    }

    // If successful
    if (data && data.ok) {
      return {
        awarded: true,
        message: `Daily Login Reward: +${data.points_added} points! (Streak: ${data.streak} days) 🔥`
      };
    }

    return { awarded: false };
  } catch (err) {
    console.error('Error in checkAndAwardDailyReward:', err);
    return { awarded: false };
  }
}

/**
 * Fetch recent rewards for user from reward_history
 * @param {string} userId - User ID
 * @param {number} limit - Number of rewards to fetch
 * @returns {Promise<Array>}
 */
export async function fetchUserRewards(userId, limit = 10) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('reward_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in fetchUserRewards:', err);
    return [];
  }
}