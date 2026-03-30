import React from 'react';

export default function ChatLockedBanner({ timeRemaining, userIsVIP }) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-1">🔒</div>
        <div className="flex-1">
          <p className="font-semibold text-amber-900">This chat is locked</p>
          <p className="text-sm text-amber-800 mt-1">
            {userIsVIP ? (
              <>
                You have VIP access. Chat is unlocked for you.
              </>
            ) : (
              <>
                Send a gift to unlock chat and continue the conversation.
                {timeRemaining && timeRemaining !== 'Locked' && (
                  <span className="block mt-1 text-xs text-amber-700">
                    Chat will be available again in {timeRemaining}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}