import React, { useState } from 'react';

// Curated emoji list grouped by category
const EMOJI_GROUPS = {
  smileys: [
    '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
    '🙃', '😉', '😢', '😡', '😴', '🤔', '😎', '🥳',
  ],
  hearts: [
    '❤️', '💖', '💕', '💘', '💓', '💗', '💞', '💝',
    '💋', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  ],
  reactions: [
    '👍', '👎', '👏', '🙌', '🤝', '🙏', '🤍', '🔥',
    '🎉', '🎊', '⭐', '✨', '💫', '🌟', '👋', '🎈',
  ],
};

export default function ImprovedEmojiPicker({ isOpen, onClose, onEmojiSelect }) {
  const [activeTab, setActiveTab] = useState('smileys');

  if (!isOpen) return null;

  const currentEmojis = EMOJI_GROUPS[activeTab] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-40 flex items-end">
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[60vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Pick an emoji</h3>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-70 transition-opacity p-2"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pt-3 border-b border-gray-100">
          {Object.keys(EMOJI_GROUPS).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Emoji Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-8 gap-3">
            {currentEmojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => {
                  onEmojiSelect(emoji);
                  onClose();
                }}
                className="text-3xl hover:scale-125 transition-transform duration-200 hover:bg-gray-100 rounded-lg p-2"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}