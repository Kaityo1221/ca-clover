"use client";

import {useEffect, useRef, useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {MeetupDeltaStatus} from "@/components/meetup-delta-status";
import type {DeltaStatus} from "@/lib/meetup-delta-display";
import {requestAuthorizedMeetupDeltas, MeetupDeltaRequestError} from "@/lib/meetup-delta-request";

type Props = {
  supabase: SupabaseClient;
  userId: string;
  communityIds: string[];
};

export function AuthorizedMeetupDeltaPanel({supabase,userId,communityIds}:Props) {
  const [result,setResult]=useState<{userId:string;status:DeltaStatus;added:number;updated:number}|null>(null);
  const version=useRef(0);
  const busy=useRef(false);
  useEffect(()=>{
    version.current++;
    busy.current=false;
    setResult(null);
    return ()=>{version.current++;};
  },[userId]);

  async function check() {
    if(busy.current || !communityIds.length)return;
    const requestVersion=++version.current;
    busy.current=true;
    setResult({userId,status:"loading",added:0,updated:0});
    try {
      // The browser's auth result is only a pre-check.
      // The API must independently verify JWT and formal CA approval.
      const {data,error}=await supabase.auth.getUser();
      if(error || !data.user || data.user.id!==userId)
        throw new MeetupDeltaRequestError("unauthorized");
      const totals=await requestAuthorizedMeetupDeltas(communityIds, async communityId=>{
        const response=await supabase.functions.invoke("ca-meetup-delta-readonly",{
          body:{communityId},
        });
        return {data:response.data,error:response.error};
      });
      if(requestVersion!==version.current)return;
      setResult({
        userId,
        status:totals.added+totals.updated>0?"updated":"unchanged",
        added:totals.added,updated:totals.updated,
      });
    } catch(e) {
      if(requestVersion!==version.current)return;
      setResult({
        userId,
        status:e instanceof MeetupDeltaRequestError && e.category==="unauthorized"
          ? "unauthorized":"error",
        added:0,updated:0,
      });
    } finally {
      if(requestVersion===version.current)busy.current=false;
    }
  }

  const status = result?.userId===userId ? result.status : "idle";
  const isBusy=status==="loading";
  return (
    <section className="mt-5 rounded-2xl border border-lime-200 bg-white p-4">
      <h2 className="text-sm font-black text-lime-950">CampfireのMeetup更新確認</h2>
      <MeetupDeltaStatus status={status}
        added={result?.userId===userId?result.added:0}
        updated={result?.userId===userId?result.updated:0}/>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        正式に承認されたCommunityの更新を確認します。通信エラーや所属不一致では更新件数を表示しません。
      </p>
      <button type="button" onClick={()=>void check()} disabled={isBusy || !communityIds.length}
        className="mt-3 inline-flex rounded-full bg-lime-100 px-4 py-2 text-xs font-black text-lime-900 disabled:opacity-50">
        {isBusy?"確認中...":"Campfire更新を確認"}
      </button>
    </section>
  );
}
