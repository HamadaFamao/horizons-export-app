import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Users, Settings, LogOut, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const stats = [
    { label: 'Profile Views', value: '127', icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Matches', value: '23', icon: Heart, color: 'from-rose-500 to-pink-500' },
    { label: 'Messages', value: '45', icon: MessageCircle, color: 'from-purple-500 to-indigo-500' },
    { label: 'Likes Received', value: '89', icon: Sparkles, color: 'from-orange-500 to-yellow-500' }
  ];

  const quickActions = [
    { label: t('discover'), icon: Heart, path: '/discover', color: 'bg-gradient-to-r from-rose-500 to-pink-500' },
    { label: t('messages'), icon: MessageCircle, path: '/messages', color: 'bg-gradient-to-r from-purple-500 to-indigo-500' },
    { label: t('matches'), icon: Users, path: '/matches', color: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
    { label: t('profile'), icon: Users, path: '/profile', color: 'bg-gradient-to-r from-green-500 to-emerald-500' }
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard - Famo</title>
        <meta name="description" content="Your Famo dashboard. View your matches, messages, and profile statistics." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
                <span className="text-2xl font-bold gradient-text">Famo</span>
              </div>

              <div className="flex items-center gap-4">
                {user?.subscription === 'free' && (
                  <Button 
                    onClick={() => navigate('/subscription')}
                    className="btn-gradient text-white"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {t('upgrade')}
                  </Button>
                )}
                <Button 
                  variant="ghost"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost"
                  onClick={logout}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold mb-2">
              Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>! 👋
            </h1>
            <p className="text-gray-600 text-lg">Ready for Endless Connections?</p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card-gradient p-6 rounded-2xl shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(action.path)}
                  className={`${action.color} text-white p-6 rounded-2xl shadow-lg flex flex-col items-center gap-3 transition-all`}
                >
                  <action.icon className="w-8 h-8" />
                  <span className="font-semibold">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card-gradient p-8 rounded-2xl shadow-lg"
          >
            <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white/50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">New Match!</div>
                  <div className="text-sm text-gray-600">You matched with Emma</div>
                </div>
                <div className="text-sm text-gray-500">2 hours ago</div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">New Message</div>
                  <div className="text-sm text-gray-600">Sarah sent you a message</div>
                </div>
                <div className="text-sm text-gray-500">5 hours ago</div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Someone Liked You!</div>
                  <div className="text-sm text-gray-600">You have 3 new likes</div>
                </div>
                <div className="text-sm text-gray-500">1 day ago</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;