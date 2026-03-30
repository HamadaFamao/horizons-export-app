import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, DollarSign, Wallet } from 'lucide-react';
import WithdrawalRequestModal from '@/components/modals/WithdrawalRequestModal';

export default function AgencyWithdrawal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);

  const fetchWalletAndRequests = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      // Fetch wallet
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (walletError && walletError.code !== 'PGRST116') throw walletError;
      setWallet(walletData);

      // Fetch requests
      const { data: reqData, error: reqError } = await supabase
        .from('gem_withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (reqError) throw reqError;
      setRequests(reqData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      toast({
        title: "Error",
        description: "Failed to load withdrawal data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletAndRequests();
  }, [user?.id]);

  const handleWithdrawClick = () => {
    if (!wallet || (wallet.gems || 0) <= 0) {
      toast({
        title: "Insufficient Balance",
        description: "You have no gems available to withdraw.",
        variant: "destructive"
      });
      return;
    }
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    fetchWalletAndRequests();
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const availableGems = wallet?.gems || 0;

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Withdrawals</h1>
           <p className="text-gray-500 mt-1">Manage your gem withdrawals and payout requests.</p>
        </div>
        <Button onClick={handleWithdrawClick} className="bg-purple-600 hover:bg-purple-700">
           <DollarSign className="w-4 h-4 mr-2" />
           Request Withdrawal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{availableGems.toLocaleString()}</span>
              <span className="text-sm font-medium text-purple-600">Gems</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {requests.filter(r => r.status === 'pending').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
        
        <Card>
           <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Withdrawn</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold text-gray-900">
               {requests.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.gems_requested, 0).toLocaleString()}
             </div>
             <p className="text-xs text-gray-500 mt-1">Lifetime gems paid out</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No withdrawal requests found.</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">#{req.id}</td>
                      <td className="px-6 py-4">{new Date(req.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold">{req.gems_requested.toLocaleString()} Gems</td>
                      <td className="px-6 py-4 capitalize">{req.payout_method?.replace('_', ' ') || 'Mixed/Manual'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${req.status === 'paid' ? 'bg-green-100 text-green-800' : 
                            req.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 truncate max-w-[200px]" title={req.admin_note}>
                        {req.admin_note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <WithdrawalRequestModal
        isOpen={isModalOpen}
        onClose={setIsModalOpen}
        availableGems={availableGems}
        onSuccess={handleSuccess}
      />
    </div>
  );
}