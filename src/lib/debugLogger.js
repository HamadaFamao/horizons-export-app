const STORAGE_KEY = 'debug_logs';

/**
 * Generic debug logger that saves logs to localStorage
 * Used for tracking redirects, auth state changes, etc.
 */
export const logDebug = (action, details, type = 'INFO') => {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newLog = {
      timestamp: new Date().toISOString(),
      action,
      details,
      type,
      id: Date.now() + Math.random()
    };
    
    // Keep last 50 logs to prevent storage bloat
    const updatedLogs = [newLog, ...logs].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
    
    // Dispatch event so components can update in real-time
    window.dispatchEvent(new Event('debug_logs_updated'));
    
    // Also log to console for devtools
    console.log(`[Debug] ${action}:`, details);
  } catch (e) {
    console.error("Failed to log debug info", e);
  }
};

/**
 * Specific helper for logging redirects (used by App.jsx and ProtectedRoute)
 */
export const logRedirect = (reason, targetPath) => {
  logDebug('REDIRECT', `${reason} -> ${targetPath}`, 'REDIRECT');
};

/**
 * Retrieve all debug logs
 */
export const getDebugLogs = () => {
   try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
   } catch { return []; }
};

/**
 * Clear all debug logs
 */
export const clearDebugLogs = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('debug_logs_updated'));
};

// --- Backward Compatibility Aliases ---
// These ensure that if any other component uses the old names, they still work.
export const getRedirectLogs = getDebugLogs;
export const clearRedirectLogs = clearDebugLogs;