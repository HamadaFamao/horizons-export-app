import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Save } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
    import { Switch } from '@/components/ui/switch';
    import { toast } from '@/components/ui/use-toast';

    const defaultSettings = {
        incognitoModeEnabled: true,
        weeklyBoostEnabled: true,
        blurPhotosDefault: false,
    };

    const AdminSettings = () => {
        const [settings, setSettings] = useState(defaultSettings);

        useEffect(() => {
            const storedSettings = JSON.parse(localStorage.getItem('singlesGlobalSettings'));
            if (storedSettings) {
                setSettings(storedSettings);
            }
        }, []);

        const handleSave = () => {
            localStorage.setItem('singlesGlobalSettings', JSON.stringify(settings));
            toast({ title: 'Global Settings Saved!', description: 'The changes will apply across the app.' });
        };

        const handleToggle = (key) => {
            setSettings(prev => ({...prev, [key]: !prev[key]}));
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Global App Settings</h1>
                    <Button onClick={handleSave} className="btn-gradient text-white">
                        <Save className="mr-2 h-4 w-4" /> Save Settings
                    </Button>
                </div>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-gradient p-6 rounded-xl shadow-lg space-y-6"
                >
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                        <div>
                            <Label htmlFor="incognito" className="font-bold text-lg">Enable Incognito Mode</Label>
                            <p className="text-sm text-gray-600">Allows Gold users to browse profiles without being seen.</p>
                        </div>
                        <Switch id="incognito" checked={settings.incognitoModeEnabled} onCheckedChange={() => handleToggle('incognitoModeEnabled')} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                        <div>
                            <Label htmlFor="boost" className="font-bold text-lg">Enable Weekly Boost</Label>
                            <p className="text-sm text-gray-600">Allows Gold users to boost their profile once a week.</p>
                        </div>
                        <Switch id="boost" checked={settings.weeklyBoostEnabled} onCheckedChange={() => handleToggle('weeklyBoostEnabled')} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                        <div>
                            <Label htmlFor="blur" className="font-bold text-lg">Blur Photos for Non-Matches by Default</Label>
                            <p className="text-sm text-gray-600">New users will have this setting enabled by default. They can change it in their privacy settings.</p>
                        </div>
                        <Switch id="blur" checked={settings.blurPhotosDefault} onCheckedChange={() => handleToggle('blurPhotosDefault')} />
                    </div>
                </motion.div>
            </div>
        );
    };

    export default AdminSettings;