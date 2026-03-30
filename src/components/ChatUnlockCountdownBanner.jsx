import React from 'react';

export default function ChatUnlockCountdownBanner({ timeRemaining, openUntilLabel }) {
  if (!timeRemaining || !openUntilLabel) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔓</span>
          <div>
            <p className="text-sm font-semibold text-blue-900">Chat is unlocked</p>
            <p className="text-xs text-blue-700 mt-0.5">
              {timeRemaining} • until {openUntilLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}