import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import CoinPacksSection from '@/components/CoinPacksSection';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Check, Shield, Star, Crown, Zap, Sparkles, Loader2 } from 'lucide-react';
import { purchaseVipPlan } from '@/lib/subscription';
import { useToast } from '@/components/ui/use-toast';

export default function PlansPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [processingPlanId, setProcessingPlanId] = useState(null);

  // Read tab from URL query param on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    
    if (tabParam === 'coins' || tabParam === 'subscriptions') {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Update URL when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/plans?tab=${tab}`, { replace: true });
  };

  const handlePurchase = async (planId, planName) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (processingPlanId) return;

    try {
      setProcessingPlanId(planId);
      
      // Simulate API delay for UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = await purchaseVipPlan(user.id, planId, billingPeriod);

      if (result.success) {
        toast({
          title: "VIP Activated! 👑",
          description: `You are now a ${planName} member!`,
          duration: 5000,
          className: "bg-green-50 border-green-200 text-green-900",
        });
        
        // Refresh page or user state to show new status
        // For now, redirect to profile to see the badge
        setTimeout(() => {
           navigate('/profile');
           // Force reload to ensure context updates if not reactive enough
           window.location.reload(); 
        }, 1500);
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingPlanId(null);
    }
  };

  // New VIP plans structure
  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'The basics to get you started',
      monthlyPrice: 0,
      yearlyPrice: 0,
      type: 'free',
      features: [
        'Browse profiles',
        'Send 1 free message daily',
        'Basic search filters',
      ],
      highlighted: false,
      badge: null,
      isCurrent: !user?.plan || user?.plan === 'free',
    },
  ];

  // Spark Week special offer
  const sparkWeek = {
    id: 'spark-week',
    name: 'Spark Week',
    description: 'Limited-time weekly access',
    price: 3.99,
    duration: '7 days',
    type: 'weekly',
    features: [
      'Open chat with all matches for 7 days',
      'Light boost in visibility',
      '+20% XP from gifts and rewards',
      'Simple highlight frame on profile',
    ],
    highlighted: false,
    badge: '1-week offer',
  };

  // VIP plans
  const vipPlans = [
    {
      id: 'vip-silver',
      name: 'VIP Silver',
      description: 'Essential VIP benefits',
      monthlyPrice: 9.99,
      yearlyPrice: 89.99,
      type: 'vip',
      features: [
        'Unlimited messaging (chat always unlocked)',
        'Light boost in profile visibility',
        '+30% XP from all actions',
        'Extra daily rewards',
        'Silver frame and VIP badge on profile',
      ],
      highlighted: false,
      badge: null,
    },
    {
      id: 'vip-gold',
      name: 'VIP Gold',
      description: 'Enhanced VIP experience',
      monthlyPrice: 19.99,
      yearlyPrice: 149.99,
      type: 'vip',
      features: [
        'All VIP Silver features',
        'Higher boost in Discover & Search',
        'Read receipts on messages',
        'See who liked you',
        'Bigger daily rewards',
        'Gold frame and crown badge',
      ],
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      id: 'vip-platinum',
      name: 'VIP Platinum',
      description: 'Premium VIP tier',
      monthlyPrice: 29.99,
      yearlyPrice: 219.99,
      type: 'vip',
      features: [
        'All VIP Gold features',
        'Strong profile boost in Discover & Search',
        '+50% XP from all actions',
        '10% discount on gift costs',
        'Advanced search filters',
        'Premium Platinum frame on profile',
      ],
      highlighted: false,
      badge: null,
    },
    {
      id: 'vip-diamond-elite',
      name: 'VIP Diamond Elite',
      description: 'The ultimate VIP experience',
      monthlyPrice: 49.99,
      yearlyPrice: 359.99,
      type: 'vip',
      features: [
        'All VIP Platinum features',
        'Maximum boost in visibility and matches',
        '+100% XP from all actions',
        '20% discount on gift costs',
        'Incognito mode (coming soon)',
        'Diamond frame with glow and exclusive badge',
      ],
      highlighted: false,
      badge: null,
    },
  ];

  // Calculate yearly savings percentage
  const calculateYearlySavings = (monthlyPrice, yearlyPrice) => {
    if (monthlyPrice === 0 || yearlyPrice === 0) return 0;
    const monthlyTotal = monthlyPrice * 12;
    const savings = ((monthlyTotal - yearlyPrice) / monthlyTotal * 100).toFixed(0);
    return parseInt(savings);
  };

  // Render plan card
  const renderPlanCard = (plan, isVip = false) => {
    const currentPrice = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    const yearlySavings = billingPeriod === 'yearly' ? calculateYearlySavings(plan.monthlyPrice, plan.yearlyPrice) : 0;
    
    // Check if user is on this plan (simplified check)
    // In real app, we would check subscription table or precise VIP tier
    const isProcessing = processingPlanId === plan.id;

    return (
      <div
        key={plan.id}
        className={`relative rounded-2xl transition-all flex flex-col h-full ${
          plan.highlighted
            ? 'ring-2 ring-blue-500 shadow-xl scale-100 md:scale-105 z-10'
            : 'border-2 border-gray-200 hover:border-gray-300'
        } ${plan.highlighted ? 'bg-gradient-to-br from-blue-50 to-indigo-50' : 'bg-white'} p-6 sm:p-8`}
      >
        {/* Badge */}
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-max">
            <span className={`px-4 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider shadow-sm ${
              plan.badge === 'Most Popular'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                : 'bg-gradient-to-r from-yellow-400 to-yellow-500'
            }`}>
              {plan.badge}
            </span>
          </div>
        )}

        {/* Plan name */}
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            {plan.name}
            {plan.id.includes('diamond') && <Sparkles className="w-5 h-5 text-cyan-500" />}
        </h3>
        <p className="text-gray-600 text-sm mb-6 min-h-[40px]">{plan.description}</p>

        {/* Price */}
        <div className="mb-6">
          <div className="text-3xl sm:text-4xl font-bold text-gray-900">
            ${currentPrice.toFixed(2)}
          </div>
          <p className="text-gray-600 text-sm mt-1 font-medium">
            {isVip ? (
              billingPeriod === 'monthly' ? 'per month' : 'per year'
            ) : (
              plan.duration || 'forever'
            )}
          </p>
          {yearlySavings > 0 && (
            <div className="mt-2 inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              Save {yearlySavings}%
            </div>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => handlePurchase(plan.id, plan.name)}
          disabled={plan.id === 'free' || isProcessing}
          className={`w-full py-3 rounded-xl font-bold transition-all mb-6 shadow-sm flex items-center justify-center gap-2 ${
            plan.id === 'free'
              ? 'bg-gray-100 text-gray-400 cursor-default' 
              : plan.highlighted
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {plan.id === 'free' ? 'Basic Plan' : isProcessing ? 'Processing...' : 'Upgrade'}
        </button>

        {/* Features list */}
        <ul className="space-y-3 flex-1">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={3} />
              <span className="text-gray-700 text-sm leading-tight">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>{activeTab === 'coins' ? 'Top Up Coins' : 'Choose Your Plan'} - Singles App</title>
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <AppHeader />

        {/* Header Content */}
        <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Plans & Coins</h1>
            <p className="text-gray-600">Choose your subscription or top up coins</p>
          </div>
        
          {/* Tab navigation */}
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-2 pb-4">
              <button
                onClick={() => handleTabChange('subscriptions')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'subscriptions'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Subscriptions
              </button>
              <button
                onClick={() => handleTabChange('coins')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'coins'
                    ? 'bg-yellow-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Star className="w-4 h-4" />
                Coins
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-12 animate-in fade-in duration-500">
              {/* Billing period toggle */}
              <div className="flex justify-center items-center gap-4 bg-white p-2 rounded-full w-fit mx-auto shadow-sm border border-gray-200">
                <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                        billingPeriod === 'monthly' 
                        ? 'bg-gray-900 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingPeriod('yearly')}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                        billingPeriod === 'yearly' 
                        ? 'bg-gray-900 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Yearly
                    <span className="text-[10px] bg-green-500 text-white font-bold px-2 py-0.5 rounded-full">
                        SAVE UP TO 27%
                    </span>
                </button>
              </div>

              {/* Free plan */}
              <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto">
                {plans.map((plan) => renderPlanCard(plan, false))}
              </div>

              {/* Limited Time Offers & VIP Grid */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center flex items-center justify-center gap-2">
                    <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    Limited-Time Offers
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                  {/* Spark Week card - Custom Implementation */}
                  <div className="relative rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-6 sm:p-8 shadow-lg flex flex-col h-full">
                    {/* Weekly offer badge */}
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-max">
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                        Try VIP for 7 days
                      </span>
                    </div>

                    {/* Plan name */}
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Spark Week</h3>
                    <p className="text-gray-600 text-sm mb-6 min-h-[40px]">Limited-time weekly access to boost your dating life.</p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="text-4xl font-bold text-yellow-600">
                        ${sparkWeek.price.toFixed(2)}
                      </div>
                      <p className="text-gray-600 text-sm mt-1 font-medium">
                        for {sparkWeek.duration}
                      </p>
                    </div>

                    {/* CTA Button */}
                    <button 
                        onClick={() => handlePurchase(sparkWeek.id, sparkWeek.name)}
                        disabled={processingPlanId === sparkWeek.id}
                        className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all mb-6 shadow-md shadow-orange-200 flex items-center justify-center gap-2"
                    >
                      {processingPlanId === sparkWeek.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      {processingPlanId === sparkWeek.id ? 'Processing...' : 'Try Now'}
                    </button>

                    {/* Features list */}
                    <ul className="space-y-3 flex-1">
                      {sparkWeek.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                          <span className="text-gray-800 text-sm leading-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* First 3 VIP plans */}
                  {vipPlans.slice(0, 3).map((plan) => (
                    <div key={plan.id} className="h-full">
                      {renderPlanCard(plan, true)}
                    </div>
                  ))}
                </div>
              </div>

              {/* VIP Diamond Elite (full width or separate row) */}
              <div className="mt-8 border-t border-gray-200 pt-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                   <div className="lg:col-span-3 flex items-center justify-center lg:justify-end pr-8">
                        <div className="text-center lg:text-right max-w-lg">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center lg:justify-end gap-2">
                                <Crown className="w-6 h-6 text-purple-600 fill-purple-100" />
                                Ultimate Exclusivity
                            </h3>
                            <p className="text-gray-600">
                                For those who demand the absolute best. The Diamond Elite plan offers maximum visibility, priority matching, and exclusive status symbols that set you apart from everyone else.
                            </p>
                        </div>
                   </div>
                   <div className="lg:col-span-1">
                        {renderPlanCard(vipPlans[3], true)}
                   </div>
                </div>
              </div>

              {/* Info section */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mt-12 flex gap-4 items-start">
                <div className="bg-blue-100 p-2 rounded-full shrink-0">
                    <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-bold text-blue-900 mb-1">VIP Benefits Guarantee</h3>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        All VIP plans include unlimited messaging, profile boosts, and exclusive rewards. Higher tiers unlock additional perks like read receipts, advanced filters, and special badges. You can cancel anytime.
                    </p>
                </div>
              </div>
            </div>
          )}

          {/* Coins Tab */}
          {activeTab === 'coins' && (
            <CoinPacksSection />
          )}
        </div>
      </div>
    </>
  );
}