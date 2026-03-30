import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

const DebugBanner = () => {
  const { user } = useAuth();
  const isDevelopment = import.meta.env.DEV;

  // Only show in development and if user is logged in
  if (!isDevelopment || !user) return null;

  // Check based ONLY on isadmin field as requested
  const isAdmin = user.isadmin === true;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white text-xs p-1 z-50 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
      <div className="flex gap-4">
        <span>User: {user.email || user.id}</span>
        <span>ID: {user.id}</span>
        <span className={isAdmin ? "text-green-400 font-bold" : "text-gray-400"}>
          Admin: {isAdmin ? 'YES' : 'NO'}
        </span>
      </div>
      <div className="text-[10px] text-gray-500">
        Debug Mode
      </div>
    </div>
  );
};

export default DebugBanner;