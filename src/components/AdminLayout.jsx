import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, CreditCard, ShieldAlert, Database, Settings, Home, Gem, Award, Wrench, ArrowDownLeftFromCircle, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import ConfirmDialog from '@/components/ConfirmDialog';

// No DebugBanner import here - ensuring clean admin interface

const AdminLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDirty, setDirty } = useUnsavedChanges();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);

  const navItems = [
    { name: 'Overview', href: 'dashboard', icon: LayoutGrid },
    { name: 'Users', href: 'users', icon: Users },
    { name: 'Agencies', href: 'agencies', icon: Building },
    { name: 'Withdrawals', href: 'withdrawals', icon: ArrowDownLeftFromCircle },
    { name: 'Plans', href: 'plans', icon: CreditCard },
    { name: 'Coins', href: 'coins', icon: Gem },
    { name: 'Rewards', href: 'rewards', icon: Award },
    { name: 'Reports', href: 'reports', icon: ShieldAlert },
    { name: 'Seed Data', href: 'seed', icon: Database },
    { name: 'Tools', href: 'tools/profile-id', icon: Wrench },
    { name: 'Settings', href: 'settings', icon: Settings },
  ];

  // Intercept navigation for unsaved changes protection
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

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
      <ConfirmDialog 
        open={showConfirm}
        onStay={handleStay}
        onLeave={handleConfirmLeave}
        title="Unsaved Changes"
        description="You have unsaved changes in the form. Are you sure you want to leave? Your changes will be lost."
      />

      <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-pink-100 p-4 flex flex-col h-screen sticky top-0">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold gradient-text">Admin Panel</h2>
          <p className="text-sm text-gray-600">Welcome, {user.name}</p>
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
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
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
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;