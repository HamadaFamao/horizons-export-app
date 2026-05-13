import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'scam',
  'violence',
  'other',
];

export default function ReportModal({
  isOpen,
  onClose,
  reportType,
  targetId,
  targetName,
}) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSubmitDisabled = useMemo(() => {
    return submitting || !currentUser?.id || !reportType || !targetId || !reason;
  }, [submitting, currentUser?.id, reportType, targetId, reason]);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setDescription('');
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!currentUser?.id) {
      toast({ title: 'Error', description: 'You must be logged in to report.', variant: 'destructive' });
      return;
    }

    if (!reason) {
      toast({ title: 'Error', description: 'Please select a reason.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        reporter_id: currentUser.id,
        report_type: reportType,
        target_id: String(targetId),
        target_name: targetName || null,
        reason,
        description: description.trim() ? description.trim() : null,
      };

      const { error } = await supabase.from('reports').insert(payload);
      if (error) throw error;

      toast({ title: 'تم الإبلاغ بنجاح' });
      handleClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to submit report.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {reportType || 'item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {targetName ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold">Target:</span> {targetName}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason} disabled={submitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              maxLength={500}
              disabled={submitting}
              placeholder="Add extra details..."
              className="min-h-[110px]"
            />
            <p className="text-xs text-slate-500 text-right">{description.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {submitting ? 'Submitting...' : '🚩 Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
