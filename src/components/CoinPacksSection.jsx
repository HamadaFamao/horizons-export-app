import React, { useState } from 'react';
import { Loader2, Check } from 'lucide-react';

export default function CoinPacksSection() {
  const [selectedPack, setSelectedPack] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Coin pack options
  const coinPacks = [
    {
      id: 'pack-100',
      coins: 100,
      price: 1.99,
      discount: null,
      popular: false,
    },
    {
      id: 'pack-550',
      coins: 550,
      price: 9.99,
      discount: 10,
      popular: true,
    },
    {
      id: 'pack-1200',
      coins: 1200,
      price: 19.99,
      discount: 20,
      popular: false,
    },
    {
      id: 'pack-2500',
      coins: 2500,
      price: 39.99,
      discount: 25,
      popular: false,
    },
  ];

  const handleBuyPack = async (pack) => {
    setSelectedPack(pack.id);
    setIsProcessing(true);

    try {
      console.log('🪙 Selected coin pack:', pack);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // TODO: Implement real payment flow (Stripe, PayPal, etc.)
      console.log('💳 Payment flow would be initiated here');
      
      // Show success message or redirect to payment provider
    } catch (error) {
      console.error('Error processing coin purchase:', error);
    } finally {
      setIsProcessing(false);
      setSelectedPack(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Top Up Coins</h2>
        <p className="text-gray-600">
          Purchase coins to send gifts, unlock messages, and boost your profile visibility.
        </p>
      </div>

      {/* Coin packs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {coinPacks.map((pack) => (
          <div
            key={pack.id}
            onClick={() => handleBuyPack(pack)}
            className={`relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden group ${
              selectedPack === pack.id
                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200 ring-offset-2'
                : 'border-gray-200 hover:border-amber-300 bg-white hover:shadow-lg'
            }`}
          >
            {/* Popular badge */}
            {pack.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-1 rounded-b-lg text-xs font-bold shadow-sm uppercase tracking-wider z-10">
                Most Popular
              </div>
            )}

            <div className="p-6 flex flex-col items-center text-center relative z-0">
              {/* Discount Badge */}
              {pack.discount && (
                 <div className="absolute top-4 right-4 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">
                    Save {pack.discount}%
                 </div>
              )}

              {/* Coins amount */}
              <div className="mb-4 mt-2">
                <div className="text-5xl font-bold text-amber-500 mb-2 drop-shadow-sm flex items-center justify-center gap-2">
                  <span>🪙</span>
                  {pack.coins.toLocaleString()}
                </div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Coins</p>
              </div>

              {/* Price */}
              <div className="mb-6 bg-gray-50 px-6 py-2 rounded-full">
                <div className="text-2xl font-bold text-gray-900">
                  ${pack.price.toFixed(2)}
                </div>
              </div>

              {/* Per coin cost */}
              <div className="mb-6 text-xs text-gray-400">
                <p>${(pack.price / pack.coins).toFixed(4)} / coin</p>
              </div>

              {/* Buy button */}
              <button
                disabled={isProcessing}
                className={`w-full py-3 rounded-xl font-bold transition-all shadow-sm ${
                  pack.popular
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group-hover:scale-[1.02] active:scale-[0.98]`}
              >
                {isProcessing && selectedPack === pack.id ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    'Buy Now'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info section */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-8 max-w-4xl mx-auto flex gap-3 items-start">
        <div className="bg-blue-100 p-2 rounded-full shrink-0">
             <Check className="w-4 h-4 text-blue-600" />
        </div>
        <div>
            <p className="text-sm text-blue-900 font-medium">Value Tip</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Larger packages offer significantly better value per coin. The 1200 coin pack saves you 20% compared to the base rate!
            </p>
        </div>
      </div>
    </div>
  );
}