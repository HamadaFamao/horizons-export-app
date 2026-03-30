import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Terms of Service - Singles Dating App</title>
        <meta name="description" content="Read Singles terms of service. Understand the rules and guidelines for using our dating platform." />
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
                <span className="text-xl font-bold gradient-text">Singles</span>
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
            <h1 className="text-4xl font-bold mb-6 gradient-text">Terms of Service</h1>
            <p className="text-gray-600 mb-8">Last updated: January 2025</p>

            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
                <p>By accessing and using Singles, you accept and agree to be bound by the terms and provision of this agreement.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">2. Use License</h2>
                <p>Permission is granted to temporarily use Singles for personal, non-commercial purposes. This is the grant of a license, not a transfer of title.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">3. User Conduct</h2>
                <p>You agree not to use Singles to upload, post, or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">4. Account Termination</h2>
                <p>We reserve the right to terminate or suspend your account at any time for violations of these Terms of Service or for any other reason at our sole discretion.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">5. Disclaimer</h2>
                <p>Singles is provided "as is" without any representations or warranties. We do not warrant that the service will be uninterrupted or error-free.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">6. Limitation of Liability</h2>
                <p>In no event shall Singles be liable for any damages arising out of the use or inability to use our services.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-3">7. Contact Information</h2>
                <p>For questions about these Terms of Service, please contact us at legal@singles.com</p>
              </section>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;