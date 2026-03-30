import React from 'react';

const POPULAR_EMOJIS = [
  '😀', '😂', '😍', '😘', '😭', '😱', '😴', '😴',
  '🤔', '😎', '🤗', '😏', '😌', '😔', '😢', '😡',
  '❤️', '💔', '💕', '💖', '💗', '💘', '💝', '💞',
  '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '👌',
  '🎉', '🎊', '🎈', '🎁', '🌟', '⭐', '✨', '🔥',
  '👋', '👏', '🙏', '💪', '🤲', '🤜', '🤛', '✊',
  '🌹', '🌺', '🌻', '🌷', '🌸', '💐', '🌼', '🌾',
  '🍕', '🍔', '🍟', '🌭', '🍿', '🥤', '☕', '🍷',
];

export default function EmojiPicker({ onEmojiSelect, isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-h-48 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
      <div className="grid grid-cols-8 gap-2">
        {POPULAR_EMOJIS.map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onEmojiSelect(emoji);
              onClose();
            }}
            className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors flex items-center justify-center"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}