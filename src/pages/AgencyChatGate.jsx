import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * AgencyChatGate
 * 
 * Entry point for /agency/chat route.
 * Determines user's agency chat access and redirects to the appropriate chat.
 * 
 * Flow:
 * 1. Check if user is in an agency (member or owner)
 * 2. Get or create the agency chat
 * 3. Redirect to /agency-chat/:chatId
 */
function AgencyChatGate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeChat = async () => {
      if (!user?.id) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        // Call RPC to get or create agency chat
        const { data, error: rpcError } = await supabase
          .rpc('get_or_create_my_agency_chat');

        if (rpcError) {
          console.error('Error getting agency chat:', rpcError);
          
          // Handle specific error cases
          if (rpcError.message?.includes('not_in_agency')) {
            setError('You are not a member of any agency');
          } else if (rpcError.message?.includes('not_authenticated')) {
            setError('Authentication required');
          } else {
            setError('Unable to access agency chat');
          }
          setLoading(false);
          return;
        }

        if (!data) {
          setError('No agency chat available');
          setLoading(false);
          return;
        }

        // Redirect to the chat
        navigate(`/agency-chat/${data}`, { replace: true });
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    initializeChat();
  }, [user?.id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading agency chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border rounded-xl p-6 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Access Denied
          </h2>
          
          <p className="text-slate-600 text-sm mb-6">
            {error}
          </p>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/agency/dashboard')}
              className="w-full px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium"
            >
              Go to Agency Dashboard
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default AgencyChatGate;