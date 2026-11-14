"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useAuthProfile} from "@/lib/use-auth-profile";

// Registered Discord OAuth callback. Uses the existing Supabase Auth session
// and NEVER sends an unauthenticated user ID or role flag to the API.
export default function DiscordCaCallbackPage(){
  const {supabase,user,loading}=useAuthProfile();
  const started=useRef(false);
  const [status,setStatus]=useState("Discordからの認証結果を確認中…");
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    if(loading||started.current)return;
    started.current=true;
    const query=new URLSearchParams(window.location.search);
    const state=query.get("state"),code=query.get("code"),denied=query.get("error");
    // Remove the single-use code from browser history before sending to Edge.
    window.history.replaceState(null,"","/discord-ca/callback");
    if(denied){setStatus("Discordでの認証がキャンセルされました。");setFailed(true);return;}
    if(!user){setStatus("Googleログインの有効なセッションがありません。もう一度アカウント画面から認証してください。");setFailed(true);return;}
    if(!state||!code){setStatus("Discord認証の応答が不足しています。最初からやり直してください。");setFailed(true);return;}
    (async()=>{
      const {data,error}=await supabase.functions.invoke("ca-claim-discord-oauth",{
        body:{action:"complete",state,code}
      });
      if(error||data?.verified!==true){
        setStatus("APAC CAロールを確認できませんでした。Discordのロールや認証期限を確認し、やり直してください。");
        setFailed(true);
        return;
      }
      window.location.replace("/account?discord=verified");
    })();
  },[loading,user,supabase]);

  return <main className="mx-auto max-w-lg px-4 py-14 text-center">
    <h1 className="text-2xl font-black text-lime-950">🍀 Discord CA認証</h1>
    <p className="mt-5 text-sm font-semibold leading-7 text-slate-600" role="status">{status}</p>
    {failed?<Link className="mt-6 inline-flex rounded-full bg-lime-600 px-5 py-3 text-sm font-black text-white" href="/account">アカウント設定に戻る</Link>:null}
  </main>;
}
