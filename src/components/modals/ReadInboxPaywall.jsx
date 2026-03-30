import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const ReadInboxPaywall = ({ isOpen, onOpenChange }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/plans#silver');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] card-gradient">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Lock className="w-6 h-6 text-rose-500" />
            Unlock Your Inbox
          </DialogTitle>
          <DialogDescription className="pt-2">
            You can send messages on the Free plan, but reading your inbox requires a Premium subscription.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="p-4 rounded-lg bg-white/50 backdrop-blur-sm border border-pink-100">
            <p className="font-semibold">Message Preview:</p>
            <p className="blur-sm select-none text-gray-500">"Hey! I saw your profile and was really impressed. I'd love to..."</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Maybe Later</Button>
          <Button onClick={handleUpgrade} className="btn-gradient text-white">Upgrade to Silver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReadInboxPaywall;