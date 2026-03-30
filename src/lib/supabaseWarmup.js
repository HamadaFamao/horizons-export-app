import { supabase } from '@/lib/supabaseClient';

let didWarm = false;

export async function supabaseWarmup() {
  if (didWarm) return true;
  didWarm = true;

  try {
    await supabase.auth.getSession();
  } catch (_) {}

  try {
    await supabase.from('profiles').select('id').limit(1);
  } catch (_) {}

  try {
    await supabase.from('profiles').select('id').limit(1);
  } catch (_) {}

  return true;
}