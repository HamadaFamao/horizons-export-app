import { supabase } from './supabaseClient';

/**
 * Fetch user wallet (SELECT only, respects RLS)
 * @param {string} userId - User ID
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function fetchUserWallet(userId) {
  if (!userId) {
    return { data: null, error: 'No user ID provided' };
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('user_id, coins, gems, gems_on_hold, level, xp, is_vip, created_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No wallet found
        return { data: null, error: 'wallet_not_found' };
      }
      console.error('Error fetching wallet:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in fetchUserWallet:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Calculate level from XP (client-side, for display only)
 * This mirrors the DB logic for immediate UI updates if needed,
 * although the RPC returns the calculated level now.
 */
export function calculateLevelFromXp(xp) {
  if (xp >= 100000) return 6;
  if (xp >= 50000) return 5;
  if (xp >= 20000) return 4;
  if (xp >= 5000) return 3;
  if (xp >= 1000) return 2;
  return 1;
}

/**
 * Calculate XP progress towards next level
 * @param {number} xp - Current XP
 * @returns {Object} { currentLevel, nextLevel, xpToNextLevel, progress }
 */
export function getXpProgress(xp) {
  const currentLevel = calculateLevelFromXp(xp);
  
  // Define thresholds (must match calculateLevelFromXp)
  const thresholds = {
    1: 0,
    2: 1000,
    3: 5000,
    4: 20000,
    5: 50000,
    6: 100000
  };

  // If max level
  if (currentLevel >= 6) {
    return {
      currentLevel: 6,
      nextLevel: 6,
      xpToNextLevel: 0,
      progress: 100
    };
  }

  const nextLevel = currentLevel + 1;
  const currentLevelThreshold = thresholds[currentLevel];
  const nextLevelThreshold = thresholds[nextLevel];
  
  const xpInCurrentLevel = xp - currentLevelThreshold;
  const xpNeededForLevel = nextLevelThreshold - currentLevelThreshold;
  
  // Calculate percentage (0-100)
  let progress = (xpInCurrentLevel / xpNeededForLevel) * 100;
  progress = Math.min(Math.max(progress, 0), 100); // Clamp between 0 and 100

  return {
    currentLevel,
    nextLevel,
    xpToNextLevel: nextLevelThreshold - xp,
    progress
  };
}

/**
 * @deprecated Use fetchUserWallet instead. Client-side creation is disabled for security.
 * This export is maintained for backward compatibility.
 */
export async function getOrCreateWallet(userId) {
  return fetchUserWallet(userId);
}