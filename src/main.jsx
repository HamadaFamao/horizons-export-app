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

const LoadingFallback = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-rose-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
      <p className="text-xl text-rose-600">Loading Singles...</p>
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