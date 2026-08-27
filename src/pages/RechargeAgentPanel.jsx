import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Send, Coins, History, User, AlertCircle, Loader2, CheckCircle2, Wallet, RefreshCcw, ArrowRight, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { DEFAULT_AVATAR } from '@/lib/constants';

export default function RechargeAgentPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [agentInfo, setAgentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Agent Balance State (Strictly separate from personal wallet)
  const [agentBalance, setAgentBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Form State
  const [clientId, setClientId] = useState('');
  const [coinsAmount, setCoinsAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Profile Preview State
  const [profilePreview, setProfilePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  
  // History State
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [pendingSplitsCount, setPendingSplitsCount] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check if user is an agent and load initial data
  useEffect(() => {
    const checkAgentStatus = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);

        // Check if user is a recharge agent
        const { data: agentData, error: agentError } = await supabase
          .from('recharge_agents')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (agentError || !agentData) {
          setError('You do not have permission to access this panel.');
          setLoading(false);
          return;
        }

        setAgentInfo(agentData);
        
        // Initial data fetch
        await Promise.all([
          fetchAgentBalance(),
          fetchTransfers(),
          fetchPendingSplitsCount()
        ]);
        
      } catch (err) {
        console.error('Error checking agent status:', err);
        setError('Failed to verify agent status.');
      } finally {
        setLoading(false);
      }
    };

    checkAgentStatus();
  }, [user?.id]);

  // 1. Fetch Agent Balance via RPC ONLY (No personal wallet fallback)
  const fetchAgentBalance = async () => {
    try {
      setBalanceLoading(true);
      // RPC call to get the specific recharge balance
      const { data, error } = await supabase.rpc('get_recharge_agent_balance_for_current_user');
      
      if (error) throw error;
      
      setAgentBalance(data || 0);
    } catch (err) {
      console.error('Error fetching agent balance:', err);
      // Set to 0 on error to prevent spending logic errors
      setAgentBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Debounce logic for profile preview
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clientId && clientId.length > 0) {
        fetchProfilePreview(clientId);
      } else {
        setProfilePreview(null);
        setPreviewError(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [clientId]);

  const fetchProfilePreview = async (id) => {
    const numericId = parseInt(id, 10);
    
    // Basic validation
    if (!id || isNaN(numericId)) {
       setProfilePreview(null);
       return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setProfilePreview(null);

    try {
      const { data, error } = await supabase.rpc('get_profile_preview_by_profile_id', {
        p_profile_id: numericId
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setProfilePreview(data[0]);
      } else {
        setPreviewError("User not found. Please check the profile ID.");
      }
    } catch (err) {
      console.error("Error fetching preview:", err);
      setPreviewError("Error searching for user.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoadingHistory(true);
      
      // Fetch actual transfers from recharge_agent_transfers table
      const { data, error } = await supabase
        .from('recharge_agent_transfers')
        .select('*')
        .eq('agent_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      setRecentTransfers(data || []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchPendingSplitsCount = async () => {
    try {
      const { data } = await supabase.rpc('get_recharge_agent_assigned_splits');
      const approvedCount = (data || []).filter(s => s.status === 'approved').length;
      setPendingSplitsCount(approvedCount);
    } catch (err) {
      console.error('Error fetching splits count:', err);
    }
  };

  const handleSendCoins = async (e) => {
    e.preventDefault();
    
    // Validation: Client ID
    if (!clientId) {
      toast({ title: "Error", description: "Please enter a valid Client Profile ID", variant: "destructive" });
      return;
    }
    
    // Validation: Amount
    const coins = parseInt(coinsAmount);
    if (isNaN(coins) || coins <= 0) {
      toast({ title: "Error", description: "Please enter a valid positive amount of coins", variant: "destructive" });
      return;
    }

    // Validation: Agent Balance Check (Frontend)
    // We check against the locally stored agentBalance fetched from RPC
    if (agentBalance < coins) {
      toast({ 
        title: "Insufficient Agent Balance", 
        description: `You have ${agentBalance} coins available for recharge. Cannot send ${coins}.`, 
        variant: "destructive" 
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 3. Call RPC: recharge_agent_send_coins
      const { data, error } = await supabase.rpc('recharge_agent_send_coins', {
        p_client_profile_id: parseInt(clientId),
        p_amount: coins,
        p_note: note || ''
      });

      if (error) throw error;
      
      // Handle RPC logic errors (returned as JSON)
      if (data && data.success === false) {
        const errorKey = data.error;
        let errorMessage = "Transaction failed.";
        
        switch (errorKey) {
            case 'insufficient_recharge_balance':
                errorMessage = "Insufficient balance in your Agent Wallet.";
                break;
            case 'not_a_recharge_agent':
                errorMessage = "You are not authorized as a recharge agent.";
                break;
            case 'client_not_found':
                errorMessage = "The client Profile ID could not be found.";
                break;
            case 'amount_must_be_positive':
                errorMessage = "Amount must be greater than zero.";
                break;
            case 'not_authenticated':
                errorMessage = "Your session has expired. Please login again.";
                break;
            default:
                errorMessage = `Error: ${errorKey}`;
        }
        
        throw new Error(errorMessage);
      }

      // Success Flow
      toast({
        title: "Coins Sent Successfully! 🚀",
        description: `Transferred ${coins} coins to ID: ${clientId}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      // Clear Form
      setCoinsAmount('');
      setNote('');
      setClientId('');
      setProfilePreview(null);
      
      // Refresh Data
      await Promise.all([
        fetchAgentBalance(),
        fetchTransfers()
      ]);

    } catch (err) {
      console.error('Transaction error:', err);
      toast({
        title: "Transaction Failed",
        description: err.message || "Could not send coins. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-2" />
        <p className="text-gray-500">Loading agent panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/profile')} className="w-full">
            Return to Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/profile')}
            className="-ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Recharge Panel</h1>
        </div>
        
        {/* NEW BUTTONS ADDED HERE */}
        <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate('/recharge-agent/buy')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buy Coins</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/recharge-agent/activity')}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1.5"
            >
              <History className="w-4 h-4" />
              <span>Activity</span>
            </Button>
            
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => navigate('/recharge-agent/activity')}
              className="text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5"
            >
              <span>Activity</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/recharge-agent/withdrawals')}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1.5 relative"
            >
              <span className="hidden sm:inline">Assigned</span>
              <span>Withdrawals</span>
              <ArrowRight className="w-4 h-4" />
              {pendingSplitsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingSplitsCount}
                </span>
              )}
            </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Agent Info Card */}
        <Card className="bg-gradient-to-br from-indigo-900 to-purple-800 text-white border-none shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Coins size={120} />
          </div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-4 mb-6">
               <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-2xl overflow-hidden">
                  <img 
                    src={user.avatar_url || DEFAULT_AVATAR} 
                    alt={user.name} 
                    className="w-full h-full rounded-full object-cover" 
                  />
               </div>
               <div>
                 <h2 className="text-xl font-bold">{agentInfo.name}</h2>
                 <p className="text-indigo-200 text-sm flex items-center gap-2">
                   Agent ID: {user.profile_id}
                 </p>
                 <div className="flex items-center gap-2 mt-1 text-xs text-indigo-200">
                    <span className="bg-white/20 px-2 py-0.5 rounded">{agentInfo.country_code}</span>
                    <span>{agentInfo.contact_info}</span>
                 </div>
               </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 flex justify-between items-center">
               <div>
                 <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">
                   <Wallet className="w-3 h-3" />
                   Available Recharge Balance
                 </div>
                 <div className="flex items-baseline gap-1">
                   {balanceLoading ? (
                     <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                   ) : (
                     <p className="text-3xl font-bold">
                       {agentBalance?.toLocaleString() || 0} 
                     </p>
                   )}
                   <span className="text-lg font-normal opacity-80">Coins</span>
                 </div>
               </div>
               
               <Button 
                 variant="secondary" 
                 size="sm" 
                 onClick={() => navigate('/recharge-agent/buy')}
                 className="bg-white text-indigo-900 hover:bg-indigo-50 font-semibold"
               >
                 Top Up
               </Button>
            </div>
          </CardContent>
        </Card>

        {/* Send Coins Form */}
        <Card className="border-indigo-100 shadow-md">
          <CardHeader className="pb-4 border-b border-gray-50 bg-gray-50/50 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              Send Coins to Client
            </CardTitle>
            <CardDescription>Transfer coins from your agent balance</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
             <form onSubmit={handleSendCoins} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-gray-700 font-medium">Client Profile ID</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="clientId"
                        type="number"
                        placeholder="Enter client ID…"
                        className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    {/* Preview / Loading / Error UI */}
                    <div className="min-h-[20px]">
                      {previewLoading && (
                        <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Searching...
                        </p>
                      )}

                      {previewError && (
                        <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {previewError}
                        </p>
                      )}

                      {profilePreview && !previewLoading && (
                        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg mt-2 animate-in fade-in slide-in-from-top-1">
                          <img 
                            src={profilePreview.avatar_url || DEFAULT_AVATAR} 
                            alt={profilePreview.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                          />
                          <div className="min-w-0 flex-1">
                             <p className="text-sm font-bold text-gray-900 truncate">{profilePreview.name}</p>
                             <p className="text-xs text-indigo-600 flex items-center gap-1">
                                ID: {profilePreview.profile_id}
                                {profilePreview.country && <span className="text-gray-400">• {profilePreview.country}</span>}
                             </p>
                          </div>
                          <div className="ml-auto">
                             <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-gray-700 font-medium">Amount (Coins)</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-3 h-4 w-4 text-amber-500" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Amount to send…"
                        className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors font-semibold text-gray-900"
                        value={coinsAmount}
                        onChange={(e) => setCoinsAmount(e.target.value)}
                        min="1"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    {agentBalance > 0 && (
                      <p className="text-xs text-gray-500 text-right">
                        Max: {agentBalance.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note" className="text-gray-700 font-medium">Note (Optional)</Label>
                  <Textarea 
                    id="note" 
                    placeholder="Transaction reference, details..."
                    className="bg-gray-50 border-gray-200 focus:bg-white min-h-[80px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-12 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || !profilePreview || !coinsAmount || parseInt(coinsAmount) <= 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      Confirm & Send Coins
                      <Send className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
             </form>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Recent Transfers
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchTransfers} className="text-xs h-8">
                <RefreshCcw className={`w-3 h-3 mr-1 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
          </div>
          
          {loadingHistory && recentTransfers.length === 0 ? (
             <div className="text-center py-8">
               <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
             </div>
          ) : recentTransfers.length === 0 ? (
             <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <History className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No recent transfers found</p>
             </div>
          ) : (
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {recentTransfers.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                     <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-green-100 text-green-600 rounded-full shrink-0">
                           <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-gray-900">
                             Sent to ID: <span className="font-mono text-indigo-600">{tx.client_profile_id}</span>
                           </p>
                           <p className="text-xs text-gray-500">
                             {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                           </p>
                           {tx.note && (
                             <p className="text-xs text-gray-600 mt-1 italic">"{tx.note}"</p>
                           )}
                        </div>
                     </div>
                     <div className="flex items-center justify-end gap-1.5 pl-10 sm:pl-0">
                        <span className="text-lg font-bold text-gray-900">-{tx.amount}</span>
                        <Coins className="w-4 h-4 text-amber-500 fill-amber-500" />
                     </div>
                  </div>
                ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}