import React, { useState } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { ArrowLeft, Star, ShoppingBag, Gift, Clock, Users, Copy, Share2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useNavigate } from 'react-router-dom';
    import { useAuth } from '@/contexts/AuthContext';
    import { useRewards } from '@/contexts/RewardsContext';
    import { useCoins } from '@/contexts/CoinsContext';
    import { toast } from '@/components/ui/use-toast';
    import { cn } from '@/lib/utils';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

    const RewardsPage = () => {
      const navigate = useNavigate();
      const { user } = useAuth();
      const { rewards, redeemPoints, getPointsForNextLevel } = useRewards();
      const { purchaseCoins } = useCoins();
      const [activeTab, setActiveTab] = useState('overview');

      const pointsToNextLevel = getPointsForNextLevel(rewards.level);
      const pointsOfCurrentLevel = getPointsForNextLevel(rewards.level - 1) || 0;
      const progress = ((rewards.points - pointsOfCurrentLevel) / (pointsToNextLevel - pointsOfCurrentLevel)) * 100;
      
      const referralLink = `${window.location.origin}/signup?ref=${user?.referralCode}`;

      const earnTasks = [
        { title: "Complete your profile (90%)", points: "+50" },
        { title: "Verify your account", points: "+30" },
        { title: "Daily login streak", points: "+5 to +7" },
        { title: "Make a new match", points: "+3 / match" },
        { title: "Send a gift", points: "+1 / 50 coins" },
        { title: "Receive a gift", points: "+5 / gift" },
        { title: "Refer a friend", points: "+100" },
      ];

      const redeemItems = [
        { title: "1-Day Gold Trial", points: 250, action: () => redeemPoints(250, "1-Day Gold Trial") },
        { title: "Profile Boost (24h)", points: 150, action: () => redeemPoints(150, "Profile Boost") },
        { title: "100 Bonus Coins", points: 100, action: () => {
            if(redeemPoints(100, "100 Bonus Coins")) {
                purchaseCoins(100);
            }
        }},
      ];

      const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
          toast({ title: 'Link Copied!', description: 'Your referral link is ready to be shared.' });
        });
      };
      
      const shareLink = () => {
        if (navigator.share) {
          navigator.share({
            title: 'Join me on Singles!',
            text: `Sign up on Singles with my link and we both get rewards!`,
            url: referralLink,
          });
        } else {
          copyToClipboard(referralLink);
        }
      };


      return (
        <>
          <Helmet><title>Rewards - Singles</title></Helmet>
          <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
            <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
              <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5 mr-2" /> Back</Button>
                <h1 className="text-2xl font-bold gradient-text">Rewards</h1>
                <div className="w-24"></div>
              </div>
            </header>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-rose-100/50">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="earn">Earn</TabsTrigger>
                        <TabsTrigger value="redeem">Redeem</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="referrals">Referrals</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                        <div className="card-gradient p-8 rounded-2xl shadow-lg text-center">
                            <p className="font-mono text-sm text-gray-500">Profile ID: {user.profileId}</p>
                            <p className="text-2xl font-bold">Level {rewards.level}</p>
                            <div className="flex items-center justify-center gap-3 my-2">
                                <Star className="w-12 h-12 text-yellow-400 fill-yellow-400" />
                                <p className="text-6xl font-bold gradient-text">{rewards.points}</p>
                            </div>
                            <p className="text-gray-600 mb-6">Total Points</p>
                            <div className="w-full bg-rose-100 rounded-full h-2.5 mb-2">
                                <div className="bg-gradient-to-r from-rose-400 to-pink-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                             <p className="text-sm text-gray-500">{rewards.points}/{pointsToNextLevel} points to Level {rewards.level + 1}</p>
                        </div>
                         <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="card-gradient p-4 rounded-xl text-center"><p className="text-2xl font-bold">{rewards.streakDays}</p><p className="text-sm text-gray-600">Daily Streak</p></div>
                            <div className="card-gradient p-4 rounded-xl text-center"><p className="text-2xl font-bold">{rewards.referralCount}</p><p className="text-sm text-gray-600">Referrals</p></div>
                        </div>
                    </TabsContent>
                    <TabsContent value="earn" className="mt-6">
                        <div className="card-gradient p-6 rounded-2xl shadow-lg space-y-3">
                            {earnTasks.map(task => (
                                <div key={task.title} className="flex justify-between items-center bg-white/50 p-4 rounded-lg">
                                    <p className="font-semibold">{task.title}</p>
                                    <p className="font-bold text-green-600">{task.points}</p>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="redeem" className="mt-6">
                        <div className="card-gradient p-6 rounded-2xl shadow-lg space-y-3">
                             {redeemItems.map(item => (
                                <div key={item.title} className="flex justify-between items-center bg-white/50 p-4 rounded-lg">
                                    <div>
                                        <p className="font-semibold">{item.title}</p>
                                        <p className="text-sm text-yellow-600 flex items-center gap-1"><Star className="w-4 h-4"/>{item.points} Points</p>
                                    </div>
                                    <Button onClick={item.action} disabled={rewards.points < item.points} className="btn-gradient text-white">Redeem</Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="mt-6">
                        <div className="card-gradient p-6 rounded-2xl shadow-lg max-h-96 overflow-y-auto">
                            {rewards.history.length > 0 ? rewards.history.map(entry => (
                                <div key={entry.id} className="flex justify-between items-center p-3 border-b border-rose-100 last:border-b-0">
                                    <div>
                                        <p className="font-semibold capitalize">{entry.description}</p>
                                        <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
                                    </div>
                                    <p className={cn("font-bold", entry.delta > 0 ? "text-green-500" : "text-red-500")}>
                                        {entry.delta > 0 ? "+" : ""}{entry.delta}
                                    </p>
                                </div>
                            )) : <p className="text-center text-gray-500 py-8">No rewards history yet.</p>}
                        </div>
                    </TabsContent>
                    <TabsContent value="referrals" className="mt-6">
                        <div className="card-gradient p-6 rounded-2xl shadow-lg">
                            <h2 className="text-xl font-bold mb-2">Invite Friends, Earn Rewards!</h2>
                            <p className="text-gray-600 mb-4">Share your link and earn 100 points for every friend who signs up!</p>
                             <div className="flex items-center gap-2 mb-4">
                                <input readOnly value={referralLink} className="w-full bg-white/50 p-2 border rounded-md" />
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(referralLink)}><Copy className="w-4 h-4"/></Button>
                                <Button variant="ghost" size="icon" onClick={shareLink}><Share2 className="w-4 h-4"/></Button>
                            </div>
                            <h3 className="font-semibold mt-6 mb-2">Your Referrals ({rewards.referralCount})</h3>
                            <div className="text-center text-gray-500 py-6">This is a demo. Your referred users would appear here.</div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
          </div>
        </>
      );
    };

    export default RewardsPage;