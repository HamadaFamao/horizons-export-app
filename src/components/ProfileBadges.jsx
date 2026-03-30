import React from 'react';

const ProfileBadges = ({ verified, isVip, isActive, lastSeen }) => {
  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      {verified && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          ✓ Verified
        </span>
      )}
      
      {isVip && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          ★ VIP
        </span>
      )}
      
      {isActive && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Online now
        </span>
      )}
      {!isActive && lastSeen && (
        <span className="text-xs text-gray-500">
          Last seen: {lastSeen}
        </span>
      )}
    </div>
  );
};

export default ProfileBadges;