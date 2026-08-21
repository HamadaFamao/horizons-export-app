import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import '@/index.css';
import '@/i18n';

import { AuthProvider } from '@/contexts/AuthContext';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MiniRoomProvider } from "@/contexts/MiniRoomContext";
import { Loader2 } from 'lucide-react';

import { setupGlobalErrorHandlers } from '@/lib/globalErrorLogger';
import { supabaseWarmup } from '@/lib/supabaseWarmup';

// Initialize global error handlers immediately
setupGlobalErrorHandlers();

// Check for required storage buckets
console.log('🔍 Checking Supabase storage buckets...');
console.log('📦 Required buckets: room_avatars (public), profile-photos (public), room_backgrounds (public)');
console.log('⚠️  If upload fails with "bucket does not exist", create buckets manually in Supabase dashboard');
console.log('📋 See SUPABASE_BUCKETS.md for step-by-step instructions');
console.log('🛠️  Or use CLI: ./create-buckets.sh (if you have Supabase CLI installed)');

// Quick bucket check on app start
import('./lib/supabaseWarmup.js').then(({ supabaseWarmup }) => {
  supabaseWarmup().then(() => {
    // Check buckets after warmup
    setTimeout(async () => {
      try {
        const { supabase } = await import('./lib/supabaseClient.js');
        const { data: buckets } = await supabase.storage.listBuckets();
        const hasRoomAvatars = buckets?.some(b => b.name === 'room_avatars');
        const hasProfilePhotos = buckets?.some(b => b.name === 'profile-photos');
        const hasRoomBackgrounds = buckets?.some(b => b.name === 'room_backgrounds');

        console.log('📦 Bucket status:', {
          'room_avatars': hasRoomAvatars ? '✅ Found' : '❌ Missing',
          'profile-photos': hasProfilePhotos ? '✅ Found' : '❌ Missing',
          'room_backgrounds': hasRoomBackgrounds ? '✅ Found' : '❌ Missing'
        });

        if (!hasRoomAvatars || !hasProfilePhotos || !hasRoomBackgrounds) {
          console.warn('⚠️  Some storage buckets are missing. Upload features may not work until buckets are created.');
        }
      } catch (e) {
        console.warn('⚠️  Could not check storage buckets:', e.message);
      }
    }, 2000); // Wait 2 seconds after warmup
  });
}).catch(e => console.warn('Bucket check failed:', e));

const LoadingFallback = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-rose-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
      <p className="text-xl text-rose-600">Loading Famo...</p>
    </div>
  </div>
);

async function bootstrap() {
  try {
    // ✅ Warmup Supabase / PostgREST schema cache / initial session
    await supabaseWarmup();
  } catch (e) {
    // Don't block the app from loading if warmup fails
    console.warn('[Warmup] supabaseWarmup failed, continuing to render app...', e);
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[System] Root element #root not found.');
    return;
  }

  console.log('[System] Bootstrapping App...');

  ReactDOM.createRoot(rootEl).render(
    <Suspense fallback={<LoadingFallback />}>
      <AppErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <MiniRoomProvider>
                <App />
              </MiniRoomProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </Suspense>
  );
}

bootstrap();