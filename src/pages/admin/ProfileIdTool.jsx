import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShieldOff, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminGuard = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    if (!user || !user.isadmin) {
        return (
            <Card className="w-full max-w-md mx-auto mt-20">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-red-100 rounded-full p-3 w-fit">
                        <ShieldOff className="w-10 h-10 text-red-600" />
                    </div>
                    <CardTitle className="mt-4">Access Denied</CardTitle>
                    <CardDescription>You do not have permission to view this page.</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button asChild>
                        <Link to="/">Go to Homepage</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return children;
};

const ProfileIdTool = () => {
    const { toast } = useToast();
    const [target, setTarget] = useState('');
    const [newProfileId, setNewProfileId] = useState('');
    const [loadingCheck, setLoadingCheck] = useState(false);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [checkResult, setCheckResult] = useState(null);
    const [error, setError] = useState('');

    const isNewIdValid = /^\d+$/.test(newProfileId) && Number(newProfileId) >= 10000;

    const handleCheck = useCallback(async () => {
        if (!target || !newProfileId) {
            setError('Please provide a target user and a new Profile ID.');
            return;
        }
        setError('');
        setLoadingCheck(true);

        const { data, error: rpcError } = await supabase.rpc('admin_check_profile_id', {
            p_target: target,
            p_new_profile_id: Number(newProfileId),
        });
        
        setLoadingCheck(false);

        if (rpcError) {
            setError(rpcError.message);
            toast({ title: 'Error', description: rpcError.message, variant: 'destructive' });
            return;
        }

        if (data.ok) {
            setCheckResult(data);
        } else {
            setError(data.message);
        }
    }, [target, newProfileId, toast]);
    
    const handleUpdate = useCallback(async () => {
        if (!checkResult || !checkResult.ok) {
            setError('Please run a successful check first.');
            return;
        }
        setError('');
        setLoadingUpdate(true);

        const { data, error: rpcError } = await supabase.rpc('admin_update_profile_id_rpc', {
             p_target: target,
             p_new_profile_id: Number(newProfileId),
        });
        
        setLoadingUpdate(false);
        if (rpcError) {
            setError(rpcError.message);
            toast({ title: 'Update Failed', description: rpcError.message, variant: 'destructive' });
        } else if (data.ok) {
            toast({ title: 'Success', description: data.message });
            setCheckResult(null);
            setTarget('');
            setNewProfileId('');
        } else {
            setError(data.message);
            toast({ title: 'Update Failed', description: data.message, variant: 'destructive' });
        }

    }, [checkResult, target, newProfileId, toast]);

    return (
        <AdminGuard>
            <Helmet>
                <title>Admin - Edit Profile ID</title>
            </Helmet>
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">Edit Profile ID Tool</CardTitle>
                        <CardDescription>
                            Use this tool to manually change a user's Profile ID.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="target-user" className="font-medium">Target User</label>
                            <Input
                                id="target-user"
                                placeholder="email, UUID, or current profile_id"
                                value={target}
                                onChange={(e) => { setTarget(e.target.value); setCheckResult(null); }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="new-id" className="font-medium">New Profile ID</label>
                            <Input
                                id="new-id"
                                type="number"
                                placeholder="e.g., 10000 or higher"
                                value={newProfileId}
                                min="10000"
                                onChange={(e) => { setNewProfileId(e.target.value); setCheckResult(null); }}
                            />
                        </div>

                        {error && (
                             <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                                <AlertTriangle className="w-5 h-5"/>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={handleCheck} disabled={loadingCheck || loadingUpdate || !target || !newProfileId} className="flex-1">
                                {loadingCheck ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Search className="w-5 h-5 mr-2" />}
                                Check Availability
                            </Button>
                            <Button
                                onClick={handleUpdate}
                                disabled={loadingUpdate || !checkResult?.ok || !isNewIdValid}
                                className="flex-1"
                                variant="destructive"
                            >
                               {loadingUpdate ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Update Profile ID'}
                            </Button>
                        </div>
                        
                        {checkResult?.ok && (
                             <div className="border-t pt-6 mt-6 space-y-4">
                                <h3 className="text-lg font-semibold flex items-center text-green-700"><CheckCircle className="mr-2"/>Ready to Update</h3>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><span className="font-semibold">Name:</span> {checkResult.name}</div>
                                    <div><span className="font-semibold">Email:</span> {checkResult.email}</div>
                                    <div><span className="font-semibold">Current ID:</span> <span className="font-mono">{checkResult.old_profile_id}</span></div>
                                    <div><span className="font-semibold">New ID:</span> <span className="font-mono">{newProfileId}</span></div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminGuard>
    );
};

export default ProfileIdTool;