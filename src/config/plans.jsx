import { Check, X } from 'lucide-react';

    export const plansConfig = {
      pricing: {
        monthly: {
          silver: 14.99,
          gold: 24.99,
        },
        yearly: {
          silver: 11.99,
          gold: 19.99,
        },
      },
      features: [
        { name: 'Send messages', free: true, silver: true, gold: true },
        { name: 'Read inbox', free: false, silver: true, gold: true },
        { name: 'Read receipts', free: false, silver: true, gold: true },
        { name: 'See who liked you', free: false, silver: true, gold: true },
        { name: 'Advanced filters', free: false, silver: false, gold: true },
        { name: 'Weekly Boost', free: false, silver: false, gold: true },
        { name: 'Incognito mode', free: false, silver: false, gold: true },
        { name: 'Unlimited rewinds', free: false, silver: false, gold: true },
        { name: 'Photo blur control', free: false, silver: false, gold: true },
        { name: 'Priority support', free: false, silver: true, gold: true },
      ],
      faqs: [
        {
          question: 'How does billing work?',
          answer: 'You will be billed at the beginning of each subscription period (monthly or yearly). Your subscription will automatically renew unless you cancel it.',
        },
        {
          question: 'Can I cancel my subscription anytime?',
          answer: 'Yes, you can cancel your subscription at any time from your account settings. You will retain access to premium features until the end of your current billing cycle.',
        },
        {
          question: 'What happens after I upgrade?',
          answer: 'Once you upgrade, all premium features for your chosen plan will be unlocked immediately. You can start reading messages, see who liked you, and use all other benefits right away.',
        },
      ],
    };

    export const getFeatureIcon = (hasFeature) => {
      return hasFeature ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-400" />;
    };