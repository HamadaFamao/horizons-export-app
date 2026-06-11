import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Upload, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

export default function AgentWithdrawals() {
  const { toast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Submit Dialog State
    const [submitDialog, setSubmitDialog] = useState({ open: false, splitId: null });
  const [proofFile, setProofFile] = useState(null);
  const [proofNote, setProofNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchAssignedRequests = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_recharge_agent_assigned_splits');
            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Fetch error:', err);
            toast({
                title: "Error",
                description: "Failed to load assigned withdrawals.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [toast]);

  useEffect(() => {
    fetchAssignedRequests();
  }, [fetchAssignedRequests]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAssignedRequests();
  };

    const openSubmitDialog = (split) => {
        setSubmitDialog({ open: true, splitId: split.split_id });
        setProofFile(null);
        setProofNote('');
    };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofFile) {
        toast({ title: "File missing", description: "Please select a proof image.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `split_${submitDialog.splitId}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload to storage
        const { error: uploadError } = await supabase.storage
            .from('withdrawal-proofs')
            .upload(filePath, proofFile);

        if (uploadError) throw uploadError;

        // 2. Call RPC to update split status
        const { data: rpcData, error: rpcError } = await supabase.rpc('recharge_agent_submit_split_proof', {
            p_split_id: submitDialog.splitId,
            p_proof_url: filePath,
            p_note: proofNote
        });

        if (rpcError) throw rpcError;
        if (rpcData && rpcData.success === false) throw new Error(rpcData.error);

        toast({
            title: "Proof Submitted",
            description: "Admin will review your payment proof shortly.",
            className: "bg-green-50 border-green-200 text-green-800"
        });
        
        setSubmitDialog({ open: false, splitId: null });
        fetchAssignedRequests();

    } catch (err) {
        console.error('Submit error:', err);
        toast({
            title: "Submission Failed",
            description: err.message,
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assigned Withdrawals</h1>
           <p className="text-muted-foreground mt-1">
             Process payments for users and submit proof to get compensated in coins.
           </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
           <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
           Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
           <CardTitle>Pending Payments</CardTitle>
           <CardDescription>
               These users have requested withdrawals via your agency. Pay them offline and upload proof.
           </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
               <TableHeader>
                   <TableRow>
                       <TableHead>Split</TableHead>
                       <TableHead>Agency / Agent</TableHead>
                       <TableHead>Amount</TableHead>
                       <TableHead>Payout</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead className="text-right">Action</TableHead>
                   </TableRow>
               </TableHeader>
               <TableBody>
                   {loading ? (
                       <TableRow>
                           <TableCell colSpan={6} className="h-24 text-center">
                               <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                           </TableCell>
                       </TableRow>
                   ) : requests.length === 0 ? (
                       <TableRow>
                           <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                               No assigned withdrawals found.
                           </TableCell>
                       </TableRow>
                   ) : (
                       requests.map((req) => {
                           const statusStyles = {
                             approved: 'bg-blue-50 text-blue-700 border-blue-200',
                             proof_submitted: 'bg-purple-50 text-purple-700 border-purple-200',
                             paid: 'bg-green-50 text-green-700 border-green-200',
                           };
                           const statusLabels = {
                             approved: 'Awaiting Payment',
                             proof_submitted: 'Proof Submitted',
                             paid: 'Paid',
                           };
                           return (
                           <TableRow key={req.split_id}>
                               <TableCell className="font-mono text-xs text-muted-foreground">
                                   #{req.split_id}
                                   <span className="block text-[10px] text-gray-400">req {req.request_id}</span>
                               </TableCell>
                               <TableCell>
                                   <div className="flex flex-col">
                                       <span className="text-sm font-medium">{req.agency_name || '—'}</span>
                                       <span className="text-xs text-muted-foreground">
                                         {req.agent_name || '—'} • ID: {req.agent_profile_id || '—'}
                                       </span>
                                   </div>
                               </TableCell>
                               <TableCell className="font-medium">
                                   💎 {req.gems_amount?.toLocaleString()}
                               </TableCell>
                               <TableCell>
                                   <span className="font-bold text-green-700">
                                        ${Number(req.payout_usd || 0).toFixed(2)}
                                   </span>
                               </TableCell>
                               <TableCell>
                                   <Badge variant="outline" className={cn('w-fit', statusStyles[req.status] || '')}>
                                       {statusLabels[req.status] || req.status}
                                   </Badge>
                               </TableCell>
                               <TableCell className="text-right">
                                   {req.status === 'approved' ? (
                                       <Button 
                                           size="sm" 
                                           className="bg-indigo-600 hover:bg-indigo-700"
                                           onClick={() => openSubmitDialog(req)}
                                       >
                                           <Upload className="w-4 h-4 mr-2" />
                                           Submit Proof
                                       </Button>
                                   ) : req.status === 'proof_submitted' ? (
                                       <Button size="sm" variant="secondary" disabled className="opacity-70">
                                           Under Review
                                       </Button>
                                   ) : (
                                       <Button size="sm" variant="secondary" disabled className="opacity-70">
                                           Completed
                                       </Button>
                                   )}
                               </TableCell>
                           </TableRow>
                           );
                       })
                   )}
               </TableBody>
           </Table>
        </CardContent>
      </Card>

      {/* Submit Proof Dialog */}
      <Dialog open={submitDialog.open} onOpenChange={(open) => !open && setSubmitDialog({ open: false, requestId: null })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Submit Payment Proof</DialogTitle>
                  <DialogDescription>
                      Upload a screenshot confirming you have paid the user.
                  </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label htmlFor="proof">Proof Image (Screenshot)</Label>
                      <Input id="proof" type="file" accept="image/*" onChange={handleFileChange} />
                  </div>

                  <div className="grid w-full gap-1.5">
                      <Label htmlFor="note">Note (Optional)</Label>
                      <Textarea 
                          id="note" 
                          placeholder="Transaction ID, date, or other details..." 
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                      />
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="outline" onClick={() => setSubmitDialog({ open: false, requestId: null })}>Cancel</Button>
                  <Button onClick={handleSubmitProof} disabled={isSubmitting || !proofFile}>
                      {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Submit Proof
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}