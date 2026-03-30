import React from 'react';
import { isUserOnline } from '@/lib/lastSeenUtils';

/**
 * Small green dot indicator for online status
 * Shows only if user is online (within 5 minutes)
 * Used on user cards in Discover page
 */
const OnlineIndicator = ({ lastSeen }) => {
  const online = isUserOnline(lastSeen);

  if (!online) {
    return null; // Don't show anything if not online
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
    </span>
  );
};

export default OnlineIndicator;