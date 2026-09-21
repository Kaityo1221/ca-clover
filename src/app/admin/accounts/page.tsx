"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile, type AppRole } from "@/lib/use-auth-profile";

type ProfileRow={
  id:string;
  email:string|null;
  niantic_id:string|null;
  role:AppRole;
  created_at:string;
};

type PermissionRow={
  user_id:string;
  permission_code:string;
};

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [rows,setRows]=useState<ProfileRow[]>([]);
  const [stampUsers,setStampUsers]=useState<Set<string>>(new Set());
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    const [profileResult,permissionResult]=await Promise.all([
      supabase.from("profiles").select("id,email,niantic_id,role,created_at").order("created_at",{ascending:false}),
      supabase.from("user_permissions").select("user_id,permission_code").eq("permission_code","S"),
    ]);
    setRows((profileResult.data as ProfileRow[]|null)??[]);
    setStampUsers(new Set(
      ((permissionResult.data as PermissionRow[]|null)??[]).map(row=>row.user_id)
    ));
  }

  useEffect(()=>{ if(!loading && user && profile?.role==="admin") load(); },[loading,user,profile?.role]);

  async function changeRole(id:string,role:AppRole){
    setBusy(id);
    const {error}=await supabase.functions.invoke("admin-manage",{body:{action:"set_role",userId:id,role}});
    if(!error) await load();
    setBusy(null);
  }

  async function toggleStampPermission(row:ProfileRow){
    if(row.role==="pending") return;
    setBusy(row.id);
    const enabled=!stampUsers.has(row.id);
    const {error}=await supabase.functions.invoke("admin-manage",{
      body:{action:"set_permission",userId:row.id,permissionCode:"S",enabled}
    });
    if(!error) await load();
    setBusy(null);
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ACCOUNTS</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">👥 CAアカウント</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">Googleログイン後のアカウントを承認します。SはStamp Rally LABの追加権限です。</p>

    <div className="mt-6 space-y-3">
      {rows.map(row=><section key={row.id} className="clover-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="truncate font-black text-lime-950">{row.email??"メール未取得"}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Niantic ID: {row.niantic_id??"未登録"}</div>
            <div className="mt-1 text-[11px] text-slate-400">登録 {new Date(row.created_at).toLocaleString("ja-JP")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["pending","ca","admin"] as AppRole[]).map(role=><button key={role} disabled={busy===row.id || row.role===role} onClick={()=>changeRole(row.id,role)} className={row.role===role?"rounded-full bg-lime-400 px-4 py-2 text-xs font-black text-lime-950":"rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700 disabled:opacity-50"}>{role.toUpperCase()}</button>)}
            {row.role==="admin"
              ? <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">S相当 / ADMIN</span>
              : <button
                  type="button"
                  disabled={busy===row.id || row.role==="pending"}
                  onClick={()=>toggleStampPermission(row)}
                  className={stampUsers.has(row.id)
                    ?"rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    :"rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-700 disabled:opacity-40"}
                >
                  {stampUsers.has(row.id)?"S ✓":"S"}
                </button>}
          </div>
        </div>
      </section>)}
    </div>
  </main>;
}
