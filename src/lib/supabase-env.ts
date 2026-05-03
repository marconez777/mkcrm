// Centralized access to public Supabase env vars used by direct fetch() calls
// (e.g. streaming responses that bypass the SDK).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

import { supabase } from "@/integrations/supabase/client";

/** Build the auth headers required to call an edge function via raw fetch. */
export async function getFunctionHeaders(extra: Record<string, string> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}
