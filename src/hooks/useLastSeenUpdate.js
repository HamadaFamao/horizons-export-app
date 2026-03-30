import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook to periodically update the current user's last_seen timestamp
 * Updates every 30 seconds when window is focused
 * Updates immediately when window regains focus
 */
export function useLastSeenUpdate(userId) {
  const updateIntervalRef = useRef(null);
  const focusTimeoutRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Function to update last_seen in database
    const updateLastSeen = async () => {
      try {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('profiles')
          .update({ last_seen: now, last_seen_at: now })
          .eq('id', userId);

        if (error) {
          console.error('Error updating last_seen:', error);
        } else {
          // console.log('✅ Updated last_seen:', now);
        }
      } catch (err) {
        console.error('Exception updating last_seen:', err);
      }
    };

    // Update immediately on mount
    updateLastSeen();

    // Set up periodic updates every 30 seconds
    updateIntervalRef.current = setInterval(() => {
      if (document.hidden) {
        // console.log('⏸️ Window is hidden, skipping last_seen update');
        return;
      }
      updateLastSeen();
    }, 30000); // 30 seconds

    // Handle window focus/blur
    const handleFocus = () => {
      // console.log('👁️ Window focused, updating last_seen');
      updateLastSeen();
    };

    const handleBlur = () => {
      // console.log('👁️ Window blurred');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Cleanup
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [userId]);
}