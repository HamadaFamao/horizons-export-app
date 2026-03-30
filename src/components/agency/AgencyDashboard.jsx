import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Users, DollarSign, TrendingUp,
  UserPlus, Search, CheckCircle, XCircle,
  RefreshCw, Mail, Share2, Wallet, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ClientEarningsPanel from './ClientEarningsPanel';
import AgencyWithdrawal from '@/pages/agency/AgencyWithdrawal';
import AgencyMonthlyWithdrawal from '@/pages/agency/AgencyMonthlyWithdrawal';

export default function AgencyDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalEarnings: 0,
    lastEarningDate: null
  });
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [activeInvites, setActiveInvites] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Invite Dialog State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteProfileId, setInviteProfileId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Cache agency ID to avoid refetching
  const [agencyId, setAgencyId] = useState(null);

  // ✅ IMPORTANT: load dashboard as soon as we have user.id (no is_agent gate)
  useEffect(() => {
    let mounted = true;

    const initDashboard = async () => {
      if (!user?.id) {
        if (mounted) setLoading(false);
        return;
      }

      await fetchDashboardData(mounted);
    };

    initDashboard();

    return () => { mounted = false; };
  }, [user?.id]);

  const fetchDashboardData = async (mounted = true) => {
    if (!mounted) return;

    console.log("AGENCY_DASHBOARD_LOADING_ON");
    setLoading(true);

    try {
      // ✅ 1) Get Agency ID using p_user_id
      let aId = null;

      try {
        const { data: agencyRows, error: agencyError } = await supabase
          .rpc('get_my_owned_agency', { p_user_id: user.id });

        console.log("[get_my_owned_agency] rows:", agencyRows);

        if (agencyError) throw agencyError;

        // RPC returns table rows
        aId = agencyRows?.[0]?.agency_id || null;
      } catch (e) {
        console.error("Error fetching agency ID:", e);
      }

      if (!aId) {
        console.log("No agency found for current user");
        if (mounted) {
          setAgencyId(null);
          setMembers([]);
          setJoinRequests([]);
          setActiveInvites([]);
          setStats({ totalReferrals: 0, totalEarnings: 0, lastEarningDate: null });
          setLoading(false);
        }
        console.log("AGENCY_DASHBOARD_LOADING_OFF (No Agency)");
        return;
      }

      if (mounted) setAgencyId(aId);

      // ✅ 2) Fetch all dependent data in parallel
      const [statsResult, membersResult, requestsResult, invitesResult] = await Promise.allSettled([
        fetchStatsSafe(),
        fetchMembersSafe(aId),
        fetchJoinRequestsSafe(aId),
        fetchActiveInvitesSafe(aId)
      ]);

      if (mounted) {
        // Stats
        if (statsResult.status === 'fulfilled' && statsResult.value) {
          setStats(statsResult.value);
        }

        // Members
        if (membersResult.status === 'fulfilled' && membersResult.value) {
          setMembers(membersResult.value);
        } else {
          setMembers([]);
        }

        // Requests
        if (requestsResult.status === 'fulfilled' && requestsResult.value) {
          setJoinRequests(requestsResult.value);
        } else {
          setJoinRequests([]);
        }

        // Invites
        if (invitesResult.status === 'fulfilled' && invitesResult.value) {
          setActiveInvites(invitesResult.value);
        } else {
          setActiveInvites([]);
        }
      }

      console.log("AGENCY_DASHBOARD_RPC_DONE", {
        agencyId: aId,
        membersCount: membersResult.status === 'fulfilled' ? membersResult.value?.length : 0,
        invitesCount: invitesResult.status === 'fulfilled' ? invitesResult.value?.length : 0,
        requestsCount: requestsResult.status === 'fulfilled' ? requestsResult.value?.length : 0
      });

    } catch (error) {
      console.error("Dashboard data load error (Critical):", error);
      if (mounted) {
        toast({
          title: "Error",
          description: "Some dashboard data failed to load. Please refresh.",
          variant: "destructive"
        });
      }
    } finally {
      if (mounted) {
        setLoading(false);
        console.log("AGENCY_DASHBOARD_LOADING_OFF");
      }
    }
  };

  // Safe wrappers for RPC calls
  const fetchStatsSafe = async () => {
    try {
      const { data, error } = await supabase.rpc('get_agent_dashboard_summary');
      if (error) throw error;
      if (data && data.length > 0) {
        return {
          totalReferrals: data[0].total_referrals || 0,
          totalEarnings: data[0].total_agent_gems || 0,
          lastEarningDate: data[0].last_earning_at
        };
      }
      return { totalReferrals: 0, totalEarnings: 0, lastEarningDate: null };
    } catch (err) {
      console.error("Error fetching stats:", err);
      return { totalReferrals: 0, totalEarnings: 0, lastEarningDate: null };
    }
  };

  const fetchMembersSafe = async (id) => {
    try {
      const { data, error } = await supabase.rpc('list_agency_members_for_dashboard', {
        p_agency_id: id
      });
      if (error) throw error;
      console.log("[list_agency_members_for_dashboard] rows:", data);
      return data || [];
    } catch (err) {
      console.error("Error fetching members:", err);
      return [];
    }
  };

  const fetchJoinRequestsSafe = async (id) => {
    try {
      const { data, error } = await supabase.rpc('list_agency_join_requests_for_dashboard', {
        p_agency_id: id
      });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching join requests:", err);
      return [];
    }
  };

  const fetchActiveInvitesSafe = async (id) => {
    try {
      const { data, error } = await supabase.rpc('list_agency_invites_for_dashboard', {
        p_agency_id: id
      });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching active invites:", err);
      return [];
    }
  };

  // Normalization layer for members data
  const normalizedMembers = (members || []).map(m => ({
    ...m,
    user_id: m.user_id ?? m.member_user_id,
    profile_id: m.profile_id ?? m.member_profile_id,
    name: m.name ?? m.member_name,
    avatar_url: m.avatar_url ?? m.member_avatar_url,
    joined_at: m.joined_at,
    gems_this_month: m.gems_this_month ?? 0,
    conversions_this_month: m.conversions_this_month ?? 0,
    gems_total: m.gems_total ?? 0,
    last_conversion_at: m.last_conversion_at
  }));

  const handleInviteUser = async () => {
    if (!inviteProfileId.trim()) return;

    const profileIdNum = parseInt(inviteProfileId.trim(), 10);
    if (isNaN(profileIdNum)) {
      toast({
        title: "Invalid Profile ID",
        description: "Please enter a valid numeric Profile ID.",
        variant: "destructive"
      });
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.rpc('send_agency_invite_by_profile_id', {
        p_invited_profile_id: profileIdNum
      });

      if (error) {
        const isAlreadyInvited =
          error.code === '23505' ||
          error.message?.includes('agency_invites_unique_pending') ||
          (error.code === '42704' && error.message?.includes('agency_invites_unique_pending'));

        if (isAlreadyInvited) {
          toast({
            title: "Already Invited",
            description: `An invite is already pending for Profile ID: ${profileIdNum}`,
            variant: "default",
          });
          setInviteProfileId('');
          setIsInviteOpen(false);
          if (agencyId) fetchActiveInvitesSafe(agencyId).then(setActiveInvites);
          return;
        }
        throw error;
      }

      toast({
        title: "Invite Sent",
        description: `Invitation sent to Profile ID: ${profileIdNum}`,
        className: "bg-green-50 text-green-900 border-green-200"
      });

      setInviteProfileId('');
      setIsInviteOpen(false);

      if (agencyId) {
        Promise.all([
          fetchActiveInvitesSafe(agencyId).then(setActiveInvites),
          fetchJoinRequestsSafe(agencyId).then(setJoinRequests),
        ]);
      }

    } catch (error) {
      console.error('Invite error:', error);
      toast({
        title: "Error",
        description: "Failed to send invite.",
        variant: "destructive"
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRequestDecision = async (requestId, approved) => {
    try {
      const { data, error } = await supabase.rpc('decide_agency_join_request_bool', {
        p_request_id: requestId,
        p_approved: approved
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: approved ? "Request Approved" : "Request Rejected",
          description: approved ? "New member added to your agency." : "Join request rejected.",
          className: approved ? "bg-green-50 text-green-900" : ""
        });
        if (agencyId) {
          fetchJoinRequestsSafe(agencyId).then(setJoinRequests);
          if (approved) fetchMembersSafe(agencyId).then(setMembers);
        }
      } else {
        toast({
          title: "Action Failed",
          description: data?.error || "Could not process request.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Decision error:', error);
      toast({
        title: "Error",
        description: "Failed to process request.",
        variant: "destructive"
      });
    }
  };

  const handleRevokeInvite = async (requestId) => {
    try {
      const { data, error } = await supabase.rpc('revoke_agency_invite', { p_request_id: requestId });
      if (error) throw error;

      toast({
        title: "Invite Revoked",
        description: "The invitation has been cancelled."
      });

      if (agencyId) fetchActiveInvitesSafe(agencyId).then(setActiveInvites);
    } catch (error) {
      console.error('Revoke error:', error);
      toast({ title: "Error", description: "Failed to revoke invite.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-gray-500">Loading agency dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Active agency members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agency Gems</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{Number(stats.totalEarnings || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings from commission</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agency Action</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsInviteOpen(true)}>
              <Mail className="w-4 h-4 mr-2" /> Invite Member
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-gray-200 p-0 h-auto w-full md:w-auto flex flex-col md:flex-row md:inline-flex rounded-lg overflow-hidden">
          <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 py-3 px-6 rounded-none border-b md:border-b-0 md:border-r border-gray-100 last:border-0">
            <Users className="w-4 h-4 mr-2" /> Members & Earnings
          </TabsTrigger>

          <TabsTrigger value="requests" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 py-3 px-6 rounded-none border-b md:border-b-0 md:border-r border-gray-100 last:border-0 relative">
            <UserPlus className="w-4 h-4 mr-2" />
            Requests
            {(joinRequests.length > 0) && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="invites" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 py-3 px-6 rounded-none border-b md:border-b-0 md:border-r border-gray-100 last:border-0">
            <Share2 className="w-4 h-4 mr-2" /> Sent Invites
          </TabsTrigger>

          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 py-3 px-6 rounded-none border-b md:border-b-0 md:border-r border-gray-100 last:border-0">
            <Wallet className="w-4 h-4 mr-2" /> Withdrawals (Cycle)
          </TabsTrigger>

          <TabsTrigger value="payouts" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 py-3 px-6 rounded-none">
            <DollarSign className="w-4 h-4 mr-2" /> Withdrawal Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ClientEarningsPanel
            members={normalizedMembers}
            loading={loading}
            onMemberRemoved={() => {
              if (agencyId) {
                fetchMembersSafe(agencyId).then(setMembers);
                fetchStatsSafe().then(setStats);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Join Requests</CardTitle>
              <CardDescription>Review users who want to join your agency.</CardDescription>
            </CardHeader>
            <CardContent>
              {joinRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-6 h-6 text-gray-400" />
                  </div>
                  <p>No pending requests at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {joinRequests.map(req => (
                    <div key={req.request_id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={req.requester_avatar_url} />
                          <AvatarFallback>{req.requester_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium text-gray-900">{req.requester_name}</h4>
                          <p className="text-sm text-gray-500">ID: {req.requester_profile_id}</p>
                          <p className="text-xs text-gray-400">{new Date(req.requested_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleRequestDecision(req.request_id, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={() => handleRequestDecision(req.request_id, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Sent Invites</CardTitle>
                <CardDescription>Track invitations you've sent to users.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsInviteOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <UserPlus className="w-4 h-4 mr-2" /> New Invite
              </Button>
            </CardHeader>
            <CardContent>
              {activeInvites.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-6 h-6 text-gray-400" />
                  </div>
                  <p>No active invites sent.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeInvites.map(invite => (
                    <div key={invite.request_id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={invite.invited_avatar_url} />
                          <AvatarFallback>{invite.invited_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium text-gray-900">{invite.invited_name}</h4>
                          <p className="text-sm text-gray-500">ID: {invite.invited_profile_id}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium capitalize">
                              {invite.status}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(invite.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRevokeInvite(invite.request_id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <AgencyMonthlyWithdrawal />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <AgencyWithdrawal />
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Enter the Profile ID of the user you want to invite to your agency.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">User Profile ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="e.g. 100123"
                className="pl-9"
                value={inviteProfileId}
                onChange={(e) => setInviteProfileId(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              The user will receive an invitation in their agency dashboard.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInviteUser}
              disabled={!inviteProfileId || inviteLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {inviteLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" /> Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}