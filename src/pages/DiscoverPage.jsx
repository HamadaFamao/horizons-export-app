import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import UserCard from '@/components/UserCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 50;

// أول تحميل بعد فترة خمول ممكن يحتاج وقت أكبر
const FIRST_LOAD_TIMEOUT_MS = 20000;
const NORMAL_TIMEOUT_MS = 12000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DiscoverPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { toast } = useToast();

  const isMounted = useRef(true);
  const hasFetched = useRef(false);

  // علشان ندي أول محاولة Timeout أكبر + Warmup
  const firstAttempt = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const withTimeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]);
  };

  const normalizeErrorMessage = (err) => {
    const msg = (err?.message || '').trim();
    if (msg === 'Request timed out') {
      return 'Connection timed out. Server is taking too long to respond.';
    }
    if (msg.toLowerCase().includes('failed to fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    return msg || 'Something went wrong loading profiles.';
  };

  const isRpcNotVisibleError = (rpcError) => {
    const m = (rpcError?.message || '').toLowerCase();
    return (
      (m.includes('could not find the function') && m.includes('schema cache')) ||
      (m.includes('function') && m.includes('does not exist')) ||
      (m.includes('rpc') && m.includes('not found')) ||
      (m.includes('schema cache')) ||
      (m.includes('not found') && m.includes('function'))
    );
  };

  // ✅ Warmup صغير: يجهز الـ session + يعمل ping خفيف جدًا
  const warmUp = async () => {
    try {
      await supabase.auth.getSession(); // يثبت/يقرأ session من التخزين
      // ping بسيط جدًا عشان يوقظ الاتصال (وأحيانًا يقلل cold start)
      await supabase.from('profiles').select('id').limit(1);
    } catch {
      // مش مهم يفشل — الهدف بس تهيئة
    }
  };

  const fetchViaRpc = async () => {
    const rpcParams = {
      p_limit: PAGE_SIZE,
      p_offset: 0,
      p_query: null,
      p_min_age: null,
      p_max_age: null,
      p_gender: null,
      p_living_in: null,
      p_interests: null,
    };
    return supabase.rpc('search_profiles_rpc', rpcParams);
  };

  const fetchViaFallback = async () => {
    return supabase
      .from('profiles')
      .select('profile_id, id, name, avatar_url, age, gender, living_in, country_code, is_active, last_seen')
      .eq('is_active', true)
      .order('last_seen', { ascending: false })
      .limit(PAGE_SIZE);
  };

  const fetchOnce = async (timeoutMs) => {
    // 1) Try RPC
    const rpcResult = await withTimeout(fetchViaRpc(), timeoutMs);
    const { data: rpcData, error: rpcError } = rpcResult || {};

    if (!rpcError && Array.isArray(rpcData)) {
      return { ok: true, data: rpcData };
    }

    // If RPC not visible => fallback
    if (isRpcNotVisibleError(rpcError)) {
      const fbResult = await withTimeout(fetchViaFallback(), timeoutMs);
      const { data: fbData, error: fbError } = fbResult || {};
      if (fbError) throw fbError;
      return { ok: true, data: fbData || [] };
    }

    // other RPC errors
    throw rpcError || new Error('RPC failed');
  };

  const fetchProfiles = useCallback(
    async (isRetry = false) => {
      if (hasFetched.current && !isRetry && profiles.length > 0) return;

      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      try {
        // ✅ أول مرة بس: Warmup + Timeout أكبر
        if (firstAttempt.current) {
          await warmUp();
        }

        const timeoutMs = firstAttempt.current ? FIRST_LOAD_TIMEOUT_MS : NORMAL_TIMEOUT_MS;

        // ✅ محاولة أولى
        let res;
        try {
          res = await fetchOnce(timeoutMs);
        } catch (e) {
          // ✅ لو أول محاولة فشلت بسبب timeout فقط، نعمل retry تلقائي مرة واحدة
          const msg = (e?.message || '').toLowerCase();
          const isTimeout = msg.includes('timed out') || msg.includes('timeout');

          if (firstAttempt.current && isTimeout) {
            console.warn('[DiscoverPage] First load timeout. Auto retry in 800ms...');
            await sleep(800);
            res = await fetchOnce(NORMAL_TIMEOUT_MS);
          } else {
            throw e;
          }
        } finally {
          firstAttempt.current = false;
        }

        if (res?.ok && isMounted.current) {
          setProfiles(res.data || []);
          hasFetched.current = true;
        }
      } catch (err) {
        console.error('[DiscoverPage] Error:', err);

        if (isMounted.current) {
          const userMessage = normalizeErrorMessage(err);
          setError(userMessage);

          toast({
            title: 'Error loading feed',
            description: userMessage,
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [toast, profiles.length]
  );

  useEffect(() => {
    if (!hasFetched.current) fetchProfiles(false);
  }, [fetchProfiles]);

  // Simulate online activity for fake profiles
  useEffect(() => {
    const simulate = async () => {
      await supabase.rpc('simulate_online_activity');
    };
    simulate();
    const interval = setInterval(simulate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => fetchProfiles(true);

  return (
    <>
      <Helmet>
        <title>{t('discover_page_title', 'Discover')} - Singles</title>
        <meta name="description" content={t('discover_page_meta_description', 'Find people near you')} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <AppHeader />

        <main className="container mx-auto px-4 py-8 pb-20 md:pb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold gradient-text">{t('discover')}</h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/search')}>
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col justify-center items-center py-32 gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                <div className="absolute inset-0 bg-rose-200 blur-xl opacity-20 animate-pulse rounded-full" />
              </div>
              <p className="text-gray-500 font-medium animate-pulse">Finding people near you...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="bg-white/90 backdrop-blur rounded-2xl border border-red-100 p-8 max-w-md w-full shadow-xl text-center">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <WifiOff className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connection Issue</h3>
                <p className="text-gray-600 mb-8">{error}</p>
                <Button
                  onClick={handleRetry}
                  size="lg"
                  className="w-full gap-2 btn-gradient text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            </div>
          ) : profiles.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {profiles.map((profile, idx) => (
                <motion.div
                  key={profile.profile_id ?? profile.id ?? idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <UserCard profile={profile} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-gray-300">
              <p className="text-xl font-semibold text-gray-700">{t('no_profiles_found')}</p>
              <p className="mt-2 text-gray-500 mb-6">{t('no_profiles_found_subtext')}</p>
              <Button onClick={() => navigate('/search')} variant="secondary">
                Adjust Filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default DiscoverPage;