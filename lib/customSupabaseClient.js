// DEPRECATED: This file must NOT be used anymore. Use @/lib/supabaseClient instead
// All imports should be updated to: import { supabase } from '@/lib/supabaseClient'

import { supabase } from '@/lib/supabaseClient';

console.warn('WARNING: utilizing deprecated customSupabaseClient. Please migrate to @/lib/supabaseClient');

const customSupabaseClient = supabase;

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};