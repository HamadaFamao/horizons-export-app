import React from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import MiniRoomBar from "@/components/MiniRoomBar";

const Layout = ({ children }) => {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith("/rooms/");

  // Define routes where bottom nav should be visible
  // Using a comprehensive list to ensure pages like Profile, Messages, Search have nav
  // but pages like Chat (messages/:id), Edit Profile, etc. do not.
  const navVisibleRoutes = [
    '/',
    '/home',
    '/discover',
    '/matches',
    '/messages',
    '/profile',
    '/search'
  ];

  // Check if current route is one of the main routes
  // Strict equality check to avoid showing on /profile/edit or /messages/123
  const showBottomNav = navVisibleRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!isRoomPage && <AppHeader />}
      <main
        className={`container mx-auto px-4 py-6 flex-1 ${showBottomNav ? 'pb-24 md:pb-6' : ''
          }`}
      >
        <MiniRoomBar />
        {children}
      </main>
    </div>
  );
};

export default Layout;