import React, { useState, useEffect } from 'react';
import { formatLastSeen, isUserOnline } from '@/lib/lastSeenUtils';

export default function OnlineStatus({ lastSeen }) {
  const [displayText, setDisplayText] = useState('');
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Update display text immediately
    const updateDisplay = () => {
      const text = formatLastSeen(lastSeen);
      const online = isUserOnline(lastSeen);
      setDisplayText(text);
      setIsOnline(online);
    };

    updateDisplay();

    // Update every second to keep "Last seen X minutes ago" fresh
    const interval = setInterval(updateDisplay, 1000);

    return () => clearInterval(interval);
  }, [lastSeen]);

  return (
    <div className="flex items-center gap-1">
      {isOnline ? (
        <>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-green-600 font-medium">{displayText}</span>
        </>
      ) : (
        <span className="text-xs text-gray-500">{displayText}</span>
      )}
    </div>
  );
}