import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook to handle page visibility changes and refresh session safely.
 * Dispatches custom events so ProtectedRoute knows when we are revalidating.
 */
export function usePageVisibility() {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Dispatch global event to signal checking start
        // This tells ProtectedRoute to temporarily pause redirects
        window.dispatchEvent(new Event('app:visibility-check-start'));
        console.log('[PageVisibility] Visibility detected - Checking session...');

        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[PageVisibility] Session verification failed:', error);
            // If session is truly dead, AuthContext should eventually pick this up via onAuthStateChange
          } else {
             // Session OK
             if (data?.session) {
                 console.log('[PageVisibility] Session confirmed active');
             } else {
                 console.log('[PageVisibility] No active session found');
             }
          }
        } catch (err) {
          console.error('[PageVisibility] Unexpected error during check:', err);
        } finally {
          // Short timeout to ensure any state updates from auth have settled
          // before we release the "checking" lock
          setTimeout(() => {
            window.dispatchEvent(new Event('app:visibility-check-end'));
            console.log('[PageVisibility] Check complete - Released lock');
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);
}