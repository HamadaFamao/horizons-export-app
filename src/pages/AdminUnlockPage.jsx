import React from 'react';
    import { useNavigate } from 'react-router-dom';
    import { useAuth } from '@/contexts/AuthContext';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { ShieldCheck, Home } from 'lucide-react';

    const AdminUnlockPage = () => {
      const { user, updateUser } = useAuth();
      const navigate = useNavigate();

      const handleMakeAdmin = () => {
        if (user) {
          updateUser({ isAdmin: true }, true);
          toast({
            title: "Admin Enabled! 👑",
            description: "You now have admin privileges for this session.",
          });
        }
      };

      return (
        <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-lg card-gradient">
            <ShieldCheck className="mx-auto h-16 w-16 text-rose-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Unlock</h1>
            <p className="text-gray-600 mb-6">
              This page is for development purposes. Grant yourself temporary admin rights.
            </p>
            
            {user && !user.isAdmin && (
              <Button onClick={handleMakeAdmin} size="lg" className="w-full btn-gradient text-white mb-4">
                Make me admin (dev)
              </Button>
            )}

            {user && user.isAdmin && (
              <div className="p-4 bg-green-100 text-green-800 rounded-lg mb-4">
                <p className="font-semibold">You are already an admin!</p>
              </div>
            )}

            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      );
    };

    export default AdminUnlockPage;