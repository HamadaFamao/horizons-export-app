/**
 * Validates a JWT token structure and claims.
 * Checks for:
 * 1. Valid 3-part structure (header.payload.signature)
 * 2. Valid JSON payload
 * 3. Presence of 'sub' claim (Subject/User ID)
 * 4. Expiration (exp) if present
 * 
 * @param {string} token - The JWT string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload (2nd part)
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Handle unicode characters correctly
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // Check for 'sub' claim (Subject/User ID) - Critical for Supabase
    if (!payload.sub) {
      console.warn('[JWT] Validation Failed: Missing "sub" claim');
      return false;
    }
    
    // Check expiration if present
    if (payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      // Add a small buffer (e.g., 5 seconds) to account for clock skew
      if (currentTime >= payload.exp + 5) {
        console.warn('[JWT] Validation Failed: Token expired');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('[JWT] Validation Exception:', error);
    return false;
  }
};