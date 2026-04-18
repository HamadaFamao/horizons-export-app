import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInApp, setIsInApp] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const inApp = /FBAN|FBAV|Instagram|Messenger|WebView|wv/i.test(navigator.userAgent);
    setIsInApp(inApp);
  }, []);

  useEffect(() => {
    if (!authLoading && user?.id) {
      navigate('/discover', { replace: true });
    }
  }, [user?.id, authLoading, navigate]);

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      toast({
        title: 'Authentication Failed',
        description: location.state.error,
        variant: 'destructive',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location, toast]);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback`;

      const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|WebView|wv/i.test(navigator.userAgent);

      if (isInAppBrowser) {
        setError('Please open this link in Safari or Chrome to sign in with Google.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }

    } catch (err) {
      console.error('Sign in error:', err);
      setError(err?.message || 'Something went wrong');
      toast({
        title: 'Error signing in',
        description: err?.message || 'Something went wrong',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  if (authLoading || user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  // ✅ In-App Browser Screen
  if (isInApp) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 p-4">
      <Card className="w-full max-w-sm shadow-xl border-rose-100/50 bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center flex flex-col items-center space-y-4 pt-8 pb-6">
          <Logo size="xl" className="mb-2" />
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Open in Browser
            </CardTitle>
            <CardDescription className="text-base">
              Google sign-in doesn't work inside Messenger
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8 flex flex-col gap-4">

          {/* الرابط قابل للنسخ */}
          <div className="bg-gray-100 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Copy this link and open in Chrome or Safari:</p>
            <p className="text-sm font-bold text-rose-500 select-all break-all">
              singlesdate.online/auth
            </p>
          </div>

          <p className="text-xs text-center text-gray-400">
            Press and hold the link above to copy it
          </p>

        </CardContent>
      </Card>
    </div>
  );
}

  return (
    <>
      <Helmet>
        <title>Sign In - Singles</title>
        <meta name="description" content="Sign in to your Singles account to connect with people." />
      </Helmet>

      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 p-4">
        <Card className="w-full max-w-sm shadow-xl border-rose-100/50 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center flex flex-col items-center space-y-4 pt-8 pb-6">
            <Logo size="xl" className="mb-2" />
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
              <CardDescription className="text-base">Sign in to find your perfect match</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="w-full text-base py-6 shadow-sm hover:shadow-md transition-all duration-200"
              variant="outline"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon />}
              Sign In with Google
            </Button>

            <p className="text-xs text-center text-gray-500 mt-6 px-4">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AuthPage;