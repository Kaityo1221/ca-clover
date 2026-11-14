import { createClient } from "@supabase/supabase-js";
import {resolveSupabaseEndpoint, isSupabaseKeyForRole} from "./supabase-connection";

// Preproduction safety: never silently connect an unconfigured build to the
// real CA Clover database. This is not an authorization control for the backend;
// Preview must ALSO have isolated service-role secrets and Edge functions.
const DISABLED_URL = "https://ca-clover-no-auth.invalid";
const DISABLED_KEY = "sb_publishable_disabled_no_real_database";

let browserClient: ReturnType<typeof createClient> | null = null;
export function resolveBrowserSupabaseConfig(env:{
  url?:string;key?:string;deployment?:string;isolatedRef?:string;
}){
  const url=env.url?.trim()??"";
  const key=env.key?.trim()??"";
  const endpoint=resolveSupabaseEndpoint({...env,url});
  if(!endpoint || !isSupabaseKeyForRole(key,endpoint.ref,"anon"))
    return {url:DISABLED_URL,key:DISABLED_KEY,isolated:false};
  return {url:endpoint.url,key,isolated:endpoint.isolated};
}

export function createBrowserSupabaseClient(){
  if(browserClient)return browserClient;
  const config=resolveBrowserSupabaseConfig({
    url:process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    deployment:process.env.NEXT_PUBLIC_VERCEL_ENV,
    isolatedRef:process.env.NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF,
  });
  browserClient=createClient(config.url,config.key);
  return browserClient;
}

