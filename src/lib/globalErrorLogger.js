/**
 * globalErrorLogger.js
 * Provides comprehensive global error handling and logging for development.
 * Catches runtime errors and unhandled promise rejections to provide detailed console output.
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Formats a timestamp for logging
 */
const getTimestamp = () => {
  return new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3 
  });
};

/**
 * Set up global error handlers for window.onerror and unhandledrejection
 */
export const setupGlobalErrorHandlers = () => {
  // Only run in development mode to avoid noise in production
  if (!isDevelopment) {
    return;
  }

  console.log(`[System] Global Error Loggers Initialized (${getTimestamp()})`);

  // Handler for runtime errors (window.onerror)
  window.onerror = (message, source, lineno, colno, error) => {
    const timestamp = getTimestamp();
    
    // Use console.group for cleaner organization
    console.group(`%c[GLOBAL ERROR] %c${message}`, 'color: #ff4d4f; font-weight: bold; font-size: 12px;', 'color: #333; font-weight: bold;');
    
    console.log(`%cTimestamp:%c ${timestamp}`, 'color: #888; font-weight: bold;', 'color: #555;');
    console.log(`%cLocation:%c ${source}:${lineno}:${colno}`, 'color: #888; font-weight: bold;', 'color: #0066cc; text-decoration: underline;');
    
    if (error) {
      console.log('%cStack Trace:', 'color: #888; font-weight: bold;');
      console.error(error);
      
      // If error has a component stack (React error), log it specifically
      if (error.componentStack) {
        console.log('%cComponent Stack:', 'color: #888; font-weight: bold;');
        console.log(error.componentStack);
      }
    } else {
      console.log('%cError Object not available', 'color: #aaa; font-style: italic;');
    }
    
    console.groupEnd();

    // Return false to allow default browser error handling (printing to console)
    // Return true to suppress default handling
    return false; 
  };

  // Handler for unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const timestamp = getTimestamp();
    const reason = event.reason;

    console.group(`%c[UNHANDLED REJECTION] %c${reason instanceof Error ? reason.message : String(reason)}`, 'color: #faad14; font-weight: bold; font-size: 12px;', 'color: #333; font-weight: bold;');
    
    console.log(`%cTimestamp:%c ${timestamp}`, 'color: #888; font-weight: bold;', 'color: #555;');
    
    if (reason instanceof Error) {
      console.log('%cStack Trace:', 'color: #888; font-weight: bold;');
      console.error(reason);
    } else {
      console.log('%cReason:', 'color: #888; font-weight: bold;');
      console.warn(reason);
    }
    
    console.log('%cPromise:', 'color: #888; font-weight: bold;');
    console.dir(event.promise);

    console.groupEnd();
  };
};