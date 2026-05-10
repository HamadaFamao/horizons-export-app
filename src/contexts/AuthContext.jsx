import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isHydrating, setIsHydrating] = useState(true);

  const initialFetchDone = useRef(false);

  const isInIframe = () => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  };

  const isAuthTokenError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.code || err?.error_code;
    const status = err?.status;

    return (
      status === 403 ||
      code === 'bad_jwt' ||
      msg.includes('bad_jwt') ||
      msg.includes('invalid claim') ||
      msg.includes('missing sub claim') ||
      msg.includes('invalid jwt') ||
      msg.includes('jwt')
    );
  };

  const clearSupabaseStorage = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('sb-')) sessionStorage.removeItem(key);
      });
    } catch (e) {
      console.error('[AuthContext] Error clearing storage:', e);
    }
  };

  const hardLogout = useCallback(async (reason = '') => {
    console.warn('[AuthContext] Logging out (forced).', reason);

    clearSupabaseStorage();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    setSession(null);
    setUser(null);
    initialFetchDone.current = false;
    setLoading(false);
    setIsHydrating(false);
  }, []);

  const refreshUserProfile = useCallback(async (userId) => {
    if (!userId) return;

    try {
      // Check ban first
      const { data: banData } = await supabase
        .from('user_bans')
        .select('banned_until, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (banData) {
        const isPermanent = !banData.banned_until;
        const isStillBanned = isPermanent || new Date(banData.banned_until) > new Date();

        if (isStillBanned) {
          console.warn('[AuthContext] User is banned - forcing logout');
          await hardLogout('[refreshUserProfile] user is banned');
          return;
        } else {
          // Ban expired - auto-lift
          await supabase.from('user_bans').update({ is_active: false }).eq('user_id', userId);
        }
      }

      const { data: profileData, error } = await supabase
        .from('v_user_profile_with_wallet')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (isAuthTokenError(error)) {
          await hardLogout('[refreshUserProfile] auth token error');
        }
        return;
      }

      if (profileData) {
        const isAdmin = profileData.isadmin === true;
        const adminRole = profileData.admin_role;
        const staffRole = profileData.staff_role;
        const isManager = adminRole === 'manager' || staffRole === 'manager';
        const isSuperAdmin = adminRole === 'admin' || staffRole === 'super_admin';
        const isAdminOrManager = isAdmin || isSuperAdmin || isManager || !!staffRole;

        let roleLabel = null;
        if (isManager) roleLabel = 'Manager';
        else if (isSuperAdmin || isAdmin) roleLabel = 'Admin';
        else if (staffRole) roleLabel = staffRole.replace('_', ' ').toUpperCase();

        setUser((prev) => ({
          ...(prev || {}),
          ...profileData,
          isAdminOrManager,
          roleLabel,
          canSeeAdminPanel: isAdminOrManager,
        }));
      }
    } catch (err) {
      console.error('[AuthContext] Error refreshing user profile:', err);
    }
  }, [hardLogout]);

  const signOut = useCallback(async () => {
    await hardLogout('[signOut]');
    return { error: null };
  }, [hardLogout]);

  useEffect(() => {
    let mounted = true;

    const validateAndSetSession = async (candidateSession, sourceTag = '') => {
      if (!mounted) return;

      // Horizons Preview (iframe) غالبًا بيكسر OAuth/storage
      // فهنا نخليها Logged out عمدًا علشان صفحة اللوجين تظهر بدل redirect وهمي.
      if (isInIframe()) {
        setSession(null);
        setUser(null);
        setLoading(false);
        setTimeout(() => mounted && setIsHydrating(false), 50);
        return;
      }

      if (!candidateSession?.access_token || !candidateSession?.user?.id) {
        setSession(null);
        setUser(null);
        setLoading(false);
        setTimeout(() => mounted && setIsHydrating(false), 50);
        return;
      }

      // ✅ Validate against server
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (isAuthTokenError(userError)) {
          await hardLogout(`[validateAndSetSession:${sourceTag}] bad token`);
          return;
        }
        // unknown error: treat as logged out
        setSession(null);
        setUser(null);
        setLoading(false);
        setTimeout(() => mounted && setIsHydrating(false), 50);
        return;
      }

      const safeUser = userRes?.user ?? candidateSession.user;
      setSession(candidateSession);
      setUser(safeUser);

      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        refreshUserProfile(safeUser?.id);
      }

      setLoading(false);
      setTimeout(() => mounted && setIsHydrating(false), 50);
    };

    const initAuth = async () => {
      try {
        setIsHydrating(true);

        const { data: sessionRes, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (isAuthTokenError(sessionError)) {
            await hardLogout('[initAuth:getSession] bad token');
            return;
          }
          throw sessionError;
        }

        await validateAndSetSession(sessionRes?.session ?? null, 'init');
      } catch (err) {
        console.error('[AuthContext] initAuth error:', err);
        await hardLogout('[initAuth] catch');
      }
    };

    initAuth();

    // Check ban every 60 seconds
    const banCheckInterval = setInterval(async () => {
      const currentSession = (await supabase.auth.getSession())?.data?.session;
      if (!currentSession?.user?.id) return;

      const { data: banData } = await supabase
        .from('user_bans')
        .select('banned_until, is_active')
        .eq('user_id', currentSession.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (banData) {
        const isPermanent = !banData.banned_until;
        const isStillBanned = isPermanent || new Date(banData.banned_until) > new Date();
        if (isStillBanned) {
          console.warn('[AuthContext] Ban detected - forcing logout');
          await hardLogout('[banCheck] user is banned');
        }
      }
    }, 60000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        initialFetchDone.current = false;
        clearSupabaseStorage();
        setLoading(false);
        setTimeout(() => mounted && setIsHydrating(false), 50);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        await validateAndSetSession(currentSession ?? null, event);
      }
    });

    return () => {
      mounted = false;
      clearInterval(banCheckInterval);
      if (subscription) subscription.unsubscribe();
    };
  }, [hardLogout, refreshUserProfile]);

  const value = {
    session,
    user,
    loading,
    isHydrating,
    refreshUserProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};