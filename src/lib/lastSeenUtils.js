import { supabase } from './supabaseClient';

/**
 * Format a last_seen timestamp into a human-readable string
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} - Formatted string like "Online", "Last seen 5 minutes ago", etc.
 */
export function formatLastSeen(timestamp) {
  if (!timestamp) {
    return 'Last seen recently';
  }

  const lastSeenDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Online if within last 60 seconds
  if (diffSeconds < 60) {
    return 'Online';
  }

  // Minutes
  if (diffMinutes < 60) {
    return `Last seen ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }

  // Hours
  if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  // Days
  if (diffDays < 7) {
    return `Last seen ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  // Date format
  const options = { month: 'short', day: 'numeric' };
  const dateStr = lastSeenDate.toLocaleDateString('en-US', options);
  return `Last seen on ${dateStr}`;
}

/**
 * Check if user is currently online
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {boolean} - True if last_seen is within last 60 seconds
 */
export function isUserOnline(timestamp) {
  if (!timestamp) {
    return false;
  }

  const lastSeenDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  return diffSeconds < 60;
}

/**
 * Get online status object including boolean and text
 * @param {object} profile - Profile object containing last_seen
 * @returns {object} - { isOnline: boolean, text: string }
 */
export function getOnlineStatus(profile) {
  if (!profile) {
    return { isOnline: false, text: 'Offline' };
  }

  const timestamp = profile.last_seen || profile.last_seen_at;

  if (!timestamp) {
    return { isOnline: false, text: 'Last seen recently' };
  }

  const isOnline = isUserOnline(timestamp);
  const text = formatLastSeen(timestamp);

  return { isOnline, text };
}

/**
 * Update user's last_seen timestamp
 * Kept for compatibility with App.jsx
 * @param {string} userId - User ID
 */
export const updateLastSeen = async (userId) => {
  if (!userId) return;

  try {
    const now = new Date().toISOString();

    // Updating both last_seen (schema default) and last_seen_at (requested alias) for compatibility
    const { error } = await supabase
      .from('profiles')
      .update({ last_seen: now, last_seen_at: now })
      .eq('id', userId);

    if (error) {
      console.error('Error updating last_seen:', error);
    }
  } catch (error) {
    console.error('Error in updateLastSeen:', error);
  }
};