import { createClient } from "@supabase/supabase-js";
import {resolveSupabaseEndpoint, isSupabaseKeyForRole} from "./supabase-connection";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Use Vercel's server-owned environment, never the browser's public flag.
  const endpoint = resolveSupabaseEndpoint({
    url, deployment: process.env.VERCEL_ENV,
    isolatedRef: process.env.CA_CLOVER_ISOLATED_SUPABASE_REF,
  });
  if (!endpoint || !serviceRoleKey ||
      (endpoint.isolated && process.env.NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF !== endpoint.ref) ||
      !isSupabaseKeyForRole(serviceRoleKey, endpoint.ref, "service_role")) return null;

  return createClient(endpoint.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

