import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, History, Coins, Gem, ArrowRightLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function WalletActivityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .rpc('get_wallet_activity', { p_user_id: user.id });

        if (error) throw error;
        setActivities(data || []);
      } catch (err) {
        console.error('Error fetching wallet activity:', err);
        setError("Failed to load wallet activity.");
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [user?.id]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'conversion':
        return <ArrowRightLeft className="w-5 h-5 text-purple-600" />;
      case 'withdrawal':
        return <Download className="w-5 h-5 text-orange-600" />;
      case 'topup':
        return <Coins className="w-5 h-5 text-amber-600" />;
      default:
        return <History className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActivityTitle = (type) => {
    switch (type) {
      case 'conversion': return 'Gems → Coins Conversion';
      case 'withdrawal': return 'Gem Withdrawal';
      case 'topup': return 'Coins Top-Up';
      default: return 'Wallet Activity';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/profile')}
          className="-ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Wallet Activity</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
            <p className="text-gray-500">Loading activity...</p>
          </div>
        ) : error ? (
           <div className="text-center py-12">
            <p className="text-red-500 font-medium mb-2">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No activity yet</h3>
            <p className="text-gray-500 mt-1">Your wallet transactions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-4">
                <div className={`p-2.5 rounded-full shrink-0 ${
                  item.activity_type === 'conversion' ? 'bg-purple-100' : 
                  item.activity_type === 'withdrawal' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  {getActivityIcon(item.activity_type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-900 truncate pr-2">
                      {getActivityTitle(item.activity_type)}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap mt-1">
                      {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {item.coins_change !== 0 && (
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.coins_change > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Coins className="w-3 h-3 mr-1" />
                        {item.coins_change > 0 ? '+' : '−'}{Math.abs(item.coins_change)} coins
                      </span>
                    )}
                    
                    {item.gems_change !== 0 && (
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.gems_change > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-50 text-red-600'
                      }`}>
                        <Gem className="w-3 h-3 mr-1" />
                        {item.gems_change > 0 ? '+' : '−'}{Math.abs(item.gems_change)} gems
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}