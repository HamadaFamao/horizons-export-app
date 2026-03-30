/**
 * Calculate level and XP stats based on total XP
 * 
 * XP curve:
 * - XP to go from level L to L+1 is L * 100
 * - Cumulative XP at start of level L is 100 * L * (L - 1) / 2
 * 
 * @param {number} totalXp - Total XP accumulated
 * @returns {Object} Object with level, xpInLevel, xpToNext, progress, xpStart
 */
export function getLevelStats(totalXp) {
  if (totalXp < 0 || typeof totalXp !== 'number') {
    totalXp = 0;
  }

  // Find current level by solving: totalXp >= 100 * L * (L - 1) / 2
  // This is a quadratic equation: L^2 - L - (2 * totalXp / 100) <= 0
  // Using quadratic formula: L = (1 + sqrt(1 + 8 * totalXp / 100)) / 2
  
  let level = Math.floor((1 + Math.sqrt(1 + (8 * totalXp) / 100)) / 2);
  
  // Verify and adjust if needed (due to floating point precision)
  while (true) {
    const xpAtLevelStart = (100 * level * (level - 1)) / 2;
    if (totalXp >= xpAtLevelStart) {
      const xpAtNextLevelStart = (100 * (level + 1) * level) / 2;
      if (totalXp < xpAtNextLevelStart) {
        break; // Correct level found
      }
      level++;
    } else {
      level--;
    }
  }

  // Calculate XP stats for current level
  const xpStart = (100 * level * (level - 1)) / 2;
  const xpInLevel = totalXp - xpStart;
  const xpToNext = level * 100;
  const progress = xpToNext > 0 ? xpInLevel / xpToNext : 0;

  return {
    level,
    xpInLevel: Math.floor(xpInLevel),
    xpToNext,
    progress: Math.min(progress, 1), // Cap at 1.0 for display
    xpStart: Math.floor(xpStart),
  };
}

/**
 * Format XP number with commas for display
 * @param {number} xp - XP value
 * @returns {string} Formatted string
 */
export function formatXp(xp) {
  return (xp || 0).toLocaleString();
}