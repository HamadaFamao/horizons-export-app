const signInWithGoogle = async () => {
  setLoading(true);
  setError(null);

  try {
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback`;

    // detect in-app browser
    const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|WebView|wv/i.test(
      navigator.userAgent
    );

    if (isInAppBrowser) {
      // ✅ عرض رسالة للمستخدم يفتح في Safari بدل redirect خاطئ
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