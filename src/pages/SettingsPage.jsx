import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Bell, Eye, Lock, Globe, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  
  const [settings, setSettings] = useState({
    profileVisibility: user?.privacy?.profileVisibility || 'public',
    photoVisibility: user?.privacy?.photoVisibility || 'public',
    messageVisibility: user?.privacy?.messageVisibility || 'matches',
    notifications: true,
    emailNotifications: true,
    matchNotifications: true
  });

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    document.documentElement.lang = lng;
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  const handleSave = () => {
    // Placeholder
    console.log("Saving settings...", settings);
  };

  return (
    <>
      <Helmet>
        <title>Settings - Singles Dating App</title>
        <meta name="description" content="Manage your Singles account settings, privacy preferences, and notifications." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold gradient-text">Settings</h1>
              <Button onClick={handleSave} className="btn-gradient text-white">
                Save
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Language Settings */}
            <div className="card-gradient p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Language</h2>
              </div>
              <div>
                <Label htmlFor="language">Select Language</Label>
                <select
                  id="language"
                  value={i18n.language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mt-2"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="ar">🇸🇦 العربية (Arabic)</option>
                </select>
              </div>
            </div>

            {/* Blocked Users Link - NEW */}
            <div className="card-gradient p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <UserX className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Blocked Users</h2>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Manage people you have blocked.</div>
                <Button variant="outline" onClick={() => navigate('/blocked')}>
                    Manage Block List
                </Button>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="card-gradient p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Privacy & Safety</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="profileVisibility">Profile Visibility</Label>
                  <select
                    id="profileVisibility"
                    value={settings.profileVisibility}
                    onChange={(e) => setSettings({...settings, profileVisibility: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mt-2"
                  >
                    <option value="public">Public - Everyone can see</option>
                    <option value="private">Private - Only matches</option>
                    <option value="hidden">Hidden - No one can see</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="photoVisibility">Photo Visibility</Label>
                  <select
                    id="photoVisibility"
                    value={settings.photoVisibility}
                    onChange={(e) => setSettings({...settings, photoVisibility: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mt-2"
                  >
                    <option value="public">Public - Everyone can see</option>
                    <option value="matches">Matches Only</option>
                    <option value="blurred">Blurred for non-matches</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="messageVisibility">Who Can Message You</Label>
                  <select
                    id="messageVisibility"
                    value={settings.messageVisibility}
                    onChange={(e) => setSettings({...settings, messageVisibility: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mt-2"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="matches">Matches Only</option>
                    <option value="verified">Verified Users Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="card-gradient p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Notifications</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-sm text-gray-600">Receive notifications on your device</div>
                  </div>
                  <Switch
                    checked={settings.notifications}
                    onCheckedChange={(checked) => setSettings({...settings, notifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-gray-600">Receive updates via email</div>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Match Notifications</div>
                    <div className="text-sm text-gray-600">Get notified when you have a new match</div>
                  </div>
                  <Switch
                    checked={settings.matchNotifications}
                    onCheckedChange={(checked) => setSettings({...settings, matchNotifications: checked})}
                  />
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="card-gradient p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Account</h2>
              </div>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Verify Account
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                  Delete Account
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;