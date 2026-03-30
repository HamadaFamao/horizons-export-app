import { getLevelStats } from '@/utils/levels';

/**
 * Calculate level information from total XP
 * Compatible with legacy usages (returns object structure expected by UserProfilePage)
 * @param {number} totalXp - Total XP earned
 * @returns {object} - { currentLevel, nextLevel, xpInCurrentLevel, xpToNextLevel, totalXp, progressPercentage, isMaxLevel }
 */
export function getLevelFromXp(totalXp) {
  const stats = getLevelStats(totalXp);
  
  return {
    currentLevel: stats.level,
    nextLevel: stats.level + 1,
    xpInCurrentLevel: stats.xpInLevel,
    xpToNextLevel: stats.xpToNext,
    totalXp: totalXp || 0,
    progressPercentage: stats.progress * 100,
    isMaxLevel: false, // No max level with infinite system
  };
}

/**
 * Get XP threshold for a specific level
 * @param {number} level - Level number (1-based)
 * @returns {number} - XP required to reach that level
 */
export function getXpThresholdForLevel(level) {
  if (level <= 1) return 0;
  // Cumulative XP at start of level L is 50 * L * (L - 1)
  // This effectively means 50 * level * (level - 1) is the threshold to REACH level
  return 50 * level * (level - 1);
}

/**
 * @deprecated
 * Get all level thresholds - retained for backward compatibility if any component iterates levels
 * @returns {array} - Array of XP thresholds (first 20 levels)
 */
export function getLevelThresholds() {
  const thresholds = [];
  for (let i = 1; i <= 20; i++) {
    thresholds.push(getXpThresholdForLevel(i));
  }
  return thresholds;
}