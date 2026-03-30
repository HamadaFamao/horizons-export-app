import React from 'react';
    import { motion } from 'framer-motion';
    import { Users, Heart, MessageSquare, ShieldAlert, Award, RefreshCcw, CheckCircle } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';

    const AdminOverview = () => {
      const { user, updateUser } = useAuth();

      const stats = [
        { label: 'Total Users', value: '12', icon: Users, color: 'from-blue-500 to-cyan-500' },
        { label: 'Matches (24h)', value: '15', icon: Heart, color: 'from-rose-500 to-pink-500' },
        { label: 'Chats (24h)', value: '32', icon: MessageSquare, color: 'from-green-500 to-emerald-500' },
        { label: 'Reports Pending', value: '3', icon: ShieldAlert, color: 'from-yellow-500 to-orange-500' }
      ];

      const handleGrantGold = () => {
        updateUser({ plan: 'gold' }, true);
        toast({ title: '👑 Gold Plan Granted!', description: 'You now have Gold plan for 7 days (demo).' });
      };

      const handleResetToFree = () => {
        let users = JSON.parse(localStorage.getItem('singlesDemoUsers') || '[]');
        users.forEach(u => u.plan = 'free');
        localStorage.setItem('singlesDemoUsers', JSON.stringify(users));
        if(user.plan !== 'free') {
            updateUser({ plan: 'free' }, true);
        }
        toast({ title: '🔄 All users reset to Free plan.', description: 'Premium plans have been revoked.' });
      };

      const handleVerifyAccount = () => {
        if (!user.verified) {
            updateUser({ verified: true }, true);
            toast({ title: '✅ Account Verified!', description: 'Your account now has a verification badge.' });
        } else {
             toast({ title: 'Already Verified', description: 'Your account is already verified.' });
        }
      };


      return (
        <div>
          <h1 className="text-3xl font-bold mb-6">Overview</h1>
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
                </div>
                <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-gradient p-6 rounded-2xl shadow-lg"
          >
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleGrantGold} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                <Award className="mr-2 h-4 w-4" /> Give Myself Gold
              </Button>
              <Button onClick={handleResetToFree} variant="destructive">
                <RefreshCcw className="mr-2 h-4 w-4" /> Reset All to Free
              </Button>
              <Button onClick={handleVerifyAccount} className="bg-blue-500 hover:bg-blue-600 text-white">
                <CheckCircle className="mr-2 h-4 w-4" /> Verify My Account
              </Button>
            </div>
          </motion.div>
        </div>
      );
    };

    export default AdminOverview;