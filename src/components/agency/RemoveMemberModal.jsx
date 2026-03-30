import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, UserX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RemoveMemberModal({ isOpen, onClose, member, onConfirm }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!member) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for removal.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onConfirm(member, reason);
      setReason(''); // Reset on success
      onClose();
    } catch (err) {
      console.error('Removal error:', err);
      setError(err.message || 'Failed to remove member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
             <UserX className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl text-red-700">Remove Member from Agency</DialogTitle>
          <DialogDescription className="text-center">
             Are you sure you want to remove this member?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
            <div className="bg-gray-50 p-4 rounded-md border border-gray-100 text-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-500">Member Name:</span>
                    <span className="font-semibold text-gray-900">{member.client_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Member ID:</span>
                    <span className="font-mono text-gray-700">{member.client_profile_id || '-'}</span>
                </div>
            </div>

            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs leading-relaxed">
                   This action cannot be undone. The member will lose access to the agency and all associated data.
                </AlertDescription>
            </Alert>

            <div className="space-y-2">
                <Label htmlFor="reason" className="text-gray-700">Reason for Removal <span className="text-red-500">*</span></Label>
                <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Violation of terms, Inactive..."
                    disabled={isSubmitting}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} type="button">
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700"
            type="button"
          >
            {isSubmitting ? (
              <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Removing...
              </>
            ) : (
              'Remove Member'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}