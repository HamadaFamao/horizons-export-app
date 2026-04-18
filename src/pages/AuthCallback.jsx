import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleAuthCallback = async () => {
      console.log('🔄 [AuthCallback] Starting...');

      try {
        const params = new URLSearchParams(window.location.search);
        const hashString = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hashString);

        // 1. URL errors
        const error = params.get('error') || hashParams.get('error');
        const errorDesc = params.get('error_description') || hashParams.get('error_description');
        if (error) throw new Error(errorDesc || error);

        // 2. لو فيه openInBrowser flag
        if (params.get('openInBrowser')) {
          navigate('/auth', { replace: true });
          return;
        }

        // 3. Code exchange
        const code = params.get('code');
        if (code) {
          console.log('🔄 Exchanging code...');
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          if (exchangeData?.session) {
            console.log('✅ Session from code exchange');
            setStatus('success');
            setTimeout(() => navigate('/discover', { replace: true }), 1500);
            return;
          }
        }

        // 4. Hash tokens (implicit flow - بعض iOS cases)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          console.log('🔄 Setting session from hash tokens...');
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) throw sessionError;

          if (sessionData?.session) {
            console.log('✅ Session from hash tokens');
            setStatus('success');
            setTimeout(() => navigate('/discover', { replace: true }), 1500);
            return;
          }
        }

        // 5. Retry getSession (fallback)
        let session = null;
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 800));
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            session = data.session;
            break;
          }
        }

        if (!session) throw new Error('No authentication credentials found.');

        console.log('✅ Auth successful');
        setStatus('success');
        setTimeout(() => navigate('/discover', { replace: true }), 1500);

      } catch (err) {
        console.error('❌ Error:', err);
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