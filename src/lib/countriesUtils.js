import { supabase } from './supabaseClient';

/**
 * Fetch all countries from Supabase
 * Adapts to schema: code, name_en, flag
 * @returns {Promise<Array>} Array of countries
 */
export const fetchCountries = async () => {
  try {
    const { data, error } = await supabase
      .from('countries')
      .select('code, name_en, flag')
      .order('name_en', { ascending: true });

    if (error) {
      console.error('Error fetching countries:', error);
      return [];
    }

    // Normalize data structure to match expected format in app
    return (data || []).map(c => ({
      id: c.code, // Use code as unique ID since 'id' column might not exist
      name: c.name_en,
      code: c.code,
      flag_emoji: c.flag,
      flag_url: null // Schema uses emoji flags
    }));
  } catch (error) {
    console.error('Error in fetchCountries:', error);
    return [];
  }
};

/**
 * Get country by code or name
 * @param {string} identifier - Country code or name
 * @param {Array} countries - List of countries
 * @returns {object|null} Country object or null
 */
export const getCountryByIdentifier = (identifier, countries) => {
  if (!identifier || !countries) return null;

  const searchTerm = identifier.toLowerCase();

  // Try to find by code first
  let country = countries.find(c => c.code.toLowerCase() === searchTerm);
  if (country) return country;

  // Try to find by name
  country = countries.find(c => c.name.toLowerCase() === searchTerm);
  if (country) return country;

  // If identifier looks like a URL, try to extract code
  if (identifier && identifier.startsWith('http')) {
    const code = extractCountryCodeFromUrl(identifier);
    if (code) {
      country = countries.find(c => c.code === code);
      if (country) return country;
    }
  }

  return null;
};

/**
 * Extract country code from flag URL
 * @param {string} url - URL like https://flagcdn.com/w40/eg.png
 * @returns {string|null} Country code like "eg" or null
 */
export const extractCountryCodeFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    // Match pattern like /eg.png or /w40/eg.png
    const match = url.match(/\/([a-z]{2})\.png/i);
    if (match && match[1]) {
      return match[1].toUpperCase(); // Codes are usually uppercase in DB
    }
  } catch (error) {
    console.error('Error extracting country code from URL:', error);
  }

  return null;
};

/**
 * Normalize country value - convert URL to code if needed
 * @param {string} value - Country value (could be code, name, or URL)
 * @param {Array} countries - List of countries
 * @returns {string|null} Normalized country code or null
 */
export const normalizeCountryValue = (value, countries) => {
  if (!value) return null;

  // If it's already a code, return it
  if (countries.find(c => c.code === value)) {
    return value;
  }

  // If it's a name, find and return the code
  const country = countries.find(c => c.name === value);
  if (country) {
    return country.code;
  }

  // If it's a URL, extract code
  if (value.startsWith('http')) {
    const code = extractCountryCodeFromUrl(value);
    if (code && countries.find(c => c.code === code)) {
      return code;
    }
  }

  return null;
};

/**
 * Format country for display
 * @param {string} countryValue - Country code, name, or URL
 * @param {Array} countries - List of countries
 * @returns {object} { name, flag_url, flag_emoji } or null
 */
export const formatCountryForDisplay = (countryValue, countries) => {
  if (!countryValue || !countries) return null;

  const country = getCountryByIdentifier(countryValue, countries);
  if (!country) return null;

  return {
    name: country.name,
    flag_url: country.flag_url,
    flag_emoji: country.flag_emoji,
    code: country.code,
  };
};