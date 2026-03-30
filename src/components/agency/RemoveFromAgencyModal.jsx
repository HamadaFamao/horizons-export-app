import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RemoveFromAgencyModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  member, 
  isLoading 
}) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(member, reason);
  };

  const handleOpenChange = (open) => {
    if (!open && !isLoading) {
      onClose();
      setReason(""); // Reset on close
    }
  };

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>Remove member from agency?</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-base text-gray-700">
            This will remove <span className="font-bold text-gray-900">{member.client_name}</span> (ID: {member.client_profile_id}) from your agency. They can rejoin later using the code.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Alert variant="warning" className="bg-amber-50 border-amber-200 text-amber-800">
             <AlertDescription>
               Warning: This action cannot be undone immediately. The user will need to re-enter your referral code to join again.
             </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for removal <span className="text-gray-400 font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please provide a brief reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none focus:border-red-500 focus:ring-red-500"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              "Remove"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}