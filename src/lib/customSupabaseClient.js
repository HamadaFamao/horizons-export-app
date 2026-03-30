import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wymywyrdahtahkfxxkkt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bXl3eXJkYWh0YWhrZnh4a2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjA1NDksImV4cCI6MjA3NjUzNjU0OX0.k9HIGpScpsPt1zwnVOPnkDpizpDh9lbsy4baflpTa2I';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
