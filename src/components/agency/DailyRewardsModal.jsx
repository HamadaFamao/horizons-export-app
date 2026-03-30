import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function DailyRewardsModal({ isOpen, onClose, onClaim, status, xpAmount = 50 }) {
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    setIsClaiming(true);
    await onClaim();
    setIsClaiming(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isClaiming && onClose(open)}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="items-center text-center">
          <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <Trophy className="h-8 w-8 text-yellow-600" />
          </div>
          <DialogTitle className="text-xl">Daily Agency Reward</DialogTitle>
          <DialogDescription>
            Claim your daily XP bonus to level up your agency profile!
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center space-y-4">
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border-2 border-slate-100 w-full">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Today's Reward</span>
            <div className="text-4xl font-black text-slate-900 flex items-center gap-2">
              +{xpAmount}
              <span className="text-2xl text-slate-500">XP</span>
            </div>
            <Badge className="mt-3 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
              XP ONLY
            </Badge>
          </div>

          {status === 'claimed' && (
            <div className="flex items-center gap-2 text-green-600 font-medium text-sm animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="w-4 h-4" />
              Successfully claimed!
            </div>
          )}

          {status === 'already_claimed' && (
            <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" />
              You have already claimed your reward today.
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
              <XCircle className="w-4 h-4" />
              Failed to claim reward. Please try again.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          {status === 'claimed' || status === 'already_claimed' ? (
             <Button onClick={() => onClose(false)} variant="outline" className="w-full">
               Close
             </Button>
          ) : (
            <Button 
              onClick={handleClaim} 
              disabled={isClaiming || status === 'loading'} 
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                'Claim Daily Reward'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}