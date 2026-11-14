import { createClient } from "@supabase/supabase-js";

// Preproduction safety: never silently connect an unconfigured build to the
// real CA Clover database. This is not an authorization control for the backend;
// Preview must ALSO have isolated service-role secrets and Edge functions.
const PROD_URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const DISABLED_URL = "https://ca-clover-no-auth.invalid";
const DISABLED_KEY = "sb_publishable_disabled_no_real_database";

let browserClient: ReturnType<typeof createClient> | null = null;
export function resolveBrowserSupabaseConfig(env:{
  url?:string;key?:string;deployment?:string;
}){
  const url=env.url?.trim()??"";
  const key=env.key?.trim()??"";
  const deploy=env.deployment??"";
  // A Preview/unknown deployment must never use the production CA Clover DB.
  // The release needs a deliberate review of this gate before merging.
  if(!url || !key || (url===PROD_URL && deploy!=="production"))
    return {url:DISABLED_URL,key:DISABLED_KEY,isolated:false};
  return {url,key,isolated:url!==PROD_URL};
}

export function createBrowserSupabaseClient(){
  if(browserClient)return browserClient;
  const config=resolveBrowserSupabaseConfig({
    url:process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    deployment:process.env.NEXT_PUBLIC_VERCEL_ENV,
  });
  browserClient=createClient(config.url,config.key);
  return browserClient;
}
