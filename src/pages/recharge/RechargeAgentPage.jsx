import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, AlertCircle, Loader2 } from 'lucide-react';
import PricingPackages from '@/components/recharge/PricingPackages';
import { calculatePackageDetails, formatUSD, formatCoins } from '@/lib/pricingUtils';

export default function RechargeAgentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [agentBalance, setAgentBalance] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Initial Fetch
  useEffect(() => {
    const initPage = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Check if agent
            const { data: agentData, error: agentError } = await supabase
                .from('recharge_agents')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .single();
            
            if (agentError || !agentData) {
                setError('You must be an active recharge agent to access this page.');
                setLoading(false);
                return;
            }

            // 2. Fetch Packages
            const { data: pkgData, error: pkgError } = await supabase
                .from('recharge_packages')
                .select('*')
                .eq('is_active', true)
                .order('price_usd', { ascending: true });

            if (pkgError) throw pkgError;
            setPackages(pkgData || []);

            // 3. Fetch Balance
            await fetchBalance();

        } catch (err) {
            console.error("Error loading recharge page:", err);
            setError("Failed to load recharge packages.");
        } finally {
            setLoading(false);
        }
    };

    initPage();
  }, [user]);

  const fetchBalance = async () => {
    const { data } = await supabase.rpc('get_recharge_agent_balance_for_current_user');
    setAgentBalance(data || 0);
  };

  const handlePurchase = async (pkg) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
        // In a real app, this would trigger a Payment Gateway (Stripe/PayPal) first.
        // For this implementation as per instructions, we simulate success and call RPC.
        
        console.log(`Processing purchase for ${pkg.name} ($${pkg.price_usd})`);
        
        const { data, error } = await supabase.rpc('purchase_recharge_package', {
            p_package_id: pkg.id
        });

        if (error) throw error;

        if (data && data.success) {
            const { bonusCoins, totalCoins } = calculatePackageDetails(pkg.base_coins, pkg.bonus_percentage);
            
            toast({
                title: "Purchase Successful! 🎉",
                description: `You purchased ${pkg.name} and received ${formatCoins(data.total_coins)} coins (+${formatCoins(data.bonus_coins)} bonus).`,
                className: "bg-green-50 border-green-200 text-green-800"
            });
            
            // Refresh balance
            await fetchBalance();
        } else {
            throw new Error(data?.error || "Transaction failed");
        }

    } catch (err) {
        console.error("Purchase error:", err);
        toast({
            title: "Purchase Failed",
            description: err.message || "Could not complete purchase. Please try again.",
            variant: "destructive"
        });
    } finally {
        setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium">Loading packages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-md w-full">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
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
            onClick={() => navigate('/recharge-agent')}
            className="-ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Buy Coins</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
           <Wallet className="w-4 h-4 text-indigo-600" />
           <span className="text-sm font-bold text-indigo-900">{formatCoins(agentBalance)}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-10 space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recharge Packages</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Purchase coins in bulk to recharge your clients. Larger packages include significant bonus coins to maximize your earnings.
            </p>
        </div>

        <PricingPackages 
            packages={packages} 
            onPurchase={handlePurchase}
            isProcessing={isProcessing}
        />

        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-xl p-6 text-center max-w-3xl mx-auto">
            <h3 className="text-lg font-bold text-blue-900 mb-2">How it works</h3>
            <p className="text-blue-700/80">
                1. Select a package above. <br/>
                2. Complete payment (Demonstration Mode). <br/>
                3. Coins + Bonus are instantly added to your Agent Recharge Balance. <br/>
                4. Use your balance to send coins to clients via the Recharge Panel.
            </p>
        </div>
      </div>
    </div>
  );
}