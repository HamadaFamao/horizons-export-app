import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  RotateCcw,
  CalendarClock
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import OpenWithdrawalCycleModal from '@/components/admin/OpenWithdrawalCycleModal';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Paid', value: 'paid' },
];

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const { isAdmin, staffRole, loading: permLoading } = useAdminPermissions();
  const canView = isAdmin || staffRole === 'manager' || staffRole === 'moderator';

  // Data State
  const [requests, setRequests] = useState([]);

  // Loading States
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  // UI State
  const [statusFilter, setStatusFilter] = useState('pending');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Action Dialog State
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, request: null }); // type: 'approve' | 'reject' | 'confirm_payment' | 'reset'
  const [adminNote, setAdminNote] = useState('');

  // Proof Modal State
  const [proofDialog, setProofDialog] = useState({ open: false, requestId: null });
  const [proofDetails, setProofDetails] = useState(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);

  // Cycle Modal State
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  // Tabs + Batch state
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'batches'
  const [pendingSplits, setPendingSplits] = useState([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [selectedSplitIds, setSelectedSplitIds] = useState(new Set());
  const [finalizingAgent, setFinalizingAgent] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchRequests = useCallback(async (isBackground = false) => {
    if (permLoading || !canView) {
      setIsInitialLoading(false);
      setIsFetching(false);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isBackground) setIsFetching(true);

    try {
      const { data, error } = await supabase.rpc('admin_list_gem_withdrawal_requests', {
        p_status: statusFilter === 'all' ? null : statusFilter,
        p_limit: 100,
        p_offset: 0
      });

      if (controller.signal.aborted) return;
      if (error) throw error;

      setRequests(data || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[AdminWithdrawals] Error:', err);
        let errorMsg = 'Failed to load withdrawal requests.';
        if (err.message?.includes('not_admin')) {
          errorMsg = 'No permission. You must be an admin to view this.';
        }
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsFetching(false);
        setIsInitialLoading(false);
      }
    }
  }, [statusFilter, toast, canView, permLoading]);

  const fetchPendingSplits = useCallback(async () => {
    setLoadingSplits(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_pending_agent_splits');
      if (error) throw error;
      setPendingSplits(data || []);
    } catch (err) {
      console.error('[fetchPendingSplits]', err);
      toast({ title: 'Error', description: 'Failed to load agent splits.', variant: 'destructive' });
    } finally {
      setLoadingSplits(false);
    }
  }, [toast]);

  const toggleSplit = (splitId) => {
    setSelectedSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(splitId)) next.delete(splitId);
      else next.add(splitId);
      return next;
    });
  };

  const handleFinalizeBatch = async (agentId, agentSplitIds) => {
    // ناخد بس الـ splits المختارة لهذا الوكيل
    const idsToFinalize = agentSplitIds.filter((id) => selectedSplitIds.has(id));
    if (idsToFinalize.length === 0) {
      toast({ title: 'No splits selected', description: 'Select at least one paid split.', variant: 'destructive' });
      return;
    }

    if (!window.confirm(`Finalize ${idsToFinalize.length} split(s) for this agent? This will deduct gems and compensate the agent in coins.`)) return;

    setFinalizingAgent(agentId);
    try {
      const { data, error } = await supabase.rpc('admin_finalize_recharge_agent_batch', {
        p_recharge_agent_id: agentId,
        p_split_ids: idsToFinalize,
        p_note: null,
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);

      toast({
        title: '✅ Batch finalized',
        description: `Paid ${data.splits_paid} split(s) • ${Number(data.total_gems).toLocaleString()} gems • $${Number(data.total_usd).toFixed(2)} • Bonus ${data.bonus_pct}% • ${Number(data.payout_coins).toLocaleString()} coins`,
        className: 'bg-green-50 border-green-200 text-green-800',
      });

      setSelectedSplitIds(new Set());
      await fetchPendingSplits();
      await fetchRequests(true);
    } catch (err) {
      console.error('[handleFinalizeBatch]', err);
      toast({ title: 'Finalize failed', description: err.message, variant: 'destructive' });
    } finally {
      setFinalizingAgent(null);
    }
  };

  useEffect(() => {
    if (permLoading) return;
    fetchRequests();
    return () => abortControllerRef.current?.abort();
  }, [fetchRequests, permLoading]);

  useEffect(() => {
    if (permLoading || !canView) return;
    if (activeTab === 'batches') fetchPendingSplits();
  }, [activeTab, permLoading, canView, fetchPendingSplits]);

  const toggleRow = (id) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const openActionDialog = (type, request, e) => {
    e.stopPropagation();
    setActionDialog({ open: true, type, request });
    setAdminNote('');
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, request: null });
    setAdminNote('');
  };

  const openProofDialog = async (requestId, e) => {
    e.stopPropagation();
    setProofDialog({ open: true, requestId });
    setProofDetails(null);
    setIsLoadingProof(true);

    try {
      const { data: details, error: detailsError } = await supabase.rpc('admin_get_withdrawal_request_details', {
        p_request_id: requestId
      });
      if (detailsError) throw detailsError;

      const { data: urlData, error: urlError } = await supabase.rpc('admin_get_withdrawal_proof_signed_url', {
        p_request_id: requestId
      });
      if (urlError) throw urlError;

      let finalUrl = null;
      if (urlData?.success && urlData?.path) {
        const { data: signedData } = await supabase.storage
          .from('withdrawal-proofs')
          .createSignedUrl(urlData.path, 3600);
        finalUrl = signedData?.signedUrl;
      }

      setProofDetails({
        ...details,
        signedUrl: finalUrl
      });

    } catch (err) {
      console.error("Error fetching proof:", err);
      toast({
        title: "Error",
        description: "Failed to load proof details.",
        variant: "destructive"
      });
      setProofDialog({ open: false, requestId: null });
    } finally {
      setIsLoadingProof(false);
    }
  };

  const handleActionConfirm = async () => {
    const { type, request } = actionDialog;
    if (!request) return;

    if (type === 'reject' && !adminNote.trim()) {
      toast({
        title: "Validation Error",
        description: "Rejection reason is required.",
        variant: "destructive"
      });
      return;
    }

    closeActionDialog();
    setProcessingIds(prev => new Set(prev).add(request.id));

    try {
      if (type === 'reset') {
        const { data, error } = await supabase.rpc('admin_reset_gem_withdrawal_request', {
          p_request_id: request.id,
          p_note: adminNote.trim() || null
        });

        if (error) throw error;
        if (data && data.success === false) throw new Error(data.error || "Reset failed");

        toast({
          title: "Request Reset",
          description: `Request #${request.id} has been reset/rejected and gems refunded to user.`,
          className: "bg-blue-50 border-blue-200 text-blue-800"
        });

      } else if (type === 'confirm_payment') {
        /**
         * ✅ FIX: بدل RPC اللي كانت بتوقعنا في CHECK CONSTRAINT (status_check)
         * نخلي الـ status يتحدث لقيمة مسموحة: "paid"
         * + نسجل payout values لو موجودة
         */
        const payoutUsd = request.payout_usd ?? null;
        const payoutCoins = request.payout_coins ?? null;

        const { data, error } = await supabase.rpc('admin_update_gem_withdrawal_status', {
          p_request_id: request.id,
          p_new_status: 'paid',
          p_admin_note: adminNote.trim() || null,
          p_payout_usd: payoutUsd,
          p_payout_coins: payoutCoins
        });

        if (error) throw error;

        toast({
          title: "Payment Confirmed",
          description: `Request #${request.id} marked as Paid.`,
          className: "bg-green-50 border-green-200 text-green-800"
        });

        /**
         * ملاحظة: لو تعويض الـ Recharge Agent (Coins) لازم يحصل هنا،
         * هنعمله في خطوة تانية بعد ما نعرف اسم الـ RPC عندك أو المنطق اللي محتاجه.
         */

      } else if (type === 'approve') {
        // ✅ النظام الجديد: موافقة على طلب cycle (تعلّم الـ splits approved)
        const { data, error } = await supabase.rpc('admin_approve_cycle_withdrawal', {
          p_request_id: request.id
        });

        if (error) throw error;
        if (data && data.success === false) throw new Error(data.error);

      } else {
        // Reject (نسيب القديم)
        const { error } = await supabase.rpc('admin_update_gem_withdrawal_status', {
          p_request_id: request.id,
          p_new_status: 'rejected',
          p_admin_note: adminNote.trim() || null,
          p_payout_usd: null,
          p_payout_coins: null
        });

        if (error) throw error;

        toast({
          title: type === 'approve' ? "Approved" : "Rejected",
          description: `Request #${request.id} has been ${type === 'approve' ? 'approved' : 'rejected'}.`,
          className: type === 'approve'
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        });
      }

      await fetchRequests(true);

    } catch (err) {
      console.error('Action error:', err);
      let errorMsg = err.message || "An unexpected error occurred.";
      if (errorMsg.includes('not_admin')) {
        errorMsg = "No permission to perform this action.";
      }
      toast({
        title: "Action Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const getStatusColorClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200';
      case 'approved': return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200';
      case 'paid_by_recharge_agent': return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200';
    }
  };

  const getActionDialogTitle = (type) => {
    switch (type) {
      case 'approve': return 'Approve Request';
      case 'reject': return 'Reject Request';
      case 'confirm_payment': return 'Confirm Payment';
      case 'reset': return 'Reset & Reject Request';
      default: return 'Confirm Action';
    }
  };

  const getActionDialogDescription = (type, req) => {
    if (!req) return '';
    switch (type) {
      case 'approve':
        return `Are you sure you want to approve request #${req.id}? This will authorize the payout.`;
      case 'reject':
        return `Are you sure you want to reject request #${req.id}? The gems will be refunded to the user.`;
      case 'confirm_payment':
        return `Confirm that Agent has paid the user? This will mark request #${req.id} as PAID.`;
      case 'reset':
        return `Are you sure you want to RESET request #${req.id}? This will mark it as REJECTED and refund gems to the user. Use this for testing or correcting stuck requests.`;
      default:
        return '';
    }
  };

  if (!permLoading && !canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Withdrawals</h1>
          <p className="text-muted-foreground mt-1">Manage and process gem withdrawal requests</p>
        </div>

        <Card className="border-t-4 border-t-red-500 shadow-sm">
          <CardContent className="py-8">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">No permission to view this page.</p>
                <p className="text-sm text-red-600 mt-1">You must be an admin, manager, or moderator.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Withdrawals</h1>
          <p className="text-muted-foreground mt-1">Manage and process gem withdrawal requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
            onClick={() => setIsCycleModalOpen(true)}
          >
            <CalendarClock className="w-4 h-4" />
            Open Cycle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRequests()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={statusFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(filter.value)}
            className="rounded-full px-4"
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('requests')}
        >
          📋 Requests
        </Button>
        <Button
          variant={activeTab === 'batches' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('batches')}
          className="relative"
        >
          💰 Agent Batches
          {pendingSplits.length > 0 && (
            <span className="ml-2 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {pendingSplits.length}
            </span>
          )}
        </Button>
      </div>

      {activeTab === 'requests' && (
      <Card className="border-t-4 border-t-rose-500 shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead>User (Short ID)</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-4 rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-8 rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-8 w-full rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 rounded bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-6 w-16 rounded-full bg-gray-200 animate-pulse" /></TableCell>
                      <TableCell><div className="h-8 w-20 rounded bg-gray-200 animate-pulse ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No withdrawal requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((req) => (
                    <React.Fragment key={req.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-gray-50",
                          expandedRows.has(req.id) ? "bg-gray-50/80" : ""
                        )}
                        onClick={() => toggleRow(req.id)}
                      >
                        <TableCell>
                          {expandedRows.has(req.id) ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{req.id}
                        </TableCell>

                        <TableCell className="text-sm text-gray-600">
                          {req.created_at ? format(new Date(req.created_at), 'MMM d, HH:mm') : '-'}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage src={req.user_avatar_url} />
                              <AvatarFallback className="text-xs">
                                {req.user_name?.slice(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-gray-900">{req.user_name || 'Unknown'}</span>
                              <span className="text-xs text-gray-500">ID: {req.user_profile_id || 'N/A'}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <span className="text-rose-600 font-bold">{req.gems_requested?.toLocaleString()}</span>
                            <span className="text-xs text-gray-500">gems</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col text-sm gap-1">
                            <span className="capitalize font-medium">{req.payout_method?.replace('_', ' ')}</span>

                            {req.payout_method === 'recharge_agent' && (
                              <span
                                className="text-xs text-gray-500 truncate max-w-[120px]"
                                title={`Agent ID: ${req.recharge_agent_id}`}
                              >
                                {req.recharge_agent_name || `Agent #${req.recharge_agent_id}`}
                              </span>
                            )}

                            {req.agent_paid_status === 'submitted' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Proof Submitted
                              </span>
                            )}

                            {req.agent_paid_status === 'confirmed' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Agent Paid
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize shadow-none", getStatusColorClass(req.status))}>
                            {req.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {processingIds.has(req.id) ? (
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            ) : (
                              <>
                                {(req.agent_paid_status === 'submitted' || req.agent_paid_status === 'confirmed' || req.agent_paid_status === 'paid') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                    onClick={(e) => openProofDialog(req.id, e)}
                                  >
                                    <FileText className="w-4 h-4 mr-1" /> Proof
                                  </Button>
                                )}

                                {req.status === 'approved' && req.payout_method === 'recharge_agent' && req.agent_paid_status === 'submitted' && (
                                  <Button
                                    size="sm"
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={(e) => openActionDialog('confirm_payment', req, e)}
                                  >
                                    Confirm Paid
                                  </Button>
                                )}

                                {req.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                      onClick={(e) => openActionDialog('approve', req, e)}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                      onClick={(e) => openActionDialog('reject', req, e)}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}

                                {req.status !== 'paid' && req.status !== 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                    title="Test Reset"
                                    onClick={(e) => openActionDialog('reset', req, e)}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {expandedRows.has(req.id) && (
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 pl-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Admin Note</p>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                  {req.admin_note || <span className="text-gray-400 italic">No notes</span>}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Processing Info</p>
                                <div className="grid grid-cols-[80px_1fr] gap-1">
                                  <span className="text-gray-500">Processed:</span>
                                  <span className="text-gray-900">
                                    {req.processed_at ? format(new Date(req.processed_at), 'PP p') : '-'}
                                  </span>
                                  <span className="text-gray-500">By Admin:</span>
                                  <span className="text-gray-900 font-mono text-xs">
                                    {req.processed_by || '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Financials</p>
                                <div className="grid grid-cols-[100px_1fr] gap-1">
                                  <span className="text-gray-500">Payout USD:</span>
                                  <span className="font-medium text-gray-900">
                                    {req.payout_usd ? `$${req.payout_usd}` : '-'}
                                  </span>
                                  <span className="text-gray-500">Coins Value:</span>
                                  <span className="font-medium text-amber-600">
                                    {req.payout_coins ? req.payout_coins.toLocaleString() : '-'}
                                  </span>
                                  <span className="text-gray-500">Agent Paid:</span>
                                  <span className={cn(
                                    "font-medium",
                                    req.agent_paid_status === 'confirmed' ? "text-green-600" : "text-gray-600"
                                  )}>
                                    {req.agent_paid_status || 'unpaid'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'batches' && (
        <Card className="border-t-4 border-t-purple-500 shadow-sm">
          <CardContent className="p-4">
            {loadingSplits ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              </div>
            ) : pendingSplits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No splits awaiting finalization.
              </div>
            ) : (
              (() => {
                // نجمّع الـ splits حسب وكيل الشحن
                const byAgent = {};
                pendingSplits.forEach((s) => {
                  if (!byAgent[s.recharge_agent_id]) {
                    byAgent[s.recharge_agent_id] = { agent_name: s.agent_name, splits: [] };
                  }
                  byAgent[s.recharge_agent_id].splits.push(s);
                });

                return Object.entries(byAgent).map(([agentId, group]) => {
                  const agentSplitIds = group.splits.map((s) => s.split_id);
                  const selectedForAgent = agentSplitIds.filter((id) => selectedSplitIds.has(id));
                  const selectedTotal = group.splits
                    .filter((s) => selectedSplitIds.has(s.split_id))
                    .reduce((sum, s) => sum + Number(s.payout_usd || 0), 0);

                  return (
                    <div key={agentId} className="mb-6 border rounded-xl overflow-hidden">
                      <div className="bg-purple-50 px-4 py-3 flex items-center justify-between border-b">
                        <div>
                          <p className="font-bold text-purple-900">{group.agent_name}</p>
                          <p className="text-xs text-purple-600">
                            {group.splits.length} split(s) awaiting • Selected: {selectedForAgent.length} (${selectedTotal.toFixed(2)})
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={selectedForAgent.length === 0 || finalizingAgent === agentId}
                          onClick={() => handleFinalizeBatch(Number(agentId), agentSplitIds)}
                        >
                          {finalizingAgent === Number(agentId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            `✅ Finalize Batch (${selectedForAgent.length})`
                          )}
                        </Button>
                      </div>

                      <div className="divide-y">
                        {group.splits.map((s) => (
                          <div key={s.split_id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-purple-600 cursor-pointer"
                              checked={selectedSplitIds.has(s.split_id)}
                              onChange={() => toggleSplit(s.split_id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {s.agency_name || '—'} <span className="text-xs text-gray-400">• {s.family_agent_name}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                Split #{s.split_id} • req {s.request_id}
                                {s.proof_note ? ` • "${s.proof_note}"` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm">💎 {s.gems_amount?.toLocaleString()}</p>
                              <p className="text-xs text-green-700 font-semibold">${Number(s.payout_usd || 0).toFixed(2)}</p>
                            </div>
                            {s.proof_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-indigo-600 shrink-0"
                                onClick={async () => {
                                  const { data: signedData } = await supabase.storage
                                    .from('withdrawal-proofs')
                                    .createSignedUrl(s.proof_url, 3600);
                                  if (signedData?.signedUrl) window.open(signedData.signedUrl, '_blank');
                                }}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={closeActionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2",
              actionDialog.type === 'approve' || actionDialog.type === 'confirm_payment' ? 'text-green-700' :
                actionDialog.type === 'reset' ? 'text-blue-700' : 'text-red-700'
            )}>
              {actionDialog.type === 'approve' && <CheckCircle2 className="w-5 h-5" />}
              {actionDialog.type === 'confirm_payment' && <DollarSign className="w-5 h-5" />}
              {actionDialog.type === 'reject' && <XCircle className="w-5 h-5" />}
              {actionDialog.type === 'reset' && <RotateCcw className="w-5 h-5" />}
              {getActionDialogTitle(actionDialog.type)}
            </DialogTitle>
            <DialogDescription>
              {getActionDialogDescription(actionDialog.type, actionDialog.request)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="note" className={actionDialog.type === 'reject' ? "text-red-700 font-semibold" : ""}>
                {actionDialog.type === 'approve' ? 'Admin Note (Optional)' :
                  actionDialog.type === 'confirm_payment' ? 'Note (Optional)' :
                    actionDialog.type === 'reset' ? 'Reset Note (Optional)' :
                      'Rejection Reason (Required)'}
              </Label>
              <Textarea
                id="note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  actionDialog.type === 'approve' ? "Internal note for this transaction..." :
                    actionDialog.type === 'confirm_payment' ? "Add a note..." :
                      actionDialog.type === 'reset' ? "Reason for reset..." :
                        "Please explain why this request is being rejected..."
                }
                className={cn("min-h-[100px]", actionDialog.type === 'reject' && !adminNote && "border-red-300 focus-visible:ring-red-300")}
              />
              {actionDialog.type === 'reject' && !adminNote && (
                <p className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Reason is required for rejection
                </p>
              )}
            </div>

            {actionDialog.type === 'confirm_payment' && actionDialog.request?.paid_proof_url && (
              <div className="bg-gray-50 p-3 rounded-md text-sm border flex justify-between items-center">
                <span className="text-gray-600">Proof Submitted by Agent</span>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0"
                  onClick={(e) => openProofDialog(actionDialog.request.id, e)}
                >
                  View Proof
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
            <Button
              variant={actionDialog.type === 'reject' ? 'destructive' : actionDialog.type === 'reset' ? 'secondary' : 'default'}
              onClick={handleActionConfirm}
              className={
                actionDialog.type === 'approve' || actionDialog.type === 'confirm_payment' ? 'bg-green-600 hover:bg-green-700' :
                  actionDialog.type === 'reset' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
              }
              disabled={actionDialog.type === 'reject' && !adminNote.trim()}
            >
              Confirm {
                actionDialog.type === 'approve' ? 'Approval' :
                  actionDialog.type === 'confirm_payment' ? 'Payment' :
                    actionDialog.type === 'reset' ? 'Reset' :
                      'Rejection'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Viewer Dialog */}
      <Dialog open={proofDialog.open} onOpenChange={(open) => !open && setProofDialog({ open: false, requestId: null })}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Proof Details</DialogTitle>
            <DialogDescription>
              Review the payment proof submitted by the recharge agent.
            </DialogDescription>
          </DialogHeader>

          {isLoadingProof ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-gray-500">Loading proof details...</p>
            </div>
          ) : proofDetails ? (
            <div className="space-y-6">
              <div className="rounded-lg border bg-gray-50 p-2 flex justify-center bg-[url('/checker-pattern.png')]">
                {proofDetails.signedUrl ? (
                  <img
                    src={proofDetails.signedUrl}
                    alt="Payment Proof"
                    className="max-h-[500px] object-contain rounded shadow-sm"
                  />
                ) : (
                  <div className="py-12 text-gray-400 italic">No image available</div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Submitted By Agent</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {proofDetails.paid_marked_by_name?.charAt(0) || 'A'}
                      </div>
                      <span className="text-gray-700">{proofDetails.paid_marked_by_name || 'Unknown Agent'}</span>
                      <span className="text-xs text-gray-400">({proofDetails.paid_marked_by_profile_id})</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Submitted At</h4>
                    <p className="text-gray-700 mt-1">
                      {proofDetails.paid_marked_at ? format(new Date(proofDetails.paid_marked_at), 'PPpp') : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900">Agent Note</h4>
                  <div className="p-3 bg-gray-50 rounded-md border text-gray-700 min-h-[80px]">
                    {proofDetails.paid_proof_note || <span className="text-gray-400 italic">No note provided</span>}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" size="sm" asChild>
                  <a href={proofDetails.signedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open Original
                  </a>
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setProofDialog({ open: false, requestId: null })}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-red-500">
              Failed to load proof details.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <OpenWithdrawalCycleModal
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        onRefresh={() => fetchRequests(true)}
      />
    </div>
  );
}