import { supabase } from './supabaseClient';

/**
 * Normalize profile data before sending to Supabase
 * Converts empty strings to null for all fields
 * Handles array fields (interests) properly
 * Handles integer fields (age)
 * 
 * @param {Object} profileData - Raw profile data from form
 * @returns {Object} Normalized profile data ready for Supabase
 */
export function normalizeProfileData(profileData) {
  const normalized = {};

  // List of fields that should be arrays (text[])
  const arrayFields = ['interests', 'hobbies', 'languages'];

  // List of fields that are integers in the database
  // Note: living_in_code and from_code are TEXT (country codes), not integers
  const integerFields = ['age', 'profile_id', 'vip_number'];

  Object.keys(profileData).forEach((key) => {
    let value = profileData[key];

    // Skip undefined (but keep explicit nulls)
    if (value === undefined) {
      return;
    }

    // Handle array fields (interests, etc.)
    if (arrayFields.includes(key)) {
      // If empty string, null, or only whitespace, set to null
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        normalized[key] = null;
      }
      // If it's a string, split by comma and clean
      else if (typeof value === 'string') {
        const arrayItems = value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        // If array is empty after cleaning, set to null
        normalized[key] = arrayItems.length > 0 ? arrayItems : null;
      }
      // If it's already an array, filter out empty items
      else if (Array.isArray(value)) {
        const filtered = value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item && String(item).length > 0);

        normalized[key] = filtered.length > 0 ? filtered : null;
      }
      return;
    }

    // Handle integer fields (age, etc.)
    if (integerFields.includes(key)) {
      // If empty string, null, or 0 (if 0 is not valid for the field), set to null
      if (value === '' || value === null || value === undefined) {
        normalized[key] = null;
      }
      // If it's a valid number, keep it
      else if (typeof value === 'number' && !isNaN(value)) {
        normalized[key] = value;
      }
      // If it's a string that looks like a number, convert it
      else if (typeof value === 'string' && value.trim() !== '') {
        const numValue = parseInt(value, 10);
        normalized[key] = !isNaN(numValue) ? numValue : null;
      }
      // Otherwise set to null
      else {
        normalized[key] = null;
      }
      return;
    }

    // Handle regular text fields (including country codes like 'living_in_code')
    if (typeof value === 'string') {
      // If empty string or only whitespace, set to null
      if (value.trim() === '') {
        normalized[key] = null;
      }
      // Otherwise keep the value
      else {
        normalized[key] = value;
      }
      return;
    }

    // For all other types (boolean, jsonb, etc.), keep the value as is
    normalized[key] = value;
  });

  return normalized;
}

/**
 * Update user profile
 * Normalizes data before sending to Supabase
 * 
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function updateUserProfile(userId, profileData) {
  if (!userId) {
    return { data: null, error: 'No user ID provided' };
  }

  try {
    // Normalize the profile data before sending to Supabase
    const normalizedData = normalizeProfileData(profileData);

    // Remove fields that shouldn't be updated manually or don't exist
    delete normalizedData.email; // usually immutable in profile update
    delete normalizedData.id;
    
    // Legacy field handling - ensure we aren't sending conflicting data
    // if 'country' is present but we use 'living_in_code', prioritize code
    if (normalizedData.living_in_code) {
       // Optional: You might want to sync legacy fields if your app still uses them
       // normalizedData.country = normalizedData.living_in_code; 
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(normalizedData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in updateUserProfile:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Fetch user profile
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>}
 */
export async function fetchUserProfile(userId) {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error in fetchUserProfile:', err);
    return null;
  }
}

/**
 * Convert interests array to display string
 * 
 * @param {Array|string|null} interests - Interests from database
 * @returns {string} Comma-separated interests string
 */
export function interestsToString(interests) {
  if (!interests) return '';
  if (typeof interests === 'string') return interests;
  if (Array.isArray(interests)) return interests.join(', ');
  return '';
}

/**
 * Convert interests string to array
 * 
 * @param {string} interestsString - Comma-separated interests
 * @returns {Array|null} Array of interests or null
 */
export function interestsToArray(interestsString) {
  if (!interestsString || interestsString.trim() === '') return null;
  return interestsString
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// Backward compatibility aliases
export const getProfile = fetchUserProfile;
export const updateProfile = updateUserProfile;
export const cleanProfileData = normalizeProfileData;