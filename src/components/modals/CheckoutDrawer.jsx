import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { plansConfig } from '@/config/plans';
import { toast } from '@/components/ui/use-toast';

const CheckoutDrawer = ({ isOpen, onOpenChange, planId, billingCycle }) => {
  const { updateUser } = useAuth();

  if (!planId) return null;

  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
  const price = plansConfig.pricing[billingCycle][planId];

  const handleTestUpgrade = () => {
    updateUser({ plan: planId });
    onOpenChange(false);
    toast({
      title: `Upgraded to ${planName}! 🎉`,
      description: "You now have access to all premium features.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md card-gradient">
        <DialogHeader>
          <DialogTitle className="text-2xl">Checkout</DialogTitle>
          <DialogDescription>
            You are upgrading to the <span className="font-bold text-rose-500">{planName}</span> plan.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="p-6 rounded-lg bg-white/50 border border-pink-100 flex justify-between items-center">
            <div>
              <p className="font-semibold">{planName} ({billingCycle})</p>
              <p className="text-sm text-gray-600">Billed {billingCycle}</p>
            </div>
            <p className="text-2xl font-bold">${price}</p>
          </div>
          <div className="mt-4 text-center text-gray-500">
            <p>This is a demo. No real payment will be processed.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleTestUpgrade} className="btn-gradient text-white">
            Test Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDrawer;