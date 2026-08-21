import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Privacy Policy - Famo</title>
        <meta name="description" content="Read Famo privacy policy. Learn how we protect your data and respect your privacy." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                <span className="text-xl font-bold gradient-text">Famo</span>
              </div>
              <div className="w-20"></div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gradient p-8 rounded-3xl shadow-lg"
          >
            <h1 className="text-4xl font-bold mb-6 gradient-text">Privacy Policy</h1>
            <p className="text-gray-600 mb-8">Last updated: January 2025</p>

            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-2xl font-bold mb-3">1. Information We Collect</h2>
                <p>We collect information you provide directly to us, including your name, email address, photos, and profile information. We also collect information about your usage of our services.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">2. How We Use Your Information</h2>
                <p>We use the information we collect to provide, maintain, and improve our services, to develop new features, and to protect Famo and our users.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">3. Information Sharing</h2>
                <p>We do not share your personal information with third parties except as described in this policy. We may share information with service providers who perform services on our behalf.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">4. Data Security</h2>
                <p>We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">5. Your Rights</h2>
                <p>You have the right to access, update, or delete your personal information at any time. You can also object to processing of your personal information or request data portability.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">6. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at privacy@singles.com</p>
              </section>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;