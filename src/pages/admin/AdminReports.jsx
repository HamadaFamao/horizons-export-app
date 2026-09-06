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
  // ============================================
  // STATE - GENERAL
  // ============================================
  const [activeTab, setActiveTab] = useState('user-reports'); // 'user-reports' or 'post-reports'
  const PAGE_SIZE = 20;
  const { staffRole } = useAdminPermissions();
  const { toast } = useToast();
  const isManager = staffRole === 'manager';

  // ============================================
  // STATE - USER/ROOM REPORTS
  // ============================================
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [pageReports, setPageReports] = useState(0);
  const [totalCountReports, setTotalCountReports] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [managingReport, setManagingReport] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ============================================
  // STATE - POST REPORTS
  // ============================================
  const [postReports, setPostReports] = useState([]);
  const [loadingPostReports, setLoadingPostReports] = useState(false);
  const [pagePostReports, setPagePostReports] = useState(0);
  const [totalCountPostReports, setTotalCountPostReports] = useState(0);
  const [statusFilterPost, setStatusFilterPost] = useState('All');
  const [managingPostReport, setManagingPostReport] = useState(null);
  const [adminNotePost, setAdminNotePost] = useState('');
  const [updatingPostStatus, setUpdatingPostStatus] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);

  // ============================================
  // FETCH USER/ROOM REPORTS
  // ============================================
  const fetchReports = async (currentPage = pageReports) => {
    setLoadingReports(true);
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
      setTotalCountReports(count || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingReports(false);
    }
  };

  // ============================================
  // FETCH POST REPORTS
  // ============================================
  const fetchPostReports = async (currentPage = pagePostReports) => {
    setLoadingPostReports(true);
    try {
      let query = supabase.from('post_reports').select('*', { count: 'exact' });

      if (statusFilterPost !== 'All') {
        query = query.eq('status', statusFilterPost.toLowerCase());
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

      // Fetch posts with user info - including soft-deleted ones for admin review
      const postIds = [...new Set((data || []).map(r => r.post_id).filter(Boolean))];
      let postsMap = {};

      console.log('[POST_REPORTS] Starting fetch for post IDs:', postIds);

      if (postIds.length > 0) {
        // Try to fetch all available columns from posts (including soft-deleted)
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('id, user_id, type, media_url, caption, created_at, is_active')
          .in('id', postIds);

        if (postsError) {
          console.error('[POST_REPORTS] Error fetching posts:', postsError);
        } else {
          console.log('[POST_REPORTS] ✅ Fetched posts:', posts?.length || 0);
          if (posts && posts.length > 0) {
            console.log('[POST_REPORTS] Sample post:', posts[0]);
            posts.forEach(p => console.log(`[POST_REPORTS] Post ${p.id}: type=${p.type}, user_id=${p.user_id}`));
          }
        }

        (posts || []).forEach(p => {
          postsMap[p.id] = p;
        });
      }

      // Fetch post owners - get unique owner IDs from posts
      const postOwnerIds = [...new Set(
        Object.values(postsMap)
          .map(p => p?.user_id)
          .filter(Boolean)
      )];

      console.log('[POST_OWNERS] Looking for user IDs:', postOwnerIds);

      let ownersMap = {};
      if (postOwnerIds.length > 0) {
        const { data: owners, error: ownersError } = await supabase
          .from('profiles')
          .select('id, name, profile_id')
          .in('id', postOwnerIds);

        if (ownersError) {
          console.error('[POST_OWNERS] Error fetching profiles:', ownersError);
        } else {
          console.log('[POST_OWNERS] ✅ Fetched profiles:', owners?.length || 0);
          if (owners && owners.length > 0) {
            owners.forEach(o => console.log(`[POST_OWNERS] Profile: id=${o.id}, name=${o.name}`));
          } else {
            console.warn('[POST_OWNERS] ⚠️  No profiles found for user IDs:', postOwnerIds);
          }
        }
        (owners || []).forEach(o => {
          ownersMap[o.id] = o;
        });
      }

      console.log('[POST_ENRICHMENT] Summary:', {
        postsFound: Object.keys(postsMap).length,
        profilesFound: Object.keys(ownersMap).length,
        missingProfiles: postOwnerIds.length - Object.keys(ownersMap).length,
      });

      // Enrich post reports with all data
      const enrichedPostReports = (data || []).map(r => {
        const post = postsMap[r.post_id];
        let postOwner = null;

        if (post && post.user_id) {
          postOwner = ownersMap[post.user_id];
          console.log(`[POST_ENRICHMENT] Report ${r.id}: post_id=${r.post_id}, user_id=${post?.user_id}, owner=`, postOwner);
        }

        return {
          ...r,
          reporter: reportersMap[r.reporter_id] || null,
          post: post || null,
          post_owner: postOwner || null,
        };
      });

      setPostReports(enrichedPostReports);
      setTotalCountPostReports(count || 0);

      // Count pending post reports
      const { count: pendingCount } = await supabase
        .from('post_reports')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');
      setNewPostCount(pendingCount || 0);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingPostReports(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    setPageReports(0);
    fetchReports(0);
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (pageReports === 0 && (statusFilter !== 'All' || searchTerm)) return;
    fetchReports(pageReports);
  }, [pageReports]);

  useEffect(() => {
    setPagePostReports(0);
    fetchPostReports(0);
  }, [statusFilterPost]);

  useEffect(() => {
    if (pagePostReports === 0) return;
    fetchPostReports(pagePostReports);
  }, [pagePostReports]);

  useEffect(() => {
    if (activeTab === 'post-reports') {
      fetchPostReports(0);
    }
  }, [activeTab]);

  // ============================================
  // HANDLERS - USER/ROOM REPORTS
  // ============================================
  const handleSearch = (e) => {
    e.preventDefault();
    setPageReports(0);
    fetchReports(0);
  };

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
  // HANDLERS - POST REPORTS
  // ============================================
  const handleReviewPostReport = (report) => {
    setManagingPostReport(report);
    setAdminNotePost(report.admin_note || '');
  };

  const handleSavePostNote = async (reportId, note, newStatus) => {
    if (!reportId || updatingPostStatus) return;
    setUpdatingPostStatus(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('post_reports')
        .update({
          admin_note: note,
          status: newStatus,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({ title: '✅ Post report updated' });
      setManagingPostReport(null);
      setAdminNotePost('');
      fetchPostReports();
    } catch (e) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingPostStatus(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!postId) return;
    if (!window.confirm('Delete this post permanently?')) return;

    setUpdatingPostStatus(true);
    try {
      // Set is_active to false (soft delete)
      const { error } = await supabase
        .from('posts')
        .update({ is_active: false })
        .eq('id', postId);

      if (error) throw error;

      toast({ title: '🗑️ Post deactivated' });
      setManagingPostReport(null);
      setAdminNotePost('');
      fetchPostReports();
    } catch (e) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingPostStatus(false);
    }
  };

  const handleDeletePostReport = async (reportId) => {
    if (!reportId) return;
    if (!window.confirm('Delete this report permanently?')) return;

    setUpdatingPostStatus(true);
    try {
      const { error } = await supabase
        .from('post_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast({ title: '🗑️ Report deleted' });
      setManagingPostReport(null);
      setAdminNotePost('');
      fetchPostReports();
    } catch (e) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingPostStatus(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports Management</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => activeTab === 'user-reports' ? fetchReports(pageReports) : fetchPostReports(pagePostReports)}
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* ============================================ */}
      {/* TABS */}
      {/* ============================================ */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => {
            setActiveTab('user-reports');
            setPageReports(0);
          }}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'user-reports'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          User/Room Reports
        </button>
        <button
          onClick={() => {
            setActiveTab('post-reports');
            setPagePostReports(0);
          }}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors relative ${
            activeTab === 'post-reports'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Post Reports
          {newPostCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {newPostCount}
            </span>
          )}
        </button>
      </div>

      {/* ============================================ */}
      {/* USER/ROOM REPORTS TAB */}
      {/* ============================================ */}
      {activeTab === 'user-reports' && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <Input
                placeholder="Search by target name or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button type="submit" disabled={loadingReports}>
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
                {loadingReports ? (
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
              Showing {Math.min(pageReports * PAGE_SIZE + 1, totalCountReports)}–{Math.min((pageReports + 1) * PAGE_SIZE, totalCountReports)} of {totalCountReports} reports
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageReports === 0 || loadingReports}
                onClick={() => {
                  setPageReports(p => p - 1);
                  fetchReports(pageReports - 1);
                }}
              >
                ← Prev
              </Button>
              <span className="text-sm font-medium">Page {pageReports + 1} of {Math.ceil(totalCountReports / PAGE_SIZE) || 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={(pageReports + 1) * PAGE_SIZE >= totalCountReports || loadingReports}
                onClick={() => {
                  setPageReports(p => p + 1);
                  fetchReports(pageReports + 1);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* POST REPORTS TAB */}
      {/* ============================================ */}
      {activeTab === 'post-reports' && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Select value={statusFilterPost} onValueChange={setStatusFilterPost}>
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
                  <TableHead>Post Owner</TableHead>
                  <TableHead>Post Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPostReports ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader2 className="mx-auto animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : postReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center p-4 text-gray-500">
                      No post reports found.
                    </TableCell>
                  </TableRow>
                ) : (
                  postReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.reporter?.name || 'Unknown'} (#{report.reporter_id?.slice(0, 8)})
                      </TableCell>
                      <TableCell>
                        {report.post_owner?.name ? (
                          <>
                            {report.post_owner?.name}
                            <span className="text-xs text-gray-500 ml-1">({report.post_owner?.profile_id || 'N/A'})</span>
                          </>
                        ) : report.post?.user_id ? (
                          <span className="text-gray-500 italic">
                            Loading...
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          report.post?.type
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {report.post?.type?.toUpperCase() || (report.post ? 'No Type' : 'N/A')}
                        </span>
                        {report.post?.is_active === false && (
                          <span className="text-xs ml-2 text-red-600">(Deleted)</span>
                        )}
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
                          onClick={() => handleReviewPostReport(report)}
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
              Showing {Math.min(pagePostReports * PAGE_SIZE + 1, totalCountPostReports)}–{Math.min((pagePostReports + 1) * PAGE_SIZE, totalCountPostReports)} of {totalCountPostReports} reports
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagePostReports === 0 || loadingPostReports}
                onClick={() => {
                  setPagePostReports(p => p - 1);
                  fetchPostReports(pagePostReports - 1);
                }}
              >
                ← Prev
              </Button>
              <span className="text-sm font-medium">Page {pagePostReports + 1} of {Math.ceil(totalCountPostReports / PAGE_SIZE) || 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={(pagePostReports + 1) * PAGE_SIZE >= totalCountPostReports || loadingPostReports}
                onClick={() => {
                  setPagePostReports(p => p + 1);
                  fetchPostReports(pagePostReports + 1);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* REVIEW MODAL - USER/ROOM REPORTS */}
      {/* ============================================ */}
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
              onClick={() => handleSaveNote(managingReport?.id, adminNote, 'dismissed')}
              disabled={updatingStatus}
            >
              Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveNote(managingReport?.id, adminNote, 'reviewed')}
              disabled={updatingStatus}
            >
              Mark Reviewed
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleDeleteReport(managingReport?.id)}
              disabled={updatingStatus}
            >
              🗑️ Delete Report
            </Button>
            <Button
              onClick={() => handleSaveNote(managingReport?.id, adminNote, 'resolved')}
              disabled={updatingStatus}
            >
              {updatingStatus ? <Loader2 className="animate-spin" /> : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* REVIEW MODAL - POST REPORTS */}
      {/* ============================================ */}
      <Dialog open={!!managingPostReport} onOpenChange={(open) => !open && setManagingPostReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Post Report</DialogTitle>
          </DialogHeader>

          {managingPostReport && (
            <div className="space-y-4 py-2 max-h-96 overflow-y-auto">
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reporter</p>
                  <p className="font-medium">{managingPostReport?.reporter?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Post Owner</p>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {managingPostReport?.post_owner?.name || 'Unknown'}
                      <span className="text-xs text-gray-500 ml-1">
                        ({managingPostReport?.post_owner?.profile_id || 'N/A'})
                      </span>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Post Type</p>
                  <p className="font-medium bg-purple-100 text-purple-800 px-2 py-1 rounded w-fit">
                    {managingPostReport?.post?.type?.toUpperCase() || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Reason</p>
                  <p className="font-medium">{managingPostReport?.reason}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Status</p>
                  <p className="font-medium capitalize">{managingPostReport?.status}</p>
                </div>
                {managingPostReport?.post?.id && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">Post ID</p>
                    <p className="text-xs font-mono text-slate-600">{managingPostReport?.post?.id}</p>
                  </div>
                )}
              </div>

              {/* Post Media Preview */}
              {managingPostReport?.post?.media_url && (
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-semibold mb-2">Post Media</p>
                  {managingPostReport?.post?.type === 'photo' ? (
                    <img
                      src={managingPostReport?.post?.media_url}
                      alt="Post"
                      className="max-w-full h-auto rounded max-h-48 object-cover"
                    />
                  ) : managingPostReport?.post?.type === 'video' ? (
                    <video
                      src={managingPostReport?.post?.media_url}
                      controls
                      className="max-w-full h-auto rounded max-h-48"
                    />
                  ) : null}
                </div>
              )}

              {/* Post Content */}
              {managingPostReport?.post?.caption && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Post Content</p>
                  <p className="text-sm text-blue-900 break-words">{managingPostReport?.post?.caption}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Admin Note</Label>
                <Textarea
                  value={adminNotePost}
                  onChange={(e) => setAdminNotePost(e.target.value)}
                  placeholder="Add notes about this report..."
                  disabled={updatingPostStatus}
                  maxLength={500}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-slate-500 text-right">{adminNotePost.length}/500</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {managingPostReport?.post?.id && (
              <Button
                variant="outline"
                onClick={() => {
                  window.open(`/post/${managingPostReport?.post?.id}`, '_blank', 'noopener,noreferrer');
                }}
              >
                👁️ View Post
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSavePostNote(managingPostReport?.id, adminNotePost, 'dismissed')}
              disabled={updatingPostStatus}
            >
              Dismiss
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleDeletePost(managingPostReport?.post?.id)}
              disabled={updatingPostStatus}
            >
              🗑️ Delete Post
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleDeletePostReport(managingPostReport?.id)}
              disabled={updatingPostStatus}
            >
              🗑️ Delete Report
            </Button>
            <Button
              onClick={() => handleSavePostNote(managingPostReport?.id, adminNotePost, 'resolved')}
              disabled={updatingPostStatus}
            >
              {updatingPostStatus ? <Loader2 className="animate-spin" /> : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
