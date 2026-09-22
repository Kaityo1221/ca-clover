"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { useAdminRouteGuard } from "@/lib/use-admin-route-guard";
import { comparePrefectures } from "@/lib/prefecture-order";

type CommunityRow = {
  id: string;
  campfire_community_id: string | null;
  name: string;
  prefecture: string | null;
  member_count: number | null;
  coverage: "complete" | "partial" | "missing";
  fetched_at: string | null;
};

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const { denied: adminDenied } = useAdminRouteGuard({ loading, user, profile });
  const [rows, setRows] = useState<CommunityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile || profile.role !== "admin") return;
    let alive = true;
    setDataLoading(true);

    supabase
      .from("communities")
      .select("id,campfire_community_id,name,prefecture,member_count,coverage,fetched_at")
      .order("name")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else {
          const sorted = ((data as CommunityRow[]) ?? []).sort((a, b) => {
            const areaOrder = comparePrefectures(a.prefecture, b.prefecture);
            if (areaOrder !== 0) return areaOrder;
            return a.name.localeCompare(b.name, "ja");
          });
          setRows(sorted);
        }
        setDataLoading(false);
      });

    return () => { alive = false; };
  }, [loading, profile?.role, supabase, user]);

  if (loading) {
    return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 読み込み中...</main>;
  }

  if (!user) {
    return <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div><div className="text-5xl">🍀</div><h1 className="mt-3 text-2xl font-black text-lime-950">ログインが必要です</h1><Link href="/login" className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-lime-950">Googleでログイン</Link></div>
    </main>;
  }

  if (adminDenied) {
    return <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">🍀 My Communityへ移動中...</main>;
  }

  if (profile?.role === "pending") {
    return <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div><div className="text-5xl">🌱</div><h1 className="mt-3 text-2xl font-black text-lime-950">アカウント確認中</h1><p className="mt-2 text-sm font-semibold text-slate-500">Communityが割り当てられると利用できます。</p></div>
    </main>;
  }

  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm font-black text-lime-700">← CA Clover Home</Link>
    <div className="mt-4">
      <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">全国を見る</span>
      <h1 className="mt-3 text-3xl font-black text-lime-950">🌱 Community一覧</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        全国のCommunityを表示します。
      </p>
    </div>

    {error ? <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

    <div className="clover-card mt-6 overflow-hidden">
      <div className="border-b border-lime-100 px-5 py-4 text-xs font-black text-lime-800">
        {dataLoading ? "読み込み中..." : rows.length + " Community"}
      </div>
      <div className="overflow-x-auto">
        <table className={"w-full text-left text-sm "+(profile?.role==="admin"?"min-w-[760px]":"min-w-[520px]")}>
          <thead className="bg-lime-50 text-[11px] font-black text-lime-800">
            <tr>
              <th className="px-5 py-3">都道府県</th>
              <th className="px-5 py-3">Community</th>
              <th className="px-5 py-3">Member</th>
              {profile?.role==="admin"?<><th className="px-5 py-3">Data</th><th className="px-5 py-3">最終同期</th></>:null}
            </tr>
          </thead>
          <tbody className="divide-y divide-lime-50">
            {rows.map(c=><tr key={c.id} className="bg-white hover:bg-lime-50/70">
              <td className="px-5 py-4 font-bold">{c.prefecture ?? "—"}</td>
              <td className="px-5 py-4">
                <Link href={"/community/"+c.id} className="font-black text-lime-900">{c.name}</Link>
                {profile?.role!=="admin"&&c.coverage!=="complete"?<div className="mt-1 max-w-md text-[11px] font-bold text-amber-700">⚠️ 一部の過去データが未取得のため、全期間集計は参考値です</div>:null}
              </td>
              <td className="px-5 py-4">{c.member_count?.toLocaleString("ja-JP") ?? "未取得"}</td>
              {profile?.role==="admin"?<>
                <td className="px-5 py-4">{c.coverage==="complete"?"● 取得済み":c.coverage==="partial"?"◐ 一部取得":"○ 未取得"}</td>
                <td className="px-5 py-4 text-xs text-slate-500">{c.fetched_at ? new Date(c.fetched_at).toLocaleString("ja-JP") : "—"}</td>
              </>:null}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </main>;
}
