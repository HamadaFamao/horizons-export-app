import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({ open, onStay, onLeave, title, description }) => {
  return (
    <AlertDialog open={open} onOpenChange={(val) => !val && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-full">
               <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle>{title || "Unsaved Changes"}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description || "You have unsaved changes. Are you sure you want to leave? Your changes will be lost."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>
            Stay on Page
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onLeave}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Discard & Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;