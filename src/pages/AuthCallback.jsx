import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { isValidToken } from '@/lib/jwtUtils';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in strict mode
    if (processedRef.current) return;
    processedRef.current = true;

    const handleAuthCallback = async () => {
      console.log('🔄 [AuthCallback] Starting auth verification...');
      
      try {
        // 1. Handle URL errors first (e.g. access_denied)
        const params = new URLSearchParams(window.location.search);
        const hashString = window.location.hash.substring(1); // remove #
        const hashParams = new URLSearchParams(hashString);
        
        const error = params.get('error') || hashParams.get('error');
        const errorDesc = params.get('error_description') || hashParams.get('error_description');

        if (error) {
           throw new Error(errorDesc || error || 'Authentication failed');
        }

        // 2. Retrieve session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        // 3. Handle Code Exchange if no session but code exists
        if (!session) {
           const code = params.get('code');
           if (code) {
               console.log('🔄 [AuthCallback] Exchanging code for session...');
               const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
               if (exchangeError) throw exchangeError;
               
               if (!exchangeData.session) {
                   throw new Error("No session returned after code exchange");
               }
               
               // Validate the new token immediately
               if (!isValidToken(exchangeData.session.access_token)) {
                   throw new Error("Received invalid session token from provider");
               }
           } else {
               // If no code and no session, check if we have hash tokens
               const accessToken = hashParams.get('access_token');
               if (accessToken) {
                   // Validate hash token
                   if (!isValidToken(accessToken)) {
                       throw new Error("Invalid access token in URL");
                   }
               } else {
                   // Fallback: Check if we're already logged in via getUser
                   const { data: userCheck } = await supabase.auth.getUser();
                   if (!userCheck?.user) {
                       throw new Error("No authentication credentials found.");
                   }
               }
           }
        } else {
            // We have a session, validate it
            if (!isValidToken(session.access_token)) {
                // If invalid, try to refresh or fail
                console.warn('[AuthCallback] Session token invalid, attempting refresh...');
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session || !isValidToken(refreshData.session.access_token)) {
                    throw new Error("Invalid or expired session token");
                }
            }
        }

        // 4. Verify User Profile with Safe Retry Logic
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            console.log('✅ [AuthCallback] User authenticated:', user.id);
            let profile = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts && !profile) {
                console.log(`⏳ [AuthCallback] Verifying profile (Attempt ${attempts + 1}/${maxAttempts})...`);
                
                const fetchPromise = supabase
                    .from('profiles')
                    .select('id, name')
                    .eq('id', user.id)
                    .single();
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
                );

                try {
                    const result = await Promise.race([fetchPromise, timeoutPromise]);
                    if (result && result.data) {
                        profile = result.data;
                        break;
                    }
                } catch (e) {
                    console.warn("Profile fetch attempt failed/timed out:", e);
                }

                if (attempts < maxAttempts - 1) {
                    await new Promise(r => setTimeout(r, 1000));
                }
                attempts++;
            }

            if (!profile) {
                console.warn('⚠️ [AuthCallback] Profile verification timed out. User may be new/creating.');
            } else {
                console.log('✅ [AuthCallback] Profile verified:', profile.name);
            }
        }

        setStatus('success');
        
        setTimeout(() => {
             navigate('/discover', { replace: true });
        }, 1500);

      } catch (err) {
        console.error('❌ [AuthCallback] Error:', err);
        // Clear any bad state
        await supabase.auth.signOut().catch(() => {});
        setStatus('error');
        setErrorMessage(err.message || 'Authentication failed');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Failed</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button 
            onClick={() => navigate('/auth')}
            className="w-full bg-rose-500 text-white py-3 rounded-xl font-semibold hover:bg-rose-600 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-green-700">Redirecting you to the app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="relative">
        <Loader2 className="w-16 h-16 animate-spin text-rose-500" />
        <div className="absolute inset-0 bg-rose-200 blur-xl opacity-20 animate-pulse rounded-full"></div>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mt-6 animate-pulse">Verifying Credentials...</h2>
      <p className="text-gray-500 text-sm mt-2">Please wait a moment</p>
    </div>
  );
};

export default AuthCallback;