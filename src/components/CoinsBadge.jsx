import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins } from 'lucide-react';

export default function CoinsBadge({ coins = 0, onClick, className = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to Plans page with Coins tab selected
      navigate('/plans?tab=coins');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 hover:bg-amber-200 text-amber-800 font-semibold text-sm border border-amber-200/90 transition-colors cursor-pointer ${className}`}
      title="View plans and top-up coins"
    >
      <Coins className="w-4 h-4 text-amber-600" />
      <span>{coins}</span>
    </button>
  );
}