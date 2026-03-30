import React from 'react';

export default function TypingIndicator({ userName }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm ml-4 mb-2 animate-in fade-in duration-300">
      <span className="text-xs font-medium">{userName} is typing</span>
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  );
}