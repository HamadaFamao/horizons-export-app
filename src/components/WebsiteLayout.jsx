import React from 'react';
import { Outlet } from 'react-router-dom';
import MobileBottomNav from '@/components/MobileBottomNav';
import DebugBanner from '@/components/DebugBanner';

const WebsiteLayout = () => {
  console.log('[BOTTOM_NAV_RENDERER] WebsiteLayout renders MobileBottomNav');

  return (
    <>
      <div className="flex-1 pb-12 md:pb-0">
        <Outlet />
      </div>
      <MobileBottomNav />
      <DebugBanner />
    </>
  );
};

export default WebsiteLayout;