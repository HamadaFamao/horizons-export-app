import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mountedRef.current) {
          setUser(data?.session?.user ?? null);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
        if (mountedRef.current) setUser(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    load();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mountedRef.current) setUser(session?.user ?? null);
    });

    return () => {
      mountedRef.current = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  return { user, loading };
}