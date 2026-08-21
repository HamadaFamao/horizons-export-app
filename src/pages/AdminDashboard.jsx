import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Heart, MessageCircle, TrendingUp, AlertTriangle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { label: 'Total Users', value: '50,234', change: '+12%', icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Active Users', value: '12,456', change: '+8%', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { label: 'Total Matches', value: '89,123', change: '+15%', icon: Heart, color: 'from-rose-500 to-pink-500' },
    { label: 'Messages Sent', value: '234,567', change: '+20%', icon: MessageCircle, color: 'from-purple-500 to-indigo-500' },
    { label: 'Premium Users', value: '5,678', change: '+25%', icon: Crown, color: 'from-yellow-500 to-orange-500' },
    { label: 'Reports', value: '23', change: '-5%', icon: AlertTriangle, color: 'from-red-500 to-pink-500' }
  ];

  const recentUsers = [
    { id: 1, name: 'Emma Wilson', email: 'emma@example.com', status: 'Active', subscription: 'Premium Gold' },
    { id: 2, name: 'Sofia Martinez', email: 'sofia@example.com', status: 'Active', subscription: 'Premium Silver' },
    { id: 3, name: 'Aisha Khan', email: 'aisha@example.com', status: 'Active', subscription: 'Free' },
    { id: 4, name: 'Isabella Rodriguez', email: 'isabella@example.com', status: 'Inactive', subscription: 'Free' },
    { id: 5, name: 'Lily Chen', email: 'lily@example.com', status: 'Active', subscription: 'Premium Gold' }
  ];

  const reportedProfiles = [
    { id: 1, reporter: 'User #1234', reported: 'User #5678', reason: 'Inappropriate content', status: 'Pending' },
    { id: 2, reporter: 'User #2345', reported: 'User #6789', reason: 'Fake profile', status: 'Under Review' },
    { id: 3, reporter: 'User #3456', reported: 'User #7890', reason: 'Harassment', status: 'Resolved' }
  ];

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Famo</title>
        <meta name="description" content="Admin dashboard for Famo. Manage users, subscriptions, and reported profiles." />
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
              <h1 className="text-2xl font-bold gradient-text">Admin Dashboard</h1>
              <div className="w-20"></div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                  <span className={`text-sm font-semibold ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Recent Users */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="card-gradient p-6 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Recent Users</h2>
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${user.status === 'Active' ? 'text-green-600' : 'text-gray-400'}`}>
                        {user.status}
                      </div>
                      <div className="text-xs text-gray-600">{user.subscription}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Reported Profiles */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="card-gradient p-6 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Reported Profiles</h2>
              <div className="space-y-3">
                {reportedProfiles.map((report) => (
                  <div key={report.id} className="p-3 bg-white/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm">{report.reporter} → {report.reported}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        report.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        report.status === 'Under Review' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{report.reason}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Analytics Chart Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="card-gradient p-6 rounded-2xl shadow-lg mt-8"
          >
            <h2 className="text-xl font-bold mb-4">User Growth Analytics</h2>
            <div className="h-64 flex items-center justify-center bg-white/50 rounded-xl">
              <div className="text-center text-gray-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>Analytics chart will be displayed here</p>
                <p className="text-sm mt-2">Integration with analytics service coming soon</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;