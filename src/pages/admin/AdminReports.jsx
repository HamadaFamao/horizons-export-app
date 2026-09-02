import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [managingReport, setManagingReport] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'content'
  const [postReports, setPostReports] = useState([]);
  const [loadingPostReports, setLoadingPostReports] = useState(false);

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

      // Fetch reported users
      const reportedUserIds = (data || [])
        .map(r => r.reported_user_id)
        .filter(Boolean);

      const reportedRoomIds = (data || [])
        .map(r => r.reported_room_id)
        .filter(Boolean);

      let reportedUsersMap = {};
      if (reportedUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name, profile_id')
          .in('id', reportedUserIds);
        (users || []).forEach(u => {
          reportedUsersMap[u.id] = u;
        });
      }

      let reportedRoomsMap = {};
      if (reportedRoomIds.length > 0) {
        const { data: rooms } = await supabase
          .from('live_rooms')
          .select('id, title, public_room_id')
          .in('id', reportedRoomIds);
        (rooms || []).forEach(r => {
          reportedRoomsMap[r.id] = r;
        });
      }

      // Enrich reports with profile data
      const enrichedReports = (data || []).map(r => ({
        ...r,
        reporter: reportersMap[r.reporter_id] || null,
        reported_user: reportedUsersMap[r.reported_user_id] || null,
        reported_room: reportedRoomsMap[r.reported_room_id] || null,
      }));

      setReports(enrichedReports);
      setTotalCount(count || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPostReports = async () => {
    setLoadingPostReports(true);
    try {
      const { data, error } = await supabase
        .from('post_reports')
        .select(`
          id, reason, created_at, post_id,
          reporter:reporter_id (name, profile_id),
          post:post_id (type, caption, media_url, user_id,
            author:user_id (name, profile_id))
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPostReports(data || []);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingPostReports(false);
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

  useEffect(() => {
    if (activeTab === 'content') fetchPostReports();
  }, [activeTab]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchReports(0);
  };

  // ============================================
  // REVIEW ACTIONS
  // ============================================
  const handleReviewReport = (report) => {
    setManagingReport(report);
    setAdminNote(report.admin_note || '');
  };

  const handleSaveNote = async (reportId, note, newStatus) => {
    if (!reportId || updatingStatus) return;
    setUpdatingStatus(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('reports')
        .update({
          admin_note: note,
          status: newStatus,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({ title: '✅ Report updated' });
      setManagingReport(null);
      setAdminNote('');
      fetchReports();
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

  const handleDeleteReport = async (reportId) => {
    if (!reportId) return;
    if (!window.confirm('Delete this report permanently?')) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);
      if (error) throw error;

      toast({ title: '🗑️ Report deleted' });
      setManagingReport(null);
      setAdminNote('');
      fetchReports();
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

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 mb-4">
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('users')}
        >
          👤 User & Room Reports
        </Button>
        <Button
          variant={activeTab === 'content' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('content')}
          className="relative"
        >
          📝 Content Reports
          {postReports.filter(r => !r.reviewed).length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {postReports.length}
            </span>
          )}
        </Button>
      </div>

      {activeTab === 'users' && (
        <>
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
                        {report.reported_user?.name || report.reported_room?.title || 'Unknown'} (#{report.reported_user?.profile_id || report.reported_room?.public_room_id || '—'})
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
      )}
      {activeTab === 'content' && (
        <div>
          {loadingPostReports ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400" />
            </div>
          ) : postReports.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No content reports</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Post Author</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postReports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="text-xs text-blue-600 font-medium">
                        {r.reporter?.name || '—'}
                        {r.reporter?.profile_id && ` #${r.reporter.profile_id}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-purple-600 font-medium">
                        {r.post?.author?.name || '—'}
                        {r.post?.author?.profile_id && ` #${r.post.author.profile_id}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.post?.type === 'video' ? 'bg-purple-100 text-purple-700' :
                        r.post?.type === 'photo' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {r.post?.type || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-red-600">{r.reason || '—'}</span>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {r.post?.media_url ? (
                        r.post.type === 'video' ? (
                          <a href={r.post.media_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-500 hover:underline">
                            View Video
                          </a>
                        ) : (
                          <img src={r.post.media_url} className="w-12 h-12 object-cover rounded-lg" />
                        )
                      ) : (
                        <span className="text-xs text-gray-500 truncate block max-w-[120px]">
                          {r.post?.caption || '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-400">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => navigate(`/user/${r.post?.author?.profile_id}`)}
                        >
                          Profile
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs h-7"
                          onClick={async () => {
                            if (!window.confirm('Delete this post?')) return;
                            await supabase.from('posts')
                              .update({ is_active: false })
                              .eq('id', r.post_id);
                            toast({ title: '✅ Post deleted' });
                            fetchPostReports();
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={!!managingReport} onOpenChange={(open) => !open && setManagingReport(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>

          {managingReport && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reporter</p>
                  <p className="font-medium">{managingReport.reporter?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reported User/Room</p>
                  <p className="font-medium">{managingReport.reported_user?.name || managingReport.reported_room?.title || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Type</p>
                  <p className="font-medium capitalize">{managingReport.report_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reason</p>
                  <p className="font-medium">{managingReport.reason}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Status</p>
                  <p className="font-medium capitalize">{managingReport.status}</p>
                </div>
              </div>

              {managingReport.description && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Description</p>
                  <p className="text-sm text-blue-900 break-words">{managingReport.description}</p>
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
              onClick={() => handleSaveNote(managingReport.id, adminNote, 'dismissed')}
              disabled={updatingStatus}
            >
              Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveNote(managingReport.id, adminNote, 'reviewed')}
              disabled={updatingStatus}
            >
              Mark Reviewed
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleDeleteReport(managingReport.id)}
              disabled={updatingStatus}
            >
              🗑️ Delete Report
            </Button>
            <Button
              onClick={() => handleSaveNote(managingReport.id, adminNote, 'resolved')}
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