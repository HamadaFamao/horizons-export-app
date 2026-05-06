import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '@/components/MobileBottomNav';
import DebugBanner from '@/components/DebugBanner';

const WebsiteLayout = () => {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith('/messages/');

  console.log('[BOTTOM_NAV_RENDERER] WebsiteLayout renders MobileBottomNav');

  return (
    <>
      <div className={`flex-1 overflow-visible ${isChatRoute ? '' : 'pb-12 md:pb-0'}`}>
        <Outlet />
      </div>
      {!isChatRoute && <MobileBottomNav />}
      {!isChatRoute && <DebugBanner />}
    </>
  );
};

export default WebsiteLayout;