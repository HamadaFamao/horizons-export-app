import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { updateLastSeen } from '@/lib/lastSeenUtils';

/**
 * Hook to update last_seen timestamp when user is active
 * Updates on mount and route changes, and every 5 minutes
 */
export const useUpdateLastSeen = () => {
  const location = useLocation();
  const isPublicPageRef = useRef(false);

  useEffect(() => {
    // Check if current page is a public page (no auth required)
    const publicPages = ['/auth', '/login', '/signup', '/landing'];
    isPublicPageRef.current = publicPages.some(page => location.pathname.startsWith(page));

    // Don't run on public pages
    if (isPublicPageRef.current) {
      return;
    }

    // Function to update last seen
    const runUpdate = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          await updateLastSeen(user.id);
        }
      } catch (error) {
        console.error('Error updating last_seen hook:', error);
      }
    };

    // Update immediately on route change
    runUpdate();

    // Set up interval to update every 5 minutes while on this page
    const intervalId = setInterval(runUpdate, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [location.pathname]);
};