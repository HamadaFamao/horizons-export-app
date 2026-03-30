import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { logRedirect } from '@/lib/debugLogger';

/**
 * ProtectedRoute (FIXED):
 * - Authentication is determined by `session?.user` (source of truth)
 * - `user` from context is treated as "profile/enriched user" and may lag behind
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, session, loading: authLoading, isHydrating } = useAuth();
  const location = useLocation();

  // Source of truth for auth:
  const authUser = session?.user || null;
  const authUserId = authUser?.id || null;

  // Admin check state
  const [isAdmin, setIsAdmin] = useState(null);
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const needsAdminCheck = adminOnly && !!authUserId;
  const isGlobalLoading =
    authLoading ||
    isHydrating ||
    (needsAdminCheck && (profileCheckLoading || isAdmin === null));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Reset on logout / missing auth
    if (!authUserId) {
      setIsAdmin(null);
      setProfileCheckLoading(false);
      return;
    }

    // No admin route => no extra work
    if (!adminOnly) {
      setProfileCheckLoading(false);
      return;
    }

    // Already determined
    if (isAdmin !== null) return;

    const checkAdminStatus = async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      if (!isMountedRef.current) return;

      console.log(`[PROTECTED ROUTE] Starting admin check for user: ${authUserId}`);
      setProfileCheckLoading(true);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('isadmin')
          .eq('id', authUserId)
          .single()
          .abortSignal(abortControllerRef.current.signal);

        if (!isMountedRef.current) return;

        if (error) {
          console.error('[PROTECTED ROUTE] Error fetching profile:', error);
          setIsAdmin(false);
        } else {
          const isUserAdmin = data?.isadmin === true;
          console.log(`[PROTECTED ROUTE] Admin access verified: ${isUserAdmin}`);
          setIsAdmin(isUserAdmin);
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          console.log('[PROTECTED ROUTE] Admin check aborted');
        } else {
          console.error('[PROTECTED ROUTE] Unexpected error:', err);
          if (isMountedRef.current) setIsAdmin(false);
        }
      } finally {
        if (isMountedRef.current) setProfileCheckLoading(false);
      }
    };

    if (!authLoading && !isHydrating) {
      checkAdminStatus();
    }

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [authUserId, adminOnly, authLoading, isHydrating, isAdmin]);

  // 1) LOADING
  if (isGlobalLoading) {
    let loadingMessage = 'Loading...';
    if (authLoading || isHydrating) loadingMessage = 'Checking session...';
    else if (profileCheckLoading) loadingMessage = 'Verifying access...';

    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <p className="text-sm text-rose-600 font-medium animate-pulse">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // 2) NOT AUTHENTICATED (use session as truth)
  if (!authUserId) {
    console.log(`[PROTECTED ROUTE] Access denied: No session user. Redirecting to Auth.`);
    logRedirect(`ProtectedRoute: No Session User`, `/auth?from=${location.pathname}`);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3) ADMIN ONLY
  if (adminOnly) {
    if (isAdmin === true) return children;

    console.warn(`[PROTECTED ROUTE] Admin denied for user ${authUserId}. Redirecting to Discover.`);
    logRedirect(`ProtectedRoute: Admin Access Denied (${authUserId})`, '/discover');
    return <Navigate to="/discover" replace />;
  }

  // 4) AUTHENTICATED
  // (Optional debug) show what context thinks:
  console.log('[PROTECTED ROUTE] Auth OK', {
    authUserId,
    contextUserId: user?.id || null,
  });

  return children;
};

export default ProtectedRoute;