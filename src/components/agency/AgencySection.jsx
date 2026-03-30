import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Briefcase, Copy, Check, Loader2, Users, Search, LogOut, MessageCircle, Ban, UserPlus } from 'lucide-react';
import { JoinAgencyCard } from '@/components/JoinAgencyCard';
import AgencyDashboard from './AgencyDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const AgencyBrowser = ({ onJoinRequest, myRequests, onCancelRequest }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [agencies, setAgencies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchAgencies();
    }, [debouncedSearch]);

    const fetchAgencies = async () => {
        setLoading(true);
        console.log('[AGENCY SYSTEM] Fetching active agencies...');
        try {
            const { data, error } = await supabase.rpc('list_active_agencies', {
                p_search: debouncedSearch,
                p_limit: 20,
                p_offset: 0
            });
            if (error) throw error;
            setAgencies(data || []);
        } catch (err) {
            console.error('[AGENCY SYSTEM] Error fetching agencies:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input 
                    placeholder="Search agencies by name or code..." 
                    className="pl-9" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {loading && agencies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading agencies...
                    </div>
                ) : agencies.length > 0 ? (
                    agencies.map((agency) => {
                        const pendingReq = myRequests.find(r => r.agency_id === agency.id && r.status === 'pending');

                        return (
                            <Card key={agency.id} className="bg-white border-gray-100 hover:border-blue-200 transition-colors">
                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-gray-100">
                                            <AvatarImage src={agency.owner_avatar_url} />
                                            <AvatarFallback>{agency.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{agency.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>Code: {agency.agency_code}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-3 w-3" /> {agency.member_count} members
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {pendingReq ? (
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                Pending
                                            </Badge>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                                                onClick={() => onCancelRequest(pendingReq.id)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => onJoinRequest(agency.id)}
                                        >
                                            Request to Join
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        No agencies found.
                    </div>
                )}
            </div>
        </div>
    );
};

const AgencyMemberView = ({ profile, onLeave, onOpenChat }) => {
    const [agencyInfo, setAgencyInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

    useEffect(() => {
        const fetchMyAgency = async () => {
             const { data, error } = await supabase.rpc('get_my_agency_status');
             if (data?.in_agency) {
                 setAgencyInfo(data.agency);
             }
             setLoading(false);
        };
        fetchMyAgency();
    }, [profile.referred_by]);

    const handleLeaveClick = () => {
        setLeaveConfirmOpen(true);
    };

    const confirmLeave = () => {
        setLeaveConfirmOpen(false);
        onLeave();
    };

    if (loading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;
    if (!agencyInfo) return null;

    return (
        <>
            <Card className="border-indigo-100 bg-indigo-50/30">
                <CardContent className="p-6">
                     <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{agencyInfo.name}</h3>
                            <p className="text-gray-500 text-sm">Agency Code: <span className="font-mono font-medium text-gray-700">{agencyInfo.code}</span></p>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Active Member</Badge>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="p-3 bg-white rounded-lg border border-gray-100">
                             <p className="text-xs text-gray-500 mb-1">Owner</p>
                             <p className="font-medium text-gray-900">{agencyInfo.owner_name}</p>
                         </div>
                         <div className="p-3 bg-white rounded-lg border border-gray-100">
                             <p className="text-xs text-gray-500 mb-1">Joined</p>
                             <p className="font-medium text-gray-900">{new Date(agencyInfo.joined_at).toLocaleDateString()}</p>
                         </div>
                     </div>

                     <div className="flex gap-3">
                         <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => onOpenChat(agencyInfo.id)}>
                             <MessageCircle className="w-4 h-4 mr-2" />
                             Agency Chat
                         </Button>
                         <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleLeaveClick}>
                             <LogOut className="w-4 h-4 mr-2" />
                             Leave Agency
                         </Button>
                     </div>
                </CardContent>
            </Card>

            <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Agency?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to leave {agencyInfo.name}? You can rejoin later by requesting again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-3 justify-end">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmLeave} className="bg-red-600 hover:bg-red-700">Leave</AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default function AgencySection({ profile, onProfileUpdate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const isAgent = profile?.is_agent === true;
  const isMember = !!profile?.referred_by;

  useEffect(() => {
      if (!isAgent && !isMember) {
          fetchMyRequests();
      }
  }, [isAgent, isMember]);

  const fetchMyRequests = async () => {
      const { data, error } = await supabase.rpc('list_my_agency_join_requests');
      if (!error && data) {
          setMyRequests(data);
      }
  };

  const handleJoinRequest = async (agencyId) => {
      console.log('[AGENCY SYSTEM] Submitting join request for:', agencyId);
      try {
          const { data, error } = await supabase.rpc('submit_agency_join_request', { p_agency_id: agencyId });
          if (error) throw error;
          if (data.success) {
              toast({ title: "Request Sent", description: "Your request to join the agency has been sent.", className: "bg-green-50 text-green-800" });
              fetchMyRequests();
          } else {
              toast({ title: "Request Failed", description: data.error, variant: "destructive" });
          }
      } catch (err) {
          console.error('[AGENCY SYSTEM] Join request error:', err);
          toast({ title: "Error", description: "Failed to submit request.", variant: "destructive" });
      }
  };

  const handleCancelRequest = async (requestId) => {
      console.log('[AGENCY SYSTEM] Cancelling request:', requestId);
      try {
          const { data, error } = await supabase.rpc('cancel_agency_join_request', { p_request_id: requestId });
          if (error) throw error;
          if (data.success) {
              toast({ title: "Request Cancelled", description: "Your join request has been cancelled." });
              fetchMyRequests();
          } else {
              toast({ title: "Action Failed", description: data.error, variant: "destructive" });
          }
      } catch (err) {
          console.error('[AGENCY SYSTEM] Cancel request error:', err);
      }
  };

  const handleLeaveAgency = async () => {
      try {
          const { data, error } = await supabase.rpc('leave_agency_v2');
          if (error) throw error;
          if (data.success) {
               toast({ title: "Left Agency", description: "You have left the agency successfully." });
               onProfileUpdate({ referred_by: null });
          }
      } catch (err) {
          console.error('[AGENCY SYSTEM] Leave error:', err);
          toast({ title: "Error", description: "Failed to leave agency.", variant: "destructive" });
      }
  };

  const handleOpenChat = async (agencyId) => {
      try {
          const { data, error } = await supabase.rpc('get_or_create_agency_chat_by_agency_id', { p_agency_id: agencyId });
          if (error) throw error;
          if (data.success && data.chat_id) {
              navigate(`/agency-chat/${data.chat_id}`);
          } else {
              toast({ title: "Chat Error", description: data.error || "Could not open chat", variant: "destructive" });
          }
      } catch (err) {
           console.error('[AGENCY SYSTEM] Chat error:', err);
           toast({ title: "Error", description: "Failed to open chat.", variant: "destructive" });
      }
  };

  const handleCopyCode = async () => {
    if (!profile.referral_code) return;
    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral code copied.", className: "bg-green-50 text-green-800" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (isAgent) {
    return (
        <div className="mb-8 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-indigo-600" />
                    Agency Management
                </h2>
            </div>

            <Card className="border-indigo-100 overflow-hidden">
                <CardHeader className="bg-indigo-50/50 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg text-indigo-900">Agency Portal</CardTitle>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-indigo-700/80">Referral Code:</span>
                                {profile.referral_code ? (
                                    <div className="flex items-center gap-2">
                                        <code className="font-mono font-bold bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-900 select-all">
                                            {profile.referral_code}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-indigo-100 text-indigo-600"
                                            onClick={handleCopyCode}
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500 italic">Generating...</span>
                                )}
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            variant={isExpanded ? "secondary" : "default"}
                            className={isExpanded ? "bg-white text-indigo-600 border border-indigo-100" : "bg-indigo-600 hover:bg-indigo-700"}
                        >
                            {isExpanded ? (
                                <>Close Dashboard <ChevronUp className="ml-2 w-4 h-4" /></>
                            ) : (
                                <>Open Agency Dashboard <ChevronDown className="ml-2 w-4 h-4" /></>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                        >
                            <CardContent className="p-0 border-t border-indigo-100 bg-gray-50/30">
                                <div className="p-4 md:p-6">
                                    <AgencyDashboard />
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </div>
    );
  }

  if (isMember) {
      return (
          <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Agency</h2>
              <AgencyMemberView 
                  profile={profile} 
                  onLeave={handleLeaveAgency} 
                  onOpenChat={handleOpenChat}
              />
          </div>
      );
  }

  return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Agency</h2>
        
        <Card className="border-gray-200">
             <CardHeader>
                 <CardTitle>Join an Agency</CardTitle>
                 <CardDescription>Find an agency to join to unlock exclusive rewards and community.</CardDescription>
             </CardHeader>
             <CardContent>
                 <div className="space-y-6">
                     <div className="border-b border-gray-100 pb-6">
                         <JoinAgencyCard onJoinSuccess={(code) => onProfileUpdate({ referred_by: code })} />
                         <p className="text-xs text-center text-gray-400 mt-2">- OR -</p>
                     </div>
                     
                     <div>
                         <h4 className="font-semibold text-gray-700 mb-4">Browse Active Agencies</h4>
                         <AgencyBrowser 
                            onJoinRequest={handleJoinRequest} 
                            myRequests={myRequests}
                            onCancelRequest={handleCancelRequest}
                         />
                     </div>
                 </div>
             </CardContent>
        </Card>
      </div>
  );
}