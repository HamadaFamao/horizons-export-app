import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { plansConfig } from '@/config/plans';

const AdminPlansPage = () => {
  const navigate = useNavigate();
  const [prices, setPrices] = useState(plansConfig.pricing);

  const handleSave = () => {
    toast({
      title: "Prices Updated!",
      description: "The new plan prices have been saved (demo).",
    });
  };

  const handlePriceChange = (cycle, plan, value) => {
    setPrices(prev => ({
      ...prev,
      [cycle]: {
        ...prev[cycle],
        [plan]: value
      }
    }));
  };

  return (
    <>
      <Helmet>
        <title>Admin: Manage Plans - Singles</title>
        <meta name="description" content="Manage subscription plan pricing for Singles." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Admin
              </Button>
              <h1 className="text-2xl font-bold gradient-text">Manage Plans</h1>
              <Button onClick={handleSave} className="btn-gradient text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gradient p-8 rounded-2xl shadow-lg"
          >
            <h2 className="text-2xl font-bold mb-6">Plan Pricing</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Monthly Prices</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="monthly-silver">Premium Silver ($/month)</Label>
                    <Input
                      id="monthly-silver"
                      type="number"
                      value={prices.monthly.silver}
                      onChange={(e) => handlePriceChange('monthly', 'silver', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthly-gold">Premium Gold ($/month)</Label>
                    <Input
                      id="monthly-gold"
                      type="number"
                      value={prices.monthly.gold}
                      onChange={(e) => handlePriceChange('monthly', 'gold', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Yearly Prices</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="yearly-silver">Premium Silver ($/month, billed yearly)</Label>
                    <Input
                      id="yearly-silver"
                      type="number"
                      value={prices.yearly.silver}
                      onChange={(e) => handlePriceChange('yearly', 'silver', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="yearly-gold">Premium Gold ($/month, billed yearly)</Label>
                    <Input
                      id="yearly-gold"
                      type="number"
                      value={prices.yearly.gold}
                      onChange={(e) => handlePriceChange('yearly', 'gold', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-gradient p-8 rounded-2xl shadow-lg mt-8"
          >
            <h2 className="text-2xl font-bold mb-6">Feature Flags (Placeholder)</h2>
            <p className="text-gray-600">In a real application, you would manage feature availability for each plan here. This requires a database connection.</p>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default AdminPlansPage;