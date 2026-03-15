import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_DB_URL || process.env.DB_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient = null;

/**
 * Returns a singleton Supabase admin client for server-side usage only.
 * Never import this module from client components.
 */
export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL. Set SUPABASE_URL (preferred), NEXT_PUBLIC_DB_URL, or DB_URL.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
