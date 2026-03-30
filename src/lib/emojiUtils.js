// Special emojis that get big message treatment
const BIG_EMOJI_LIST = [
  '❤️', '😍', '😘', '😂', '🤣', '😢', '😡',
  '🎉', '🔥', '💋', '✨', '💖', '🌟', '⭐',
  '👍', '👎', '👏', '🙌', '🤝', '🙏'
];

/**
 * Check if a message is an emoji-only message
 * @param {string} text - The message text
 * @returns {boolean} - True if message is a single special emoji
 */
export function isEmojiOnlyMessage(text) {
  if (!text) return false;

  const trimmed = text.trim();
  
  // Check if it's exactly one emoji from our list
  // Or if it's generally a short string that looks like an emoji (simple heuristic)
  if (BIG_EMOJI_LIST.includes(trimmed)) return true;
  
  // Also support any single emoji character if needed, but for now stick to list + length 2 (surrogate pairs)
  // Regular emoji detection is complex, simplified here to list + strict equality
  return BIG_EMOJI_LIST.includes(trimmed);
}

/**
 * Get the emoji from an emoji-only message
 * @param {string} text - The message text
 * @returns {string|null} - The emoji if it's an emoji-only message, null otherwise
 */
export function getEmojiFromMessage(text) {
  if (isEmojiOnlyMessage(text)) {
    return text.trim();
  }
  return null;
}

/**
 * Check if emoji should trigger burst effect
 * @param {string} emoji - The emoji character
 * @returns {boolean} - True if emoji should have burst effect
 */
export function shouldTriggerBurst(emoji) {
  const burstEmojis = ['❤️', '😍', '💋', '🎉', '🔥', '✨', '💖', '🌟'];
  return burstEmojis.includes(emoji);
}