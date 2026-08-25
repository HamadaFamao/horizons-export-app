import { supabase } from '@/lib/supabaseClient';

// Shared client for the `admin-identity-manager` edge function — used by the
// Identity Manager page's "Login Identity" / "Replace Login Identity" cards.
// This talks only to `admin-identity-manager` (auth.users only). It never
// calls `admin-account-migration` and never touches application tables.

export const invokeIdentityFn = async (body) => {
  const { data, error } = await supabase.functions.invoke('admin-identity-manager', { body });
  if (error) {
    const message = error.context?.error || error.context?.message || error.message || 'Request failed';
    throw new Error(message);
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
};
