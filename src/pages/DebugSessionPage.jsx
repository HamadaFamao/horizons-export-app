import React from 'react';
    import { Helmet } from 'react-helmet';
    import { useLocation, useNavigate } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { LogOut, RefreshCw, Trash2, ArrowLeft, ServerCrash } from 'lucide-react';
    import { useAuth } from '@/contexts/AuthContext';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';

    const DebugSessionPage = () => {
        const { user, loading, logout, error, refreshSession } = useAuth();
        const location = useLocation();
        const navigate = useNavigate();

        const handleHardReset = () => {
            const confirmation = window.confirm("🚨 Are you sure you want to hard reset all app data? This cannot be undone.");
            if (confirmation) {
                localStorage.clear();
                toast({
                    title: 'Hard Reset Complete!',
                    description: 'All local data has been cleared.',
                    variant: 'destructive',
                });
                window.location.href = '/login';
            }
        };

        const renderObject = (obj) => {
            if (!obj) return <p>No data.</p>;
            return (
                <pre className="text-xs bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(obj, null, 2)}
                </pre>
            );
        };

        return (
            <>
                <Helmet>
                    <title>Debug Session - Singles</title>
                </Helmet>
                <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
                    <div className="max-w-4xl mx-auto">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-white hover:bg-gray-700">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                            <div className="flex items-center gap-4 mb-8">
                                <h1 className="text-3xl font-bold">Debug Session</h1>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${user ? 'bg-green-500' : 'bg-red-500'}`}>
                                    {user ? 'Logged In' : 'Logged Out'}
                                </span>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <h2 className="font-semibold mb-2">Actions</h2>
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={logout} variant="secondary"><LogOut className="w-4 h-4 mr-2" /> Force Logout</Button>
                                        <Button onClick={refreshSession} variant="secondary"><RefreshCw className="w-4 h-4 mr-2" /> Refresh Session</Button>
                                        <Button onClick={handleHardReset} variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Hard Reset (DEV)</Button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg">
                                        <h2 className="font-semibold mb-2 flex items-center gap-2"><ServerCrash className="w-5 h-5"/> Last Auth Error</h2>
                                        <p className="text-red-300">{error}</p>
                                    </div>
                                )}
                                
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <h2 className="font-semibold mb-2">Auth Status</h2>
                                    <p>Loading: <span className="font-mono">{loading.toString()}</span></p>
                                    <p>Current Path: <span className="font-mono">{location.pathname}</span></p>
                                </div>
                                
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <h2 className="font-semibold mb-2">Current User Object</h2>
                                    {renderObject(user)}
                                </div>

                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <h2 className="font-semibold mb-2">Raw Local Storage</h2>
                                    {renderObject(localStorage)}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </>
        );
    };

    export default DebugSessionPage;