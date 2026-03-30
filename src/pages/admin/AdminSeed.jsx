import React, { useState, useEffect } from 'react';
    import { Database, RefreshCw, UserPlus, Trash2, Users, MessageSquare, Heart } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/AuthContext';
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    
    const broadcastDbUpdate = () => {
        window.dispatchEvent(new Event("singles:db:updated"));
    };

    const AdminSeed = () => {
        const { seedDemoData, clearAllDemoData } = useAuth();
        const [counts, setCounts] = useState({ users: 0, matches: 0, messages: 0 });

        const updateCounts = () => {
            try {
                const users = JSON.parse(localStorage.getItem('singlesDemoUsers') || '[]');
                let matchCount = 0;
                let messageCount = 0;
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('singlesMatches_')) {
                        matchCount += JSON.parse(localStorage.getItem(key) || '[]').length;
                    }
                    if (key.startsWith('singlesMessages_')) {
                        const threads = JSON.parse(localStorage.getItem(key) || '[]');
                        threads.forEach(thread => messageCount += thread.messages.length);
                    }
                });
                setCounts({ users: users.length, matches: matchCount, messages: messageCount });
            } catch (e) {
                console.error("Failed to update counts", e);
            }
        };
        
        useEffect(() => {
            updateCounts();
             const handleDbUpdate = () => {
                updateCounts();
            };

            window.addEventListener("singles:db:updated", handleDbUpdate);

            return () => {
                window.removeEventListener("singles:db:updated", handleDbUpdate);
            };
        }, []);
        
        const handleSeed = () => {
            seedDemoData(false, 24);
        };
        
        const handleAppend = () => {
            seedDemoData(true, 12);
        };

        const handleReset = () => {
            clearAllDemoData();
            seedDemoData(false, 24);
        };
        
        const forceReRead = () => {
            updateCounts();
            broadcastDbUpdate();
            toast({ title: "🔄 Data Re-read & Broadcasted", description: "All components listening for DB updates should now refresh." });
        };

        return (
            <div>
                <h1 className="text-3xl font-bold mb-2 gradient-text">Seeding Tool</h1>
                <p className="text-gray-600 mb-6">Manage local demo database for testing and development.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{counts.users}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                            <Heart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{counts.matches}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{counts.messages}</div></CardContent>
                    </Card>
                </div>
                
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold">Seed Demo Data</h3>
                                <p className="text-sm text-gray-600">Create 24 new demo profiles with photos, matches, and chats for the admin.</p>
                            </div>
                            <Button onClick={handleSeed} size="sm">
                                <Database className="mr-2 h-4 w-4" /> Seed (24 Users)
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold">Append More Users</h3>
                                <p className="text-sm text-gray-600">Add 12 more users to the existing data without deleting anything.</p>
                            </div>
                            <Button onClick={handleAppend} variant="secondary" size="sm">
                                <UserPlus className="mr-2 h-4 w-4" /> Append (+12)
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold">Force Re-Read & Broadcast</h3>
                                <p className="text-sm text-gray-600">Reload counts from local DB and notify other components to refresh.</p>
                            </div>
                            <Button onClick={forceReRead} variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" /> Force Re-Read
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="border-red-500/50">
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-red-600">Reset Demo Data</h3>
                                <p className="text-sm text-gray-600">Warning: Clears all demo data and re-seeds a fresh batch of 24 users.</p>
                            </div>
                            <Button variant="destructive" onClick={handleReset} size="sm">
                                <Trash2 className="mr-2 h-4 w-4" /> Reset Data
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    export default AdminSeed;