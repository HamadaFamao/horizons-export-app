import React, { useState } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Star, Plus, Minus, Search } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { useRewards } from '@/contexts/RewardsContext';
    import { toast } from '@/components/ui/use-toast';

    const AdminRewards = () => {
        const { adjustPoints } = useRewards();
        const [userId, setUserId] = useState('');
        const [points, setPoints] = useState(10);
        const [searchTerm, setSearchTerm] = useState('');
        
        // Mock data for leaderboards
        const leaderboardData = [
            { id: 1, profileId: 100123, name: 'Emma Wilson', points: 1250 },
            { id: 2, profileId: 100124, name: 'Sofia Martinez', points: 1100 },
            { id: 3, profileId: 100125, name: 'Aisha Khan', points: 980 },
            { id: 4, profileId: 100101, name: 'Jessica', points: 850 },
            { id: 5, profileId: 100102, name: 'Alex', points: 730 },
        ].filter(user => 
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.profileId.toString().includes(searchTerm)
        );

        const handleAdjustPoints = (operation) => {
            if (!userId.trim()) {
                toast({ title: "User ID required", description: "Please enter a User ID or Profile ID.", variant: "destructive" });
                return;
            }
            const amount = operation === 'add' ? points : -points;
            adjustPoints(userId, amount, `Admin adjustment`);
            toast({ title: "Points Adjusted", description: `${Math.abs(amount)} points ${operation === 'add' ? 'added to' : 'removed from'} user ${userId}.` });
        };

        return (
            <>
                <Helmet><title>Admin - Rewards Management</title></Helmet>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="card-gradient p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4">Manually Adjust Points</h2>
                        <div className="grid md:grid-cols-3 gap-4 items-end">
                            <Input placeholder="User ID or Profile ID" value={userId} onChange={e => setUserId(e.target.value)} />
                            <Input type="number" placeholder="Points" value={points} onChange={e => setPoints(Number(e.target.value))} />
                            <div className="flex gap-2">
                                <Button onClick={() => handleAdjustPoints('add')} className="flex-1 bg-green-500 hover:bg-green-600 text-white"><Plus className="w-4 h-4 mr-2"/> Add</Button>
                                <Button onClick={() => handleAdjustPoints('remove')} className="flex-1 bg-red-500 hover:bg-red-600 text-white"><Minus className="w-4 h-4 mr-2"/> Remove</Button>
                            </div>
                        </div>
                    </div>

                    <div className="card-gradient p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Leaderboard</h2>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search by name or ID..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            {leaderboardData.map((user, index) => (
                                <div key={user.id} className="flex items-center justify-between bg-white/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg w-8 text-center">{index + 1}</span>
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-xs text-gray-500">ID: {user.profileId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 font-bold text-yellow-600">
                                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-500" />
                                        {user.points}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </>
        );
    };

    export default AdminRewards;