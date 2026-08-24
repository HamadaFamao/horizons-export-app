import { supabase } from '@/lib/supabaseClient';

// Shared client for the `admin-account-migration` edge function — used by
// both the Account Migration page and the Migration History page so neither
// one talks to the database directly (see ACCOUNT_MIGRATION.md).

// Dispatched on `window` after a successful (non-dry-run) migration so any
// other mounted page — e.g. Migration History — can refresh itself without
// a full page reload.
export const MIGRATION_COMPLETED_EVENT = 'famo:migration-completed';

export const invokeMigrationFn = async (body) => {
  const { data, error } = await supabase.functions.invoke('admin-account-migration', { body });
  if (error) {
    const message = error.context?.error || error.context?.message || error.message || 'Request failed';
    throw new Error(message);
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
};
