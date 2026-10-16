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
  const [downloadUsers,setDownloadUsers]=useState<Set<string>>(new Set());
  const [permissionsReady,setPermissionsReady]=useState(false);
  const [permissionError,setPermissionError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    setPermissionsReady(false);
    try{
      const [profileResult,permissionResult]=await Promise.all([
      supabase.from("profiles").select("id,email,niantic_id,role,created_at").order("created_at",{ascending:false}),
      supabase.from("user_permissions").select("user_id,permission_code").in("permission_code",["S","D"]),
    ]);
    if(profileResult.error||permissionResult.error){
      setPermissionError("CAアカウントまたは権限情報を取得できませんでした。権限の変更は停止しています。");
      return;
    }
    const permissions=(permissionResult.data as PermissionRow[]|null)??[];
    setRows((profileResult.data as ProfileRow[]|null)??[]);
    setStampUsers(new Set(permissions.filter(row=>row.permission_code==="S").map(row=>row.user_id)));
    setDownloadUsers(new Set(permissions.filter(row=>row.permission_code==="D").map(row=>row.user_id)));
    setPermissionError(null);
    setPermissionsReady(true);
    }catch{
      setPermissionError("CAアカウントまたは権限情報を取得できませんでした。権限の変更は停止しています。");
      setPermissionsReady(false);
    }
  }

  useEffect(()=>{ if(!loading && user && profile?.role==="admin") load(); },[loading,user,profile?.role]);

  async function changeRole(id:string,role:AppRole){
    if(busy!==null||!permissionsReady) return;
    setBusy(id);
    try{
      const {data,error}=await supabase.functions.invoke("admin-manage",{body:{action:"set_role",userId:id,role}});
      const failed=Boolean(error)||data?.ok!==true;
      await load();
      if(failed) setPermissionError("ロール変更を完了できませんでした。現在の権限を再確認してください。");
    }catch{
      setPermissionsReady(false);
      setPermissionError("ロール変更中にエラーが発生しました。再取得してください。");
    }finally{
      setBusy(null);
    }
  }

  async function toggleStampPermission(row:ProfileRow){
    if(row.role==="pending"||busy!==null||!permissionsReady) return;
    setBusy(row.id);
    try{
      const enabled=!stampUsers.has(row.id);
      const {data,error}=await supabase.functions.invoke("admin-manage",{
        body:{action:"set_permission",userId:row.id,permissionCode:"S",enabled}
      });
      const failed=Boolean(error)||data?.ok!==true;
      await load();
      if(failed) setPermissionError("S権限の更新を確認できませんでした。現在の権限を再確認してください。");
    }catch{
      setPermissionsReady(false);
      setPermissionError("S権限の更新中にエラーが発生しました。再取得してください。");
    }finally{
      setBusy(null);
    }
  }

  async function toggleDownloadPermission(row:ProfileRow){
    if(row.role!=="ca"||!permissionsReady||busy!==null) return;
    setBusy(row.id);
    setPermissionError(null);
    try{
      const enabled=!downloadUsers.has(row.id);
      const {data,error}=await supabase.functions.invoke("admin-manage",{
        body:{action:"set_permission",userId:row.id,permissionCode:"D",enabled}
      });
      const updateFailed=Boolean(error)||data?.ok!==true;
      await load();
      if(updateFailed){
        setPermissionError("D権限を更新できませんでした。現在の権限を再確認してください。");
      }
    }catch{
      setPermissionError("D権限の更新中にエラーが発生しました。再度確認してください。");
      setPermissionsReady(false);
    }finally{
      setBusy(null);
    }
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user || profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ACCOUNTS</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">👥 CAアカウント</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">Googleログイン後のアカウントを承認します。SはStamp Rally LAB、Dは参加者CSVダウンロードの追加権限です。DはADMINが承認済みCAに個別付与します。</p>

    {permissionError?<div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">{permissionError}<button type="button" onClick={()=>{void load();}} className="ml-3 rounded-full bg-amber-200 px-3 py-2">再取得</button></div>:null}

    <div className="mt-6 space-y-3">
      {rows.map(row=><section key={row.id} className="clover-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="truncate font-black text-lime-950">{row.email??"メール未取得"}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Niantic ID: {row.niantic_id??"未登録"}</div>
            <div className="mt-1 text-[11px] text-slate-400">登録 {new Date(row.created_at).toLocaleString("ja-JP")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["pending","ca","admin"] as AppRole[]).map(role=><button key={role} disabled={!permissionsReady || busy!==null || row.role===role} onClick={()=>changeRole(row.id,role)} className={row.role===role?"rounded-full bg-lime-400 px-4 py-2 text-xs font-black text-lime-950":"rounded-full border border-lime-200 bg-white px-4 py-2 text-xs font-black text-lime-700 disabled:opacity-50"}>{role.toUpperCase()}</button>)}
            {row.role==="admin"
              ? <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">S・D相当 / ADMIN</span>
              : <button
                  type="button"
                  disabled={!permissionsReady || busy!==null || row.role==="pending"}
                  onClick={()=>toggleStampPermission(row)}
                  className={stampUsers.has(row.id)
                    ?"rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    :"rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-700 disabled:opacity-40"}
                >
                  {stampUsers.has(row.id)?"S ✓":"S"}
                </button>}
            {row.role==="admin"?null:<button
              type="button"
              disabled={busy!==null || row.role!=="ca" || !permissionsReady}
              onClick={()=>{void toggleDownloadPermission(row);}}
              aria-label={(row.email??row.niantic_id??"CA")+" のD権限"}
              aria-pressed={downloadUsers.has(row.id)}
              title="D：参加者CSVダウンロード権限"
              className={downloadUsers.has(row.id)
                ?"min-h-11 rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                :"min-h-11 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-black text-sky-700 disabled:opacity-40"}
            >{downloadUsers.has(row.id)?"D ✓":"D"}</button>}
          </div>
        </div>
      </section>)}
    </div>
  </main>;
}
