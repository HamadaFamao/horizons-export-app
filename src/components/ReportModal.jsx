import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_profile', label: 'Fake Profile' },
  { value: 'scam', label: 'Scam' },
  { value: 'violence', label: 'Violence' },
  { value: 'other', label: 'Other' },
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

  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSubmitDisabled = useMemo(() => {
    return submitting || !currentUser?.id || !reportType || !targetId || !selectedReason;
  }, [submitting, currentUser?.id, reportType, targetId, selectedReason]);

  const handleClose = () => {
    if (submitting) return;
    setSelectedReason('');
    setDescription('');
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!currentUser?.id) {
      toast({ title: 'Error', description: 'You must be logged in to report.', variant: 'destructive' });
      return;
    }

    if (!selectedReason) {
      toast({ title: 'Error', description: 'Please select a reason.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const insertData = {
        reporter_id: currentUser.id,
        report_type: reportType,
        reason: selectedReason,
        description: description.trim() || null,
        status: 'pending',
      };

      if (reportType === 'user') {
        insertData.reported_user_id = targetId;
      } else if (reportType === 'room') {
        insertData.reported_room_id = targetId;
      } else if (reportType === 'message') {
        insertData.reported_user_id = targetId;
        insertData.reported_message_id = targetId;
      }

      const { error } = await supabase
        .from('reports')
        .insert(insertData);
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
            <div className="space-y-2 mt-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => !submitting && setSelectedReason(r.value)}
                  disabled={submitting}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                    selectedReason === r.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
