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

    // 2. لو فيه openInBrowser flag — مش المفروض يوصل هنا
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
export default AuthCallback;