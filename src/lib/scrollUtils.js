/**
 * Utility functions for managing scroll behavior in chat
 */

/**
 * Check if the user is scrolled to the bottom (or near the bottom)
 * @param {HTMLElement} container - The scrollable container
 * @param {number} threshold - How many pixels from bottom to consider "at bottom" (default 100)
 * @returns {boolean} - True if user is at or near the bottom
 */
export function isScrolledToBottom(container, threshold = 100) {
  if (!container) return true; // Default to true if no container

  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  
  return distanceFromBottom <= threshold;
}

/**
 * Scroll to the bottom of a container smoothly
 * @param {HTMLElement} container - The scrollable container
 * @param {boolean} smooth - Whether to use smooth scrolling (default true)
 */
export function scrollToBottom(container, smooth = true) {
  if (!container) return;

  const scrollOptions = {
    top: container.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  };

  container.scrollTo(scrollOptions);
}

/**
 * Scroll to a specific element within a container
 * @param {HTMLElement} element - The element to scroll to
 * @param {boolean} smooth - Whether to use smooth scrolling (default true)
 */
export function scrollToElement(element, smooth = true) {
  if (!element) return;

  element.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto',
    block: 'end',
  });
}

/**
 * Get the scroll position as a percentage (0 = top, 1 = bottom)
 * @param {HTMLElement} container - The scrollable container
 * @returns {number} - Scroll position as a percentage (0-1)
 */
export function getScrollPosition(container) {
  if (!container) return 1;

  const { scrollTop, scrollHeight, clientHeight } = container;
  const maxScroll = scrollHeight - clientHeight;
  
  return maxScroll === 0 ? 1 : scrollTop / maxScroll;
}