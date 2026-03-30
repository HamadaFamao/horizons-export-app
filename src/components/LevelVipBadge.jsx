import React from 'react';

/**
 * Compact Level and VIP badge component for visitor profiles
 * Shows level and VIP status in a horizontal row
 */
export default function LevelVipBadge({ level, isVip, vipExpiresAt, className = '' }) {
  if (!level && !isVip) {
    return null;
  }

  // Check if VIP is still active
  const isVipActive = isVip && (!vipExpiresAt || new Date(vipExpiresAt) > new Date());

  return (
    <div className={`flex items-center gap-2 flex-wrap justify-center ${className}`}>
      {/* Level badge */}
      {level && (
        <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold shadow-sm border border-blue-200">
          <span>⭐</span>
          <span>Level {level}</span>
        </div>
      )}

      {/* VIP badge */}
      {isVipActive && (
        <div className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold shadow-sm border border-purple-200">
          <span>👑</span>
          <span>VIP</span>
        </div>
      )}
    </div>
  );
}