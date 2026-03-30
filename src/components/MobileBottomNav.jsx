import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Heart, MessageCircle, User, Mic } from 'lucide-react';
import { useUnread } from '@/context/UnreadContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith("/rooms/");
  const { totalUnread, hasAgencyUnread } = useUnread();

  // ✅ helper: allow nested routes like /rooms/:id
  const isPathVisible = (pathname) => {
    const baseRoutes = [
      '/',
      '/home',
      '/discover',
      '/matches',
      '/messages',
      '/profile',
      '/search',
      '/rooms',
    ];

    if (baseRoutes.includes(pathname)) return true;

    // show on nested room pages too: /rooms/:roomId
    if (pathname.startsWith('/rooms/')) return true;

    return false;
  };

  const isVisible = isPathVisible(location.pathname);
  if (!isVisible) return null;

  // ✅ badge logic unchanged
  const effectiveBadge = totalUnread + (hasAgencyUnread ? 1 : 0);

  const navItems = [
    {
      path: '/',
      icon: Home,
      label: 'Home',
      match: (path) => path === '/' || path === '/discover' || path === '/home',
    },
    {
      path: '/rooms',
      icon: Mic,
      label: 'Rooms',
      match: (path) => path === '/rooms' || path.startsWith('/rooms/'),
    },
    {
      path: '/search',
      icon: Search,
      label: 'Search',
      match: (path) => path === '/search',
    },
    {
      path: '/matches',
      icon: Heart,
      label: 'Matches',
      match: (path) => path === '/matches',
    },
    {
      path: '/messages',
      icon: MessageCircle,
      label: 'Messages',
      match: (path) => path === '/messages',
      badge: effectiveBadge,
    },
    {
      path: '/profile',
      icon: User,
      label: 'Profile',
      match: (path) => path === '/profile',
    },
  ];

  if (isRoomPage) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 pb-safe safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around h-16 items-center">
        {navItems.map(({ path, icon: Icon, label, match, badge }) => {
          const isActive = match(location.pathname);

          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-colors active:scale-95 duration-150 relative ${isActive ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <Icon size={24} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[10px] font-medium mt-1">{label}</span>

              {/* Unread badge for Messages */}
              {badge && badge > 0 && (
                <div className="absolute top-2 right-4 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-white">
                  {badge > 99 ? '99+' : badge}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}