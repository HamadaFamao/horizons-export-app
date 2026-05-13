import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [reviewingReport, setReviewingReport] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { staffRole } = useAdminPermissions();
  const { toast } = useToast();
  const isManager = staffRole === 'manager';

  // ============================================
  // FETCH REPORTS
  // ============================================
  const fetchReports = async (currentPage = page) => {
    setLoading(true);
    try {
      let query = supabase.from('reports').select('*', { count: 'exact' });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter.toLowerCase());
      }

      if (searchTerm) {
        query = query.or(
          `target_name.ilike.%${searchTerm}%,reason.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Fetch reporter profiles
      const reporterIds = [...new Set((data || []).map(r => r.reporter_id).filter(Boolean))];
      let reportersMap = {};
      if (reporterIds.length > 0) {
        const { data: reporters } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', reporterIds);
        (reporters || []).forEach(r => {
          reportersMap[r.id] = r;
        });
      }

      // Fetch reported user/room profiles (if applicable)
      const targetIds = [...new Set((data || []).map(r => r.target_id).filter(Boolean))];
      let targetsMap = {};
      if (targetIds.length > 0) {
        const { data: targets } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', targetIds);
        (targets || []).forEach(t => {
          targetsMap[t.id] = t;
        });
      }

      // Enrich reports with profile data
      const enrichedReports = (data || []).map(r => ({
        ...r,
        reporter: reportersMap[r.reporter_id] || null,
        targetProfile: targetsMap[r.target_id] || null,
      }));

      setReports(enrichedReports);
      setTotalCount(count || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchReports(0);
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (page === 0 && (statusFilter !== 'All' || searchTerm)) return;
    fetchReports(page);
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchReports(0);
  };

  // ============================================
  // REVIEW ACTIONS
  // ============================================
  const handleReviewReport = (report) => {
    setReviewingReport(report);
    setAdminNote(report.admin_note || '');
  };

  const updateReportStatus = async (newStatus) => {
    if (!reviewingReport || updatingStatus) return;
    setUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          reviewed_by: (await supabase.auth.getUser()).data?.user?.id,
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote.trim() || null,
        })
        .eq('id', reviewingReport.id);

      if (error) throw error;

      toast({
        title: `✅ Report ${newStatus}`,
        description: `Status updated to ${newStatus}`,
      });

      setReviewingReport(null);
      setAdminNote('');
      fetchReports(page);
    } catch (e) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Reports Management</h1>
        <Button variant="outline" size="sm" onClick={() => fetchReports(page)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="Search by target name or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </form>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Reports</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Reviewed">Reviewed</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reporter</TableHead>
              <TableHead>Reported User/Room</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <Loader2 className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center p-4 text-gray-500">
                  No reports found.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {report.reporter?.name || 'Unknown'} (#{report.reporter_id?.slice(0, 8)})
                  </TableCell>
                  <TableCell>
                    {report.targetProfile?.name || report.target_name || 'Unknown'} (#{report.target_id?.slice(0, 8)})
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {report.report_type || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{report.reason}</TableCell>
                  <TableCell>
                    {report.status === 'pending' && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        Pending
                      </span>
                    )}
                    {report.status === 'reviewed' && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        Reviewed
                      </span>
                    )}
                    {report.status === 'resolved' && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Resolved
                      </span>
                    )}
                    {report.status === 'dismissed' && (
                      <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
                        Dismissed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewReport(report)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 px-2">
        <span className="text-sm text-slate-500">
          Showing {Math.min(page * PAGE_SIZE + 1, totalCount)}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} reports
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => {
              setPage(p => p - 1);
              fetchReports(page - 1);
            }}
          >
            ← Prev
          </Button>
          <span className="text-sm font-medium">Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE) || 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
            onClick={() => {
              setPage(p => p + 1);
              fetchReports(page + 1);
            }}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Review Modal */}
      <Dialog open={!!reviewingReport} onOpenChange={(open) => !open && setReviewingReport(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>

          {reviewingReport && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reporter</p>
                  <p className="font-medium">{reviewingReport.reporter?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reported User/Room</p>
                  <p className="font-medium">{reviewingReport.targetProfile?.name || reviewingReport.target_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Type</p>
                  <p className="font-medium capitalize">{reviewingReport.report_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reason</p>
                  <p className="font-medium">{reviewingReport.reason}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Status</p>
                  <p className="font-medium capitalize">{reviewingReport.status}</p>
                </div>
              </div>

              {reviewingReport.description && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Description</p>
                  <p className="text-sm text-blue-900 break-words">{reviewingReport.description}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Admin Note</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add notes about this report..."
                  disabled={updatingStatus}
                  maxLength={500}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-slate-500 text-right">{adminNote.length}/500</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => updateReportStatus('dismissed')}
              disabled={updatingStatus}
            >
              Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => updateReportStatus('reviewed')}
              disabled={updatingStatus}
            >
              Mark Reviewed
            </Button>
            <Button
              onClick={() => updateReportStatus('resolved')}
              disabled={updatingStatus}
            >
              {updatingStatus ? <Loader2 className="animate-spin" /> : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}