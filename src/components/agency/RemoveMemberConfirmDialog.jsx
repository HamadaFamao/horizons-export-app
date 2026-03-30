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
import { I18N_KEYS } from '@/constants/i18n';
import { useTranslation } from '@/hooks/useTranslation';

export default function RemoveMemberConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  member, 
  isSubmitting 
}) {
  const [reason, setReason] = useState("");
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm(member, reason);
    setReason(""); // Reset after call
  };

  const handleOpenChange = (open) => {
    if (!open && !isSubmitting) {
      onClose();
      setReason("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>{t(I18N_KEYS.AGENCY.REMOVE.CONFIRM_TITLE)}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {t(I18N_KEYS.AGENCY.REMOVE.CONFIRM_BODY)}
             {member && (
               <span className="block mt-1 font-medium text-gray-900">
                  {t(I18N_KEYS.AGENCY.REMOVE.MEMBER_LABEL)}: {member.client_name} (ID: {member.client_profile_id})
               </span>
             )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Alert variant="warning" className="bg-amber-50 border-amber-200 text-amber-800">
             <AlertDescription>
               {t(I18N_KEYS.AGENCY.REMOVE.WARNING_ALERT)}
             </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              {t(I18N_KEYS.AGENCY.REMOVE.REASON_LABEL)}
            </Label>
            <Textarea
              id="reason"
              placeholder={t(I18N_KEYS.AGENCY.REMOVE.REASON_PLACEHOLDER)}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            {t(I18N_KEYS.COMMON.CANCEL)}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t(I18N_KEYS.AGENCY.REMOVE.REMOVING)}
              </>
            ) : (
              t(I18N_KEYS.AGENCY.REMOVE.BUTTON)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}