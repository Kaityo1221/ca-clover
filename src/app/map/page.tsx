"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type ActivityMapRow = {
  community_id: string;
  community_name: string;
  prefecture: string | null;
  latitude: number;
  longitude: number;
  meetup_count: number;
  ca_meetup_count: number;
  rsvp_count: number;
  checkin_count: number;
  last_event_at: string | null;
};

type MetricKey =
  | "checkin_count"
  | "meetup_count"
  | "ca_meetup_count"
  | "rsvp_count";

type RecentMeetupRow = {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  event_url: string | null;
  is_ca_meetup: boolean | null;
  checkin_count: number | null;
};

type LeafletMap = {
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
  setView: (latlng: [number, number], zoom: number) => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (content: HTMLElement, options?: Record<string, unknown>) => LeafletMarker;
  openPopup: () => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
};

type LeafletNamespace = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (
    url: string,
    options?: Record<string, unknown>
  ) => { addTo: (map: LeafletMap) => unknown };
  circleMarker: (
    latlng: [number, number],
    options?: Record<string, unknown>
  ) => LeafletMarker;
  latLngBounds: (points: Array<[number, number]>) => unknown;
};

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

const periods = [
  { value: 30, label: "30日" },
  { value: 90, label: "90日" },
  { value: 180, label: "180日" },
  { value: 365, label: "1年" },
  { value: 0, label: "全期間" },
] as const;

const metrics: Array<{ key: MetricKey; label: string; icon: string }> = [
  { key: "checkin_count", label: "Check-in", icon: "✅" },
  { key: "meetup_count", label: "Meetup", icon: "🔥" },
  { key: "ca_meetup_count", label: "CA Meetup", icon: "🍀" },
  { key: "rsvp_count", label: "RSVP", icon: "📨" },
];

let leafletPromise: Promise<LeafletNamespace> | null = null;

function loadLeaflet() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet is browser-only"));
  }
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletNamespace>((resolve, reject) => {
    if (!document.querySelector('link[data-ca-clover-leaflet="css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      link.dataset.caCloverLeaflet = "css";
      document.head.appendChild(link);
    }

    const finish = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leafletの読み込みに失敗しました"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ca-clover-leaflet="js"]'
    );
    if (existing) {
      if (window.L) finish();
      else {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Leafletの読み込みに失敗しました")),
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.dataset.caCloverLeaflet = "js";
    script.onload = finish;
    script.onerror = () => reject(new Error("Leafletの読み込みに失敗しました"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function numberValue(row: ActivityMapRow, key: MetricKey) {
  return Number(row[key]) || 0;
}

function makePopup(row: ActivityMapRow, periodLabel: string) {
  const wrapper = document.createElement("div");
  wrapper.style.minWidth = "240px";
  wrapper.style.fontFamily =
    'Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';

  const area = document.createElement("div");
  area.textContent = row.prefecture ?? "都道府県未設定";
  area.style.fontSize = "11px";
  area.style.fontWeight = "800";
  area.style.color = "#65a30d";

  const title = document.createElement("div");
  title.textContent = row.community_name;
  title.style.marginTop = "4px";
  title.style.fontSize = "14px";
  title.style.fontWeight = "900";
  title.style.color = "#213018";

  const metricsLine = document.createElement("div");
  metricsLine.style.marginTop = "10px";
  metricsLine.style.fontSize = "12px";
  metricsLine.style.lineHeight = "1.65";
  metricsLine.style.color = "#475569";
  metricsLine.textContent =
    periodLabel +
    "　Meetup " +
    row.meetup_count +
    " / CA " +
    row.ca_meetup_count +
    " / RSVP " +
    row.rsvp_count +
    " / Check-in " +
    row.checkin_count;

  const last = document.createElement("div");
  last.style.marginTop = "5px";
  last.style.fontSize = "11px";
  last.style.color = "#64748b";
  last.textContent =
    "最終開催: " +
    (row.last_event_at
      ? new Date(row.last_event_at).toLocaleDateString("ja-JP")
      : "期間内なし");

  const recentTitle = document.createElement("div");
  recentTitle.textContent = "最近のMeetup";
  recentTitle.style.marginTop = "12px";
  recentTitle.style.paddingTop = "10px";
  recentTitle.style.borderTop = "1px solid #ecfccb";
  recentTitle.style.fontSize = "11px";
  recentTitle.style.fontWeight = "900";
  recentTitle.style.color = "#365314";

  const recent = document.createElement("div");
  recent.dataset.loaded = "false";
  recent.style.marginTop = "5px";
  recent.style.fontSize = "11px";
  recent.style.lineHeight = "1.45";
  recent.style.color = "#64748b";
  recent.textContent = "開くと最新5件を読み込みます";

  const link = document.createElement("a");
  link.href = "/community/" + row.community_id;
  link.textContent = "Community詳細を見る →";
  link.style.display = "inline-block";
  link.style.marginTop = "10px";
  link.style.fontSize = "12px";
  link.style.fontWeight = "900";
  link.style.color = "#4d7c0f";

  wrapper.append(area, title, metricsLine, last, recentTitle, recent, link);
  return { wrapper, recent };
}

function renderRecentMeetups(container: HTMLElement, meetups: RecentMeetupRow[]) {
  container.replaceChildren();

  if (meetups.length === 0) {
    container.textContent = "Meetup履歴はありません";
    return;
  }

  for (const meetup of meetups) {
    const item = document.createElement("div");
    item.style.padding = "6px 0";
    item.style.borderBottom = "1px solid #f1f5f9";

    const date = document.createElement("div");
    date.textContent = meetup.starts_at
      ? new Date(meetup.starts_at).toLocaleDateString("ja-JP")
      : "日時未取得";
    date.style.fontSize = "10px";
    date.style.fontWeight = "800";
    date.style.color = "#84a31d";

    const title = meetup.event_url
      ? document.createElement("a")
      : document.createElement("div");
    title.textContent = meetup.title;
    title.style.display = "block";
    title.style.marginTop = "2px";
    title.style.fontSize = "11px";
    title.style.fontWeight = "800";
    title.style.color = "#334155";

    if (meetup.event_url && title instanceof HTMLAnchorElement) {
      title.href = meetup.event_url;
      title.target = "_blank";
      title.rel = "noreferrer";
    }

    const meta = document.createElement("div");
    meta.style.marginTop = "2px";
    meta.style.fontSize = "10px";
    meta.style.color = "#94a3b8";
    meta.textContent =
      (meetup.is_ca_meetup ? "CA Meetup" : "Meetup") +
      " / Check-in " +
      (meetup.checkin_count ?? "—");

    item.append(date, title, meta);
    container.append(item);
  }
}

export default function Page() {
  const { supabase, user, profile, loading } = useAuthProfile();
  const [period, setPeriod] = useState<number>(30);
  const [metric, setMetric] = useState<MetricKey>("checkin_count");
  const [prefecture, setPrefecture] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityMapRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || !user || !profile || profile.role === "pending") return;
    let alive = true;
    setDataLoading(true);
    setError(null);

    supabase
      .rpc("activity_map_summary", { p_days: period } as never)
      .then(({ data, error: queryError }) => {
        if (!alive) return;
        if (queryError) {
          setRows([]);
          setError(queryError.message);
        } else {
          setRows((data as ActivityMapRow[] | null) ?? []);
        }
        setDataLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [loading, user, profile?.role, period, supabase]);

  const periodLabel =
    periods.find((item) => item.value === period)?.label ?? "期間";
  const showActivityScale = profile?.role === "admin";

  const prefectures = useMemo(
    () =>
      [...new Set(rows.map((row) => row.prefecture).filter((value): value is string => Boolean(value)))]
        .sort((a, b) => a.localeCompare(b, "ja")),
    [rows]
  );

  const visibleRows = useMemo(
    () =>
      prefecture === "all"
        ? rows
        : rows.filter((row) => row.prefecture === prefecture),
    [rows, prefecture]
  );

  const searchResults = useMemo(() => {
    const query = search.normalize("NFKC").trim().toLowerCase();
    if (!query) return [];
    return rows
      .filter((row) => {
        const name = row.community_name.normalize("NFKC").toLowerCase();
        const area = (row.prefecture ?? "").normalize("NFKC").toLowerCase();
        return name.includes(query) || area.includes(query);
      })
      .slice(0, 8);
  }, [rows, search]);

  useEffect(() => {
    if (prefecture !== "all" && !prefectures.includes(prefecture)) {
      setPrefecture("all");
    }
  }, [prefecture, prefectures]);

  const summary = useMemo(() => {
    const active = visibleRows.filter((row) => numberValue(row, metric) > 0).length;
    const total = visibleRows.reduce((sum, row) => sum + numberValue(row, metric), 0);
    const latest = visibleRows.reduce<string | null>((current, row) => {
      if (!row.last_event_at) return current;
      if (!current) return row.last_event_at;
      return new Date(row.last_event_at) > new Date(current)
        ? row.last_event_at
        : current;
    }, null);
    return { active, total, latest };
  }, [visibleRows, metric]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || visibleRows.length === 0) return;

    let disposed = false;
    let map: LeafletMap | null = null;

    loadLeaflet()
      .then((L) => {
        if (disposed || !mapElementRef.current) return;

        map = L.map(mapElementRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        const points = visibleRows.map(
          (row) => [row.latitude, row.longitude] as [number, number]
        );
        map.fitBounds(L.latLngBounds(points), {
          padding: [28, 28],
          maxZoom: 7,
        });

        const maxValue = showActivityScale
          ? Math.max(1, ...visibleRows.map((row) => numberValue(row, metric)))
          : 1;
        const markerByCommunity = new Map<string, LeafletMarker>();

        for (const row of visibleRows) {
          const value = numberValue(row, metric);
          const scaled =
            showActivityScale && value > 0
              ? Math.sqrt(value / maxValue)
              : 0;
          const radius = showActivityScale
            ? value > 0
              ? 7 + scaled * 17
              : 5
            : 9;
          const fillOpacity = showActivityScale
            ? value > 0
              ? 0.38 + scaled * 0.5
              : 0.16
            : value > 0
              ? 0.68
              : 0.22;

          const popup = makePopup(row, periodLabel);
          const marker = L.circleMarker([row.latitude, row.longitude], {
            radius,
            color: value > 0 ? "#4d7c0f" : "#94a3b8",
            weight: value > 0 ? 1.6 : 1,
            fillColor: value > 0 ? "#84cc16" : "#cbd5e1",
            fillOpacity,
          })
            .bindPopup(popup.wrapper, {
              maxWidth: 360,
            })
            .on("popupopen", () => {
              if (popup.recent.dataset.loaded === "loading" || popup.recent.dataset.loaded === "true") {
                return;
              }
              popup.recent.dataset.loaded = "loading";
              popup.recent.textContent = "読み込み中…";

              supabase
                .from("meetups")
                .select("id,title,starts_at,location,event_url,is_ca_meetup,checkin_count")
                .eq("community_id", row.community_id)
                .order("starts_at", { ascending: false })
                .limit(5)
                .then(({ data, error: meetupError }) => {
                  if (meetupError) {
                    popup.recent.dataset.loaded = "false";
                    popup.recent.textContent = "Meetupを読み込めませんでした";
                    return;
                  }
                  popup.recent.dataset.loaded = "true";
                  renderRecentMeetups(
                    popup.recent,
                    (data as RecentMeetupRow[] | null) ?? []
                  );
                });
            })
            .addTo(map);

          markerByCommunity.set(row.community_id, marker);
        }

        if (selectedCommunityId) {
          const selected = visibleRows.find(
            (row) => row.community_id === selectedCommunityId
          );
          const selectedMarker = markerByCommunity.get(selectedCommunityId);
          if (selected && selectedMarker) {
            map.setView([selected.latitude, selected.longitude], 14);
            selectedMarker.openPopup();
          }
        }
      })
      .catch((loadError: unknown) => {
        if (disposed) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "地図ライブラリの読み込みに失敗しました"
        );
      });

    return () => {
      disposed = true;
      if (map) map.remove();
    };
  }, [visibleRows, metric, periodLabel, showActivityScale, selectedCommunityId, supabase]);

  if (loading) {
    return (
      <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">
        🍀 読み込み中...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-black text-lime-950">
            ログインが必要です
          </h1>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-full bg-lime-400 px-5 py-3 text-sm font-black"
          >
            Googleでログイン
          </Link>
        </div>
      </main>
    );
  }

  if (profile?.role === "pending") {
    return (
      <main className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <div className="text-5xl">🌱</div>
          <h1 className="mt-3 text-2xl font-black text-lime-950">
            アカウント確認中
          </h1>
        </div>
      </main>
    );
  }

  const metricLabel =
    metrics.find((item) => item.key === metric)?.label ?? "Activity";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Link href="/" className="text-sm font-black text-lime-700">
        ← CA Clover Home
      </Link>
      <span className="mt-4 block w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-900">
        全国を見る
      </span>
      <h1 className="mt-3 text-3xl font-black text-lime-950">
        🗾 Activity Map
      </h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        {profile?.role === "admin"
          ? "全国Communityの活動量を地図で比較"
          : "割り当てCommunityの活動量を地図で比較"}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {periods.map((item) => (
          <button
            key={item.value}
            onClick={() => setPeriod(item.value)}
            className={period === item.value ? "clover-pill active" : "clover-pill"}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="prefecture-filter" className="text-xs font-black text-slate-500">
          都道府県
        </label>
        <select
          id="prefecture-filter"
          value={prefecture}
          onChange={(event) => setPrefecture(event.target.value)}
          className="w-full rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-black text-lime-900 outline-none focus:border-lime-400 sm:w-64"
        >
          <option value="all">全国</option>
          {prefectures.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="text-xs font-bold text-slate-400">
          {prefecture === "all" ? "全国表示" : prefecture + "を表示"}
        </span>
      </div>

      <div className="relative mt-3 max-w-xl">
        <label htmlFor="community-search" className="sr-only">
          Community検索
        </label>
        <div className="flex gap-2">
          <input
            id="community-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedCommunityId(null);
            }}
            placeholder="Community名・都道府県で検索"
            className="min-w-0 flex-1 rounded-2xl border border-lime-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-400"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCommunityId(null);
              }}
              className="rounded-2xl border border-lime-200 bg-white px-4 text-xs font-black text-lime-700"
            >
              クリア
            </button>
          ) : null}
        </div>

        {search.trim() && !selectedCommunityId ? (
          <div className="absolute z-[1000] mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-lime-100 bg-white p-2 shadow-xl">
            {searchResults.length ? (
              searchResults.map((row) => (
                <button
                  key={row.community_id}
                  type="button"
                  onClick={() => {
                    setSearch(row.community_name);
                    setPrefecture(row.prefecture ?? "all");
                    setSelectedCommunityId(row.community_id);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-lime-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-lime-950">
                      {row.community_name}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                      {row.prefecture ?? "都道府県未設定"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-black text-lime-600">
                    地図へ →
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-xs font-bold text-slate-400">
                該当するCommunityはありません
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {metrics.map((item) => (
          <button
            key={item.key}
            onClick={() => setMetric(item.key)}
            className={
              metric === item.key ? "clover-pill active" : "clover-pill"
            }
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="clover-card p-5">
          <div className="text-xs font-black text-slate-500">
            表示Community
          </div>
          <div className="mt-1 text-3xl font-black text-lime-950">
            {dataLoading ? "…" : visibleRows.length}
          </div>
        </div>
        <div className="clover-card p-5">
          <div className="text-xs font-black text-slate-500">
            {metricLabel}あり / {periodLabel}
          </div>
          <div className="mt-1 text-3xl font-black text-lime-950">
            {dataLoading ? "…" : summary.active}
          </div>
        </div>
        <div className="clover-card p-5">
          <div className="text-xs font-black text-slate-500">
            {metricLabel}合計 / {periodLabel}
          </div>
          <div className="mt-1 text-3xl font-black text-lime-950">
            {dataLoading ? "…" : summary.total.toLocaleString("ja-JP")}
          </div>
        </div>
      </div>

      <section className="clover-card mt-5 overflow-hidden p-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
          <div>
            <h2 className="font-black text-lime-950">
              {metricLabel} Activity
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {showActivityScale
                ? "円が大きく濃いほど活動量が多いCommunityです。検索するとCommunityへズームし、ポップアップで最近のMeetupを確認できます。"
                : "Communityはすべて同じ大きさの円で表示します。検索するとCommunityへズームし、ポップアップで最近のMeetupを確認できます。"}
            </p>
          </div>
          <div className="text-right text-[11px] font-bold text-slate-400">
            <div>{dataLoading ? "集計中…" : visibleRows.length + " Community"}</div>
            <div>
              最新開催{" "}
              {summary.latest
                ? new Date(summary.latest).toLocaleDateString("ja-JP")
                : "—"}
            </div>
          </div>
        </div>

        <div
          ref={mapElementRef}
          className="h-[62vh] min-h-[520px] w-full overflow-hidden rounded-[20px] bg-lime-50"
          aria-label="全国Community Activity Map"
        />
      </section>

      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">
        地図へ送るのはCommunityごとの集計結果だけです。Meetup全件はブラウザへ読み込まず、
        期間切替もPostgres側で集計します。
      </div>
    </main>
  );
}
