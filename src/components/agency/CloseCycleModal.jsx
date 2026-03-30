import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CloseCycleModal({ isOpen, onClose, onConfirm, isClosing = false, cycle }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!cycle) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('A reason is required to maintain the audit trail.');
      return;
    }
    setError('');
    onConfirm(cycle.id, reason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isClosing && onClose()}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Lock className="h-5 w-5" />
            Close Withdrawal Cycle
          </DialogTitle>
          <DialogDescription>
             This action will be logged in the permanent audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-md border text-sm">
                <div className="grid grid-cols-2 gap-2 mb-2">
                     <span className="text-gray-500">Cycle ID:</span>
                     <span className="font-mono">{cycle.id}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                     <span className="text-gray-500">Remaining Balance:</span>
                     <span className="font-bold text-gray-900">{cycle.locked_gems?.toLocaleString()} 💎</span>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label className="text-gray-700 flex items-center gap-1">
                   Reason for Closing <span className="text-red-500">*</span>
                </Label>
                <Input 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Monthly closeout, Manual adjustment..."
                    disabled={isClosing}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> 
                    This reason will be recorded in the `cycle_state_changes` audit log.
                </p>
            </div>

            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                   Once closed, this cycle cannot be reopened. No further requests can be made against it.
                </AlertDescription>
            </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isClosing}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={isClosing || !reason.trim()}
          >
            {isClosing ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                Closing & Auditing...
              </>
            ) : (
              'Confirm Close'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}