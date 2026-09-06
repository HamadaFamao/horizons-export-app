import { createClient } from '@supabase/supabase-js';

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase] URL:', supabaseUrl);

// Guard: Check if environment variables are present
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
      '❌ Missing Supabase environment variables!',
          'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
            );
            }

            // Create and export Supabase client
            // Use fallback empty strings to prevent crashes if env vars are missing (graceful degradation)
            export const supabase = createClient(
              supabaseUrl || '',
                supabaseAnonKey || '',
                  {
                      auth: {
                            persistSession: true,
                                  autoRefreshToken: true,
                                        detectSessionInUrl: true,
                                            },
                                              }
                                              );