"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { useAdminRouteGuard } from "@/lib/use-admin-route-guard";

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const { denied: adminDenied } = useAdminRouteGuard({ loading, user, profile });
  const [counts, setCounts] = useState({ ca: 0, communities: 0, linked: 0, unresolved: 0 });
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (loading || !user || profile?.role !== "admin") return;
    let alive = true;

    async function load() {
      setDataLoading(true);
      const [{ data: caRows }, { data: communityRows }, { data: linkRows }] = await Promise.all([
        supabase.from("ca_members").select("id"),
        supabase.from("communities").select("id"),
        supabase.from("community_ca_members").select("ca_member_id"),
      ]);

      if (!alive) return;
      const caIds = ((caRows as { id: string }[] | null) ?? []).map(row => row.id);
      const linkedIds = new Set(((linkRows as { ca_member_id: string }[] | null) ?? []).map(row => row.ca_member_id));
      setCounts({
        ca: caIds.length,
        communities: ((communityRows as { id: string }[] | null) ?? []).length,
        linked: linkedIds.size,
        unresolved: caIds.filter(id => !linkedIds.has(id)).length,
      });
      setDataLoading(false);
    }

    load();
    return () => { alive = false; };
  }, [loading, profile?.role, supabase, user]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  if (!user) return <main className="grid min-h-[70vh] place-items-center px-4 text-center"><div><h1 className="text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black">Googleでログイン</Link></div></main>;
  if (adminDenied) return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 My Communityへ移動中...</main>;

  return <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">活動を見る</span>
    <h1 className="mt-3 text-3xl font-black text-lime-950">🧾 Data Coverage</h1>
    <p className="mt-2 text-sm font-semibold text-slate-500">{dataLoading ? "実DBを確認中..." : "CA Clover Supabaseの現在値"}</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="clover-card p-6"><div className="text-xs font-black text-emerald-700">CA MASTER</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.ca}</div><div className="mt-2 text-xs text-slate-500">CA登録済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-lime-700">COMMUNITY</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.communities}</div><div className="mt-2 text-xs text-slate-500">Community解決済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-sky-700">LINKED CA</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.linked}</div><div className="mt-2 text-xs text-slate-500">Community紐付け済み</div></div>
      <div className="clover-card p-6"><div className="text-xs font-black text-amber-700">UNRESOLVED</div><div className="mt-2 text-4xl font-black text-lime-950">{counts.unresolved}</div><div className="mt-2 text-xs text-slate-500">紐付け要確認</div></div>
    </div>
  </main>;
}
