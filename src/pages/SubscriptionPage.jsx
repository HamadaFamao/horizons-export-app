import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Crown, Sparkles, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

const SubscriptionPage = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      icon: Sparkles,
      color: 'from-gray-400 to-gray-500',
      features: [
        'Browse profiles',
        'Send unlimited likes',
        'Send messages',
        'Basic matching algorithm',
        'Limited profile visibility'
      ],
      limitations: [
        'Cannot read received messages',
        'Cannot see who liked you',
        'No profile boost',
        'Basic search filters'
      ]
    },
    {
      name: 'Premium Silver',
      price: '$9.99',
      period: 'per month',
      icon: Crown,
      color: 'from-gray-300 to-gray-400',
      popular: true,
      features: [
        'Everything in Free',
        'Read all messages',
        'See who liked you',
        'Advanced search filters',
        'Priority customer support',
        'Ad-free experience'
      ]
    },
    {
      name: 'Premium Gold',
      price: '$19.99',
      period: 'per month',
      icon: Zap,
      color: 'from-yellow-400 to-orange-500',
      features: [
        'Everything in Silver',
        'Profile boost (5x visibility)',
        'Unlimited rewinds',
        'See who viewed your profile',
        'Advanced matching algorithm',
        'Exclusive badges',
        'Priority in search results',
        'VIP customer support'
      ]
    }
  ];

  const handleSubscribe = (plan) => {
    toast({
      title: "🚧 Payment integration coming soon!",
      description: `${plan.name} subscription will be available soon. You can request payment integration in your next prompt! 🚀`,
    });
  };

  return (
    <>
      <Helmet>
        <title>Subscription Plans - Singles Dating App</title>
        <meta name="description" content="Choose your Singles subscription plan. Upgrade to Premium for unlimited features and better matches." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold gradient-text">Subscription Plans</h1>
              <div className="w-20"></div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">
              Choose Your <span className="gradient-text">Perfect Plan</span>
            </h2>
            <p className="text-xl text-gray-600">Unlock premium features and find your match faster!</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-gradient rounded-3xl shadow-xl overflow-hidden ${
                  plan.popular ? 'ring-4 ring-rose-500 transform scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-center py-2 font-semibold">
                    Most Popular 🔥
                  </div>
                )}

                <div className="p-8">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center mb-4`}>
                    <plan.icon className="w-8 h-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold gradient-text">{plan.price}</span>
                    <span className="text-gray-600 ml-2">/ {plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations?.map((limitation, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-400">
                        <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{limitation}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(plan)}
                    className={`w-full ${
                      plan.popular
                        ? 'btn-gradient text-white'
                        : 'bg-white border-2 border-gray-300 hover:border-rose-500'
                    }`}
                  >
                    {plan.name === 'Free' ? 'Current Plan' : 'Upgrade Now'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <h3 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h3>
            <div className="space-y-4">
              <div className="card-gradient p-6 rounded-2xl shadow-lg">
                <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
                <p className="text-gray-600">Yes! You can cancel your subscription at any time. Your premium features will remain active until the end of your billing period.</p>
              </div>
              <div className="card-gradient p-6 rounded-2xl shadow-lg">
                <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
                <p className="text-gray-600">We accept all major credit cards, PayPal, and other secure payment methods.</p>
              </div>
              <div className="card-gradient p-6 rounded-2xl shadow-lg">
                <h4 className="font-semibold mb-2">Is my payment information secure?</h4>
                <p className="text-gray-600">Absolutely! We use industry-standard encryption to protect your payment information.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionPage;