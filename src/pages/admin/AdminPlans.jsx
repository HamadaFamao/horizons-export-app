import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Save, RotateCcw } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { toast } from '@/components/ui/use-toast';
    import { Switch } from "@/components/ui/switch";

    const AdminPlans = () => {
      const [config, setConfig] = useState({ pricing: {}, features: [] });
      const [initialConfig, setInitialConfig] = useState({ pricing: {}, features: [] });

      useEffect(() => {
        const storedConfig = JSON.parse(localStorage.getItem('singlesPlansConfig'));
        if (storedConfig) {
          setConfig(storedConfig);
          setInitialConfig(storedConfig);
        } else {
            // Load from file if nothing in localStorage
            import('@/config/plans').then(module => {
                setConfig(module.plansConfig);
                setInitialConfig(module.plansConfig);
            });
        }
      }, []);

      const handlePriceChange = (cycle, plan, value) => {
        setConfig(prev => ({
          ...prev,
          pricing: { ...prev.pricing, [cycle]: { ...prev.pricing[cycle], [plan]: parseFloat(value) || 0 } }
        }));
      };

      const handleFeatureChange = (index, plan) => {
        const newFeatures = [...config.features];
        newFeatures[index][plan] = !newFeatures[index][plan];
        setConfig(prev => ({ ...prev, features: newFeatures }));
      };
      
      const handleSaveChanges = () => {
        localStorage.setItem('singlesPlansConfig', JSON.stringify(config));
        setInitialConfig(config);
        toast({ title: "Plans Saved!", description: "Your changes to plans and features have been saved." });
      };

      const handleDiscardChanges = () => {
        setConfig(initialConfig);
        toast({ title: "Changes Discarded", description: "All unsaved changes have been reverted." });
      };

      if (!config.pricing.monthly) return <div>Loading plans...</div>;

      return (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Plans & Features</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDiscardChanges}><RotateCcw className="mr-2 h-4 w-4" />Discard</Button>
              <Button onClick={handleSaveChanges} className="btn-gradient text-white"><Save className="mr-2 h-4 w-4" />Save Changes</Button>
            </div>
          </div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-gradient p-6 rounded-xl shadow-lg mb-8">
            <h2 className="text-xl font-bold mb-4">Pricing</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-2">Monthly</h3>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="m-silver">Silver</Label>
                    <Input id="m-silver" type="number" value={config.pricing.monthly.silver} onChange={e => handlePriceChange('monthly', 'silver', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="m-gold">Gold</Label>
                    <Input id="m-gold" type="number" value={config.pricing.monthly.gold} onChange={e => handlePriceChange('monthly', 'gold', e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Yearly (price per month)</h3>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="y-silver">Silver</Label>
                    <Input id="y-silver" type="number" value={config.pricing.yearly.silver} onChange={e => handlePriceChange('yearly', 'silver', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="y-gold">Gold</Label>
                    <Input id="y-gold" type="number" value={config.pricing.yearly.gold} onChange={e => handlePriceChange('yearly', 'gold', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-gradient p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Features</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Feature</th>
                    <th className="p-2 text-center">Free</th>
                    <th className="p-2 text-center">Silver</th>
                    <th className="p-2 text-center">Gold</th>
                  </tr>
                </thead>
                <tbody>
                  {config.features.map((feature, index) => (
                    <tr key={feature.name} className="border-t border-rose-200/50">
                      <td className="p-2 font-medium">{feature.name}</td>
                      <td className="p-2 text-center"><Switch checked={feature.free} onCheckedChange={() => handleFeatureChange(index, 'free')} /></td>
                      <td className="p-2 text-center"><Switch checked={feature.silver} onCheckedChange={() => handleFeatureChange(index, 'silver')} /></td>
                      <td className="p-2 text-center"><Switch checked={feature.gold} onCheckedChange={() => handleFeatureChange(index, 'gold')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      );
    };
    export default AdminPlans;