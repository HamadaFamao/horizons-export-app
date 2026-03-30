import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Coins, TrendingUp, DollarSign } from 'lucide-react';
import { calculatePackageDetails, formatUSD, formatCoins } from '@/lib/pricingUtils';
import { cn } from '@/lib/utils';

export default function PricingPackages({ packages, onPurchase, isProcessing }) {
  const [selectedPackageId, setSelectedPackageId] = useState(null);

  const handlePurchaseClick = (pkg) => {
    setSelectedPackageId(pkg.id);
    onPurchase(pkg);
  };

  // Find the max bonus to highlight best value
  const maxBonus = Math.max(...packages.map(p => p.bonus_percentage));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {packages.map((pkg) => {
        const { bonusCoins, totalCoins } = calculatePackageDetails(pkg.base_coins, pkg.bonus_percentage);
        const isBestValue = pkg.bonus_percentage === maxBonus && pkg.bonus_percentage > 0;
        const isLoading = isProcessing && selectedPackageId === pkg.id;

        return (
          <Card 
            key={pkg.id} 
            className={cn(
              "relative flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
              isBestValue ? "border-2 border-amber-400 bg-amber-50/10" : "border-slate-200"
            )}
          >
            {isBestValue && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-4 py-1 shadow-sm font-semibold tracking-wide">
                  BEST VALUE
                </Badge>
              </div>
            )}

            {pkg.bonus_percentage > 0 && !isBestValue && (
               <div className="absolute top-4 right-4">
                 <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                   +{pkg.bonus_percentage}% Bonus
                 </Badge>
               </div>
            )}

            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-2xl font-bold text-slate-900">{pkg.name}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-1 text-lg font-medium text-slate-600 mt-2">
                 {formatUSD(pkg.price_usd)}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-6 pt-4">
              {/* Total Coins Display */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-4xl font-black text-indigo-600 tracking-tight">
                  <Coins className="w-8 h-8 text-amber-500 fill-amber-500" />
                  {formatCoins(totalCoins)}
                </div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Coins</p>
              </div>

              {/* Breakdown */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Base Coins:</span>
                  <span className="font-semibold text-slate-700">{formatCoins(pkg.base_coins)}</span>
                </div>
                
                {pkg.bonus_percentage > 0 ? (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Bonus (+{pkg.bonus_percentage}%):
                      </span>
                      <span className="font-bold text-green-600">+{formatCoins(bonusCoins)}</span>
                    </div>
                    <div className="h-px bg-slate-200 my-1"></div>
                    <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>Price per 1k coins:</span>
                        <span>{formatUSD((pkg.price_usd / totalCoins) * 1000)}</span>
                    </div>
                  </>
                ) : (
                    <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t">
                        <span>Standard Rate</span>
                    </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 px-6">
              <Button 
                className={cn(
                  "w-full h-11 font-semibold text-base shadow-md transition-all",
                  isBestValue 
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                )}
                disabled={isProcessing}
                onClick={() => handlePurchaseClick(pkg)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase Package
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}