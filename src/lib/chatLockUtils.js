/**
 * Check if user is VIP
 * @param {string|Date} vipExpiresAt - VIP expiration timestamp
 * @returns {boolean} - True if user is VIP and not expired
 */
export function isUserVIP(vipExpiresAt) {
  if (!vipExpiresAt) {
    return false;
  }

  const expiresDate = new Date(vipExpiresAt);
  const now = new Date();

  return expiresDate > now;
}

/**
 * Check if chat is unlocked by open_until
 * @param {string|Date} openUntil - Thread open_until timestamp
 * @returns {boolean} - True if chat is unlocked
 */
export function isChatUnlockedByTime(openUntil) {
  if (!openUntil) {
    return false;
  }

  const openUntilDate = new Date(openUntil);
  const now = new Date();

  return openUntilDate > now;
}

/**
 * Determine if chat should be unlocked
 * @param {string|Date} openUntil - Thread open_until timestamp
 * @param {string|Date} vipExpiresAt - User VIP expiration timestamp
 * @returns {boolean} - True if chat is unlocked (either by time or VIP)
 */
export function shouldChatBeUnlocked(openUntil, vipExpiresAt) {
  const unlockedByTime = isChatUnlockedByTime(openUntil);
  const userIsVIP = isUserVIP(vipExpiresAt);

  return unlockedByTime || userIsVIP;
}

/**
 * Get time remaining until chat locks
 * @param {string|Date} openUntil - Thread open_until timestamp
 * @returns {string|null} - Human-readable time remaining (e.g. "2h 30m left")
 */
export function formatTimeRemaining(openUntil) {
  if (!openUntil) {
    return null;
  }

  const openUntilDate = new Date(openUntil);
  const now = new Date();
  const diffMs = openUntilDate.getTime() - now.getTime();

  // If already expired, return null
  if (diffMs <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  } else if (minutes > 0) {
    return `${minutes}m left`;
  } else {
    return 'Less than 1m left';
  }
}

/**
 * Format open_until timestamp into readable date/time
 * @param {string|Date} openUntil - Thread open_until timestamp
 * @returns {string|null} - Formatted string like "7 Dec, 18:30"
 */
export function formatOpenUntilTime(openUntil) {
  if (!openUntil) {
    return null;
  }

  const openUntilDate = new Date(openUntil);

  return openUntilDate.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get time until lock for locked chat display
 * @param {string|Date} openUntil - Thread open_until timestamp
 * @returns {string} - Human-readable time remaining
 */
export function getTimeUntilLock(openUntil) {
  if (!openUntil) {
    return 'Unknown';
  }

  const openUntilDate = new Date(openUntil);
  const now = new Date();

  if (openUntilDate <= now) {
    return 'Locked';
  }

  const diffMs = openUntilDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Less than 1 minute';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  }

  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}