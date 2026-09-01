import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, User, Settings, LogOut, Mail, Heart, Search, Home, Users, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WalletBadge from '@/components/WalletBadge';
import { DEFAULT_AVATAR } from '@/lib/constants';
import Logo from '@/components/Logo';
import NotificationBell from '@/components/NotificationBell';
import { useUnread } from '@/context/UnreadContext';

// ✅ CHANGE THIS IF YOUR ROUTE IS DIFFERENT
const AGENCY_DASHBOARD_PATH = '/agency/dashboard';

// ✅ Guaranteed fallback image (no broken icon)
const FALLBACK_AVATAR_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffe4e6"/>
      <stop offset="1" stop-color="#fce7f3"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g)"/>
  <circle cx="64" cy="52" r="22" fill="#fb7185" opacity="0.35"/>
  <path d="M24 112c8-22 28-34 40-34s32 12 40 34" fill="#fb7185" opacity="0.35"/>
</svg>`);

// Skeleton Component for Header User Area to match loaded state size perfectly
const UserHeaderSkeleton = () => (
  <div className="flex items-center gap-3 min-w-[140px] justify-end opacity-60">
    <div className="h-8 w-16 bg-gray-200 rounded-full" />
    <div className="h-10 w-10 rounded-full bg-gray-200 border-2 border-gray-50" />
  </div>
);

const AppHeader = () => {
  const { signOut, session, loading: authLoading, isHydrating } = useAuth();

  // NOTE: your hook may already know admin/avatar — we will use it as fallback.
  const currentUserHook = useCurrentUser();
  const profileUser = currentUserHook?.user ?? null;
  const profileLoading = currentUserHook?.loading ?? false;

  // Optional flags (if your hook provides them)
  const hookShowAdminBadge = currentUserHook?.showAdminBadge ?? false;
  const hookShowManagerBadge = currentUserHook?.showManagerBadge ?? false;

  const [headerProfile, setHeaderProfile] = useState(null);
  const [headerProfileLoading, setHeaderProfileLoading] = useState(false);

  // ✅ Agent/Agency membership detection
  const [agencyRole, setAgencyRole] = useState(null);
  const [agencyId, setAgencyId] = useState(null);
  const [agencyLoading, setAgencyLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation('common');
  const { totalUnread } = useUnread();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const sessionUser = session?.user ?? null;
  const isAuthed = !!sessionUser;

  // ✅ Fetch profile for header (try view, then profiles)
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!sessionUser?.id) {
        setHeaderProfile(null);
        return;
      }

      setHeaderProfileLoading(true);
      try {
        const q1 = await supabase
          .from('v_user_profile_with_wallet')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (mounted && !q1.error && q1.data) {
          setHeaderProfile(q1.data);
          return;
        }

        const q2 = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (mounted && !q2.error && q2.data) {
          setHeaderProfile(q2.data);
          return;
        }

        console.warn('[AppHeader] header profile fetch failed:', q1.error || q2.error);
        if (mounted) setHeaderProfile(null);
      } catch (e) {
        console.error('[AppHeader] header profile fetch exception:', e);
        if (mounted) setHeaderProfile(null);
      } finally {
        if (mounted) setHeaderProfileLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [sessionUser?.id]);

  // ✅ Detect if user is an agency agent/manager/owner (so we show agency dashboard link)
  useEffect(() => {
    let mounted = true;

    const TABLE_CANDIDATES = [
      'agency_memberships',
      'agency_membership',
      'agency_members',
      'agency_member',
    ];

    const roleIsAgentLike = (r) => {
      const v = String(r || '').toLowerCase();
      return ['agent', 'owner', 'manager', 'admin'].includes(v);
    };

    const fetchMembership = async () => {
      if (!sessionUser?.id) {
        setAgencyRole(null);
        setAgencyId(null);
        return;
      }

      setAgencyLoading(true);
      try {
        // Fast path: if profile already carries an agency role/id
        const roleFromProfile =
          headerProfile?.agency_role ||
          profileUser?.agency_role ||
          headerProfile?.family_role ||
          profileUser?.family_role ||
          headerProfile?.role_in_agency ||
          profileUser?.role_in_agency ||
          null;

        const agencyIdFromProfile =
          headerProfile?.agency_id ||
          profileUser?.agency_id ||
          headerProfile?.family_id ||
          profileUser?.family_id ||
          null;

        if (roleIsAgentLike(roleFromProfile)) {
          if (!mounted) return;
          setAgencyRole(roleFromProfile);
          setAgencyId(agencyIdFromProfile);
          return;
        }

        // Try membership tables
        let found = null;
        for (const table of TABLE_CANDIDATES) {
          const { data, error } = await supabase
            .from(table)
            .select('agency_id, family_id, role, is_agent, is_owner, is_manager')
            .eq('user_id', sessionUser.id)
            .limit(1)
            .maybeSingle();

          // table might not exist => skip
          if (error) {
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema')) continue;
            console.warn('[AppHeader] membership query error:', table, error);
            continue;
          }

          if (data) {
            found = { table, data };
            break;
          }
        }

        if (!mounted) return;

        if (found?.data) {
          const d = found.data;
          const role =
            d.role ||
            (d.is_owner ? 'owner' : null) ||
            (d.is_manager ? 'manager' : null) ||
            (d.is_agent ? 'agent' : null) ||
            null;

          const aId = d.agency_id || d.family_id || null;

          setAgencyRole(role);
          setAgencyId(aId);
        } else {
          setAgencyRole(null);
          setAgencyId(null);
        }
      } catch (e) {
        console.error('[AppHeader] membership fetch exception:', e);
        if (mounted) {
          setAgencyRole(null);
          setAgencyId(null);
        }
      } finally {
        if (mounted) setAgencyLoading(false);
      }
    };

    fetchMembership();
    return () => {
      mounted = false;
    };
  }, [
    sessionUser?.id,
    headerProfile?.agency_role,
    headerProfile?.agency_id,
    headerProfile?.family_role,
    headerProfile?.family_id,
    headerProfile?.updated_at,
    profileUser?.agency_role,
    profileUser?.agency_id,
    profileUser?.family_role,
    profileUser?.family_id,
    profileUser?.updated_at,
  ]);

  // ✅ Display name/email (prefer DB/profile data then session)
  const displayName =
    headerProfile?.name ||
    profileUser?.name ||
    sessionUser?.user_metadata?.name ||
    sessionUser?.user_metadata?.full_name ||
    sessionUser?.email ||
    'User';

  const displayEmail =
    headerProfile?.email ||
    profileUser?.email ||
    sessionUser?.email ||
    '';

  // ✅ Avatar: site avatar only (DB), never Google.
  const siteAvatar =
    headerProfile?.avatar_url ||
    headerProfile?.avatar ||
    headerProfile?.photo_url ||
    profileUser?.avatar_url ||
    profileUser?.avatar ||
    profileUser?.photo_url ||
    null;

  const initialAvatarSrc = siteAvatar || DEFAULT_AVATAR || FALLBACK_AVATAR_SVG;
  const [avatarSrc, setAvatarSrc] = useState(initialAvatarSrc);

  useEffect(() => {
    const next = siteAvatar || DEFAULT_AVATAR || FALLBACK_AVATAR_SVG;
    setAvatarSrc(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteAvatar]);

  // ✅ Admin detection
  const roles = useMemo(() => {
    const role =
      headerProfile?.admin_role ||
      profileUser?.admin_role ||
      headerProfile?.role ||
      profileUser?.role ||
      null;

    const staffRole =
      headerProfile?.staff_role ||
      profileUser?.staff_role ||
      null;

    const isManager = 
      role === 'manager' || 
      staffRole === 'manager' ||
      hookShowManagerBadge === true;

    const isSuperAdmin = 
      role === 'admin' || 
      staffRole === 'super_admin';

    const isAdmin =
      headerProfile?.isadmin === true ||
      profileUser?.isadmin === true ||
      headerProfile?.is_admin === true ||
      profileUser?.is_admin === true ||
      isSuperAdmin ||
      isManager ||
      !!staffRole ||
      hookShowAdminBadge === true;

    return { isAdmin, isManager, staffRole };
  }, [headerProfile, profileUser, hookShowAdminBadge, hookShowManagerBadge]);

  // ✅ Is Agency Agent?
  const isAgencyAgent = useMemo(() => {
    const r = String(agencyRole || '').toLowerCase();
    return ['agent', 'owner', 'manager'].includes(r);
  }, [agencyRole]);

  const loading =
    authLoading ||
    isHydrating ||
    headerProfileLoading ||
    agencyLoading ||
    (isAuthed && profileLoading);

  // Debug Logging
  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(
      `[AppHeader] Render #${renderCount.current} | authed=${isAuthed ? 'YES' : 'NO'} | ` +
      `headerProfile=${headerProfile?.id ? 'YES' : 'NO'} | profileUser=${profileUser?.id ? 'YES' : 'NO'} | ` +
      `admin=${roles.isAdmin ? 'YES' : 'NO'} | agencyAgent=${isAgencyAgent ? 'YES' : 'NO'} | agencyId=${agencyId || '—'} | ` +
      `avatar=${siteAvatar ? 'SITE' : 'FALLBACK'} | path=${location.pathname}`
    );
  });

  useEffect(() => {
    setCurrentLang(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (!isAuthed && location.pathname !== '/auth' && location.pathname !== '/auth/callback') {
      sessionStorage.setItem('lastRoute', location.pathname + location.search);
    }
  }, [location, isAuthed]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // ✅ NAV LINKS (added Rooms)
  const navLinks = [
    { name: t('home'), href: '/', icon: Home },
    { name: 'Rooms', href: '/rooms', icon: Mic }, // ✅ NEW
    { name: t('search'), href: '/search', icon: Search },
    { name: t('matches'), href: '/matches', icon: Heart },
    { name: t('messages'), href: '/messages', icon: Mail, badge: totalUnread },
  ];

  const getBadge = () => {
    if (roles.isManager) {
      return (
        <span className="flex items-center justify-center h-5 min-w-[50px] bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wide uppercase">
          Manager
        </span>
      );
    }
    if (roles.isAdmin) {
      return (
        <span className="flex items-center justify-center h-5 min-w-[50px] bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wide uppercase">
          Admin
        </span>
      );
    }
    return (
      <span className="h-5 min-w-[50px] opacity-0 pointer-events-none" aria-hidden="true">
        User
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-pink-100 h-16">
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* LEFT */}
          <div className="min-w-[120px] flex-shrink-0">
            <Link to="/" className="hover:opacity-90 transition-opacity block">
              <Logo size="default" textClassName="hidden sm:block" />
            </Link>
          </div>

          {/* MIDDLE */}
          {isAuthed && (
            <nav className="hidden md:flex items-center gap-6 flex-1 justify-center px-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.href}
                  end={link.href === '/'}
                  className={({ isActive }) =>
                    `relative text-base font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${isActive ? 'text-rose-500' : 'text-gray-600 hover:text-rose-500'
                    }`
                  }
                >
                  {link.name}
                  {link.badge > 0 && (
                    <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center h-5">
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          )}

          {/* RIGHT */}
          <div className="flex items-center justify-end gap-3 min-w-[160px] flex-shrink-0">
            {loading ? (
              <UserHeaderSkeleton />
            ) : isAuthed ? (
              <>
                <NotificationBell className="hidden sm:block" />

                <div className="hidden sm:block">
                  <WalletBadge />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden">
                      <Avatar className="h-10 w-10 border-2 border-rose-100">
                        <AvatarImage
                          src={avatarSrc}
                          alt={displayName}
                          className="object-cover"
                          onError={() => setAvatarSrc(FALLBACK_AVATAR_SVG)}
                        />
                        <AvatarFallback>
                          {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-64" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal p-3">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-none truncate max-w-[120px]" title={displayName}>
                            {displayName}
                          </p>
                          {getBadge()}
                        </div>
                        <p className="text-xs leading-none text-muted-foreground truncate font-mono bg-gray-50 p-1 rounded">
                          {displayEmail}
                        </p>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <div className="sm:hidden p-2">
                      <WalletBadge />
                    </div>
                    <DropdownMenuSeparator className="sm:hidden" />

                    {/* ✅ NEW: Rooms entry */}
                    <DropdownMenuItem onClick={() => navigate('/rooms')} className="cursor-pointer">
                      <Mic className="mr-2 h-4 w-4" />
                      <span>Rooms</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>{t('profile')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate('/matches')} className="cursor-pointer">
                      <Heart className="mr-2 h-4 w-4" />
                      <span>{t('matches')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate('/messages')} className="cursor-pointer">
                      <Mail className="mr-2 h-4 w-4" />
                      <span>{t('messages')}</span>
                      {totalUnread > 0 && (
                        <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 rounded-full">
                          {totalUnread}
                        </span>
                      )}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>{t('settings')}</span>
                    </DropdownMenuItem>

                    {/* ✅ Agency/Family Panel Link (Agent only) */}
                    {isAgencyAgent && (
                      <DropdownMenuItem
                        onClick={() => navigate(AGENCY_DASHBOARD_PATH)}
                        className="cursor-pointer bg-indigo-50 text-indigo-700 focus:bg-indigo-100 focus:text-indigo-800"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        <span>{t('agency_panel') || t('family') || 'Agency Panel'}</span>
                      </DropdownMenuItem>
                    )}

                    {/* ✅ Admin Panel Link */}
                    {(roles.isAdmin || roles.isManager) && (
                      <DropdownMenuItem
                        onClick={() => navigate('/admin')}
                        className="cursor-pointer bg-rose-50 text-rose-700 focus:bg-rose-100 focus:text-rose-800"
                      >
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        <span>{t('admin_panel')}</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => navigate('/auth')} className="btn-gradient text-white min-w-[80px]">
                {t('login')}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-10 px-0 ml-1">
                  {currentLang.startsWith('ar') ? 'AR' : 'EN'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('ar')}>العربية</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;