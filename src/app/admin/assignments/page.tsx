"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile, type AppRole } from "@/lib/use-auth-profile";

type ProfileRow={id:string;email:string|null;niantic_id:string|null;role:AppRole};
type CommunityRow={id:string;name:string;prefecture:string|null};
type MembershipRow={user_id:string;community_id:string};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [profiles,setProfiles]=useState<ProfileRow[]>([]);
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [memberships,setMemberships]=useState<MembershipRow[]>([]);
  const [selected,setSelected]=useState<string>("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    const [{data:p},{data:c},{data:m}]=await Promise.all([
      supabase.from("profiles").select("id,email,niantic_id,role").neq("role","pending").order("email"),
      supabase.from("communities").select("id,name,prefecture").order("prefecture").order("name"),
      supabase.from("community_memberships").select("user_id,community_id"),
    ]);
    const profileRows=(p as ProfileRow[]|null)??[];
    setProfiles(profileRows);
    setCommunities((c as CommunityRow[]|null)??[]);
    setMemberships((m as MembershipRow[]|null)??[]);
    setSelected(current=>current || profileRows[0]?.id || "");
  }

  useEffect(()=>{
    if(loading || !user || profile?.role!=="admin") return;
    load();
    const refresh=()=>{ void load(); };
    const onVisibility=()=>{ if(document.visibilityState==="visible") void load(); };
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[loading,user,profile?.role]);

  const assigned=useMemo(()=>new Set(memberships.filter(m=>m.user_id===selected).map(m=>m.community_id)),[memberships,selected]);
  const ownersByCommunity=useMemo(()=>{
    const profileMap=new Map(profiles.map(p=>[p.id,p]));
    const result=new Map<string,ProfileRow[]>();
    memberships.forEach(m=>{
      const owner=profileMap.get(m.user_id);
      if(!owner) return;
      const list=result.get(m.community_id)??[];
      list.push(owner);
      result.set(m.community_id,list);
    });
    return result;
  },[memberships,profiles]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q) return communities;
    return communities.filter(c=>(c.name+" "+(c.prefecture??"")).toLowerCase().includes(q));
  },[communities,search]);

  async function toggle(communityId:string){
    if(!selected) return;
    const next=!assigned.has(communityId);
    setBusy(communityId);
    const {error}=await supabase.functions.invoke("admin-manage",{body:{action:"set_membership",userId:selected,communityId,assigned:next}});
    if(!error){
      setMemberships(current=>{
        if(next) return [...current,{user_id:selected,community_id:communityId}];
        return current.filter(m=>!(m.user_id===selected&&m.community_id===communityId));
      });
    }
    setBusy(null);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  const selectedProfile=profiles.find(p=>p.id===selected);

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ASSIGNMENTS</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🛠️ Community権限調整</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">通常は申請承認時に自動割当されます。ここは手動補正・追加担当・解除用です。</p>

    <section className="clover-card mt-6 p-5">
      <label className="text-xs font-black text-slate-500">対象アカウント</label>
      <select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-2 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold">
        {profiles.map(p=>{
          const count=memberships.filter(m=>m.user_id===p.id).length;
          return <option key={p.id} value={p.id}>{count>0?"✅ ":""}{p.email??p.niantic_id??p.id} ({p.role}){count>0?" / "+count+" Community":""}</option>;
        })}
      </select>
      {selectedProfile ? <div className="mt-3 text-xs font-semibold text-slate-500">Niantic ID: {selectedProfile.niantic_id??"未登録"} / 割当 {assigned.size} Community</div> : null}
    </section>

    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Community名・都道府県で検索" className="mt-5 w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-lime-400"/>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map(c=>{
        const on=assigned.has(c.id);
        const owners=ownersByCommunity.get(c.id)??[];
        const ownedByOther=!on&&owners.length>0;
        const ownerLabel=owners.map(owner=>owner.niantic_id??owner.email??"CA").join(" / ");
        return <button key={c.id} disabled={!selected||busy===c.id} onClick={()=>toggle(c.id)} className={
          on
            ?"clover-card min-h-32 border-lime-400 bg-lime-50 p-5 text-left"
            :ownedByOther
              ?"clover-card min-h-32 border-sky-200 bg-sky-50 p-5 text-left hover:border-sky-300"
              :"clover-card min-h-32 p-5 text-left hover:border-lime-300"
        }>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-lime-700">{c.prefecture??"—"}</div>
              <div className="mt-2 font-black text-lime-950">{c.name}</div>
              {owners.length?<div className="mt-2 text-[11px] font-bold text-slate-500">CA Clover: {ownerLabel}</div>:null}
            </div>
            <span className={
              on
                ?"rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-black text-lime-950"
                :ownedByOther
                  ?"rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-black text-sky-800"
                  :"rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500"
            }>{on?"✅ このCAに割当済み":ownedByOther?"✅ 認証済み":"未割当"}</span>
          </div>
        </button>;
      })}
    </div>
  </main>;
}
