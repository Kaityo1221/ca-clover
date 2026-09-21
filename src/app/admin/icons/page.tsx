"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { comparePrefectures } from "@/lib/prefecture-order";
import { CommunityIcon } from "@/components/community-icon";

type CommunityRow={
  id:string;
  name:string;
  prefecture:string|null;
  avatar_url:string|null;
  avatar_thumbnail_path:string|null;
  avatar_last_changed_at:string|null;
};

type IconChangeRow={
  id:string;
  community_id:string;
  change_type:"initial"|"changed";
  detection_method:"content_sha256"|"url_fallback";
  previous_avatar_url:string|null;
  new_avatar_url:string;
  detected_at:string;
  reviewed_at:string|null;
};

type IconVersionRow={
  id:string;
  community_id:string;
  content_hash:string;
  source_avatar_url:string|null;
  archive_path:string|null;
  thumbnail_path:string|null;
  first_seen_at:string;
  last_seen_at:string;
  is_current:boolean;
};

function normalized(value:string){
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

export default function Page(){
  const {supabase,user,profile,loading}=useAuthProfile();
  const [communities,setCommunities]=useState<CommunityRow[]>([]);
  const [changes,setChanges]=useState<IconChangeRow[]>([]);
  const [versions,setVersions]=useState<IconVersionRow[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState(false);
  const [assetBusy,setAssetBusy]=useState(false);
  const [assetProgress,setAssetProgress]=useState<string|null>(null);

  async function load(){
    const [{data:communityRows},{data:changeRows},{data:versionRows}]=await Promise.all([
      supabase.from("communities")
        .select("id,name,prefecture,avatar_url,avatar_thumbnail_path,avatar_last_changed_at"),
      supabase.from("community_icon_changes")
        .select("id,community_id,change_type,detection_method,previous_avatar_url,new_avatar_url,detected_at,reviewed_at")
        .order("detected_at",{ascending:false}),
      supabase.from("community_icon_versions")
        .select("id,community_id,content_hash,source_avatar_url,archive_path,thumbnail_path,first_seen_at,last_seen_at,is_current")
        .order("first_seen_at",{ascending:false}),
    ]);
    setCommunities((communityRows as CommunityRow[]|null)??[]);
    setChanges((changeRows as IconChangeRow[]|null)??[]);
    setVersions((versionRows as IconVersionRow[]|null)??[]);
  }

  useEffect(()=>{
    if(!loading&&user&&profile?.role==="admin") void load();
  },[loading,user,profile?.role,supabase]);

  const pendingByCommunity=useMemo(()=>{
    const map=new Map<string,IconChangeRow[]>();
    for(const change of changes){
      if(change.reviewed_at || change.change_type!=="changed") continue;
      const list=map.get(change.community_id)??[];
      list.push(change);
      map.set(change.community_id,list);
    }
    return map;
  },[changes]);

  const sortedCommunities=useMemo(
    ()=>[...communities].sort((a,b)=>
      comparePrefectures(a.prefecture,b.prefecture) ||
      a.name.localeCompare(b.name,"ja")
    ),
    [communities],
  );

  const filteredCommunities=useMemo(()=>{
    const query=normalized(search.trim());
    if(!query) return sortedCommunities;
    return sortedCommunities.filter(community=>
      normalized(community.name+" "+(community.prefecture??"")).includes(query)
    );
  },[search,sortedCommunities]);

  const groups=useMemo(()=>{
    const map=new Map<string,CommunityRow[]>();
    for(const community of filteredCommunities){
      const key=community.prefecture??"都道府県未設定";
      const list=map.get(key)??[];
      list.push(community);
      map.set(key,list);
    }
    return [...map.entries()];
  },[filteredCommunities]);

  const selected=communities.find(row=>row.id===selectedId)??null;
  const selectedChanges=selectedId?(pendingByCommunity.get(selectedId)??[]):[];
  const selectedVersions=selectedId
    ?versions.filter(version=>version.community_id===selectedId)
    :[];

  async function markReviewed(){
    if(!selectedChanges.length) return;
    setBusy(true);
    for(const change of selectedChanges){
      await supabase.functions.invoke("admin-manage",{body:{action:"review_icon_change",changeId:change.id}});
    }
    await load();
    setBusy(false);
  }

  async function backfillIconAssets(){
    if(assetBusy) return;
    setAssetBusy(true);
    setAssetProgress("画像資産を確認しています...");
    try{
      let offset=0;
      let total=0;
      let thumbs=0;
      let archived=0;
      let failed=0;

      while(true){
        const {data,error}=await supabase.functions.invoke("backfill-community-icon-assets",{
          body:{offset,limit:8}
        });
        if(error) throw error;
        if(data?.error) throw new Error(String(data.error));

        total=Number(data?.total??total);
        thumbs+=Number(data?.thumbnailBackfilled??0);
        archived+=Number(data?.archiveEnsured??0);
        failed+=Number(data?.failed??0);
        const processed=Math.min(total,Number(data?.nextOffset??total));
        setAssetProgress("補完中 "+processed+" / "+total+" ・サムネイル +"+thumbs+" ・保存 "+archived);

        if(data?.nextOffset==null) break;
        offset=Number(data.nextOffset);
      }

      setAssetProgress("完了：サムネイル +"+thumbs+" / 永久保存 "+archived+(failed?" / 失敗 "+failed:""));
      await load();
    }catch(error){
      setAssetProgress("補完エラー："+(error instanceof Error?error.message:String(error)));
    }finally{
      setAssetBusy(false);
    }
  }

  function iconVersionUrl(version:IconVersionRow){
    if(version.thumbnail_path){
      return supabase.storage.from("community-icon-thumbs").getPublicUrl(version.thumbnail_path).data.publicUrl;
    }
    if(version.archive_path){
      return supabase.storage.from("community-icon-archive").getPublicUrl(version.archive_path).data.publicUrl;
    }
    return version.source_avatar_url;
  }

  if(loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if(!user||profile?.role!=="admin") return <main className="grid min-h-[70vh] place-items-center text-center"><div>🔒 ADMIN専用です</div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm font-black text-lime-700">← 管理メニュー</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">ICON REVIEW</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🖼️ アイコン一覧</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">
      アイコンから全国のCommunityを探して詳細を確認できます。実際のアイコン変更だけ要確認として表示します。
    </p>

    <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
      <span className="rounded-full bg-white px-3 py-2 text-lime-800 shadow-sm">全国 {communities.length}</span>
      <span className={pendingByCommunity.size?"animate-pulse rounded-full bg-amber-200 px-3 py-2 text-amber-950":"rounded-full bg-lime-100 px-3 py-2 text-lime-800"}>
        要確認 {pendingByCommunity.size}
      </span>
      <button
        type="button"
        disabled={assetBusy}
        onClick={backfillIconAssets}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 disabled:opacity-50"
      >
        {assetBusy?"補完中...":"🧰 画像資産を一括補完"}
      </button>
    </div>
    {assetProgress?<div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">{assetProgress}</div>:null}

    <label className="mt-5 block">
      <span className="sr-only">Communityを検索</span>
      <input
        value={search}
        onChange={event=>setSearch(event.target.value)}
        placeholder="Community名・都道府県で検索"
        className="w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-lime-400 focus:ring-4 focus:ring-lime-100"
      />
    </label>

    <div className="mt-7 space-y-8">
      {groups.map(([prefecture,rows])=><section key={prefecture}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-black text-lime-950">{prefecture}</h2>
          <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-black text-lime-700">{rows.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((community,index)=>{
            const pending=pendingByCommunity.get(community.id)??[];
            const tilt=["-rotate-1","rotate-1","rotate-0"][index%3];
            return <button
              key={community.id}
              type="button"
              onClick={()=>setSelectedId(community.id)}
              className={(pending.length
                ?"relative rounded-[28px] border-2 border-amber-300 bg-amber-50 p-4 text-center shadow-[0_12px_30px_rgba(245,158,11,.22)] ring-2 ring-amber-200 animate-pulse "
                :"relative rounded-[28px] border border-dashed border-lime-200 bg-white/90 p-4 text-center shadow-[0_10px_24px_rgba(77,124,15,.08)] ") + tilt}
            >
              {pending.length?<span className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-amber-950">要確認</span>:null}
              <CommunityIcon
                supabase={supabase}
                community={community}
                className="mx-auto size-24 rounded-full border-4 border-white bg-lime-50 shadow-md"
                fallbackClassName="text-4xl"
              />
              <div className="mt-3 line-clamp-2 text-sm font-black leading-5 text-lime-950">{community.name}</div>
              <div className="mt-1 text-[11px] font-bold text-lime-600">{community.prefecture??"—"}</div>
              <div className="mt-3 text-[11px] font-black text-lime-700">詳細を見る →</div>
            </button>;
          })}
        </div>
      </section>)}
      {!filteredCommunities.length
        ?<div className="rounded-3xl border border-lime-100 bg-white p-8 text-center text-sm font-bold text-slate-500">該当するCommunityはありません 🍀</div>
        :null}
    </div>

    {selected?<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4" onClick={()=>setSelectedId(null)}>
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center py-4">
        <section className="w-full rounded-[30px] bg-white p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black text-slate-400">アイコン一覧 ＞ {selected.name}</div>
              <div className="mt-2 text-xs font-black text-lime-600">{selected.prefecture??"—"}</div>
              <h2 className="mt-1 text-2xl font-black text-lime-950">{selected.name}</h2>
            </div>
            <button type="button" onClick={()=>setSelectedId(null)} className="grid size-10 place-items-center rounded-full bg-slate-100 font-black text-slate-600">×</button>
          </div>

          {selectedChanges.length?<div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-lime-50 p-4 text-center">
              <div className="text-xs font-black text-lime-700">現在</div>
              <CommunityIcon
                supabase={supabase}
                community={selected}
                className="mx-auto mt-3 size-36 rounded-full border-4 border-white bg-white shadow-md"
                fallbackClassName="text-5xl"
                loading="eager"
              />
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <div className="text-xs font-black text-slate-500">変更前</div>
              <div className="mx-auto mt-3 size-36 overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                {selectedChanges[0]?.previous_avatar_url?<img src={selectedChanges[0].previous_avatar_url} alt="" decoding="async" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-sm font-bold text-slate-400">画像なし</div>}
              </div>
            </div>
          </div>:<div className="mt-5 rounded-3xl bg-lime-50 p-5 text-center">
            <CommunityIcon
              supabase={supabase}
              community={selected}
              className="mx-auto size-40 rounded-full border-4 border-white bg-white shadow-md"
              fallbackClassName="text-5xl"
              loading="eager"
            />
            <div className="mt-4 text-sm font-bold text-lime-800">🍀 アイコン変更なし</div>
          </div>}

          {selectedVersions.length?<div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-black text-slate-500">保存済みデザイン履歴</div>
              <div className="text-[10px] font-black text-slate-400">{selectedVersions.length}件</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedVersions.map(version=>{
                const src=iconVersionUrl(version);
                return <div key={version.id} className="w-24 shrink-0 text-center">
                  <div className={"relative mx-auto size-20 overflow-hidden rounded-full border-4 bg-slate-50 shadow-sm "+(version.is_current?"border-lime-300":"border-white")}>
                    <div className="grid h-full place-items-center text-2xl">🍀</div>
                    {src?<img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event=>{event.currentTarget.style.display="none";}}/>:null}
                  </div>
                  <div className="mt-1 text-[9px] font-bold text-slate-500">{version.is_current?"現在":"過去"}</div>
                </div>;
              })}
            </div>
          </div>:null}

          {selectedChanges.length?<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-black text-amber-700">要確認</div>
            <div className="mt-1 text-sm font-black text-amber-950">アイコンの変更を検知しました</div>
            <div className="mt-2 text-xs font-semibold text-amber-800">検知: {new Date(selectedChanges[0].detected_at).toLocaleString("ja-JP")}</div>
            <div className="mt-1 text-[11px] font-semibold text-amber-700">比較方式: {selectedChanges[0].detection_method==="content_sha256"?"画像内容":"URL（画像取得失敗時の代替）"}</div>
          </div>:null}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {selectedChanges.length?<button type="button" disabled={busy} onClick={markReviewed} className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-amber-950 disabled:opacity-50">{busy?"更新中...":"✓ 確認済みにする"}</button>:null}
            <Link href={"/community/"+selected.id} className={"rounded-2xl bg-lime-400 px-5 py-3 text-center text-sm font-black text-lime-950 "+(!selectedChanges.length?"sm:col-span-2":"")}>Community詳細を見る →</Link>
          </div>
        </section>
      </div>
    </div>:null}
  </main>;
}
