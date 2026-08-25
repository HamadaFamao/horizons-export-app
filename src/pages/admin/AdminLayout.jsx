import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, CreditCard, ShieldAlert, Database, Settings, Home, Gem, Award, Wrench, ArrowDownLeftFromCircle, Building, Mic, ArrowRightLeft, History, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import ConfirmDialog from '@/components/ConfirmDialog';

const AdminLayout = () => {
  const { user } = useAuth();
  const { can, permissions, staffRole, loading: permLoading } = useAdminPermissions();
  const navigate = useNavigate();
  const { isDirty, setDirty } = useUnsavedChanges();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [bannedAgenciesCount, setBannedAgenciesCount] = useState(0);

  const allNavItems = [
    { name: 'Overview',     href: 'dashboard',        icon: LayoutGrid,               permission: null },
    { name: 'Users',        href: 'users',             icon: Users,                    permission: 'can_manage_users' },
    { name: 'Account Migration', href: 'users/migration', icon: ArrowRightLeft,         permission: 'can_manage_users' },
    { name: 'Identity Manager', href: 'users/identity-manager', icon: Fingerprint,       permission: 'can_manage_users' },
    { name: 'Migration History', href: 'users/migration-history', icon: History,        permission: 'can_manage_users' },
    { name: 'Rooms',        href: 'rooms',             icon: Mic,                      permission: 'can_manage_rooms' },
    { name: 'Agencies',     href: '/admin/agencies',   icon: Building, iconEmoji: '🏢', permission: 'can_manage_agencies' },
    { name: 'Withdrawals',  href: 'withdrawals',       icon: ArrowDownLeftFromCircle,  permission: 'can_manage_withdrawals' },
    { name: 'Plans',        href: 'plans',             icon: CreditCard,               permission: 'can_manage_finance' },
    { name: 'Coins',        href: 'coins',             icon: Gem,                      permission: 'can_manage_finance' },
    { name: 'Rewards',      href: 'rewards',           icon: Award,                    permission: 'can_manage_finance' },
    { name: 'Reports',      href: 'reports',           icon: ShieldAlert,              permission: 'can_manage_users' },
    { name: 'Seed Data',    href: 'seed',              icon: Database,                 permission: 'can_manage_finance' },
    { name: 'Gifts',        href: 'gifts',             icon: Gem,                      permission: 'can_manage_finance' },
    { name: 'Tools',        href: 'tools/profile-id',  icon: Wrench,                   permission: 'can_manage_users' },
    { name: 'Settings',     href: 'settings',          icon: Settings,                 permission: 'can_manage_banners' },
  ];

  const navItems = allNavItems.filter(item => 
    !item.permission || (permissions && !!permissions[item.permission])
  );

  useEffect(() => {
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingReportsCount(count || 0);
    };

    fetchPendingCount();

    const channel = supabase
      .channel('reports-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchBannedAgenciesCount = async () => {
      const { count } = await supabase
        .from('agencies')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false);
      setBannedAgenciesCount(count || 0);
    };

    fetchBannedAgenciesCount();

    const channel = supabase
      .channel('agencies-banned-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agencies' },
        () => fetchBannedAgenciesCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Intercept navigation
  const handleNavClick = (e, path) => {
    if (isDirty) {
      e.preventDefault();
      console.log(`[AdminLayout] Navigation prevented to ${path} due to unsaved changes.`);
      setPendingPath(path);
      setShowConfirm(true);
    }
  };

  const handleBackToSite = () => {
    const path = '/';
    if (isDirty) {
        console.log(`[AdminLayout] Back to site prevented due to unsaved changes.`);
        setPendingPath(path);
        setShowConfirm(true);
    } else {
        navigate(path);
    }
  };

  const handleConfirmLeave = () => {
    console.log('[AdminLayout] User chose to leave. Discarding changes.');
    setDirty(false); // Reset dirty state
    setShowConfirm(false);
    if (pendingPath) {
      if (pendingPath.startsWith('/')) {
         navigate(pendingPath);
      } else {
         navigate(`/admin/${pendingPath}`);
      }
    }
  };

  const handleStay = () => {
    console.log('[AdminLayout] User chose to stay.');
    setShowConfirm(false);
    setPendingPath(null);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
      <ConfirmDialog 
        open={showConfirm}
        onStay={handleStay}
        onLeave={handleConfirmLeave}
        title="Unsaved Changes"
        description="You have unsaved changes in the form. Are you sure you want to leave? Your changes will be lost."
      />

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-pink-100 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rose-500">Admin Panel</h2>
          {staffRole && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              staffRole === 'manager' ? 'bg-purple-100 text-purple-700' :
              staffRole === 'super_admin' ? 'bg-blue-100 text-blue-700' :
              staffRole === 'moderator' ? 'bg-green-100 text-green-700' :
              'bg-amber-100 text-amber-700'
            }`}>{staffRole.replace('_', ' ').toUpperCase()}</span>
          )}
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg bg-rose-50 text-rose-600"
        >
          ☰
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col p-4 shadow-xl">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-rose-500">Admin Panel</h2>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
              {staffRole && (
                <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                  staffRole === 'manager' ? 'bg-purple-100 text-purple-700' :
                  staffRole === 'super_admin' ? 'bg-blue-100 text-blue-700' :
                  staffRole === 'moderator' ? 'bg-green-100 text-green-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{staffRole.replace('_', ' ').toUpperCase()}</span>
              )}
            </div>
            <nav className="flex-1 overflow-y-auto">
              <ul>
                {navItems.map(item => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      end={item.href === 'dashboard'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-4 py-3 my-1 rounded-lg text-gray-700 transition-colors hover:bg-rose-100 hover:text-rose-600",
                        { "bg-rose-200 text-rose-700 font-semibold": isActive }
                      )}
                    >
                      {item.iconEmoji ? (
                        <span className="text-base leading-none">{item.iconEmoji}</span>
                      ) : (
                        <item.icon className="w-5 h-5" />
                      )}
                      <span>{item.name}</span>
                      {item.href === 'reports' && pendingReportsCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {pendingReportsCount}
                        </span>
                      )}
                      {(item.href === '/admin/agencies' || item.href === 'agencies') && bannedAgenciesCount > 0 && (
                        <span className="ml-auto bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {bannedAgenciesCount}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto pt-4 border-t border-pink-100">
              <Button variant="ghost" className="w-full justify-start" onClick={handleBackToSite}>
                <Home className="w-5 h-5 mr-3" />
                Back to Site
              </Button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-64 bg-white/80 backdrop-blur-md border-r border-pink-100 p-4 flex-col h-screen sticky top-0">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold gradient-text">Admin Panel</h2>
          <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          {staffRole && (
            <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
              staffRole === 'manager'     ? 'bg-purple-100 text-purple-700' :
              staffRole === 'super_admin' ? 'bg-blue-100 text-blue-700' :
              staffRole === 'moderator'   ? 'bg-green-100 text-green-700' :
              staffRole === 'finance'     ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {staffRole.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>
        <nav className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          <ul>
            {navItems.map(item => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  end={item.href === 'dashboard'}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3 my-1 rounded-lg text-gray-700 transition-colors hover:bg-rose-100 hover:text-rose-600",
                    { "bg-rose-200 text-rose-700 font-semibold": isActive }
                  )}
                >
                  {item.iconEmoji ? (
                    <span className="text-base leading-none">{item.iconEmoji}</span>
                  ) : (
                    <item.icon className="w-5 h-5" />
                  )}
                  <span>{item.name}</span>
                  {item.href === 'reports' && pendingReportsCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingReportsCount}
                    </span>
                  )}
                  {(item.href === '/admin/agencies' || item.href === 'agencies') && bannedAgenciesCount > 0 && (
                    <span className="ml-auto bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {bannedAgenciesCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto pt-4 border-t border-pink-100">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-600 hover:text-rose-600 hover:bg-rose-50" 
            onClick={handleBackToSite}
          >
            <Home className="w-5 h-5 mr-3" />
            Back to Site
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-auto mt-14 md:mt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;