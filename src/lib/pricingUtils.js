/**
 * Calculate bonus and total coins for a package
 * @param {number} baseCoins 
 * @param {number} bonusPercentage 
 * @returns {Object} { bonusCoins, totalCoins }
 */
export function calculatePackageDetails(baseCoins, bonusPercentage) {
  const bonusCoins = Math.floor(baseCoins * (bonusPercentage / 100));
  const totalCoins = baseCoins + bonusCoins;
  return { bonusCoins, totalCoins };
}

/**
 * Format currency
 * @param {number} amount 
 * @returns {string}
 */
export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format coins with commas
 * @param {number} amount 
 * @returns {string}
 */
export function formatCoins(amount) {
  return amount.toLocaleString();
}