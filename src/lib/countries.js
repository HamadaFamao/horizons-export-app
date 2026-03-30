import { supabase } from './supabaseClient';

// In-memory cache
let countriesCache = null;
let cachePromise = null;

/**
 * Fetch all countries from Supabase with caching
 * Maps database columns (name_en) to app interface
 * Generates flagUrl dynamically from code
 * @returns {Promise<Array>} Array of { id, code, name, flagEmoji, flagUrl }
 */
export async function getAllCountries() {
  // Return cached data if available
  if (countriesCache) {
    return countriesCache;
  }

  // If a fetch is already in progress, wait for it
  if (cachePromise) {
    return cachePromise;
  }

  // Start new fetch
  cachePromise = (async () => {
    try {
      // Schema has: code, name_en, name_ar, flag (emoji)
      const { data, error } = await supabase
        .from('countries')
        .select('code, name_en, flag')
        .order('name_en', { ascending: true });

      if (error) {
        console.error('Error fetching countries:', error);
        return [];
      }

      // Transform to our interface
      const countries = (data || []).map((row) => ({
        id: row.code, // Use code as ID
        code: row.code,
        name: row.name_en, // Map name_en to name
        flagEmoji: row.flag,
        // Generate flag image URL dynamically
        flagUrl: `https://flagcdn.com/w40/${row.code.toLowerCase()}.png`,
      }));

      countriesCache = countries;
      return countries;
    } catch (err) {
      console.error('Error in getAllCountries:', err);
      return [];
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/**
 * Get a single country by code
 * @param {string} code - Country code (e.g. "EG")
 * @returns {Promise<Object|null>} Country object or null
 */
export async function getCountryByCode(code) {
  if (!code) return null;

  const countries = await getAllCountries();
  return countries.find((c) => c.code === code) || null;
}

/**
 * Get a single country by id (alias for getCountryByCode since we use code as id)
 */
export async function getCountryById(id) {
  return getCountryByCode(id);
}

/**
 * Clear cache (useful for testing or manual refresh)
 */
export function clearCountriesCache() {
  countriesCache = null;
}