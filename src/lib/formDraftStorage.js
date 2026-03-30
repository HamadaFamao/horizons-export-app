/**
 * formDraftStorage.js
 * Utility for persisting form drafts to localStorage.
 * Handles serialization, error checking, and logging for form persistence.
 */

const LOG_PREFIX = '[FORM DRAFT]';

/**
 * Saves the form draft to localStorage with JSON serialization.
 * Handles quota exceeded errors gracefully.
 * 
 * @param {string} key - The localStorage key to use
 * @param {object} data - The form data object to persist
 */
export const saveDraft = (key, data) => {
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
    // console.log(`${LOG_PREFIX} Saved draft for key: ${key}`, data);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error saving draft for key: ${key}`, error);
    
    // Handle quota exceeded specifically
    if (error.name === 'QuotaExceededError' || 
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn(`${LOG_PREFIX} LocalStorage quota exceeded. Draft could not be saved.`);
    }
  }
};

/**
 * Loads and deserializes the form draft from localStorage.
 * Handles JSON parse errors by clearing corrupted data.
 * 
 * @param {string} key - The localStorage key to retrieve
 * @returns {object|null} The parsed form data object, or null if not found/error
 */
export const loadDraft = (key) => {
  try {
    const serializedData = localStorage.getItem(key);
    
    if (serializedData === null) {
      console.log(`${LOG_PREFIX} No draft found for key: ${key}`);
      return null;
    }

    const data = JSON.parse(serializedData);
    console.log(`${LOG_PREFIX} Loaded draft for key: ${key}`, data);
    return data;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing draft for key: ${key}`, error);
    // If we can't parse it, it's corrupted. Clear it to prevent persistent errors.
    try {
      localStorage.removeItem(key);
      console.log(`${LOG_PREFIX} Cleared corrupted draft for key: ${key}`);
    } catch (e) {
      // ignore removal errors
    }
    return null;
  }
};

/**
 * Clears the form draft from localStorage.
 * 
 * @param {string} key - The localStorage key to remove
 */
export const clearDraft = (key) => {
  try {
    localStorage.removeItem(key);
    console.log(`${LOG_PREFIX} Cleared draft for key: ${key}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error clearing draft for key: ${key}`, error);
  }
};