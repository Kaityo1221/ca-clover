import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";

let browserClient: ReturnType<typeof createClient> | null = null;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  browserClient = createClient(url, key);
  return browserClient;
}
