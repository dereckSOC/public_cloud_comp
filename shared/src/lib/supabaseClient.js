import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_DB_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_DB_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

let _client = null;

export const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_client) {
      _client = getSupabaseClient();
    }
    if (!_client) throw new Error("Supabase client could not be initialized: missing env vars.");
    return _client[prop];
  }
});
