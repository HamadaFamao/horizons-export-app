import React, { useState, useEffect } from 'react';
import { fetchUserWallet } from '@/lib/walletUtils';

export default function WalletDisplay({ userId, refreshTrigger }) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWallet = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fix: fetchUserWallet now returns { data, error }
        const { data: walletData } = await fetchUserWallet(userId);
        setWallet(walletData);
      } catch (err) {
        console.error('Error loading wallet:', err);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [userId, refreshTrigger]);

  if (loading || !wallet) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {/* Coins */}
      <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
        <span className="text-sm font-bold text-amber-700">
          {wallet.coins}
        </span>
        <span className="text-lg">💰</span>
      </div>

      {/* Gems */}
      <div className="flex items-center gap-1 bg-purple-50 px-3 py-1 rounded-full">
        <span className="text-sm font-bold text-purple-700">
          {wallet.gems}
        </span>
        <span className="text-lg">💎</span>
      </div>

      {/* Level */}
      <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full">
        <span className="text-sm font-bold text-blue-700">
          Lvl {wallet.level}
        </span>
        <span className="text-lg">⭐</span>
      </div>
    </div>
  );
}