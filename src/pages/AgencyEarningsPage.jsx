import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, DollarSign, Users, Gift, RefreshCw, Wallet, Lock, CalendarClock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import WithdrawalRequestModal from '@/components/modals/WithdrawalRequestModal';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GEM_USD_RATE } from '@/config/rates';
import { fetchUserWallet } from '@/lib/walletUtils';

export default function AgencyEarningsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Data States
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [clientEarnings, setClientEarnings] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [gemTotal, setGemTotal] = useState({ total_client_gems: 0, agent_wallet_gems: 0, total_available_gems: 0 });
  const [heldGems, setHeldGems] = useState(0);
  
  // Cycle State
  const [activeCycle, setActiveCycle] = useState(null);

  // Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Summary
      const { data: summaryData } = await supabase.rpc('get_agent_dashboard_summary');
      if (summaryData && summaryData.length > 0) {
          setSummary(summaryData[0]);
      }

      // 2. Fetch Client List
      const { data: clientsData } = await supabase.rpc('get_agent_client_earnings');
      setClientEarnings(clientsData || []);

      // 3. Fetch Gem Totals (Wallet + Clients)
      const { data: gemData } = await supabase.rpc('get_agent_gem_totals');
      if (gemData && gemData.length > 0) {
        setGemTotal(gemData[0]);
      }

      // 4. Fetch Wallet for Held Gems directly
      const { data: walletData } = await fetchUserWallet(user.id);
      if (walletData) {
        setHeldGems(walletData.gems_on_hold || 0);
      }

      // 5. Fetch Active Cycle
      const { data: cycleData, error: cycleError } = await supabase.rpc('get_current_agency_cycle', {
         p_user_id: user.id
      });
      if (!cycleError && cycleData?.has_cycle) {
        setActiveCycle(cycleData);
      } else {
        setActiveCycle(null);
      }

      // 6. Fetch Withdrawal History
      const { data: withdrawals } = await supabase
        .from('gem_withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setWithdrawalHistory(withdrawals || []);

    } catch (error) {
      console.error('Error fetching agency data:', error);
      toast({
        title: "Error",
        description: "Failed to load agency dashboard data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateUsdEstimate = (gems) => {
     return (gems * GEM_USD_RATE).toFixed(2);
  };

  // Determine what balance to show/pass to modal
  const displayAvailableGems = activeCycle 
    ? activeCycle.remaining_gems 
    : gemTotal?.total_available_gems || 0;

  const displayLockedLabel = activeCycle 
    ? "Reserved in Active Cycle" 
    : "Available Balance";

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agency Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your earnings, clients, and withdrawals
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button 
                onClick={() => setIsWithdrawModalOpen(true)} 
                className="gap-2 bg-rose-600 hover:bg-rose-700"
                disabled={displayAvailableGems <= 0}
            >
                <DollarSign className="w-4 h-4" /> Withdraw Gems
            </Button>
        </div>
      </div>

      {/* Cycle Active Banner */}
      {activeCycle && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
            <CalendarClock className="w-5 h-5 text-indigo-600 mt-0.5" />
            <div className="flex-1">
                <h3 className="font-semibold text-indigo-900">Withdrawal Cycle Active</h3>
                <p className="text-sm text-indigo-700 mt-1">
                    A withdrawal cycle is open for {format(new Date(activeCycle.cycle_month), 'MMMM yyyy')}. 
                    You have <strong>{activeCycle.remaining_gems.toLocaleString()} gems</strong> remaining to withdraw from your locked balance.
                </p>
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 shadow-none hover:bg-indigo-100">
                Cycle Open
            </Badge>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{summary?.total_referrals || 0}</div>
            <p className="text-xs text-indigo-600/80 mt-1">Active referrals under your code</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Lifetime Earnings</CardTitle>
            <Gift className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{(summary?.total_agent_gems || 0).toLocaleString()}</div>
            <p className="text-xs text-purple-600/80 mt-1">Total gems earned from commissions</p>
          </CardContent>
        </Card>
        
        {/* Dynamic Balance Card */}
        <Card className={cn("bg-gradient-to-br border shadow-sm", activeCycle ? "from-indigo-50 to-white border-indigo-200" : "from-emerald-50 to-white border-emerald-100")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", activeCycle ? "text-indigo-900" : "text-emerald-900")}>
                {activeCycle ? "Withdrawable This Cycle" : "Available Balance"}
            </CardTitle>
            {activeCycle ? <CalendarClock className="h-4 w-4 text-indigo-600" /> : <Wallet className="h-4 w-4 text-emerald-600" />}
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", activeCycle ? "text-indigo-700" : "text-emerald-700")}>
                {displayAvailableGems.toLocaleString()}
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
                <p className={cn("text-xs", activeCycle ? "text-indigo-600/80" : "text-emerald-600/80")}>
                    ≈ ${calculateUsdEstimate(displayAvailableGems)} USD
                </p>
                
                {/* Logic for showing Held/Available based on cycle state */}
                {activeCycle ? (
                     <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500">
                        <Wallet className="w-3 h-3" />
                        <span>Live Wallet: {(gemTotal?.total_available_gems || 0).toLocaleString()} (0 avail)</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                        <Lock className="w-3 h-3" />
                        <span>Held: {heldGems.toLocaleString()} gems</span>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="clients">My Clients</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal History</TabsTrigger>
        </TabsList>
        
        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Performance</CardTitle>
              <CardDescription>
                Earnings breakdown from each of your referred users.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {clientEarnings.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No clients found. Share your referral code to start earning!
                    </div>
                ) : (
                    <div className="space-y-4">
                        {clientEarnings.map((client) => (
                            <div key={client.client_id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden">
                                        {client.client_avatar_url ? (
                                            <img src={client.client_avatar_url} alt={client.client_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                                                {client.client_name?.substring(0,2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{client.client_name}</p>
                                        <p className="text-xs text-muted-foreground">ID: {client.client_profile_id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">{client.client_agent_gems?.toLocaleString()} gems</p>
                                    <p className="text-xs text-muted-foreground">
                                        Last active: {client.last_earning_at ? format(new Date(client.last_earning_at), 'MMM d') : 'Never'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>
                History of your gem withdrawals and their status.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {withdrawalHistory.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No withdrawal history found.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {withdrawalHistory.map((req) => (
                            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("capitalize", getStatusColor(req.status))}>
                                            {req.status?.replace('_', ' ')}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(req.created_at), 'PPP p')}
                                        </span>
                                        {req.cycle_id && (
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                                                Cycle: {req.cycle_month ? format(new Date(req.cycle_month), 'MMM yyyy') : 'Cycle'}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-bold text-lg">
                                            {req.gems_requested?.toLocaleString()} Gems
                                        </span>
                                        <span className="text-sm text-gray-500 font-medium">
                                            ≈ ${calculateUsdEstimate(req.gems_requested)} USD
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>Method: <span className="font-medium capitalize">{req.payout_method?.replace('_', ' ')}</span></span>
                                        {req.status === 'paid' && req.payout_usd && (
                                            <span className="text-green-600 font-medium">
                                                Paid: ${req.payout_usd} USD
                                            </span>
                                        )}
                                    </div>
                                    {req.admin_note && (
                                        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-1 border">
                                            <span className="font-semibold">Note:</span> {req.admin_note}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <WithdrawalRequestModal 
        isOpen={isWithdrawModalOpen}
        onClose={() => {
            setIsWithdrawModalOpen(false);
            fetchData();
        }}
        availableGems={displayAvailableGems}
        onSuccess={fetchData}
        isCycleWithdrawal={!!activeCycle}
      />
    </div>
  );
}